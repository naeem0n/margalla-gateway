import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb, newId, now, nextClientId } from "../db/index.js";
import { authRequired, requireRole, stripUser } from "../middleware/auth.js";
import type { User } from "../db/types.js";

function validatePhone(phone: string | null | undefined): boolean {
  if (!phone) return true;
  const clean = phone.replace(/[\s\-()]/g, "");
  return /^\+?\d{10,15}$/.test(clean);
}

function validateCNIC(cnic: string | null | undefined): boolean {
  if (!cnic) return true;
  const clean = cnic.replace(/[\s\-]/g, "");
  return /^\d{13}$/.test(clean);
}

const router = Router();

async function triggerWelcomeNotification(db: any, user: any, plainPassword: string) {
  try {
    const body = `Dear ${user.full_name}, welcome to Margalla Gateway! Your Resident Portal account has been set up. Resident ID: ${user.client_id}, Password: ${plainPassword}. You can log in at the Resident Portal to view your statements and billing ledger.`;
    const logId = newId();
    const nowStr = now();
    await db.run(
      `INSERT INTO notification_logs (
        id, channel, template_key, recipient_phone, recipient_user_id,
        subject, body, status, provider, provider_message_id, error_message, trigger_type, reference_id, sent_at, created_at
      ) VALUES (?, 'whatsapp', 'resident_welcome', ?, ?, 'Resident Portal Access Credentials', ?, 'sent', 'mock', ?, NULL, 'credentials', ?, ?, ?)`,
      [logId, user.phone || '0000000000', user.id, body, `mock_${Date.now()}`, user.id, nowStr, nowStr]
    );
    console.log(`[WhatsApp Welcome Sent] To: ${user.phone || '0000000000'} | Body: ${body}`);
  } catch (err: any) {
    console.error("[Welcome Notification Alert] Failed to trigger notification log:", err.message);
  }
}

