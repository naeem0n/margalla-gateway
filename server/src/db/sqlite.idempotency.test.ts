import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

// `node:sqlite` is only available on Node >= 22.5 (with --experimental-sqlite).
// Load it (and the module under test, which imports it) lazily so the suite
// skips gracefully instead of crashing the whole run on older runtimes.
let DatabaseSync: typeof import("node:sqlite").DatabaseSync | undefined;
let syncLedgerToDoubleEntry:
  | typeof import("./sqlite.js").syncLedgerToDoubleEntry
  | undefined;
let hasNodeSqlite = true;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
  ({ syncLedgerToDoubleEntry } = await import("./sqlite.js"));
} catch {
  hasNodeSqlite = false;
}

function createTestDb() {
  const db = new DatabaseSync!(':memory:');
  db.exec(`
    CREATE TABLE ledger_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      entry_date TEXT,
      entry_type TEXT,
      description TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      balance_after REAL DEFAULT 0,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      voucher_no TEXT
    );
    CREATE TABLE ledger_transactions (
      voucher_no TEXT,
      tx_date TEXT,
      description TEXT,
      main_acco_id TEXT,
      contra_acco_id TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0
    );
    CREATE TABLE chart_of_accounts (
      acco_id TEXT PRIMARY KEY,
      acco_name TEXT,
      account_type TEXT
    );
    CREATE TABLE journal_entries (
      id TEXT PRIMARY KEY,
      voucher_no TEXT,
      entry_type TEXT,
      entry_date TEXT,
      description TEXT,
      reference TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE journal_lines (
      id TEXT PRIMARY KEY,
      entry_id TEXT,
      acco_id TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      full_name TEXT,
      role TEXT
    );
  `);
  return db;
}

describe.skipIf(!hasNodeSqlite)("syncLedgerToDoubleEntry", () => {
  it("is idempotent for repeated ledger postings", () => {
    const db = createTestDb();
    const entryId = randomUUID();
    const ts = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, full_name, role) VALUES (?, ?, ?)
    `).run("user-1", "Test Resident", "resident");

    db.prepare(`
      INSERT INTO ledger_entries (
        id, user_id, entry_date, entry_type, description, debit, credit, balance_after, created_by, created_at, updated_at, voucher_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entryId, "user-1", "2026-07-10", "rent", "Test rental entry", 1000, 0, 0, "admin", ts, ts, "LGR-000001");

    syncLedgerToDoubleEntry!(db as any, entryId);
    syncLedgerToDoubleEntry!(db as any, entryId);

    const journalEntries = db.prepare("SELECT COUNT(*) as count FROM journal_entries").get() as { count: number };
    const journalLines = db.prepare("SELECT COUNT(*) as count FROM journal_lines").get() as { count: number };

    expect(journalEntries.count).toBe(1);
    expect(journalLines.count).toBe(2);

    db.close();
  });

  it("replaces stale journal rows keyed by reference", () => {
  const db = createTestDb();
  const entryId = randomUUID();
  const ts = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, full_name, role) VALUES (?, ?, ?)
  `).run("user-2", "Another Resident", "resident");

  db.prepare(`
    INSERT INTO ledger_entries (
      id, user_id, entry_date, entry_type, description, debit, credit, balance_after, created_by, created_at, updated_at, voucher_no
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(entryId, "user-2", "2026-07-10", "security", "Security deposit", 500, 0, 0, "admin", ts, ts, "LGR-000002");

  const staleEntryId = randomUUID();
  db.prepare(`
    INSERT INTO journal_entries (id, voucher_no, entry_type, entry_date, description, reference, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(staleEntryId, "OLD-VOUCHER", "JV", "2026-07-10", "Stale entry", entryId, ts, ts);
  db.prepare(`
    INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), staleEntryId, "1000", 500, 0, ts, ts);
  db.prepare(`
    INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), staleEntryId, "2100", 0, 500, ts, ts);

  syncLedgerToDoubleEntry!(db as any, entryId);

    const journalEntries = db.prepare("SELECT COUNT(*) as count FROM journal_entries").get() as { count: number };
    const journalLines = db.prepare("SELECT COUNT(*) as count FROM journal_lines").get() as { count: number };
    const staleJournal = db.prepare("SELECT COUNT(*) as count FROM journal_entries WHERE id = ?").get(staleEntryId) as { count: number };

    expect(journalEntries.count).toBe(1);
    expect(journalLines.count).toBe(2);
    expect(staleJournal.count).toBe(0);

    db.close();
  });
});
