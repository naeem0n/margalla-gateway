import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
try {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const dbPath = path.join(appData, 'margalla-gateway', 'data', 'margalla.db');
  console.log('Connecting to:', dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) VALUES ('system', 'SYSTEM_CLIENT', 'system@margalla.local', 'none', 'System Account', 'admin');
    INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) VALUES ('admin-id-default', 'ADMIN_DEFAULT', 'admin@margalla.local', 'none', 'Default Admin', 'admin');
  `);
  console.log('Fixed APPDATA margalla.db!');
  db.close();
} catch(e) {
  console.error(e);
}
