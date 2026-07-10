import { Router } from "express";
import { getDb, newId, now, postLedgerEntry } from "../db/index.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import type { Complaint } from "../db/types.js";

const router = Router();

// 1. GET all complaints
router.get("/", authRequired, async (req, res) => {
  try {
    const db = await getDb();
    // Allow admins or staff with permission to see all complaints
    if (req.user!.role === "admin") {
      const rows = await db.query<Complaint>("SELECT * FROM complaints ORDER BY created_at DESC");
      return res.json({ complaints: rows });
    }
    if (req.user!.role === "thirdparty") {
      const rows = await db.query<Complaint>(
        "SELECT * FROM complaints WHERE assigned_to LIKE ? ORDER BY created_at DESC",
        [`%${req.user!.client_id}%`]
      );
      return res.json({ complaints: rows });
    }
    // Residents only see their own
    const rows = await db.query<Complaint>(
      "SELECT * FROM complaints WHERE resident_id = ? ORDER BY created_at DESC",
      [req.user!.sub]
    );
    res.json({ complaints: rows });
  } catch (e: any) {
    console.error("Failed to fetch complaints:", e);
    res.status(500).json({ error: e.message || "Failed to fetch complaints" });
  }
});

// 2. POST create new complaint
router.post("/", authRequired, async (req, res) => {
  const { title, category, priority, description, resident_id, assigned_to } = req.body ?? {};
  if (!title || !category) {
    return res.status(400).json({ error: "title and category are required" });
  }

  try {
    const db = await getDb();
    const id = newId();
    const ts = now();
    
    // Residents log for themselves. Admins can log on behalf of any resident, defaulting to admin user ID if none provided.
    const targetResidentId = req.user!.role === "resident" ? req.user!.sub : (resident_id ?? req.user!.sub);

    await db.run(
      `INSERT INTO complaints (id, resident_id, title, category, priority, description, status, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
      [id, targetResidentId, title, category, priority ?? "normal", description ?? null, assigned_to ?? null, ts, ts]
    );

    const payload = {
      id,
      resident_id: targetResidentId,
      title,
      category,
      priority: priority ?? "normal",
      description: description ?? null,
      status: "open",
      assigned_to: assigned_to ?? null,
      created_at: ts,
      updated_at: ts
    };

    // Queue for cloud sync
    await db.enqueueSync("complaints", id, "insert", payload);

    res.json({ success: true, complaint: payload });
  } catch (e: any) {
    console.error("Failed to create complaint:", e);
    res.status(500).json({ error: e.message || "Failed to create complaint" });
  }
});

// 3. PATCH update complaint fields (status, resolution, cost, assigned_to)
router.patch("/:id", authRequired, async (req, res) => {
  const { status, resolution, maintenance_cost, assigned_to } = req.body ?? {};
  
  try {
    const db = await getDb();
    const existing = await db.queryOne<Complaint>(
      "SELECT * FROM complaints WHERE id = ? LIMIT 1",
      [req.params.id]
    );
    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    if (req.user!.role !== "admin") {
      const isOwner = existing.resident_id === req.user!.sub;
      const isAssigned = existing.assigned_to && existing.assigned_to.includes(req.user!.client_id ?? "");
      if (!isOwner && !isAssigned) {
        return res.status(403).json({ error: "Access denied: complaint does not belong to you or is not assigned to you" });
      }
      if (req.user!.role === "resident") {
        if (maintenance_cost !== undefined || assigned_to !== undefined) {
          return res.status(403).json({ error: "Access denied: you cannot modify maintenance cost or assigned staff" });
        }
      }
    }

    const ts = now();
    const updatedStatus = status ?? existing.status;
    const updatedResolution = resolution !== undefined ? resolution : (existing as any).resolution;
    const updatedMaintCost = maintenance_cost !== undefined ? Number(maintenance_cost) : (existing as any).maintenance_cost;
    const updatedAssignedTo = assigned_to !== undefined ? assigned_to : (existing as any).assigned_to;

    await db.run(
      `UPDATE complaints SET
        status = ?,
        resolution = ?,
        maintenance_cost = ?,
        assigned_to = ?,
        updated_at = ?
       WHERE id = ?`,
      [updatedStatus, updatedResolution, updatedMaintCost, updatedAssignedTo, ts, req.params.id]
    );

    const payload = {
      ...existing,
      status: updatedStatus,
      resolution: updatedResolution,
      maintenance_cost: updatedMaintCost,
      assigned_to: updatedAssignedTo,
      updated_at: ts
    };

    // Queue for cloud sync
    await db.enqueueSync("complaints", req.params.id, "update", payload);

    res.json({ success: true, complaint: payload });
  } catch (e: any) {
    console.error("Failed to update complaint:", e);
    res.status(500).json({ error: e.message || "Failed to update complaint" });
  }
});

// 4. DELETE a complaint
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const db = await getDb();
    const existing = await db.queryOne("SELECT id FROM complaints WHERE id = ?", [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    await db.run("DELETE FROM complaints WHERE id = ?", [req.params.id]);
    
    // Queue delete for cloud sync
    await db.enqueueSync("complaints", req.params.id, "delete", { id: req.params.id });

    res.json({ success: true, message: "Complaint deleted locally" });
  } catch (e: any) {
    console.error("Failed to delete complaint:", e);
    res.status(500).json({ error: e.message || "Failed to delete complaint" });
  }
});

export default router;
