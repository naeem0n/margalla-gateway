import { db, syncLedgerToDoubleEntry } from "../db/sqlite.js";
import { randomUUID } from "node:crypto";

export function handlePaymentReturn(invoiceId: string) {
  // Check if invoice exists in ledger
  const entry = db.prepare("SELECT * FROM ledger_entries WHERE id = ? LIMIT 1").get(invoiceId) as any;
  if (!entry) {
    return { success: false, message: "Invoice not found in system ledger!" };
  }

  // Insert a matching refund entry (debit and credit reversed)
  const refundId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ledger_entries (id, user_id, entry_date, entry_type, description, debit, credit, balance_after, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'other', ?, ?, ?, 0, 'system', ?, ?)
  `).run(
    refundId,
    entry.user_id,
    now.split("T")[0],
    `REFUND for entry #${invoiceId.slice(0, 8)}: ${entry.description}`,
    entry.credit, // Debit is credit reversed
    entry.debit,  // Credit is debit reversed
    now,
    now
  );

  try {
    syncLedgerToDoubleEntry(db, refundId);
  } catch (err) {
    console.error("Double-entry sync failed in refund controller:", err);
  }

  return { success: true, message: `Invoice #${invoiceId.slice(0, 8)} successfully refunded!` };
}

export function handleStaffStatus(
  staffId: string,
  name: string,
  role: string,
  joiningDate: string,
  endingDate: string
) {
  // Dynamically ensure the staff table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      joining_date TEXT,
      ending_date TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  // Insert or update the staff record
  db.prepare(`
    INSERT INTO staff (id, name, role, joining_date, ending_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      joining_date = excluded.joining_date,
      ending_date = excluded.ending_date,
      updated_at = excluded.updated_at
  `).run(
    staffId || randomUUID(),
    name,
    role,
    joiningDate || null,
    endingDate || null,
    new Date().toISOString()
  );
}
