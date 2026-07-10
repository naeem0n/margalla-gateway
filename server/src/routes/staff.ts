import { Router } from "express";
import { getDb, newId, now, postLedgerEntry } from "../db/index.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

// 1. GET all staff
router.get("/", authRequired, requireRole("admin"), async (_req, res) => {
  try {
    const db = await getDb();
    const rows = await db.query(
      "SELECT * FROM staff ORDER BY full_name ASC"
    );
    res.json({ staff: rows });
  } catch (e: any) {
    console.error("Fetch staff failed:", e);
    res.status(500).json({ error: e.message || "Failed to fetch staff" });
  }
});

// 2. POST create staff member
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  const { full_name, role, phone, cnic, salary, join_date, status, notes, duty_start, duty_end, photo_url, id_card_url, appointment_letter_url, father_name, address, witness_name, witness_cnic, witness_phone } = req.body ?? {};
  if (!full_name || !role) {
    return res.status(400).json({ error: "full_name and role are required" });
  }
  try {
    const id = newId();
    const ts = now();
    const db = await getDb();
    await db.run(
      `INSERT INTO staff (id, full_name, role, phone, cnic, salary, join_date, status, notes, duty_start, duty_end, advance_balance, photo_url, id_card_url, appointment_letter_url, father_name, address, witness_name, witness_cnic, witness_phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        full_name,
        role,
        phone ?? null,
        cnic ?? null,
        Number(salary) || 0,
        join_date ?? null,
        status ?? "active",
        notes ?? null,
        duty_start ?? null,
        duty_end ?? null,
        photo_url ?? null,
        id_card_url ?? null,
        appointment_letter_url ?? null,
        father_name ?? null,
        address ?? null,
        witness_name ?? null,
        witness_cnic ?? null,
        witness_phone ?? null,
        ts,
        ts
      ]
    );
    res.json({ id });
  } catch (e: any) {
    console.error("Create staff failed:", e);
    res.status(500).json({ error: e.message || "Failed to create staff member" });
  }
});

// 3. PATCH update staff member
router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const { full_name, role, phone, cnic, salary, join_date, status, notes, duty_start, duty_end, photo_url, id_card_url, appointment_letter_url, father_name, address, witness_name, witness_cnic, witness_phone } = req.body ?? {};
  try {
    const db = await getDb();
    const ts = now();
    await db.run(
      `UPDATE staff
       SET full_name = COALESCE(?, full_name),
           role = COALESCE(?, role),
           phone = COALESCE(?, phone),
           cnic = COALESCE(?, cnic),
           salary = COALESCE(?, salary),
           join_date = COALESCE(?, join_date),
           status = COALESCE(?, status),
           notes = COALESCE(?, notes),
           duty_start = COALESCE(?, duty_start),
           duty_end = COALESCE(?, duty_end),
           photo_url = COALESCE(?, photo_url),
           id_card_url = COALESCE(?, id_card_url),
           appointment_letter_url = COALESCE(?, appointment_letter_url),
           father_name = COALESCE(?, father_name),
           address = COALESCE(?, address),
           witness_name = COALESCE(?, witness_name),
           witness_cnic = COALESCE(?, witness_cnic),
           witness_phone = COALESCE(?, witness_phone),
           updated_at = ?
       WHERE id = ?`,
      [
        full_name ?? null,
        role ?? null,
        phone ?? null,
        cnic ?? null,
        salary !== undefined ? Number(salary) : null,
        join_date ?? null,
        status ?? null,
        notes ?? null,
        duty_start ?? null,
        duty_end ?? null,
        photo_url ?? null,
        id_card_url ?? null,
        appointment_letter_url ?? null,
        father_name ?? null,
        address ?? null,
        witness_name ?? null,
        witness_cnic ?? null,
        witness_phone ?? null,
        ts,
        req.params.id
      ]
    );
    res.json({ ok: true });
  } catch (e: any) {
    console.error("Update staff failed:", e);
    res.status(500).json({ error: e.message || "Failed to update staff member" });
  }
});

// 4. DELETE staff member
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const db = await getDb();
    await db.run("DELETE FROM staff WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("Delete staff failed:", e);
    res.status(500).json({ error: e.message || "Failed to delete staff member" });
  }
});

// 5. POST give staff advance
router.post("/give-advance", authRequired, requireRole("admin"), async (req, res) => {
  const { staff_id, amount, notes } = req.body ?? {};
  if (!staff_id || !amount) {
    return res.status(400).json({ error: "staff_id and amount are required" });
  }
  const amt = Number(amount);
  if (amt <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  try {
    const db = await getDb();
    const staff = await db.queryOne<{ full_name: string }>(
      "SELECT full_name FROM staff WHERE id = ?",
      [staff_id]
    );
    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const ts = now();

    // 1. Update staff advance balance
    await db.run(
      "UPDATE staff SET advance_balance = advance_balance + ?, updated_at = ? WHERE id = ?",
      [amt, ts, staff_id]
    );

    res.json({ ok: true });
  } catch (e: any) {
    console.error("Give advance failed:", e);
    res.status(500).json({ error: e.message || "Failed to issue advance" });
  }
});

// 6. POST pay staff salary
router.post("/pay-salary", authRequired, requireRole("admin"), async (req, res) => {
  const { staff_id, period } = req.body ?? {};
  if (!staff_id || !period) {
    return res.status(400).json({ error: "staff_id and period are required" });
  }

  try {
    const db = await getDb();
    const staff = await db.queryOne<{ full_name: string; salary: number; advance_balance: number }>(
      "SELECT full_name, salary, advance_balance FROM staff WHERE id = ?",
      [staff_id]
    );
    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const gross = Number(staff.salary) || 0;
    const advanceDeducted = Math.min(Number(staff.advance_balance || 0), gross);
    const netPaid = Math.max(gross - advanceDeducted, 0);

    const ts = now();
    const paymentId = newId();

    // 1. Create payment record
    await db.run(
      `INSERT INTO staff_salary_payments (id, staff_id, period_month, gross_salary, advance_deducted, net_paid, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, staff_id, period, gross, advanceDeducted, netPaid, ts]
    );

    // 2. Reset advance balance on staff record
    await db.run(
      "UPDATE staff SET advance_balance = advance_balance - ?, updated_at = ? WHERE id = ?",
      [advanceDeducted, ts, staff_id]
    );

    res.json({
      payment: {
        id: paymentId,
        staff_id,
        period_month: period,
        gross_salary: gross,
        advance_deducted: advanceDeducted,
        net_paid: netPaid,
        paid_at: ts
      }
    });
  } catch (e: any) {
    console.error("Pay salary failed:", e);
    res.status(500).json({ error: e.message || "Failed to process salary payment" });
  }
});

// 7. GET staff salary history / payments
router.get("/:id/payments", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.query(
      "SELECT * FROM staff_salary_payments WHERE staff_id = ? ORDER BY paid_at DESC",
      [req.params.id]
    );
    res.json({ payments: rows });
  } catch (e: any) {
    console.error("Fetch staff payments failed:", e);
    res.status(500).json({ error: e.message || "Failed to fetch payments" });
  }
});

export default router;