function randomPassword(username: string = 'user') {
  const cleanName = username.trim() ? username.trim().toLowerCase() : 'user';
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${cleanName}@${randomDigits}`;
}

async function syncApartmentStatuses() {
  try {
    const db = await getDb();
    // 1. Reset all apartments to available
    await db.run("UPDATE apartments SET status = 'available'");
    // 2. Find all distinct apartment numbers assigned to active residents
    const occupied = await db.query<{ apartment_no: string }>(
      "SELECT DISTINCT apartment_no FROM users WHERE role = 'resident' AND apartment_no IS NOT NULL AND apartment_no != ''"
    );
    // 3. Mark assigned apartments as occupied
    for (const unit of occupied) {
      if (unit.apartment_no) {
        await db.run(
          "UPDATE apartments SET status = 'occupied' WHERE UPPER(number) = ?",
          [unit.apartment_no.trim().toUpperCase()]
        );
      }
    }
    console.log("[Apartment Sync] Synced occupied status for units:", occupied.map(u => u.apartment_no));
  } catch (err) {
    console.error("[Apartment Sync] Error during apartment status sync:", err);
  }
}

router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  const db = await getDb();
  const filterRole = req.query.role as string;
  let query = "SELECT * FROM users WHERE role IN ('resident') ORDER BY created_at DESC";
  
  if (filterRole === "thirdparty") {
    query = "SELECT * FROM users WHERE role = 'thirdparty' ORDER BY created_at DESC";
  } else if (filterRole === "all") {
    query = "SELECT * FROM users WHERE role IN ('resident', 'thirdparty') ORDER BY created_at DESC";
  }
  
  const users = await db.query<User>(query);
  res.json({ users: users.map((u) => stripUser(u as unknown as Record<string, unknown>)) });
});

router.post("/generate", authRequired, requireRole("admin"), async (req, res) => {
  const { full_name, email, apartment_no, phone, role, permissions } = req.body ?? {};
  if (!full_name || !email || !role) {
    return res.status(400).json({ error: "full_name, email, and role required" });
  }
  if (!["resident", "thirdparty"].includes(role)) {
    return res.status(400).json({ error: "Role must be resident or thirdparty" });
  }
  if (phone && !validatePhone(phone)) {
    return res.status(400).json({ error: `Invalid phone number format: ${phone}. Must contain 10-15 digits.` });
  }

  const db = await getDb();
  const existing = await db.queryOne<User>("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
  const countRow = await db.queryOne<{ c: number }>(
    "SELECT COUNT(*) as c FROM users WHERE role = ?",
    [role],
  );
  const client_id = existing ? existing.client_id : nextClientId(role, Number(countRow?.c ?? 0));
  const password = randomPassword(client_id);
  const hash = bcrypt.hashSync(password, 10);
  const ts = now();

  if (existing) {
    const finalScopeProfile = existing.role === "thirdparty" ? "Third-Party Hidden Vault" : "Resident Hub";
    await db.run(
      `UPDATE users SET password_hash = ?, full_name = ?, apartment_no = ?, phone = ?, scope_profile = ?, updated_at = ? WHERE id = ?`,
      [hash, full_name, apartment_no !== undefined ? apartment_no : existing.apartment_no, phone !== undefined ? phone : existing.phone, finalScopeProfile, ts, existing.id],
    );
    const updated = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [existing.id]);
    if (updated) {
      try { await db.enqueueSync("users", existing.id, "update", updated); } catch (_) {}
      if (password) {
        await triggerWelcomeNotification(db, updated, password);
      }
    }
    if (db.mode === "sqlite") {
      try {
        const { db: rawDb, syncResidentErcData } = await import("../db/sqlite.js");
        syncResidentErcData(rawDb, existing.id);
      } catch (err) {
        console.error("syncResidentErcData failed in generate update:", err);
      }
    }
    await syncApartmentStatuses();
    return res.json({
      reused: true,
      client_id: existing.client_id,
      email: existing.email,
      password,
      role: existing.role,
    });
  }

  const id = newId();
  const perms = JSON.stringify(permissions ?? {});

  const finalScopeProfile = role === "thirdparty" ? "Third-Party Hidden Vault" : "Resident Hub";
  await db.run(
    `INSERT INTO users (id, client_id, email, password_hash, full_name, apartment_no, phone, role, permissions_json, scope_profile, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, client_id, email.toLowerCase(), hash, full_name, apartment_no ?? null, phone ?? null, role, perms, finalScopeProfile, ts, ts],
  );
  const inserted = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [id]);
  if (inserted) {
    try { await db.enqueueSync("users", id, "insert", inserted); } catch (_) {}
    if (password) {
      await triggerWelcomeNotification(db, inserted, password);
    }
  }
  if (db.mode === "sqlite") {
    try {
      const { db: rawDb, syncResidentErcData } = await import("../db/sqlite.js");
      syncResidentErcData(rawDb, id);
    } catch (err) {
      console.error("syncResidentErcData failed in generate insert:", err);
    }
  }

  await syncApartmentStatuses();
  res.json({ client_id, email: email.toLowerCase(), password, role });
});

