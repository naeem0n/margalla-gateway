import { config } from "../config.js";
import { getDb, now } from "../db/index.js";
import type { SyncQueueItem } from "../db/types.js";

const UPSERT_SQL: Record<string, string> = {
  users: `INSERT INTO users (id, client_id, email, password_hash, full_name, apartment_no, phone, role, permissions_json, is_active, cnic, rent_amount, security_deposit, agreement_url, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            password_hash=excluded.password_hash, full_name=excluded.full_name,
            apartment_no=excluded.apartment_no, phone=excluded.phone,
            permissions_json=excluded.permissions_json, cnic=excluded.cnic,
            rent_amount=excluded.rent_amount, security_deposit=excluded.security_deposit,
            agreement_url=excluded.agreement_url, updated_at=excluded.updated_at`,
  ledger_entries: `INSERT INTO ledger_entries (id, user_id, entry_date, entry_type, description, debit, credit, balance_after, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET description=excluded.description, debit=excluded.debit, credit=excluded.credit, balance_after=excluded.balance_after, updated_at=excluded.updated_at`,
  documents: `INSERT INTO documents (id, owner_id, owner_type, title, doc_type, file_path, file_size, mime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at`,
  complaints: `INSERT INTO complaints (id, resident_id, title, category, priority, description, status, resolution, maintenance_cost, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, resolution=excluded.resolution, maintenance_cost=excluded.maintenance_cost, updated_at=excluded.updated_at`,
  reports: `INSERT INTO reports (id, title, report_type, file_path, file_size, uploaded_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at`,
  apartments: `INSERT INTO apartments (id, number, floor, type, bedrooms, area_sqft, rent, status, description, notes, media_urls_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET number=excluded.number, floor=excluded.floor, type=excluded.type, bedrooms=excluded.bedrooms, area_sqft=excluded.area_sqft, rent=excluded.rent, status=excluded.status, description=excluded.description, notes=excluded.notes, media_urls_json=excluded.media_urls_json, updated_at=excluded.updated_at`,
  announcements: `INSERT INTO announcements (id, title, body, is_active, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, is_active=excluded.is_active, updated_at=excluded.updated_at`,
  visitors: `INSERT INTO visitors (id, visitor_name, cnic, phone, apartment_no, purpose, vehicle_no, host_name, in_time, out_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET out_time=excluded.out_time, updated_at=excluded.updated_at`,
  payment_requests: `INSERT INTO payment_requests (id, resident_id, apartment_no, bill_type, category, type, amount, due_date, method, reference, note, status, created_at, reviewed_at, finance_entry_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, reviewed_at=excluded.reviewed_at, finance_entry_id=excluded.finance_entry_id, updated_at=excluded.updated_at`,
  monthly_utility_bills: `INSERT INTO monthly_utility_bills (id, billing_month, utility_type, govt_bill_amount, govt_total_units, cost_per_unit, billing_method, fixed_amount, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(billing_month, utility_type) DO UPDATE SET govt_bill_amount=excluded.govt_bill_amount, govt_total_units=excluded.govt_total_units, cost_per_unit=excluded.cost_per_unit, billing_method=excluded.billing_method, fixed_amount=excluded.fixed_amount, notes=excluded.notes, updated_at=excluded.updated_at`,
  apartment_meter_readings: `INSERT INTO apartment_meter_readings (id, billing_month, apartment_no, user_id, utility_type, prev_reading, curr_reading, units_consumed, cost_per_unit, calculated_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(billing_month, apartment_no, utility_type) DO UPDATE SET user_id=excluded.user_id, prev_reading=excluded.prev_reading, curr_reading=excluded.curr_reading, units_consumed=excluded.units_consumed, cost_per_unit=excluded.cost_per_unit, calculated_amount=excluded.calculated_amount, updated_at=excluded.updated_at`,
  monthly_billing: `INSERT INTO monthly_billing (id, billing_month, user_id, apartment_no, rent, maintenance, electricity, gas, previous_arrears, total_payable, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(billing_month, user_id) DO UPDATE SET apartment_no=excluded.apartment_no, rent=excluded.rent, maintenance=excluded.maintenance, electricity=excluded.electricity, gas=excluded.gas, previous_arrears=excluded.previous_arrears, total_payable=excluded.total_payable, status=excluded.status, updated_at=excluded.updated_at`,
  utility_collections: `INSERT INTO utility_collections (id, billing_month, utility_type, govt_bill, total_collected, difference, result_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(billing_month, utility_type) DO UPDATE SET govt_bill=excluded.govt_bill, total_collected=excluded.total_collected, difference=excluded.difference, result_type=excluded.result_type, updated_at=excluded.updated_at`,
  adjustment_vouchers: `INSERT INTO adjustment_vouchers (id, voucher_no, billing_month, utility_type, user_id, apartment_no, charge_type, original_amount, adjustment_amount, net_amount, reason, created_by, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`,
  monthly_closings: `INSERT INTO monthly_closings (id, billing_month, status, locked_at, locked_by, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(billing_month) DO UPDATE SET status=excluded.status, locked_at=excluded.locked_at, locked_by=excluded.locked_by, notes=excluded.notes, updated_at=excluded.updated_at`,
  utility_audit_log: `INSERT INTO utility_audit_log (id, action, billing_month, utility_type, entity_id, performed_by, details, old_values, new_values, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`,
  expenses: `INSERT INTO expenses (id, category, amount, description, expense_date, paid_from_acco_id, expense_acco_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET amount=excluded.amount, description=excluded.description, updated_at=excluded.updated_at`,
};

