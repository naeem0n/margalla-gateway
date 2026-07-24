import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db/index.js";
import { authRequired, requireRole, signToken, stripUser, verifySuperAdminImpersonation } from "../middleware/auth.js";
import type { User } from "../db/types.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { client_id, email, password, phone, portal } = req.body ?? {};
  let loginId = (client_id || email || "").trim();
  loginId = loginId.replace(/^[;:\s]+/, "");
  loginId = loginId.replace(/^(id|client_id|username|user)\s*[;:\s]\s*/i, "");
  loginId = loginId.trim();

  if (!loginId) {
    return res.status(400).json({ error: "Client ID or email required" });
  }

  // Normalize admin client ID variations (e.g. ADMIN-00, ADMIN-01, ADMIN) to the seeded 'ADMIN-001'
  const upperInput = loginId.toUpperCase();
  if (
    upperInput === "ADMIN" ||
    upperInput === "ADMIN-00" ||
    upperInput === "ADMIN-01" ||
    upperInput === "ADMIN-001" ||
    upperInput === "ADMIN-002" ||
    upperInput === "ADMIN-1" ||
    upperInput === "ADMIN@MARGALLA.LOCAL" ||
    /^ADMIN-0*$/.test(upperInput) ||
    /^ADMIN-\d+$/.test(upperInput)
  ) {
    loginId = "ADMIN-001";
  }

  const db = await getDb();

  const upperLoginId = loginId.toUpperCase();
  const matchedUsers = await db.query<User>(
    `SELECT * FROM users 
     WHERE (
       LOWER(client_id) = LOWER(?) 
       OR LOWER(client_id) = LOWER('RES-' || ?)
       OR LOWER(client_id) = LOWER('MG-R' || ?)
       OR LOWER(client_id) = LOWER('TP-' || ?)
       OR LOWER(client_id) = LOWER('VND-' || ?)
       OR LOWER(email) = LOWER(?) 
       OR LOWER(full_name) = LOWER(?)
       OR LOWER(apartment_no) = LOWER(?)
       OR phone = ?
     ) AND is_active = 1`,
    [loginId, loginId, loginId, loginId, loginId, loginId, loginId, loginId, loginId],
  );

  if (matchedUsers.length === 0) {
    return res.status(401).json({ error: "Resident ID not found. Verify your Client ID (e.g. RES-104) or contact admin." });
  }

  // Prioritize candidates matching the expected portal role
  if (portal) {
    const cleanPortal = portal.toLowerCase().trim();
    matchedUsers.sort((a, b) => {
      const aRole = a.role ? a.role.toLowerCase().trim() : "";
      const bRole = b.role ? b.role.toLowerCase().trim() : "";
      const aMatch = aRole === cleanPortal ? 1 : 0;
      const bMatch = bRole === cleanPortal ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  let authenticatedUser: User | null = null;

  for (const candidate of matchedUsers) {
    const cleanRole = candidate.role ? candidate.role.toLowerCase().trim() : '';
    const isResidentRole = cleanRole === "resident" || cleanRole === "resident hub";
    const isThirdPartyRole = cleanRole === "thirdparty" || cleanRole === "third-party vault" || cleanRole === "vault";

    // 1. Resident Boundary Protection
    if (isResidentRole && (upperLoginId.startsWith("TP-") || upperLoginId.startsWith("VND-"))) {
      continue;
    }

    // 2. Third-Party Boundary Protection
    if (isThirdPartyRole && upperLoginId.startsWith("RES-")) {
      continue;
    }

    // 3. Strict Portal-Role Validation
    if (portal && cleanRole !== portal.toLowerCase().trim()) {
      continue;
    }

    // Check credentials (either phone or password)
    if (phone !== undefined) {
      const normalizePhone = (p: string) => {
        let clean = String(p).replace(/\D/g, "");
        while (clean.startsWith("0")) {
          clean = clean.substring(1);
        }
        if (clean.startsWith("92")) {
          clean = clean.substring(2);
        }
        return clean;
      };
      const cleanInputPhone = normalizePhone(phone);
      const cleanUserPhone = normalizePhone(candidate.phone ?? "");
      if (cleanUserPhone && cleanInputPhone === cleanUserPhone) {
        authenticatedUser = candidate;
        break;
      }
    } else {
      const pwd = (password ?? "").trim();
      const savedPwd = (candidate.password_hash ?? "").trim();

      let isMatch = false;
      try {
        if (savedPwd.startsWith("$2a$") || savedPwd.startsWith("$2b$") || savedPwd.startsWith("$2y$")) {
          isMatch = bcrypt.compareSync(pwd, savedPwd);
        }
      } catch (e) {
        isMatch = false;
      }

      if (pwd && isMatch) {
        authenticatedUser = candidate;
        break;
      }
    }
  }

  if (!authenticatedUser) {
    return res.status(401).json({ error: "Wrong password. Use the password provided by admin." });
  }

  const user = authenticatedUser as any;

  if (user.force_password_change === 1) {
    return res.status(403).json({ require_password_change: true, user_id: user.id });
  }

  const token = signToken({
    sub: user.id,
    client_id: user.client_id,
    role: user.role,
    email: user.email,
  });

  res.json({ token, user: stripUser(user as unknown as Record<string, unknown>) });
});

router.post("/change-initial-password", async (req, res) => {
  const { user_id, current_password, new_password } = req.body ?? {};
  if (!user_id || !current_password || !new_password) {
    return res.status(400).json({ error: "user_id, current_password, and new_password required" });
  }

  const db = await getDb();
  const user = await db.queryOne<any>("SELECT * FROM users WHERE id = ?", [user_id]);
  if (!user) return res.status(404).json({ error: "User not found" });

  const savedHash = (user.password_hash ?? "").trim();
  let isMatch = false;
  try {
    if (savedHash.startsWith("$2a$") || savedHash.startsWith("$2b$") || savedHash.startsWith("$2y$")) {
      isMatch = bcrypt.compareSync(current_password, savedHash);
    }
  } catch (e) {
    isMatch = false;
  }
  if (!isMatch) return res.status(401).json({ error: "Invalid current password" });

  const hash = bcrypt.hashSync(new_password, 10);
  await db.run("UPDATE users SET password_hash = ?, force_password_change = 0 WHERE id = ?", [hash, user_id]);

  const token = signToken({
    sub: user.id,
    client_id: user.client_id,
    role: user.role,
    email: user.email,
  });

  res.json({ token, user: stripUser(user as unknown as Record<string, unknown>) });
});

router.post("/impersonate", authRequired, verifySuperAdminImpersonation, async (req, res) => {
  const { user_id } = req.body ?? {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  const db = await getDb();
  const user = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [user_id]);
  if (!user) return res.status(404).json({ error: "User not found" });

  const token = signToken({
    sub: user.id,
    client_id: user.client_id,
    role: user.role,
    email: user.email,
  });

  res.json({ token, user: stripUser(user as unknown as Record<string, unknown>) });
});

router.get("/me", authRequired, async (req, res) => {
  const db = await getDb();
  const user = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [req.user!.sub]);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: stripUser(user as unknown as Record<string, unknown>) });
});

