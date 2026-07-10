import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import bcrypt from "bcryptjs";

const appData = process.env.APPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming') : path.join(os.homedir(), '.config'));
const sqlitePath = path.join(appData, "margalla.db");

console.log("Checking DB path:", sqlitePath);
if (!fs.existsSync(sqlitePath)) {
  console.log("Database file does not exist.");
  process.exit(1);
}

try {
  const db = new DatabaseSync(sqlitePath);
  const admin = db.prepare("SELECT id, client_id, password_hash FROM users WHERE client_id = 'ADMIN-001'").get();
  
  if (!admin) {
    console.log("Admin user ADMIN-001 not found.");
  } else {
    console.log("Current Admin data:", admin);
    const newHash = bcrypt.hashSync("MARGALLA@RAHMAN1112", 10);
    console.log("New hash to set:", newHash);
    
    const result = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, admin.id);
    console.log("Update execution result:", result);
    
    const updatedAdmin = db.prepare("SELECT id, client_id, password_hash FROM users WHERE client_id = 'ADMIN-001'").get();
    console.log("Updated Admin data:", updatedAdmin);
    
    const check = bcrypt.compareSync("MARGALLA@RAHMAN1112", updatedAdmin.password_hash);
    console.log("Verification check:", check);
  }
} catch (e) {
  console.error("Error executing script:", e);
}
