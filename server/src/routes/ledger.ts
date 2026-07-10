import { Router } from "express";
import { getDb } from "../db/index.js";
import { authRequired, requireRole, hasPermission, requirePermission, requireAccountingRole } from "../middleware/auth.js";
import type { LedgerEntry } from "../db/types.js";

const router = Router();

router.get("/", authRequired, async (req, res) => {
  const db = await getDb();
  const { user_id, entry_type } = req.query as { user_id?: string; entry_type?: string };
  const ok = await hasPermission(req.user!.sub, "canManageUtilities");

  if ((req.user!.role === "resident" || req.user!.role === "thirdparty") && !ok) {
    const rows = await db.query<LedgerEntry>(
      "SELECT * FROM ledger_entries WHERE user_id = ? ORDER BY entry_date DESC",
      [req.user!.sub],
    );
    return res.json({ entries: rows });
  }

  let sql = "SELECT * FROM ledger_entries WHERE 1=1";
  const params: unknown[] = [];
  if (user_id) {
    sql += " AND user_id = ?";
    params.push(user_id);
  }
  if (entry_type) {
    sql += " AND entry_type = ?";
    params.push(entry_type);
  }
  sql += " ORDER BY entry_date DESC";
  const rows = await db.query<LedgerEntry>(sql, params);
  res.json({ entries: rows });
});

router.post("/", authRequired, async (req, res) => {
  return res.status(403).json({
    error: "Manual ledger posting is disabled. Use the central accounting routes or approved financial transaction flows."
  });
});

router.delete("/:id", authRequired, requireAccountingRole, async (req, res) => {

  const db = await getDb();
  
  // Retrieve the user_id of the ledger entry before deleting it
  const entry = await db.queryOne<{ user_id: string }>(
    "SELECT user_id FROM ledger_entries WHERE id = ?",
    [req.params.id]
  );

  await db.run("DELETE FROM ledger_entries WHERE id = ?", [req.params.id]);
  await db.enqueueSync("ledger_entries", req.params.id, "delete", { id: req.params.id });

  if (entry && entry.user_id) {
    const { recalculateUserLedger } = await import("../db/index.js");
    await recalculateUserLedger(db, entry.user_id);
  }

  // Sync to double-entry ledger if SQLite
  if (db.mode === "sqlite") {
    try {
      const { db: rawDb, syncLedgerToDoubleEntry } = await import("../db/sqlite.js");
      syncLedgerToDoubleEntry(rawDb, req.params.id);
    } catch (err) {
      console.error("Double-entry sync failed in DELETE /ledger:", err);
    }
  }

  res.json({ ok: true });
});

router.get("/statement/:userId", authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.params.userId;
    const ok = await hasPermission(req.user!.sub, "canManageUtilities");

    if (req.user!.role !== "admin" && !ok && userId !== req.user!.sub) {
      return res.status(403).json({ error: "Access denied: you can only view your own statement" });
    }

    // Get user details
    const user = await db.queryOne<{
      full_name: string;
      client_id: string;
      apartment_no: string;
      security_deposit: number;
      outstanding_balance: number;
      email: string;
      phone: string;
    }>(
      "SELECT full_name, client_id, apartment_no, security_deposit, outstanding_balance, email, phone FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: "Resident not found" });
    }

    // Get ledger entries ordered chronologically
    const entries = await db.query<LedgerEntry>(
      "SELECT * FROM ledger_entries WHERE user_id = ? ORDER BY entry_date ASC, created_at ASC",
      [userId]
    );

    // Calculate opening balance
    let opening_balance = user.outstanding_balance;
    if (entries.length > 0) {
      opening_balance = Number(entries[0].balance_after ?? 0) - Number(entries[0].debit ?? 0) + Number(entries[0].credit ?? 0);
    }

    res.json({
      user,
      entries,
      opening_balance,
      closing_balance: user.outstanding_balance,
      security_deposit: user.security_deposit
    });
  } catch (e: any) {
    console.error("Failed to fetch statement:", e);
    res.status(500).json({ error: e.message || "Failed to fetch statement" });
  }
});

export default router;
