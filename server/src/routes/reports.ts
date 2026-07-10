import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { getDb, newId, now } from "../db/index.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";

const uploadDir = config.reportsDir;
fs.mkdirSync(uploadDir, { recursive: true });
// Reduced file size limit for performance - 50MB to 5MB
const upload = multer({ dest: uploadDir, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.get("/", authRequired, requireRole("admin"), async (_req, res) => {
  const db = await getDb();
  const rows = await db.query("SELECT * FROM reports ORDER BY created_at DESC");
  res.json({ reports: rows });
});

router.post("/", authRequired, requireRole("admin"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File required" });
  const { title, report_type } = req.body ?? {};
  const id = newId();
  const ts = now();
  const db = await getDb();
  await db.run(
    `INSERT INTO reports (id, title, report_type, file_path, file_size, uploaded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title ?? req.file.originalname, report_type ?? "general", req.file.filename, req.file.size, req.user!.sub, ts, ts],
  );
  await db.enqueueSync("reports", id, "insert", { id, title, report_type });
  res.json({ id });
});

router.get("/:id/download", authRequired, requireRole("admin"), async (req, res) => {
  const db = await getDb();
  const row = await db.queryOne<{ file_path: string; title: string }>(
    "SELECT file_path, title FROM reports WHERE id = ?",
    [req.params.id],
  );
  if (!row) return res.status(404).json({ error: "Not found" });
  res.download(path.join(uploadDir, row.file_path), row.title);
});

export default router;