router.get("/verify", authRequired, (req, res) => {
  res.json({ ok: true });
});

router.post("/logout", authRequired, (_req, res) => {
  res.json({ ok: true });
});

router.post("/reset-admin", async (req, res) => {
  // Recovery endpoint: gated behind a server-side token so it cannot be used
  // by anonymous callers to take over the admin account. The operator must
  // set ADMIN_RESET_TOKEN in the environment and present it here.
  const configuredToken = (process.env.ADMIN_RESET_TOKEN ?? "").trim();
  if (!configuredToken) {
    return res.status(403).json({ error: "Admin reset is disabled. Set ADMIN_RESET_TOKEN on the server to enable it." });
  }
  const providedToken = (req.headers["x-admin-reset-token"] as string | undefined)?.trim() ?? "";
  if (providedToken !== configuredToken) {
    return res.status(401).json({ error: "Invalid admin reset token" });
  }

  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync("MARGALLA@RAHMAN1112", 10);
    
    // Check if table exists
    try {
      await db.query("SELECT id FROM users LIMIT 1");
    } catch (e) {
      return res.status(500).json({ error: "Database tables do not exist. Please run migrations/start the server first." });
    }

    const row = await db.queryOne<{ id: string }>("SELECT id FROM users WHERE client_id = 'ADMIN-001' LIMIT 1");
    if (row) {
      await db.run("UPDATE users SET password_hash = ?, role = 'admin', is_active = 1 WHERE id = ?", [hash, row.id]);
    } else {
      const { randomUUID } = await import("node:crypto");
      const adminId = randomUUID();
      await db.run(
        `INSERT INTO users (id, client_id, email, password_hash, full_name, role, permissions_json, created_at, updated_at, is_active)
         VALUES (?, 'ADMIN-001', 'admin@margalla.local', ?, 'System Admin', 'admin', '{}', ?, ?, 1)`,
        [adminId, hash, now, now]
      );
    }
    
    res.json({ message: "Admin account restored to default: ADMIN-001 / MARGALLA@RAHMAN1112" });
  } catch (err: any) {
    console.error("Failed to reset admin:", err);
    res.status(500).json({ error: err.message || "Failed to reset admin account" });
  }
});

export default router;
