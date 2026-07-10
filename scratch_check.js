import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

try {
  const db = new DatabaseSync("C:\\Users\\Admin\\AppData\\Roaming\\margalla.db");
  const user = db.prepare("SELECT * FROM users WHERE client_id = 'ADMIN-001'").get();
  console.log("DB User:", user);
  
  if (user) {
    const check1 = bcrypt.compareSync("MARGALLA@RAHMAN1112", user.password_hash);
    console.log("Password check 'MARGALLA@RAHMAN1112':", check1);
  }
} catch (err) {
  console.error("Error:", err.message);
}
