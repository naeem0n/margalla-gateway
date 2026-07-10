import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PostgresDb {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false } });
  }

  async init() {
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
    const adapted = schema
      .replace(/INTEGER DEFAULT 1/g, "BOOLEAN DEFAULT TRUE")
      .replace(/is_active INTEGER/g, "is_active BOOLEAN");
    await this.pool.query(adapted);
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const hash = bcrypt.hashSync("MARGALLA@RAHMAN1112", 10);
    const { rows } = await this.pool.query("SELECT id FROM users WHERE client_id = 'ADMIN-001'");
    if (rows.length) {
      await this.pool.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [hash, rows[0].id]
      );
    } else {
      const now = new Date().toISOString();
      await this.pool.query(
        `INSERT INTO users (id, client_id, email, password_hash, full_name, role, permissions_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'admin', '{}', $6, $7)`,
        [randomUUID(), "ADMIN-001", "admin@margalla.local", hash, "System Admin", now, now],
      );
    }
  }

  get pool_() {
    return this.pool;
  }

  async close() {
    await this.pool.end();
  }
}
