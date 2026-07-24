import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import type { NextFunction, Request, Response } from "express";
import { getDb } from "./db/index.js";
import { startSyncInterval } from "./sync/engine.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import ledgerRoutes from "./routes/ledger.js";
import documentRoutes from "./routes/documents.js";
import complaintRoutes from "./routes/complaints.js";
import backupRoutes, { startAutoBackupSchedule } from "./routes/backup.js";
import reportRoutes from "./routes/reports.js";
import syncRoutes from "./routes/sync.js";
import extraRoutes from "./routes/extraRoutes.js";
import staffRoutes from "./routes/staff.js";
import apartmentsRoutes from "./routes/apartments.js";
import queryBridgeRouter from "./routes/queryBridge.js";
import notificationsRouter from "./routes/notifications.js";
import supportRoutes from "./routes/support.js";
import accountingRoutes from "./routes/accounting.js";
import type { UserRole } from "./db/types.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(config.uploadsDir));

// Auth router mounting handles unified logins now

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: config.dbMode, desktop: config.isDesktop });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/search", async (req, res) => {
  let defaultResponse = {
    success: true,
    results: [],
    message: "Search handled successfully",
    total: 0
  };

  try {
    const queryTerm = (req.query.q || req.query.term || "").toString();
    
    if (!queryTerm.trim()) {
      return res.json(defaultResponse);
    }

    console.log(`Executing global secure search for: ${queryTerm}`);

    const { getDb } = await import("./db/index.js");
    const db = await getDb();
    
    const rows = await db.query(
      `SELECT * FROM apartments 
       WHERE number LIKE ? 
          OR owner_name LIKE ? 
          OR status LIKE ? 
          OR type LIKE ?`,
      [`%${queryTerm}%`, `%${queryTerm}%`, `%${queryTerm}%`, `%${queryTerm}%`]
    );

    return res.json({
      success: true,
      results: rows || [],
      total: (rows || []).length
    });

  } catch (globalError: any) {
    console.error("Global search failed:", globalError);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        results: [],
        total: 0,
        error: globalError?.message || "Search failed",
      });
    }
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/apartments", apartmentsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/accounting", accountingRoutes);
app.get("/api/thirdparty/apartments", async (req, res) => {
  try {
    const { getDb } = await import("./db/index.js");
    const db = await getDb();
    
    // Fetch all apartments
    const apartments = await db.query("SELECT * FROM apartments ORDER BY number ASC");
    
    // Fetch all residents/users to map tenants
    const users = await db.query("SELECT id, full_name, apartment_no FROM users WHERE role = 'resident'");
    
    const userMap = new Map();
    users.forEach((u: any) => {
      if (u.apartment_no) {
        userMap.set(u.apartment_no.toUpperCase(), u.full_name);
      }
    });

    const result = apartments.map((apt: any) => {
      const unitNumber = apt.number;
      const tenantName = userMap.get(unitNumber.toUpperCase()) || "None";
      const statusLabel = apt.status === "occupied" ? "Occupied" : "Available";
      
      // Generate consistent mock inventory list based on the unit characters
      const charCode = unitNumber.charCodeAt(0) || 0;
      const lastCode = unitNumber.charCodeAt(unitNumber.length - 1) || 0;
      const isA = charCode % 2 === 0;
      const isB = lastCode % 2 === 0;
      
      const inventory = [
        { name: "AC Remote", present: isA },
        { name: "Keys (Main Door)", present: true },
        { name: "Gas Meter Key", present: isB },
        { name: "Geyser Remote", present: !isA }
      ];

      return {
        id: apt.id,
        unit: unitNumber,
        tenant: tenantName,
        status: statusLabel,
        inventory
      };
    });

    res.json(result);
  } catch (err: any) {
    console.error("Failed to fetch thirdparty apartments:", err);
    res.status(500).json({ error: "Failed to fetch apartments" });
  }
});

app.use("/api", queryBridgeRouter);
app.use("/api", extraRoutes);
app.use("/api", notificationsRouter);

app.get("/api/download-setup", (req, res) => {
  const setupPaths = [
    path.join(process.cwd(), "dist-electron", "Margalla Gateway Setup 1.0.0.exe"),
    path.join(process.cwd(), "..", "dist-electron", "Margalla Gateway Setup 1.0.0.exe"),
    path.join(process.cwd(), "dist-electron", "Margalla Gateway Management System Setup 1.0.0.exe"),
    path.join(process.cwd(), "..", "dist-electron", "Margalla Gateway Management System Setup 1.0.0.exe"),
  ];

  let foundPath = null;
  for (const p of setupPaths) {
    if (fs.existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  if (foundPath) {
    res.download(foundPath, "Margalla Gateway Setup 1.0.0.exe");
  } else {
    res.status(404).json({ error: "Margalla Gateway Setup 1.0.0.exe not found on server. Please package using build:electron first." });
  }
});

// Serve built frontend in production/desktop
const distPath = path.join(process.cwd(), "app.asar", "dist", "client"); if (!fs.existsSync(distPath)) { console.log("Falling back to process.cwd"); var altDistPath = path.join(process.cwd(), "dist", "client"); }
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

// Central error handler: ensures errors surfaced via next(err) (or thrown in a
// sync handler) are logged and returned as a proper 500 instead of leaving the
// request hanging or leaking a stack trace to the client.
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) {
    return _next(err);
  }
  res.status(err?.status || err?.statusCode || 500).json({
    error: err?.message || "Internal server error",
  });
});

async function main() {
  const dbAdapter = await getDb();
  if (dbAdapter.mode === "sqlite") {
    const { db } = await import("./db/sqlite.js");
    try {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      console.log("[SQLite] WAL checkpoint completed. Database file saved.");
    } catch (err) {
      console.error("[SQLite] WAL checkpoint failed:", err);
    }
    
    // SQLite optimizations & periodic space reclamation
    try {
      db.exec("PRAGMA optimize;");
      console.log("[SQLite] PRAGMA optimize completed successfully.");
    } catch (err) {
      console.error("[SQLite] PRAGMA optimize failed:", err);
    }

    try {
      db.exec("VACUUM;");
      console.log("[SQLite] Database VACUUM completed successfully (Space Reclaimed).");
    } catch (err) {
      console.error("[SQLite] Database VACUUM failed:", err);
    }
  }

  startSyncInterval();
  startAutoBackupSchedule();
  if (!process.env.VERCEL) {
    app.listen(config.port, () => {
      console.log(`Margalla Gateway API running on http://localhost:${config.port} [${config.dbMode}]`);
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export default app;

