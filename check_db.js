import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('margalla.db');

const users = db.prepare("SELECT id, full_name, apartment_no, outstanding_balance FROM users WHERE role IN ('resident','user') LIMIT 10").all();
console.log('Residents:', JSON.stringify(users, null, 2));

const invoiceCount = db.prepare("SELECT COUNT(*) as cnt FROM invoices").get();
console.log('Invoice count:', invoiceCount);

const invoices = db.prepare("SELECT invoice_no, tenant_id, current_balance, amount_received FROM invoices LIMIT 10").all();
console.log('Invoices:', JSON.stringify(invoices, null, 2));

const ledger = db.prepare("SELECT user_id, entry_type, debit, credit, balance_after FROM ledger_entries ORDER BY created_at DESC LIMIT 5").all();
console.log('Recent ledger:', JSON.stringify(ledger, null, 2));

db.close();
