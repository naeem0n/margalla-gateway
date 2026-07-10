import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type pg from "pg";
import { config } from "../config.js";
import { SqliteDb } from "./sqlite.js";

export type DbAdapter = {
  mode: "sqlite" | "postgres";
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  enqueueSync(table: string, recordId: string, operation: string, payload: unknown): Promise<void>;
  close(): Promise<void>;
};

let adapter: DbAdapter | null = null;

function sqliteAdapter(db: DatabaseSync): DbAdapter {
  return {
    mode: "sqlite",
    async query<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as any[])) as T[];
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      return (db.prepare(sql).get(...(params as any[])) as T) ?? null;
    },
    async run(sql: string, params: unknown[] = []) {
      const r = db.prepare(sql).run(...(params as any[]));
      return { changes: Number(r.changes) };
    },
    async enqueueSync(table, recordId, operation, payload) {
      if (!config.isDesktop) return;
      try {
        const now = new Date().toISOString();
        const payloadStr = JSON.stringify(payload);
        db.prepare(
          `INSERT INTO sync_queue (id, table_name, record_id, operation, payload_json, created_at, action, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(randomUUID(), table, recordId, operation, payloadStr, now, operation, payloadStr);
      } catch (err) {
        console.error(`[SQLite Sync Queue] Enqueue failed silently for table ${table}:`, err);
      }
    },
    async close() {
      db.close();
    },
  };
}

function toPgSql(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function postgresAdapter(pool: pg.Pool): DbAdapter {
  return {
    mode: "postgres",
    async query<T>(sql: string, params: unknown[] = []) {
      const { rows } = await pool.query(toPgSql(sql), params);
      return rows as T[];
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      const rows = await postgresAdapter(pool).query<T>(sql, params);
      return rows[0] ?? null;
    },
    async run(sql: string, params: unknown[] = []) {
      const r = await pool.query(toPgSql(sql), params);
      return { changes: r.rowCount ?? 0 };
    },
    async enqueueSync() {
      /* cloud is source of truth */
    },
    async close() {
      await pool.end();
    },
  };
}

export async function getDb(): Promise<DbAdapter> {
  if (adapter) return adapter;
  if (config.dbMode === "postgres" && config.postgresUrl) {
    const { PostgresDb } = await import("./postgres.js");
    const pgDb = new PostgresDb(config.postgresUrl);
    await pgDb.init();
    adapter = postgresAdapter(pgDb.pool_);
  } else {
    const sqlite = new SqliteDb(config.sqlitePath);
    adapter = sqliteAdapter(sqlite.raw);
  }
  return adapter;
}

export function now() {
  return new Date().toISOString();
}

export function newId() {
  return randomUUID();
}

export function nextClientId(role: string, count: number) {
  if (role === "resident" || role === "user") {
    return `MG-R${String(count + 1).padStart(6, "0")}`;
  }
  const prefix = role === "thirdparty" ? "TP" : "RES";
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function logActivity(userId: string | null, action: string, details: string) {
  try {
    const db = await getDb();
    const id = newId();
    const ts = now();
    await db.run(
      "INSERT INTO activity_logs (id, user_id, action, details, timestamp) VALUES (?, ?, ?, ?, ?)",
      [id, userId || "system", action, details, ts]
    );
  } catch (err: any) {
    console.error("[Activity Logger] Failed to log activity:", err.message);
  }
}

export async function recalculateUserLedger(db: DbAdapter, userId: string): Promise<number> {
  const entries = await db.query<any>(
    "SELECT * FROM ledger_entries WHERE user_id = ? ORDER BY entry_date ASC, created_at ASC",
    [userId]
  );
  
  let runningBalance = 0;
  for (const entry of entries) {
    if (entry.entry_type === "security") {
      entry.balance_after = runningBalance;
    } else {
      runningBalance += Number(entry.debit ?? 0) - Number(entry.credit ?? 0);
      entry.balance_after = runningBalance;
    }
    
    await db.run(
      "UPDATE ledger_entries SET balance_after = ? WHERE id = ?",
      [entry.balance_after, entry.id]
    );
  }
  
  await db.run(
    "UPDATE users SET outstanding_balance = ? WHERE id = ?",
    [runningBalance, userId]
  );
  
  if (db.mode === "postgres") {
    try {
      await db.run(
        "UPDATE public.profiles SET outstanding_balance = ? WHERE id = ?",
        [runningBalance, userId]
      );
    } catch (err) {
      console.error("Failed to update postgres profile outstanding_balance:", err);
    }
  }

  return runningBalance;
}

export async function postLedgerEntry(
  db: DbAdapter,
  entry: {
    id?: string;
    user_id: string;
    entry_date: string;
    entry_type: "rent" | "security" | "maintenance" | "other";
    description: string;
    debit: number;
    credit: number;
    created_by?: string;
    voucher_no?: string;
  }
) {
  const user_id = entry.user_id;
  const entry_date = entry.entry_date;
  const entry_type = entry.entry_type;
  const description = entry.description;
  const debit = Number(entry.debit ?? 0);
  const credit = Number(entry.credit ?? 0);
  const created_by = entry.created_by || "system";

  // 1. Generate sequential voucher_no if not provided
  let voucher_no = entry.voucher_no;
  if (!voucher_no) {
    const lastEntry = await db.queryOne<{ voucher_no: string }>(
      "SELECT voucher_no FROM ledger_entries WHERE voucher_no LIKE 'LGR-%' ORDER BY voucher_no DESC LIMIT 1"
    );
    if (lastEntry && lastEntry.voucher_no) {
      const match = lastEntry.voucher_no.match(/LGR-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        voucher_no = `LGR-${String(nextNum).padStart(6, "0")}`;
      } else {
        voucher_no = "LGR-000001";
      }
    } else {
      voucher_no = "LGR-000001";
    }
  }

  const id = entry.id || newId();
  const ts = now();

  // 2. Insert into database with balance_after as 0 temporarily
  await db.run(
    `INSERT INTO ledger_entries (id, user_id, entry_date, entry_type, description, debit, credit, balance_after, created_by, created_at, updated_at, voucher_no)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      id,
      user_id,
      entry_date,
      entry_type,
      description,
      debit,
      credit,
      created_by,
      ts,
      ts,
      voucher_no
    ]
  );

  // 3. Recalculate running balance chronologically
  const balance = await recalculateUserLedger(db, user_id);

  // 4. Enqueue sync
  const payload = {
    id,
    user_id,
    entry_date,
    entry_type,
    description,
    debit,
    credit,
    balance_after: balance,
    voucher_no,
    created_by,
    created_at: ts,
    updated_at: ts
  };
  await db.enqueueSync("ledger_entries", id, "insert", payload);

  // 5. Double entry sync if sqlite
  if (db.mode === "sqlite") {
    try {
      const { db: rawDb, syncLedgerToDoubleEntry } = await import("./sqlite.js");
      syncLedgerToDoubleEntry(rawDb, id);
    } catch (err) {
      console.error("Double-entry sync failed in postLedgerEntry:", err);
    }
  }

  return payload;
}

export { syncLedgerToDoubleEntry } from "./sqlite.js";
