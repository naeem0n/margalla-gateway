import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { getDb, newId, now } from "../db/index.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import type { Document } from "../db/types.js";
import { config } from "../config.js";

const uploadDir = config.uploadsDir;
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
// Reduced file size limit for performance - 25MB to 5MB
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.get("/", authRequired, async (req, res) => {
  const db = await getDb();
  if (req.user!.role === "admin") {
    const { owner_type, owner_id } = req.query as { owner_type?: string; owner_id?: string };
    let sql = "SELECT * FROM documents WHERE 1=1";
    const params: unknown[] = [];
    if (owner_type) {
      sql += " AND owner_type = ?";
      params.push(owner_type);
    }
    if (owner_id) {
      sql += " AND owner_id = ?";
      params.push(owner_id);
    }
    sql += " ORDER BY created_at DESC";
    return res.json({ documents: await db.query<Document>(sql, params) });
  }
  const docs = await db.query<Document>(
    "SELECT * FROM documents WHERE owner_id = ? OR owner_type = 'public' ORDER BY created_at DESC",
    [req.user!.sub],
  );
  res.json({ documents: docs });
});

router.post("/", authRequired, requireRole("admin"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File required" });
  const { title, owner_type, owner_id, doc_type } = req.body ?? {};
  const id = newId();
  const ts = now();
  const db = await getDb();
  await db.run(
    `INSERT INTO documents (id, owner_id, owner_type, title, doc_type, file_path, file_size, mime_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      owner_id ?? null,
      owner_type ?? "public",
      title ?? req.file.originalname,
      doc_type ?? "general",
      req.file.filename,
      req.file.size,
      req.file.mimetype,
      ts,
      ts,
    ],
  );
  await db.enqueueSync("documents", id, "insert", { id, title, file_path: req.file.filename });
  res.json({ id, file_path: req.file.filename });
});

router.get("/:id/download", authRequired, async (req, res) => {
  const db = await getDb();
  const doc = await db.queryOne<Document>("SELECT * FROM documents WHERE id = ?", [req.params.id]);
  if (!doc) return res.status(404).json({ error: "Not found" });
  if (req.user!.role !== "admin" && doc.owner_id && doc.owner_id !== req.user!.sub && doc.owner_type !== "public") {
    return res.status(403).json({ error: "Access denied" });
  }
  const fp = path.join(uploadDir, doc.file_path);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: "File missing on server" });
  res.download(fp, doc.title);
});

router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const db = await getDb();
  const doc = await db.queryOne<Document>("SELECT * FROM documents WHERE id = ?", [req.params.id]);
  if (doc) {
    const fp = path.join(uploadDir, doc.file_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await db.run("DELETE FROM documents WHERE id = ?", [req.params.id]);
    await db.enqueueSync("documents", req.params.id, "delete", { id: req.params.id });
  }
  res.json({ ok: true });
});

export default router;
