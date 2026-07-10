import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const localDb = path.join(process.cwd(), "server", "margalla.db");
const appData = process.env.APPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming') : path.join(os.homedir(), '.config'));
const roamingDb = path.join(appData, "margalla.db");

const targetDbs = [];
if (fs.existsSync(localDb)) targetDbs.push(localDb);
if (fs.existsSync(roamingDb) && roamingDb !== localDb) targetDbs.push(roamingDb);

for (const sqlitePath of targetDbs) {
  console.log(`\nExecuting migration on database: ${sqlitePath}`);
  const db = new DatabaseSync(sqlitePath);

  // Helper helper to check if a column exists in a table
  const hasColumn = (table, colName) => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all();
      return cols.some(c => c.name === colName);
    } catch (e) {
      return false;
    }
  };

  // Helper to safely drop a column
  const safelyDropColumn = (table, colName) => {
    if (hasColumn(table, colName)) {
      try {
        db.prepare(`ALTER TABLE ${table} DROP COLUMN ${colName}`).run();
        console.log(`✅ Dropped column '${colName}' from table '${table}'.`);
      } catch (e) {
        console.error(`❌ Failed to drop column '${colName}' from table '${table}':`, e.message);
      }
    } else {
      console.log(`ℹ️ Column '${colName}' in table '${table}' does not exist, skipping drop.`);
    }
  };

  // Helper to safely add a column
  const safelyAddColumn = (table, colName, definition) => {
    if (!hasColumn(table, colName)) {
      try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${colName} ${definition}`).run();
        console.log(`✅ Added column '${colName}' to table '${table}'.`);
      } catch (e) {
        console.error(`❌ Failed to add column '${colName}' to table '${table}':`, e.message);
      }
    } else {
      console.log(`ℹ️ Column '${colName}' in table '${table}' already exists, skipping add.`);
    }
  };

  // 1. Drop extra GAS columns from users table (representing utility table)
  safelyDropColumn("users", "gas_prev");
  safelyDropColumn("users", "gas_curr");
  safelyDropColumn("users", "gas_rate");
  safelyDropColumn("users", "gas_arrears");
  safelyDropColumn("users", "gas_arr");

  // 2. Add fixed GAS payment column to users
  safelyAddColumn("users", "gas_fixed_payment", "INTEGER DEFAULT 0");

  // 3. Add default params setup (opening balance + targets) to users
  safelyAddColumn("users", "opening_balance", "INTEGER DEFAULT 28000");
  safelyAddColumn("users", "gas_bill_target", "INTEGER DEFAULT 50000");

  // 4. Normalize invoices table (remove preview-only fields if they exist)
  safelyDropColumn("invoices", "preview_flag");

  // 5. Add consolidated fields to invoices (rent + maint + parking)
  safelyAddColumn("invoices", "consolidated_total", "INTEGER");

  // 6. Add columns to parking table
  safelyAddColumn("parking", "vehicle_type", "TEXT DEFAULT 'car'");
  safelyAddColumn("parking", "vehicle_model", "TEXT");
  safelyAddColumn("parking", "license_plate", "TEXT");
  safelyAddColumn("parking", "apartment_no", "TEXT");

  // 7. Add uploaded_by column to documents table
  safelyAddColumn("documents", "uploaded_by", "TEXT");

  console.log(`🎉 Migration successfully executed for: ${sqlitePath}`);
}
