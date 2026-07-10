import { Router } from "express";
import { config } from "../config.js";
import { applyRemoteSyncItem, pushPendingToCloud } from "../sync/engine.js";
import type { SyncQueueItem } from "../db/types.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

function syncKeyOk(req: { headers: Record<string, string | string[] | undefined> }) {
  const key = req.headers["x-sync-key"];
  return config.syncApiKey && key === config.syncApiKey;
}

router.post("/apply", async (req, res) => {
  if (!syncKeyOk(req)) return res.status(401).json({ error: "Invalid sync key" });
  try {
    await applyRemoteSyncItem(req.body as SyncQueueItem);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Apply failed" });
  }
});

router.get("/pending-fixes", async (req, res) => {
  if (!syncKeyOk(req)) return res.status(401).json({ error: "Invalid sync key" });
  res.json({ fixes: [] });
});

router.post("/report-fix", async (req, res) => {
  if (!syncKeyOk(req)) return res.status(401).json({ error: "Invalid sync key" });
  console.log("[Cloud Support] Received remote fix execution report:", req.body);
  res.json({ ok: true });
});

router.post("/push", async (req, res) => {
  if (!syncKeyOk(req)) return res.status(401).json({ error: "Invalid sync key" });
  const result = await pushPendingToCloud();
  res.json(result);
});

router.get("/status", async (req, res) => {
  if (!syncKeyOk(req)) return res.status(401).json({ error: "Invalid sync key" });
  const { getDb } = await import("../db/index.js");
  const db = await getDb();
  const pending = await db.queryOne<{ c: number }>(
    "SELECT COUNT(*) as c FROM sync_queue WHERE synced_at IS NULL",
  );
  res.json({ pending: Number(pending?.c ?? 0), mode: config.dbMode, isDesktop: config.isDesktop });
});

router.get("/client-status", authRequired, async (req, res) => {
  try {
    const { getDb } = await import("../db/index.js");
    const db = await getDb();
    const pending = await db.queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM sync_queue WHERE synced_at IS NULL",
    );
    const errorCount = await db.queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM sync_queue WHERE error IS NOT NULL",
    );

    let isOnline = false;
    if (config.syncCloudUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const testRes = await fetch(`${config.syncCloudUrl}/api/health`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        isOnline = testRes.ok;
      } catch (_) {
        isOnline = false;
      }
    }

    res.json({
      pendingCount: Number(pending?.c ?? 0),
      errorCount: Number(errorCount?.c ?? 0),
      isOnline,
      mode: config.dbMode,
      isDesktop: config.isDesktop
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to fetch status" });
  }
});

router.get("/config", async (req, res) => {
  res.json({
    syncCloudUrl: config.syncCloudUrl,
    syncApiKey: config.syncApiKey,
  });
});

router.post("/config", async (req, res) => {
  const { syncCloudUrl, syncApiKey } = req.body ?? {};
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sqliteDir = path.dirname(config.sqlitePath);
    const syncConfigPath = path.join(sqliteDir, "sync_config.json");
    
    const settings = {
      syncCloudUrl: syncCloudUrl ?? "",
      syncApiKey: syncApiKey ?? "",
    };
    
    if (!fs.existsSync(sqliteDir)) {
      fs.mkdirSync(sqliteDir, { recursive: true });
    }
    fs.writeFileSync(syncConfigPath, JSON.stringify(settings, null, 2), "utf-8");
    
    config.syncCloudUrl = settings.syncCloudUrl;
    config.syncApiKey = settings.syncApiKey;
    
    res.json({ success: true, settings });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to save sync config" });
  }
});

export default router;

