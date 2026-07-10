const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./backend.db');
db.serialize(() => {
  db.run("INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) VALUES ('system', 'SYSTEM_CLIENT', 'system@margalla.local', 'none', 'System Account', 'admin');");
  db.run("INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) VALUES ('admin-id-default', 'ADMIN_DEFAULT', 'admin@margalla.local', 'none', 'Default Admin', 'admin');");
  console.log('System users added.');
});
db.close();