router.post("/create-tenant", authRequired, requireRole("admin"), async (req, res) => {
  const { id, full_name, email, apartment_no, phone, client_id, password, cnic, rent_amount, security_deposit, agreement_url, role, permissions_json, apartment_type } = req.body ?? {};
  if (!full_name || !email || !client_id) {
    return res.status(400).json({ error: "full_name, email, and client_id required" });
  }
  if (phone && !validatePhone(phone)) {
    return res.status(400).json({ error: `Invalid phone number format: ${phone}. Must contain 10-15 digits.` });
  }
  if (cnic && !validateCNIC(cnic)) {
    return res.status(400).json({ error: `Invalid CNIC format: ${cnic}. Must be exactly 13 digits.` });
  }

  const db = await getDb();

  // Check uniqueness constraints
  const tempUserId = id || "non-existent-temp-id";
  if (cnic) {
    const dupCnic = await db.queryOne<User>("SELECT id FROM users WHERE cnic = ? AND id != ? AND id != ?", [cnic, tempUserId, id || '']);
    if (dupCnic) return res.status(400).json({ error: `Duplicate resident CNIC: ${cnic} is already registered.` });
  }
  const dupEmail = await db.queryOne<User>("SELECT id FROM users WHERE LOWER(email) = ? AND id != ? AND id != ?", [email.toLowerCase(), tempUserId, id || '']);
  if (dupEmail) return res.status(400).json({ error: `Duplicate resident Email: ${email} is already registered.` });

  const dupClientId = await db.queryOne<User>("SELECT id FROM users WHERE client_id = ? AND id != ? AND id != ?", [client_id.toUpperCase(), tempUserId, id || '']);
  if (dupClientId) return res.status(400).json({ error: `Duplicate resident Client ID: ${client_id} is already registered.` });
  
  const existing = await db.queryOne<User>(
    "SELECT * FROM users WHERE email = ? OR client_id = ? LIMIT 1",
    [email.toLowerCase(), client_id.toUpperCase()]
  );
  
  const ts = now();
  const userId = id || newId();
  const finalRole = role === "thirdparty" ? "thirdparty" : "resident";
  const finalPerms = permissions_json || "{}";

  if (existing) {
    let hash = existing.password_hash;
    if (password) {
      hash = bcrypt.hashSync(password.trim(), 10);
    }
    const finalScopeProfile = finalRole === "thirdparty" ? "Third-Party Hidden Vault" : "Resident Hub";
    
    await db.run(
      `UPDATE users SET password_hash = ?, full_name = ?, apartment_no = ?, phone = ?, cnic = ?, rent_amount = ?, security_deposit = ?, agreement_url = ?, permissions_json = ?, role = ?, apartment_type = ?, scope_profile = ?, fixed_maintenance = ?, daily_rent_rate = ?, joining_date = ?, agreement_end_date = ?, elec_prev = ?, elec_curr = ?, elec_rate = ?, gas_prev = ?, gas_curr = ?, gas_rate = ?, water_prev = ?, water_curr = ?, water_rate = ?, parking_rent = ?, stall_rent = ?, other_income = ?, updated_at = ? WHERE id = ?`,
      [hash, full_name, apartment_no !== undefined ? apartment_no : existing.apartment_no, phone !== undefined ? phone : existing.phone, cnic !== undefined ? cnic : existing.cnic, rent_amount !== undefined ? Number(rent_amount) : existing.rent_amount, security_deposit !== undefined ? Number(security_deposit) : existing.security_deposit, agreement_url !== undefined ? agreement_url : existing.agreement_url, finalPerms, finalRole, apartment_type !== undefined ? apartment_type : existing.apartment_type, finalScopeProfile, (req.body.fixed_maintenance !== undefined ? Number(req.body.fixed_maintenance) : existing.fixed_maintenance), (req.body.daily_rent_rate !== undefined ? Number(req.body.daily_rent_rate) : existing.daily_rent_rate), req.body.joining_date !== undefined ? req.body.joining_date : existing.joining_date, req.body.agreement_end_date !== undefined ? req.body.agreement_end_date : existing.agreement_end_date, (req.body.elec_prev !== undefined ? Number(req.body.elec_prev) : existing.elec_prev), (req.body.elec_curr !== undefined ? Number(req.body.elec_curr) : existing.elec_curr), (req.body.elec_rate !== undefined ? Number(req.body.elec_rate) : existing.elec_rate), (req.body.gas_prev !== undefined ? Number(req.body.gas_prev) : existing.gas_prev), (req.body.gas_curr !== undefined ? Number(req.body.gas_curr) : existing.gas_curr), (req.body.gas_rate !== undefined ? Number(req.body.gas_rate) : existing.gas_rate), (req.body.water_prev !== undefined ? Number(req.body.water_prev) : existing.water_prev), (req.body.water_curr !== undefined ? Number(req.body.water_curr) : existing.water_curr), (req.body.water_rate !== undefined ? Number(req.body.water_rate) : existing.water_rate), (req.body.parking_rent !== undefined ? Number(req.body.parking_rent) : existing.parking_rent), (req.body.stall_rent !== undefined ? Number(req.body.stall_rent) : existing.stall_rent), (req.body.other_income !== undefined ? Number(req.body.other_income) : existing.other_income), ts, existing.id]
    );
    const updated = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [existing.id]);
    if (updated) {
      try { await db.enqueueSync("users", existing.id, "update", updated); } catch (_) {}
      if (password) {
        await triggerWelcomeNotification(db, updated, password);
      }
    }
    if (db.mode === "sqlite") {
      try {
        const { db: rawDb, syncResidentErcData } = await import("../db/sqlite.js");
        syncResidentErcData(rawDb, existing.id);
      } catch (err) {
        console.error("syncResidentErcData failed in create-tenant update:", err);
      }
    }

    if (db.mode === "postgres") {
      try {
        let pgHash = hash;
        if (!pgHash.startsWith("$2a$") && !pgHash.startsWith("$2b$")) {
          pgHash = bcrypt.hashSync(pgHash, 10);
        }
        await db.run(
          `UPDATE public.profiles SET client_id = ?, full_name = ?, apartment_no = ?, phone = ?, rent_amount = ?, security_deposit = ?, agreement_url = ?, scope_profile = ? WHERE id = ?`,
          [client_id.toUpperCase(), full_name, apartment_no !== undefined ? apartment_no : existing.apartment_no, phone !== undefined ? phone : existing.phone, rent_amount !== undefined ? Number(rent_amount) : existing.rent_amount, security_deposit !== undefined ? Number(security_deposit) : existing.security_deposit, agreement_url !== undefined ? agreement_url : existing.agreement_url, finalScopeProfile, existing.id]
        );
      } catch (profErr) {
        console.error("Postgres update profile error:", profErr);
      }
    }

    return res.json({ success: true, reused: true, client_id: existing.client_id, password });
  }

  const hash = bcrypt.hashSync((password || "123456").trim(), 10);

  const finalScopeProfile = finalRole === "thirdparty" ? "Third-Party Hidden Vault" : "Resident Hub";
  await db.run(
    `INSERT INTO users (id, client_id, email, password_hash, full_name, apartment_no, phone, role, permissions_json, cnic, rent_amount, security_deposit, agreement_url, apartment_type, scope_profile, is_active, fixed_maintenance, daily_rent_rate, joining_date, agreement_end_date, elec_prev, elec_curr, elec_rate, gas_prev, gas_curr, gas_rate, water_prev, water_curr, water_rate, parking_rent, stall_rent, other_income, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, client_id.toUpperCase(), email.toLowerCase(), hash, full_name, apartment_no ?? null, phone ?? null, finalRole, finalPerms, cnic ?? null, rent_amount !== undefined ? Number(rent_amount) : 0, security_deposit !== undefined ? Number(security_deposit) : 0, agreement_url ?? null, apartment_type ?? null, finalScopeProfile, (req.body.fixed_maintenance !== undefined ? Number(req.body.fixed_maintenance) : 0), (req.body.daily_rent_rate !== undefined ? Number(req.body.daily_rent_rate) : 0), req.body.joining_date ?? null, req.body.agreement_end_date ?? null, (req.body.elec_prev !== undefined ? Number(req.body.elec_prev) : 0), (req.body.elec_curr !== undefined ? Number(req.body.elec_curr) : 0), (req.body.elec_rate !== undefined ? Number(req.body.elec_rate) : 100), (req.body.gas_prev !== undefined ? Number(req.body.gas_prev) : 0), (req.body.gas_curr !== undefined ? Number(req.body.gas_curr) : 0), (req.body.gas_rate !== undefined ? Number(req.body.gas_rate) : 0), (req.body.water_prev !== undefined ? Number(req.body.water_prev) : 0), (req.body.water_curr !== undefined ? Number(req.body.water_curr) : 0), (req.body.water_rate !== undefined ? Number(req.body.water_rate) : 80), (req.body.parking_rent !== undefined ? Number(req.body.parking_rent) : 0), (req.body.stall_rent !== undefined ? Number(req.body.stall_rent) : 0), (req.body.other_income !== undefined ? Number(req.body.other_income) : 0), ts, ts],
  );

    const inserted = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [userId]);
    if (inserted) {
      try { await db.enqueueSync("users", userId, "insert", inserted); } catch (_) {}
      if (password) {
        await triggerWelcomeNotification(db, inserted, password);
      }
    }
    if (db.mode === "sqlite") {
      try {
        const { db: rawDb, syncResidentErcData } = await import("../db/sqlite.js");
        syncResidentErcData(rawDb, userId);
      } catch (err) {
        console.error("syncResidentErcData failed in create-tenant insert:", err);
      }
    }

  if (db.mode === "postgres") {
    try {
      let pgHash = hash;
      if (!pgHash.startsWith("$2a$") && !pgHash.startsWith("$2b$")) {
        pgHash = bcrypt.hashSync(pgHash, 10);
      }
      await db.run(
        `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role, instance_id)
         VALUES (?, ?, ?, NOW(), ?, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
         ON CONFLICT (id) DO NOTHING`,
        [userId, email.toLowerCase(), pgHash, JSON.stringify({ full_name, phone })]
      );
    } catch (authErr) {
      console.error("Postgres auth.users insertion error:", authErr);
    }

    try {
      await db.run(
        `INSERT INTO public.user_roles (user_id, role)
         VALUES (?, 'resident')
         ON CONFLICT (user_id, role) DO NOTHING`,
        [userId]
      );
    } catch (roleErr) {
      console.error("Postgres user_roles insertion error:", roleErr);
    }

    try {
      await db.run(
        `INSERT INTO public.profiles (id, client_id, full_name, apartment_no, phone, is_approved, rent_amount, security_deposit, agreement_url, scope_profile, created_at)
         VALUES (?, ?, ?, ?, ?, true, ?, ?, ?, ?, NOW())
         ON CONFLICT (id) DO UPDATE SET
           client_id = EXCLUDED.client_id,
           full_name = EXCLUDED.full_name,
           apartment_no = EXCLUDED.apartment_no,
           phone = EXCLUDED.phone,
           rent_amount = EXCLUDED.rent_amount,
           security_deposit = EXCLUDED.security_deposit,
           agreement_url = EXCLUDED.agreement_url,
           scope_profile = EXCLUDED.scope_profile`,
        [userId, client_id.toUpperCase(), full_name, apartment_no ?? null, phone ?? null, rent_amount !== undefined ? Number(rent_amount) : 0, security_deposit !== undefined ? Number(security_deposit) : 0, agreement_url ?? null, finalScopeProfile]
      );
    } catch (profErr) {
      console.error("Postgres profiles insertion error:", profErr);
    }
  }

  await syncApartmentStatuses();
  res.json({ success: true, client_id: client_id.toUpperCase(), password });
});

router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const { is_active, permissions, full_name, apartment_no, phone, client_id, email } = req.body ?? {};
  const db = await getDb();
  const ts = now();

  const existingUser = await db.queryOne<{ id: string }>(
    "SELECT id FROM users WHERE id = ? OR (client_id = ? AND client_id IS NOT NULL)",
    [req.params.id, client_id ? client_id.toUpperCase() : null]
  );

  if (existingUser) {
    await db.run(
      `UPDATE users SET
        id = ?,
        is_active = COALESCE(?, is_active),
        permissions_json = COALESCE(?, permissions_json),
        full_name = COALESCE(?, full_name),
        apartment_no = COALESCE(?, apartment_no),
        phone = COALESCE(?, phone),
        updated_at = ?
       WHERE id = ?`,
      [
        req.params.id,
        is_active !== undefined ? is_active : null,
        permissions ? JSON.stringify(permissions) : null,
        full_name ?? null,
        apartment_no ?? null,
        phone ?? null,
        ts,
        existingUser.id,
      ],
    );
    const updated = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (updated) {
      try { await db.enqueueSync("users", req.params.id, "update", updated); } catch (_) {}
    }
    if (db.mode === "sqlite") {
      try {
        const { db: rawDb, syncResidentErcData } = await import("../db/sqlite.js");
        syncResidentErcData(rawDb, req.params.id);
      } catch (err) {
        console.error("syncResidentErcData failed in patch update:", err);
      }
    }
  } else {
    const finalClientId = client_id || `RES-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalEmail = email || `${finalClientId.toLowerCase()}@margalla.local`;
    const finalFullName = full_name || `Resident ${finalClientId}`;
    const perms = JSON.stringify(permissions ?? {});
    const activeStatus = is_active !== undefined ? is_active : 1;

    await db.run(
      `INSERT INTO users (id, client_id, email, password_hash, full_name, apartment_no, phone, role, permissions_json, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 'NOPASSWORD_YET', ?, ?, ?, 'resident', ?, ?, ?, ?)`,
      [
        req.params.id,
        finalClientId.toUpperCase(),
        finalEmail.toLowerCase(),
        finalFullName,
        apartment_no ?? null,
        phone ?? null,
        perms,
        activeStatus,
        ts,
        ts,
      ]
    );
    const inserted = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (inserted) {
      try { await db.enqueueSync("users", req.params.id, "insert", inserted); } catch (_) {}
    }
    if (db.mode === "sqlite") {
      try {
        const { db: rawDb, syncResidentErcData } = await import("../db/sqlite.js");
        syncResidentErcData(rawDb, req.params.id);
      } catch (err) {
        console.error("syncResidentErcData failed in patch insert:", err);
      }
    }
  }
  await syncApartmentStatuses();
  res.json({ ok: true });
});