async function applyItem(db: Awaited<ReturnType<typeof getDb>>, item: SyncQueueItem) {
  const payload = JSON.parse(item.payload_json) as Record<string, unknown>;
  if (item.operation === "delete") {
    await db.run(`DELETE FROM ${item.table_name} WHERE id = ?`, [item.record_id]);
    return;
  }
  const sql = UPSERT_SQL[item.table_name];
  if (!sql) throw new Error(`Unknown table: ${item.table_name}`);
  const ts = now();
  switch (item.table_name) {
    case "users":
      if (db.mode === "postgres") {
        try {
          await db.run(
            `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role, instance_id)
             VALUES (?, ?, ?, NOW(), ?, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
             ON CONFLICT (id) DO NOTHING`,
            [payload.id, (payload.email as string).toLowerCase(), payload.password_hash ?? "", JSON.stringify({ full_name: payload.full_name, phone: payload.phone })]
          );
        } catch (authErr) {
          console.error("Cloud sync: auth.users insertion failed:", authErr);
        }

        try {
          await db.run(
            `INSERT INTO public.user_roles (user_id, role)
             VALUES (?, 'resident')
             ON CONFLICT (user_id, role) DO NOTHING`,
            [payload.id]
          );
        } catch (roleErr) {
          console.error("Cloud sync: public.user_roles insertion failed:", roleErr);
        }

        try {
          await db.run(
            `INSERT INTO public.profiles (id, client_id, full_name, apartment_no, phone, is_approved, created_at)
             VALUES (?, ?, ?, ?, ?, true, NOW())
             ON CONFLICT (id) DO UPDATE SET
               client_id = EXCLUDED.client_id,
               full_name = EXCLUDED.full_name,
               apartment_no = EXCLUDED.apartment_no,
               phone = EXCLUDED.phone`,
            [payload.id, (payload.client_id as string).toUpperCase(), payload.full_name, payload.apartment_no ?? null, payload.phone ?? null]
          );
        } catch (profErr) {
          console.error("Cloud sync: public.profiles insertion failed:", profErr);
        }
      } else {
        await db.run(sql, [
          payload.id, payload.client_id, payload.email, payload.password_hash ?? "",
          payload.full_name, payload.apartment_no ?? null, payload.phone ?? null,
          payload.role, payload.permissions_json ?? "{}", payload.cnic ?? null,
          payload.rent_amount !== undefined ? Number(payload.rent_amount) : 0,
          payload.security_deposit !== undefined ? Number(payload.security_deposit) : 0,
          payload.agreement_url ?? null, payload.created_at ?? ts, ts,
        ]);
      }
      break;
    case "ledger_entries":
      await db.run(sql, [
        payload.id, payload.user_id, payload.entry_date, payload.entry_type, payload.description,
        payload.debit ?? 0, payload.credit ?? 0, payload.balance_after ?? 0,
        payload.created_by ?? null, payload.created_at ?? ts, ts,
      ]);
      break;
    case "documents":
      await db.run(sql, [
        payload.id, payload.owner_id ?? null, payload.owner_type ?? "public",
        payload.title, payload.doc_type ?? null, payload.file_path,
        payload.file_size ?? null, payload.mime_type ?? null, payload.created_at ?? ts, ts,
      ]);
      break;
    case "complaints":
      await db.run(sql, [
        payload.id, payload.resident_id, payload.title, payload.category,
        payload.priority ?? "normal", payload.description ?? null,
        payload.status ?? "open", payload.resolution ?? null,
        payload.maintenance_cost !== undefined ? Number(payload.maintenance_cost) : 0,
        payload.created_at ?? ts, ts,
      ]);
      break;
    case "reports":
      await db.run(sql, [
        payload.id, payload.title, payload.report_type, payload.file_path,
        payload.file_size ?? null, payload.uploaded_by ?? null, payload.created_at ?? ts, ts,
      ]);
      break;
    case "apartments":
      await db.run(sql, [
        payload.id,
        payload.number,
        payload.floor !== undefined && payload.floor !== null ? Number(payload.floor) : null,
        payload.type ?? null,
        payload.bedrooms !== undefined && payload.bedrooms !== null ? Number(payload.bedrooms) : null,
        payload.area_sqft !== undefined && payload.area_sqft !== null ? Number(payload.area_sqft) : null,
        payload.rent !== undefined && payload.rent !== null ? Number(payload.rent) : 0,
        payload.status ?? "available",
        payload.description ?? null,
        payload.notes ?? null,
        JSON.stringify(payload.media_urls ?? []),
        payload.created_at ?? ts,
        ts,
      ]);
      break;
    case "announcements":
      await db.run(sql, [
        payload.id, payload.title, payload.body,
        payload.is_active !== undefined ? (payload.is_active ? 1 : 0) : 1,
        payload.created_by ?? null, payload.created_at ?? ts, ts,
      ]);
      break;
    case "visitors":
      await db.run(sql, [
        payload.id, payload.visitor_name, payload.cnic ?? null, payload.phone ?? null,
        payload.apartment_no ?? null, payload.purpose ?? null, payload.vehicle_no ?? null,
        payload.host_name ?? null, payload.in_time ?? ts, payload.out_time ?? null,
        payload.created_at ?? ts, ts,
      ]);
      break;
    case "payment_requests":
      await db.run(sql, [
        payload.id, payload.resident_id, payload.apartment_no ?? null, payload.bill_type ?? null,
        payload.category ?? null, payload.type ?? null, payload.amount !== undefined ? Number(payload.amount) : 0,
        payload.due_date ?? null, payload.method ?? "cash", payload.reference ?? null, payload.note ?? null,
        payload.status ?? "pending", payload.created_at ?? ts, payload.reviewed_at ?? null,
        payload.finance_entry_id ?? null, ts,
      ]);
      break;
    case "monthly_utility_bills":
      await db.run(sql, [
        payload.id, payload.billing_month, payload.utility_type,
        payload.govt_bill_amount !== undefined ? Number(payload.govt_bill_amount) : 0,
        payload.govt_total_units !== undefined ? Number(payload.govt_total_units) : 0,
        payload.cost_per_unit !== undefined ? Number(payload.cost_per_unit) : 0,
        payload.billing_method ?? "meter",
        payload.fixed_amount !== undefined ? Number(payload.fixed_amount) : 0,
        payload.notes ?? null, payload.created_at ?? ts, ts
      ]);
      break;
    case "apartment_meter_readings":
      await db.run(sql, [
        payload.id, payload.billing_month, payload.apartment_no, payload.user_id ?? null,
        payload.utility_type,
        payload.prev_reading !== undefined ? Number(payload.prev_reading) : 0,
        payload.curr_reading !== undefined ? Number(payload.curr_reading) : 0,
        payload.units_consumed !== undefined ? Number(payload.units_consumed) : 0,
        payload.cost_per_unit !== undefined ? Number(payload.cost_per_unit) : 0,
        payload.calculated_amount !== undefined ? Number(payload.calculated_amount) : 0,
        payload.created_at ?? ts, ts
      ]);
      break;
    case "monthly_billing":
      await db.run(sql, [
        payload.id, payload.billing_month, payload.user_id, payload.apartment_no,
        payload.rent !== undefined ? Number(payload.rent) : 0,
        payload.maintenance !== undefined ? Number(payload.maintenance) : 0,
        payload.electricity !== undefined ? Number(payload.electricity) : 0,
        payload.gas !== undefined ? Number(payload.gas) : 0,
        payload.previous_arrears !== undefined ? Number(payload.previous_arrears) : 0,
        payload.total_payable !== undefined ? Number(payload.total_payable) : 0,
        payload.status ?? "pending", payload.created_at ?? ts, ts
      ]);
      break;
    case "utility_collections":
      await db.run(sql, [
        payload.id, payload.billing_month, payload.utility_type,
        payload.govt_bill !== undefined ? Number(payload.govt_bill) : 0,
        payload.total_collected !== undefined ? Number(payload.total_collected) : 0,
        payload.difference !== undefined ? Number(payload.difference) : 0,
        payload.result_type ?? "break_even", payload.created_at ?? ts, ts
      ]);
      break;
    case "adjustment_vouchers":
      await db.run(sql, [
        payload.id, payload.voucher_no, payload.billing_month, payload.utility_type ?? null,
        payload.user_id ?? null, payload.apartment_no ?? null, payload.charge_type ?? null,
        payload.original_amount !== undefined ? Number(payload.original_amount) : 0,
        payload.adjustment_amount !== undefined ? Number(payload.adjustment_amount) : 0,
        payload.net_amount !== undefined ? Number(payload.net_amount) : 0,
        payload.reason, payload.created_by, payload.status ?? "posted", payload.created_at ?? ts, ts
      ]);
      break;
    case "monthly_closings":
      await db.run(sql, [
        payload.id, payload.billing_month, payload.status ?? "locked",
        payload.locked_at ?? null, payload.locked_by ?? null, payload.notes ?? null,
        payload.created_at ?? ts, ts
      ]);
      break;
    case "utility_audit_log":
      await db.run(sql, [
        payload.id, payload.action, payload.billing_month, payload.utility_type,
        payload.entity_id ?? null, payload.performed_by, payload.details ?? null,
        payload.old_values ?? null, payload.new_values ?? null, payload.created_at ?? ts
      ]);
      break;
    case "expenses":
      await db.run(sql, [
        payload.id, payload.category, Number(payload.amount || 0), payload.description ?? null,
        payload.expense_date, payload.paid_from_acco_id ?? null, payload.expense_acco_id ?? null,
        payload.created_at ?? ts, ts
      ]);
      break;
  }
}

