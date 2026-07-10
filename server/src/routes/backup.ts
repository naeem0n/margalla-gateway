import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();
fs.mkdirSync(config.tmpDir, { recursive: true });
// Reduced file size limit for performance
const upload = multer({ dest: config.tmpDir, limits: { fileSize: 50 * 1024 * 1024 } });

// List of all critical tables to export/import
const COMPREHENSIVE_TABLES = [
  "properties",
  "buildings",
  "apartments",
  "users",
  "residents",
  "leases",
  "ledger_entries",
  "ledger_transactions",
  "chart_of_accounts",
  "journal_entries",
  "journal_lines",
  "security_deposits",
  "complaints",
  "staff",
  "visitors",
  "payment_requests",
  "announcements",
  "documents"
];

// Helper to log backup actions to the database
async function logBackupAction(opts: {
  action: string;
  file_name: string | null;
  file_size: number | null;
  status: "Success" | "Failed";
  details: string;
  performed_by: string;
}) {
  try {
    const { getDb, newId, now } = await import("../db/index.js");
    const db = await getDb();
    await db.run(
      `INSERT INTO backup_logs (id, action, file_name, file_size, status, details, performed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), opts.action, opts.file_name, opts.file_size, opts.status, opts.details, opts.performed_by, now()]
    );
  } catch (err: any) {
    console.error("Failed to write to backup_logs:", err.message);
  }
}

// 1. GET Backup History Logs
router.get("/logs", authRequired, requireRole("admin"), async (_req, res) => {
  try {
    const { getDb } = await import("../db/index.js");
    const db = await getDb();
    const rows = await db.query(
      "SELECT * FROM backup_logs ORDER BY created_at DESC"
    );
    res.json({ logs: rows });
  } catch (e: any) {
    console.error("Failed to fetch backup logs:", e);
    res.status(500).json({ error: e.message || "Failed to fetch logs" });
  }
});

// 2. Download raw SQLite Database File (.db)
router.get("/download", authRequired, requireRole("admin"), async (req, res) => {
  const performed_by = req.user!.sub;
  if (config.dbMode !== "sqlite" || !fs.existsSync(config.sqlitePath)) {
    await logBackupAction({
      action: "SQLite Database Download",
      file_name: null,
      file_size: null,
      status: "Failed",
      details: "Attempted SQLite backup in non-sqlite mode.",
      performed_by
    });
    return res.status(400).json({ error: "SQLite backup only available in desktop/local SQLite mode" });
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const fileName = `margalla-backup-${stamp}.db`;
  
  try {
    const stats = fs.statSync(config.sqlitePath);
    
    // Log success before downloading
    await logBackupAction({
      action: "SQLite Database Download",
      file_name: fileName,
      file_size: stats.size,
      status: "Success",
      details: "Raw SQLite database file successfully exported.",
      performed_by
    });

    res.download(config.sqlitePath, fileName);
  } catch (err: any) {
    await logBackupAction({
      action: "SQLite Database Download",
      file_name: fileName,
      file_size: null,
      status: "Failed",
      details: `File export failed: ${err.message}`,
      performed_by
    });
    res.status(500).json({ error: "Database download failed" });
  }
});

// 3. One-Click Restore raw SQLite Database File (.db)
router.post("/restore", authRequired, requireRole("admin"), upload.single("file"), async (req, res) => {
  const performed_by = req.user!.sub;
  if (!req.file) {
    return res.status(400).json({ error: ".db file required" });
  }
  if (config.dbMode !== "sqlite") {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Restore only supported in desktop/local SQLite mode" });
  }

  const fileName = req.file.originalname;
  const fileSize = req.file.size;

  try {
    fs.copyFileSync(req.file.path, config.sqlitePath);
    fs.unlinkSync(req.file.path);

    await logBackupAction({
      action: "SQLite Database Restore",
      file_name: fileName,
      file_size: fileSize,
      status: "Success",
      details: "SQLite database file successfully uploaded and restored.",
      performed_by
    });

    res.json({ ok: true, message: "Database restored. Please restart the application." });
  } catch (err: any) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    await logBackupAction({
      action: "SQLite Database Restore",
      file_name: fileName,
      file_size: fileSize,
      status: "Failed",
      details: `Database restore failed: ${err.message}`,
      performed_by
    });
    res.status(500).json({ error: err.message || "Failed to restore database" });
  }
});

// 4. Export database as JSON Snapshot File
router.get("/export-json", authRequired, requireRole("admin"), async (req, res) => {
  const performed_by = req.user!.sub;
  try {
    const { getDb } = await import("../db/index.js");
    const db = await getDb();
    
    const snapshot: Record<string, unknown> = {
      _meta: {
        exported_at: new Date().toISOString(),
        version: "1.0",
        source: "Margalla Gateway ERP Suite"
      }
    };

    for (const t of COMPREHENSIVE_TABLES) {
      snapshot[t] = await db.query(`SELECT * FROM ${t}`);
    }

    const jsonStr = JSON.stringify(snapshot, null, 2);
    const sizeBytes = Buffer.byteLength(jsonStr, "utf-8");

    await logBackupAction({
      action: "JSON Snapshot Export",
      file_name: "json_export",
      file_size: sizeBytes,
      status: "Success",
      details: `JSON database snapshot exported covering ${COMPREHENSIVE_TABLES.length} tables.`,
      performed_by
    });

    res.setHeader("Content-Disposition", `attachment; filename=margalla-export-${Date.now()}.json`);
    res.setHeader("Content-Type", "application/json");
    res.send(jsonStr);
  } catch (e: any) {
    console.error("JSON export failed:", e);
    await logBackupAction({
      action: "JSON Snapshot Export",
      file_name: null,
      file_size: null,
      status: "Failed",
      details: `JSON export failed: ${e.message}`,
      performed_by
    });
    res.status(500).json({ error: e.message || "JSON export failed" });
  }
});

// 5. Import database from JSON Snapshot File
router.post("/import-json", authRequired, requireRole("admin"), upload.single("file"), async (req, res) => {
  const performed_by = req.user!.sub;
  if (!req.file) {
    return res.status(400).json({ error: "JSON file required" });
  }

  const fileName = req.file.originalname;
  const fileSize = req.file.size;
  
  try {
    const { getDb } = await import("../db/index.js");
    const db = await getDb();
    const fileContent = fs.readFileSync(req.file.path, "utf-8");
    fs.unlinkSync(req.file.path); // cleanup file

    const data = JSON.parse(fileContent);
    if (!data._meta) {
      throw new Error("Invalid backup format: missing '_meta' header section.");
    }

    // Disable foreign key constraint during batch deletion and insertion
    await db.run("PRAGMA foreign_keys = OFF");

    for (const table of COMPREHENSIVE_TABLES) {
      if (data[table] && Array.isArray(data[table])) {
        // Truncate current table
        await db.run(`DELETE FROM ${table}`);
        
        const rows = data[table];
        if (rows.length === 0) continue;

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => "?").join(", ");
        const insertSql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

        for (const row of rows) {
          const values = columns.map(col => row[col]);
          await db.run(insertSql, values);
        }
      }
    }

    await db.run("PRAGMA foreign_keys = ON");

    await logBackupAction({
      action: "JSON Snapshot Import",
      file_name: fileName,
      file_size: fileSize,
      status: "Success",
      details: "JSON database snapshot imported. All matching tables were overwritten successfully.",
      performed_by
    });

    res.json({ ok: true, message: "JSON database snapshot imported successfully." });
  } catch (err: any) {
    if (fs.existsSync(req.file?.path || "")) fs.unlinkSync(req.file.path);
    try {
      const { getDb } = await import("../db/index.js");
      const db = await getDb();
      await db.run("PRAGMA foreign_keys = ON");
    } catch {}

    await logBackupAction({
      action: "JSON Snapshot Import",
      file_name: fileName,
      file_size: fileSize,
      status: "Failed",
      details: `JSON import failed: ${err.message}`,
      performed_by
    });
    res.status(500).json({ error: err.message || "Failed to import JSON snapshot" });
  }
});

// 6. Clear and Reset database tables
router.post("/clear", authRequired, requireRole("admin"), async (req, res) => {
  const performed_by = req.user!.sub;
  if (config.dbMode !== "sqlite") {
    return res.status(400).json({ error: "Clear only supported in desktop/local SQLite mode" });
  }
  try {
    const { db } = await import("../db/sqlite.js");
    const tables = [
      ...COMPREHENSIVE_TABLES,
      "backup_logs"
    ];
    for (const t of tables) {
      db.exec(`DROP TABLE IF EXISTS ${t}`);
    }

    let schemaPath = path.join(process.cwd(), "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(process.cwd(), "server", "src", "db", "schema.sql");
    }
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      db.exec(schema);
    }

    // Re-seed default admin
    const hash = bcrypt.hashSync("MARGALLA@RAHMAN1112", 10);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, client_id, email, password_hash, full_name, role, permissions_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'admin', '{}', ?, ?)`
    ).run("admin-id-default", "ADMIN-001", "admin@margalla.local", hash, "System Admin", now, now);

    await logBackupAction({
      action: "Database Clear & Reset",
      file_name: null,
      file_size: null,
      status: "Success",
      details: "Database cleared and reset to fresh state.",
      performed_by
    });

    res.json({ ok: true, message: "Database cleared and schema reset." });
  } catch (err: any) {
    console.error("Failed to clear database:", err);
    await logBackupAction({
      action: "Database Clear & Reset",
      file_name: null,
      file_size: null,
      status: "Failed",
      details: `Database clear failed: ${err.message}`,
      performed_by
    });
    res.status(500).json({ error: err.message || "Failed to clear database" });
  }
});

