import { DatabaseSync } from 'node:sqlite';
try {
  const db = new DatabaseSync('C:\\\\Users\\\\Admin\\\\AppData\\\\Roaming\\\\margalla-gateway\\\\data\\\\margalla.db');
  db.exec(\
    INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) VALUES ('system', 'SYSTEM_CLIENT', 'system@margalla.local', 'none', 'System Account', 'admin');
    INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) VALUES ('admin-id-default', 'ADMIN_DEFAULT', 'admin@margalla.local', 'none', 'Default Admin', 'admin');
  \);
  console.log('Fixed APPDATA margalla.db!');
  db.close();
} catch(e) {
  console.error(e);
}