export async function pushPendingToCloud() {
  if (!config.syncCloudUrl || !config.isDesktop) return { pushed: 0 };
  const db = await getDb();
  const pending = await db.query<SyncQueueItem>(
    "SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at ASC LIMIT 100",
  );
  let pushed = 0;
  for (const item of pending) {
    try {
      const res = await fetch(`${config.syncCloudUrl}/api/sync/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sync-Key": config.syncApiKey,
        },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(await res.text());
      await db.run("UPDATE sync_queue SET synced_at = ?, error = NULL WHERE id = ?", [now(), item.id]);
      pushed++;
    } catch (e) {
      await db.run("UPDATE sync_queue SET error = ? WHERE id = ?", [
        e instanceof Error ? e.message : "sync failed",
        item.id,
      ]);
    }
  }
  return { pushed };
}

export async function applyRemoteSyncItem(item: SyncQueueItem) {
  const db = await getDb();
  await applyItem(db, item);
}

export async function fetchAndApplyRemoteFixes() {
  if (!config.syncCloudUrl || !config.isDesktop) return;
  const db = await getDb();
  
  try {
    const res = await fetch(`${config.syncCloudUrl}/api/sync/pending-fixes`, {
      method: "GET",
      headers: {
        "X-Sync-Key": config.syncApiKey,
      },
    });
    if (!res.ok) return;
    
    const data = await res.json() as { fixes?: Array<{ id: string; sql: string; description?: string }> };
    if (!data.fixes || data.fixes.length === 0) return;
    
    for (const fix of data.fixes) {
      // Check if already executed
      const existing = await db.queryOne<{ id: string }>(
        "SELECT id FROM remote_fixes_log WHERE id = ?",
        [fix.id]
      );
      if (existing) continue;
      
      console.log(`[Remote Support] Applying fix ${fix.id}: ${fix.description || "No description"}`);
      let status = "success";
      let errMsg = "";
      
      try {
        await db.run(fix.sql);
      } catch (err: any) {
        status = "failed";
        errMsg = err.message || "SQL execution failed";
        console.error(`[Remote Support] Fix ${fix.id} failed:`, errMsg);
      }
      
      // Save result locally
      await db.run(
        "INSERT INTO remote_fixes_log (id, description, executed_at, status, error_message) VALUES (?, ?, ?, ?, ?)",
        [fix.id, fix.description ?? null, now(), status, errMsg || null]
      );
      
      // Report result back to cloud
      try {
        await fetch(`${config.syncCloudUrl}/api/sync/report-fix`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Sync-Key": config.syncApiKey,
          },
          body: JSON.stringify({
            fix_id: fix.id,
            status,
            error: errMsg || null,
          }),
        });
      } catch (reportErr) {
        console.error(`[Remote Support] Failed to report fix ${fix.id} status to cloud:`, reportErr);
      }
    }
  } catch (err) {
    console.error("[Remote Support] Fetching fixes failed:", err);
  }
}

export function startSyncInterval() {
  if (!config.isDesktop || !config.syncCloudUrl) return;
  setInterval(() => {
    pushPendingToCloud().catch(console.error);
    fetchAndApplyRemoteFixes().catch(console.error);
  }, 30_000);
}
