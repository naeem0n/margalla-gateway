import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("./backend.db");
try {
  db.exec(`
    INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) 
    VALUES ('system', 'SYSTEM_CLIENT', 'system@margalla.local', 'none', 'System Account', 'admin');
    
    INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) 
    VALUES ('admin-id-default', 'ADMIN_DEFAULT', 'admin@margalla.local', 'none', 'Default Admin', 'admin');
  `);
  console.log('System users added to backend.db');
} catch (err) {
  console.error(err);
}
db.close();