router.post("/:id/reset-password", authRequired, requireRole("admin"), async (req, res) => {
  const { client_id, full_name, apartment_no, phone, email } = req.body ?? {};
  const db = await getDb();
  const ts = now();

  // Find if user exists by id or client_id
  const existingUser = await db.queryOne<{ id: string; client_id: string }>(
    "SELECT id, client_id FROM users WHERE id = ? OR (client_id = ? AND client_id IS NOT NULL)",
    [req.params.id, client_id ? client_id.toUpperCase() : null]
  );

  const targetUsername = client_id || existingUser?.client_id || 'user';
  const password = randomPassword(targetUsername);
  const hash = bcrypt.hashSync(password, 10);

  if (existingUser) {
    const userRoleQuery = await db.queryOne<{ role: string }>("SELECT role FROM users WHERE id = ?", [existingUser.id]);
    const finalScopeProfile = userRoleQuery?.role === "thirdparty" ? "Third-Party Hidden Vault" : "Resident Hub";
    // Update password, and align ID if different
    await db.run(
      "UPDATE users SET id = ?, password_hash = ?, scope_profile = ?, updated_at = ? WHERE id = ?",
      [req.params.id, hash, finalScopeProfile, ts, existingUser.id]
    );
    const updated = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (updated) {
      try { await db.enqueueSync("users", req.params.id, "update", updated); } catch (_) {}
      await triggerWelcomeNotification(db, updated, password);
    }
  } else {
    // Insert new user if they don't exist anywhere in SQLite
    const isThirdParty = client_id?.toUpperCase().startsWith("TP-") || client_id?.toUpperCase().startsWith("VND-");
    const finalRole = isThirdParty ? "thirdparty" : "resident";
    const finalClientId = client_id || `${finalRole === "thirdparty" ? "TP" : "RES"}-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalEmail = email || `${finalClientId.toLowerCase()}@margalla.local`;
    const finalFullName = full_name || `${finalRole === "thirdparty" ? "Partner" : "Resident"} ${finalClientId}`;
    const finalScopeProfile = finalRole === "thirdparty" ? "Third-Party Hidden Vault" : "Resident Hub";
    
    await db.run(
      `INSERT INTO users (id, client_id, email, password_hash, full_name, apartment_no, phone, role, permissions_json, scope_profile, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?)`,
      [
        req.params.id,
        finalClientId.toUpperCase(),
        finalEmail.toLowerCase(),
        hash,
        finalFullName,
        apartment_no ?? null,
        phone ?? null,
        finalRole,
        finalScopeProfile,
        ts,
        ts,
      ]
    );
    const inserted = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (inserted) {
      try { await db.enqueueSync("users", req.params.id, "insert", inserted); } catch (_) {}
      await triggerWelcomeNotification(db, inserted, password);
    }
  }

  res.json({ password });
});

router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const db = await getDb();
    const existing = await db.queryOne("SELECT id FROM users WHERE id = ?", [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    // 1. Get ledger entry IDs before deleting them
    const ledgerEntries = await db.query<{ id: string }>(
      "SELECT id FROM ledger_entries WHERE user_id = ?",
      [req.params.id]
    );

    // 2. Cascade delete references in child tables
    await db.run("DELETE FROM leases WHERE resident_id IN (SELECT id FROM residents WHERE user_id = ?)", [req.params.id]);
    await db.run("DELETE FROM residents WHERE user_id = ?", [req.params.id]);
    await db.run("UPDATE parking SET assigned_tenant_id = NULL, status = 'available' WHERE assigned_tenant_id = ?", [req.params.id]);
    await db.run("DELETE FROM ledger_entries WHERE user_id = ?", [req.params.id]);
    await db.run("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoice_headers WHERE tenant_id = ?)", [req.params.id]);
    await db.run("DELETE FROM invoice_headers WHERE tenant_id = ?", [req.params.id]);
    await db.run("DELETE FROM invoices WHERE tenant_id = ?", [req.params.id]);
    await db.run("DELETE FROM payments WHERE tenant_id = ?", [req.params.id]);
    await db.run("DELETE FROM receipt_vouchers WHERE tenant_id = ?", [req.params.id]);
    await db.run("DELETE FROM security_deposits WHERE tenant_id = ?", [req.params.id]);
    await db.run("DELETE FROM tenant_ledger WHERE tenant_id = ?", [req.params.id]);
    await db.run("DELETE FROM complaints WHERE resident_id = ?", [req.params.id]);
    
    try {
      await db.run("DELETE FROM payment_requests WHERE resident_id = ? OR tenant_id = ?", [req.params.id, req.params.id]);
    } catch {}

    // Clean up chart of accounts for the user
    try {
      await db.run(
        "DELETE FROM chart_of_accounts WHERE acco_id IN ('1200.1.1.' || ?, '2100.1.1.' || ?, '1300.1.1.' || ?)",
        [req.params.id, req.params.id, req.params.id]
      );
    } catch {}

    // 3. Delete user
    await db.run("DELETE FROM users WHERE id = ?", [req.params.id]);
    try { await db.enqueueSync("users", req.params.id, "delete", { id: req.params.id }); } catch (_) {}

    if (db.mode === "postgres") {
      try {
        await db.run("DELETE FROM public.profiles WHERE id = ?", [req.params.id]);
        await db.run("DELETE FROM auth.users WHERE id = ?", [req.params.id]);
      } catch (profErr) {
        console.error("Postgres delete profile error:", profErr);
      }
    }

    // 4. Clean up SQLite double entry transactions for deleted ledger entries
    if (db.mode === "sqlite" && ledgerEntries.length > 0) {
      try {
        const { db: rawDb, syncLedgerToDoubleEntry: syncLedgerToDoubleEntry2 } = await import("../db/sqlite.js");
        for (const entry of ledgerEntries) {
          syncLedgerToDoubleEntry2(rawDb, entry.id);
        }
      } catch (err) {
        console.error("Double-entry sync failed in user delete cleanup:", err);
      }
    }

    await syncApartmentStatuses();
    res.json({ success: true, message: "User deleted locally" });
  } catch (e: any) {
    console.error("Failed to delete user:", e);
    res.status(500).json({ error: e.message || "Failed to delete user" });
  }
});

export default router;
