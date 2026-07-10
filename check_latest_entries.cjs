const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const dbPath = 'C:\\Users\\Admin\\AppData\\Roaming\\margalla-gateway\\data\\margalla.db';
const db = new DatabaseSync(dbPath);

console.log("=== Latest Ledger Entries ===");
const ledger = db.prepare("SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 5").all();
console.log(ledger);

console.log("=== Latest Journal Entries ===");
const journal = db.prepare("SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 5").all();
console.log(journal);

console.log("=== Latest Invoices ===");
const invoices = db.prepare("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 5").all();
console.log(invoices);

db.close();
