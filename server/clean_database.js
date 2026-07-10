import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import bcrypt from "bcryptjs";

const paths = [
  "C:\\Users\\Admin\\AppData\\Roaming\\margalla.db",
  "C:\\Users\\Admin\\AppData\\Roaming\\margalla-gateway\\margalla.db",
  "C:\\Users\\Admin\\AppData\\Roaming\\MargallaGateway\\data\\margalla.db"
];

const tablesToTruncate = [
  "ledger_entries",
  "documents",
  "complaints",
  "reports",
  "sync_queue",
  "staff",
  "staff_salary_payments",
  "apartments",
  "announcements",
  "visitors",
  "payment_requests",
  "notification_logs",
  "chart_of_accounts",
  "ledger_transactions",
  "company_assets",
  "inventory_stock",
  "manual_assets",
  "apartment_manual_assets"
];

paths.forEach(p => {
  if (!fs.existsSync(p)) return;
  console.log("Cleaning database:", p);
  try {
    const db = new DatabaseSync(p);
    
    // Truncate tables
    tablesToTruncate.forEach(t => {
      try {
        db.prepare(`DELETE FROM ${t}`).run();
        console.log(`  Cleared table: ${t}`);
      } catch (e) {
        // Table might not exist yet
      }
    });

    // Clean users table except ADMIN-001
    try {
      db.prepare("DELETE FROM users WHERE client_id != 'ADMIN-001'").run();
      console.log("  Cleared non-admin users.");
    } catch (e) {
      // Table might not exist yet
    }

    // Seed/Reset admin user
    try {
      const now = new Date().toISOString();
      const hash = bcrypt.hashSync("margalla@123", 10);
      const row = db.prepare("SELECT id FROM users WHERE client_id = 'ADMIN-001'").get();
      if (row) {
        db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, row.id);
      } else {
        db.prepare(
          `INSERT INTO users (id, client_id, email, password_hash, full_name, role, permissions_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'admin', '{}', ?, ?)`
        ).run("admin-id-default", "ADMIN-001", "admin@margalla.local", hash, "System Admin", now, now);
      }
      console.log("  Reset and seeded default admin user (ADMIN-001 / margalla@123).");
    } catch (e) {
      // Table might not exist yet
    }
  } catch (err) {
    console.error("  Error cleaning database:", err.message);
  }
});