export async function runAutoBackup(performed_by: string = "system") {
  if (config.dbMode !== "sqlite" || !fs.existsSync(config.sqlitePath)) {
    return;
  }
  
  const backupDir = path.join(path.dirname(config.sqlitePath), "backups");
  try {
    fs.mkdirSync(backupDir, { recursive: true });
  } catch (err) {}

  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
  const fileName = `auto-backup-${stamp}.db`;
  const destPath = path.join(backupDir, fileName);

  // If backup for today already exists, skip it to avoid write churn
  if (fs.existsSync(destPath)) {
    console.log(`[Auto-Backup] Backup for today (${fileName}) already exists. Skipping.`);
    return;
  }

  try {
    // Copy the database file safely
    fs.copyFileSync(config.sqlitePath, destPath);
    const stats = fs.statSync(destPath);
    console.log(`[Auto-Backup] Saved database backup to: ${destPath} (${(stats.size / 1024).toFixed(1)} KB)`);

    // Log to DB
    await logBackupAction({
      action: "Auto Database Backup",
      file_name: fileName,
      file_size: stats.size,
      status: "Success",
      details: "Automated daily rotation backup successfully created.",
      performed_by
    });

    // Prune old backups - keep last 10
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith("auto-backup-") && f.endsWith(".db"))
      .map(f => ({ name: f, path: path.join(backupDir, f), birthtime: fs.statSync(path.join(backupDir, f)).birthtimeMs }));
    
    // Sort oldest first
    files.sort((a, b) => a.birthtime - b.birthtime);
    
    while (files.length > 10) {
      const oldest = files.shift();
      if (oldest && fs.existsSync(oldest.path)) {
        fs.unlinkSync(oldest.path);
        console.log(`[Auto-Backup] Pruned oldest backup file: ${oldest.name}`);
      }
    }
  } catch (err: any) {
    console.error("[Auto-Backup] Backup operation failed:", err.message);
    await logBackupAction({
      action: "Auto Database Backup",
      file_name: fileName,
      file_size: null,
      status: "Failed",
      details: `Automated backup failed: ${err.message}`,
      performed_by
    });
  }
}

export function startAutoBackupSchedule() {
  // Run once immediately on startup (with a small timeout of 3 seconds to let initialization complete)
  setTimeout(() => {
    runAutoBackup().catch(err => console.error("Initial auto-backup failed:", err));
  }, 3000);

  // Run every 24 hours
  setInterval(() => {
    runAutoBackup().catch(err => console.error("Periodic auto-backup failed:", err));
  }, 24 * 60 * 60 * 1000);
}

export default router;
