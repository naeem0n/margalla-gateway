import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

// 1. Locate all database paths
const localDb = path.join(process.cwd(), "server", "margalla.db");
const appData = process.env.APPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming') : path.join(os.homedir(), '.config'));
const roamingDb = path.join(appData, "margalla.db");

const targetDbs = [];
if (fs.existsSync(localDb)) targetDbs.push(localDb);
if (fs.existsSync(roamingDb) && roamingDb !== localDb) targetDbs.push(roamingDb);

if (targetDbs.length === 0) {
  console.error("❌ No database file found!");
  process.exit(1);
}

for (const sqlitePath of targetDbs) {
  console.log(`\nUsing Database: ${sqlitePath}`);
  const db = new DatabaseSync(sqlitePath);
  
  // Verify required tables exist in this DB
  const tableCheck = db.prepare("SELECT count(*) AS cnt FROM sqlite_master WHERE type='table' AND name IN ('invoices', 'ledger_entries')").get();
  if (tableCheck.cnt < 2) {
    console.log("⚠️ Required tables ('invoices', 'ledger_entries') do not exist in this database. Skipping...");
    continue;
  }

try {
  console.log("🚀 Starting database synchronization and cleanup...\n");

  // Step 1: Remove duplicates from ledger_entries
  console.log("Step 1: Removing duplicate entries from ledger_entries...");
  const dupBefore = db.prepare("SELECT COUNT(*) AS cnt FROM ledger_entries").get().cnt;
  
  db.prepare(`
    DELETE FROM ledger_entries
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM ledger_entries
      GROUP BY user_id, entry_date, debit, credit
    )
  `).run();
  
  const dupAfter = db.prepare("SELECT COUNT(*) AS cnt FROM ledger_entries").get().cnt;
  console.log(`✅ Completed. Removed ${dupBefore - dupAfter} duplicate entries.\n`);

  // Step 2: Normalize invoice balances
  console.log("Step 2: Normalizing invoice balances (total_bill_amount - amount_received)...");
  const normResult = db.prepare(`
    UPDATE invoices
    SET current_balance = (total_bill_amount - amount_received)
  `).run();
  console.log(`✅ Completed. Updated ${normResult.changes} invoices.\n`);

  // Step 3: Sync ledger_entries with invoices (post missing debits)
  console.log("Step 3: Posting missing billed invoices to ledger_entries as debits...");
  const debitResult = db.prepare(`
    INSERT INTO ledger_entries (id, user_id, entry_date, entry_type, description, debit, credit, created_by, created_at, updated_at)
    SELECT 
      'LE-SYNC-' || i.invoice_no, 
      i.tenant_id, 
      i.date, 
      'rent', 
      'Invoice Sync - ' || i.invoice_no, 
      i.total_bill_amount, 
      0,
      'system',
      datetime('now'),
      datetime('now')
    FROM invoices i
    WHERE i.invoice_no NOT LIKE 'RV-%'
    AND i.tenant_id IS NOT NULL
    AND i.total_bill_amount > 0
    AND NOT EXISTS (
      SELECT 1 FROM ledger_entries l
      WHERE l.user_id = i.tenant_id AND l.entry_date = i.date AND l.debit = i.total_bill_amount
    )
  `).run();
  console.log(`✅ Completed. Posted ${debitResult.changes} missing debits to ledger_entries.\n`);

  // Step 4: Sync ledger_entries with RV invoices (post missing credits)
  console.log("Step 4: Posting missing receipt vouchers (RV) to ledger_entries as credits...");
  const creditResult = db.prepare(`
    INSERT INTO ledger_entries (id, user_id, entry_date, entry_type, description, debit, credit, created_by, created_at, updated_at)
    SELECT 
      'LE-SYNC-' || i.invoice_no, 
      i.tenant_id, 
      i.date, 
      'rent', 
      'RV Sync - ' || i.invoice_no, 
      0,
      i.amount_received,
      'system',
      datetime('now'),
      datetime('now')
    FROM invoices i
    WHERE i.invoice_no LIKE 'RV-%'
    AND i.tenant_id IS NOT NULL
    AND i.amount_received > 0
    AND NOT EXISTS (
      SELECT 1 FROM ledger_entries l
      WHERE l.user_id = i.tenant_id AND l.entry_date = i.date AND l.credit = i.amount_received
    )
  `).run();
  console.log(`✅ Completed. Posted ${creditResult.changes} missing credits to ledger_entries.\n`);

  console.log("🎉 Database cleanup and synchronization completed successfully!");
} catch (e) {
  console.error("❌ Error executing database script:", e);
}
}
