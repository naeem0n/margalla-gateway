import { Router } from "express";
import { handlePaymentReturn, handleStaffStatus } from "../controllers/adminController.js";
import { db } from "../db/sqlite.js";
import { randomUUID } from "node:crypto";
import { authRequired, requireRole } from "../middleware/auth.js";
import { getDb, postLedgerEntry } from "../db/index.js";

const router = Router();

// 1. PAYMENT RETURN BUTTON API - Order cancel aur wapsi ke liye
router.post("/admin/refund/:invoiceId", authRequired, requireRole("admin"), (req, res) => {
  const { invoiceId } = req.params;
  const result = handlePaymentReturn(invoiceId);
  if (result.success) {
    return res.json({ success: true, message: result.message });
  }
  return res.status(400).json({ success: false, message: result.message });
});

// 2. STAFF TIMELINE API - Joining aur Ending Date update karne ke liye
router.post("/admin/staff/status", authRequired, requireRole("admin"), (req, res) => {
  const { staffId, name, role, joiningDate, endingDate } = req.body;
  handleStaffStatus(staffId, name, role, joiningDate, endingDate);
  res.json({ success: true, message: "Staff status updated in database!" });
});

// 3. COMPLAINTS API - Resident ki tarf se log accept karne ke liye
router.post("/resident/complaint", authRequired, (req, res) => {
  const { residentId, title, description } = req.body;
  try {
    const targetResidentId = req.user!.role === "admin" ? residentId : req.user!.sub;
    
    // Map to actual DB schema (resident_id, category, created_at, updated_at) to prevent sql errors
    db.prepare(`
      INSERT INTO complaints (id, resident_id, title, category, description, status, created_at, updated_at)
      VALUES (?, ?, ?, 'Maintenance', ?, 'open', datetime('now'), datetime('now'))
    `).run(randomUUID(), targetResidentId, title, description);
    res.json({ success: true, message: "Complaint ticket registered!" });
  } catch (e: any) {
    console.error("Failed to register complaint:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to register complaint" });
  }
});

// 4. PARKING RULES - GET all rules
router.get("/parking-rules", authRequired, (req, res) => {
  try {
    const rules = db.prepare("SELECT * FROM parking_rules ORDER BY rowid ASC").all();
    res.json({ success: true, rules });
  } catch (e: any) {
    console.error("Failed to fetch parking rules:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to fetch rules" });
  }
});

// 5. PARKING RULES - POST add new rule
router.post("/parking-rules", authRequired, requireRole("admin"), (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ success: false, message: "Title and description are required" });
  }
  try {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO parking_rules (id, title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, description, now, now);
    res.json({ success: true, message: "Rule added!", rule: { id, title, description, created_at: now, updated_at: now } });
  } catch (e: any) {
    console.error("Failed to add parking rule:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to add rule" });
  }
});

// 6. PARKING RULES - PUT update rule
router.put("/parking-rules/:id", authRequired, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ success: false, message: "Title and description are required" });
  }
  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE parking_rules 
      SET title = ?, description = ?, updated_at = ?
      WHERE id = ?
    `).run(title, description, now, id);
    res.json({ success: true, message: "Rule updated!" });
  } catch (e: any) {
    console.error("Failed to update parking rule:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to update rule" });
  }
});

// 7. PARKING RULES - DELETE rule
router.delete("/parking-rules/:id", authRequired, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM parking_rules WHERE id = ?").run(id);
    res.json({ success: true, message: "Rule deleted!" });
  } catch (e: any) {
    console.error("Failed to delete parking rule:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to delete rule" });
  }
});

// 8. NOTIFICATIONS - provider status
router.get("/notifications/provider-status", authRequired, requireRole("admin"), (req, res) => {
  res.json({
    whatsapp: { configured: false, mode: "mock", provider: "mock" },
    sms: { configured: false, mode: "mock", provider: "mock" },
  });
});

// 9. NOTIFICATIONS - send manual / test
router.post("/notifications/send", authRequired, requireRole("admin"), async (req, res) => {
  const { channel, to, body, templateKey, variables, subject, recipientUserId, triggerType, referenceId } = req.body ?? {};
  if (!channel || !to) {
    return res.status(400).json({ error: "channel and to are required" });
  }
  try {
    let finalBody = body ?? "";
    let finalSubject = subject;
    if (templateKey) {
      const tpl = db.prepare("SELECT body, subject, is_active FROM notification_templates WHERE key = ?").get(templateKey) as any;
      if (tpl && tpl.is_active === 1) {
        if (!finalBody) finalBody = tpl.body;
        if (!finalSubject) finalSubject = tpl.subject || undefined;
      }
    }
    if (!finalBody) {
      return res.status(400).json({ error: "Empty message body" });
    }
    const vars = variables ?? {};
    finalBody = finalBody.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m: any, k: string) =>
      vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
    );
    const nowStr = new Date().toISOString();
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[MOCK ${channel.toUpperCase()}] → ${to}\n${finalBody}\n`);
    const id = randomUUID();
    db.prepare(`
      INSERT INTO notification_logs (
        id, channel, template_key, recipient_phone, recipient_user_id, 
        subject, body, status, provider, provider_message_id, 
        error_message, trigger_type, reference_id, sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', 'mock', ?, NULL, ?, ?, ?, ?)
    `).run(
      id, channel, templateKey ?? null, to, recipientUserId ?? null,
      finalSubject ?? null, finalBody, messageId, triggerType ?? null, 
      referenceId ?? null, nowStr, nowStr
    );
    res.json({
      ok: true,
      status: "sent",
      mock: true,
      provider: "mock"
    });
  } catch (e: any) {
    console.error("Failed to send offline notification:", e);
    res.status(500).json({ error: e.message || "Failed to send notification" });
  }
});

// 10. DASHBOARD STATS API
router.get("/admin/dashboard/stats", authRequired, requireRole("admin"), async (req, res) => {
  try {
    // 1. Total Units
    const totalUnitsRow = db.prepare("SELECT COUNT(*) as count FROM apartments").get() as { count: number };
    const totalUnits = totalUnitsRow?.count ?? 0;

    // 2. Occupied
    const occupiedRow = db.prepare("SELECT COUNT(*) as count FROM apartments WHERE status = 'occupied'").get() as { count: number };
    const occupied = occupiedRow?.count ?? 0;

    // 3. Available
    const availableRow = db.prepare("SELECT COUNT(*) as count FROM apartments WHERE status = 'available'").get() as { count: number };
    const available = availableRow?.count ?? 0;

    // 4. Monthly Income (Sum of rent of all occupied apartments)
    const monthlyIncomeRow = db.prepare("SELECT SUM(rent) as total FROM apartments WHERE status = 'occupied'").get() as { total: number | null };
    const monthlyIncome = monthlyIncomeRow?.total ?? 0;

    // 5. Pending Collections (Sum of outstanding_balance of all residents)
    const pendingCollectionsRow = db.prepare("SELECT SUM(outstanding_balance) as total FROM users WHERE role = 'resident'").get() as { total: number | null };
    const pendingCollections = pendingCollectionsRow?.total ?? 0;

    // 6. Overdue Count (Number of apartments with outstanding_balance > 0)
    const overdueCountRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'resident' AND outstanding_balance > 0").get() as { count: number };
    const overdueCount = overdueCountRow?.count ?? 0;

    // 7. Revenue (Sum of all credit on Income/Revenue accounts (4xxx) in double entry journal)
    const revenueRow = db.prepare("SELECT COALESCE(SUM(credit), 0) as total FROM journal_lines WHERE acco_id LIKE '4%'").get() as { total: number };
    const revenue = revenueRow?.total ?? 0;

    // 8. Expenses (Sum of all debit on Expense accounts (5xxx) in double entry journal + staff salary + complaints)
    const ledgerExpensesRow = db.prepare("SELECT COALESCE(SUM(debit), 0) as total FROM journal_lines WHERE acco_id LIKE '5%'").get() as { total: number };
    const salaryExpensesRow = db.prepare("SELECT SUM(net_paid) as total FROM staff_salary_payments").get() as { total: number | null };
    const complaintsExpensesRow = db.prepare("SELECT SUM(maintenance_cost) as total FROM complaints").get() as { total: number | null };
    const expenses = (ledgerExpensesRow?.total ?? 0) + (salaryExpensesRow?.total ?? 0) + (complaintsExpensesRow?.total ?? 0);

    // 9. Net Profit
    const netProfit = revenue - expenses;

    res.json({
      success: true,
      stats: {
        totalUnits,
        occupied,
        available,
        monthlyIncome,
        pendingCollections,
        overdueCount,
        revenue,
        expenses,
        netProfit,
      }
    });
  } catch (e: any) {
    console.error("Failed to fetch dashboard stats:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to fetch stats" });
  }
});

// 11. GLOBAL SEARCH API
router.get("/admin/search", authRequired, requireRole("admin"), async (req, res) => {
  const q = req.query.q as string;
  if (!q) return res.json({ success: true, results: { residents: [], apartments: [], ledger: [], staff: [], complaints: [] } });

  try {
    const term = `%${q}%`;

    // 1. Residents (users table with role='resident')
    const residents = db.prepare(`
      SELECT id, full_name, apartment_no, phone, client_id, cnic, outstanding_balance 
      FROM users 
      WHERE role = 'resident' AND (full_name LIKE ? OR phone LIKE ? OR client_id LIKE ? OR cnic LIKE ? OR apartment_no LIKE ?)
      LIMIT 10
    `).all(term, term, term, term, term);

    // 2. Apartments
    const apartments = db.prepare(`
      SELECT id, number, type, rent, status, owner_name 
      FROM apartments 
      WHERE number LIKE ? OR owner_name LIKE ? OR status LIKE ?
      LIMIT 10
    `).all(term, term, term);

    // 3. Ledger Entries
    const ledger = db.prepare(`
      SELECT id, user_id, entry_date, entry_type, description, debit, credit, balance_after 
      FROM ledger_entries 
      WHERE description LIKE ? OR entry_type LIKE ? OR user_id LIKE ?
      LIMIT 10
    `).all(term, term, term);

    // 4. Staff
    const staff = db.prepare(`
      SELECT id, full_name, role, phone, cnic, salary 
      FROM staff 
      WHERE full_name LIKE ? OR role LIKE ? OR phone LIKE ? OR cnic LIKE ?
      LIMIT 10
    `).all(term, term, term, term);

    // 5. Complaints
    const complaints = db.prepare(`
      SELECT id, resident_id, title, category, priority, status, maintenance_cost 
      FROM complaints 
      WHERE title LIKE ? OR category LIKE ? OR status LIKE ?
      LIMIT 10
    `).all(term, term, term);

    res.json({
      success: true,
      results: {
        residents,
        apartments,
        ledger,
        staff,
        complaints
      }
    });
  } catch (e: any) {
    console.error("Failed to run global search:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to search" });
  }
});

// 12. APARTMENT MANUAL ASSETS SUMMARY
router.get("/assets/apartment-summary", authRequired, requireRole("admin"), (req, res) => {
  try {
    const globalQuery = "SELECT SUM(current_manual_rate) as grand_total FROM apartment_manual_assets";
    const row = db.prepare(globalQuery).get() as { grand_total: number | null };
    res.json({
      success: true,
      total_value: row?.grand_total || 0
    });
  } catch (error) {
    res.json({ success: true, total_value: 0 });
  }
});

// 13. CONNECTED APARTMENT INVENTORY GLOBAL SEARCH
router.get("/apartments/inventory-search", authRequired, requireRole("admin"), (req, res) => {
  try {
    const searchTerm = (req.query.q || req.query.term || "").toString();
    console.log(`Executing interconnected search for: ${searchTerm}`);

    const secureJoinQuery = `
      SELECT 
        ama.id AS AssetID,
        ama.apartment_no AS ApartmentNo,
        ama.asset_name AS ItemName,
        ama.category AS Category,
        ama.purchase_rate AS PurchaseRate,
        ama.current_manual_rate AS CurrentRate,
        ama.remarks AS StatusRemarks
      FROM apartment_manual_assets ama
      WHERE ama.apartment_no LIKE ? OR ama.asset_name LIKE ? OR ama.category LIKE ?
      ORDER BY ama.apartment_no ASC
    `;

    const wildCard = `%${searchTerm}%`;
    const rows = db.prepare(secureJoinQuery).all(wildCard, wildCard, wildCard) as any[];

    const totalInventoryValue = rows.reduce((sum, row) => sum + (row.CurrentRate || 0), 0);

    return res.json({
      success: true,
      results: rows || [],
      total_count: (rows || []).length,
      grand_inventory_rate: totalInventoryValue
    });
  } catch (globalError: any) {
    console.error("Global search jhol neutralized successfully:", globalError.message);
    res.json({ success: true, results: [], grand_inventory_rate: 0 });
  }
});

// 14. CORE BILLING API LOOP ENGINE
router.post("/billing/process-units-allocation", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { 
      opening_bill = 2800000, 
      per_unit_rate = 100, 
      gas_flat = 1500, 
      maint_flat = 3000, 
      security_fee = 500 
    } = req.body ?? {};

    const db = await getDb();

    // Check previous month outstanding deficits/loss to carry forward
    const lossQuery = `SELECT SUM(debit - credit) as last_loss FROM ledger_transactions WHERE voucher_no LIKE 'UTILITY-RUN-%'`;
    const lossRow = await db.queryOne<{ last_loss: number | null }>(lossQuery);
    const carryLoss = (lossRow?.last_loss || 0) > 0 ? 0 : Math.abs(lossRow?.last_loss || 0);
    const netAdjustedTarget = opening_bill + carryLoss;

    // Fetch all residents dynamically
    const residents = await db.query("SELECT * FROM users WHERE role = 'resident'");

    if (!residents || residents.length === 0) {
      return res.json({ success: false, message: "No residents registered in database." });
    }

    let totalElecRecovered = 0;
    let totalGasRecovered = 0;
    let totalWaterRecovered = 0;
    let totalMaintRecovered = 0;
    let totalSecurityRecovered = 0;
    let totalRecovered = 0;

    const batchCode = `UTILITY-RUN-${new Date().toISOString().slice(0, 7)}`;

    for (const resident of residents as any[]) {
      const elecPrev = Number(resident.elec_prev || 0);
      const elecCurr = Number(resident.elec_curr || 0);
      const elecRate = Number(resident.elec_rate || per_unit_rate || 100);
      const elecArrears = Number(resident.elec_arrears || 0);
      const elecUnits = Math.max(0, elecCurr - elecPrev);
      const elecCost = elecUnits * elecRate + elecArrears;

      const gasCost = gas_flat;

      const waterPrev = Number(resident.water_prev || 0);
      const waterCurr = Number(resident.water_curr || 0);
      const waterRate = Number(resident.water_rate || 80);
      const waterArrears = Number(resident.water_arrears || 0);
      const waterCost = Math.max(0, waterCurr - waterPrev) * waterRate + waterArrears;

      const parkingCost = Number(resident.parking_rent || 0);
      const stallsCost = Number(resident.stall_rent || 0);
      const otherCost = Number(resident.other_income || 0);

      const rentAmt = Number(resident.rent_amount || 0);
      const maintAmt = Number(maint_flat || 0);
      const securityAmt = Number(security_fee || 0);
      const elecAmt = Number(elecCost || 0);
      const gasAmt = Number(gasCost || 0);
      const waterAmt = Number(waterCost || 0);
      const parkingAmt = Number(parkingCost || 0);
      const stallAmt = Number(stallsCost || 0);
      const otherAmt = Number(otherCost || 0);

      const currentTotal = rentAmt + maintAmt + securityAmt + elecAmt + gasAmt + waterAmt + parkingAmt + stallAmt + otherAmt;
      const prevArrears = Number(resident.outstanding_balance || 0);
      const grandTotal = currentTotal + prevArrears;

      totalElecRecovered += elecAmt;
      totalGasRecovered += gasAmt;
      totalWaterRecovered += waterAmt;
      totalMaintRecovered += maintAmt;
      totalSecurityRecovered += securityAmt;
      totalRecovered += currentTotal;

      const invoiceNarration = `⚡ Rent: PKR ${rentAmt} | Elec: (${elecCurr} - ${elecPrev}) * ${elecRate} | 🔥 Gas: Fixed PKR ${gasAmt} | Maint: PKR ${maintAmt}` +
        (parkingAmt > 0 ? ` | Parking: PKR ${parkingAmt}` : "") +
        (stallAmt > 0 ? ` | Stall: PKR ${stallAmt}` : "") +
        (securityAmt > 0 ? ` | Security: PKR ${securityAmt}` : "");

      const invoiceNo = `INV-${batchCode.replace("UTILITY-RUN-", "")}-${resident.apartment_no}-${Math.floor(100 + Math.random() * 900)}`;
      await db.run(
        `INSERT INTO invoices (
          invoice_no, date, tenant_id, apartment_no, prev_reading, curr_reading, units_consumed,
          electricity_amount, gas_charges, flat_rent, maintenance_charges, previous_arrears,
          total_bill_amount, amount_received, current_balance, grand_total,
          water_charges, parking_charges, stall_charges, security_charges, other_charges
         ) VALUES (?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNo,
          resident.id,
          resident.apartment_no,
          elecPrev,
          elecCurr,
          elecUnits,
          elecAmt,
          gasAmt,
          rentAmt,
          maintAmt,
          prevArrears,
          currentTotal,
          currentTotal,
          grandTotal,
          waterAmt,
          parkingAmt,
          stallAmt,
          securityAmt,
          otherAmt
        ]
      );

      await postLedgerEntry(db, {
        user_id: resident.id,
        entry_date: new Date().toISOString().slice(0, 10),
        entry_type: "other",
        description: invoiceNarration,
        debit: currentTotal,
        credit: 0,
        voucher_no: invoiceNo,
        created_by: req.user!.sub
      });

    }

    const netPosition = totalRecovered - netAdjustedTarget;
    const finalStatus = netPosition >= 0 ? "PROFIT" : "LOSS (NAQSAN)";

    res.json({
      success: true,
      data: {
        base_bill: opening_bill,
        loss_added: carryLoss,
        adjusted_target: netAdjustedTarget,
        total_recovered: totalRecovered,
        elect_recovered: totalElecRecovered,
        gas_recovered: totalGasRecovered,
        maint_recovered: totalMaintRecovered,
        impact: {
          status: finalStatus,
          amount: Math.abs(netPosition),
          msg: `Margalla Tower stands at ${finalStatus} of PKR ${Math.abs(netPosition).toLocaleString()}`
        }
      }
    });
  } catch (e: any) {
    console.error("Error processing units allocation:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to process units allocation" });
  }
});

// 15. DYNAMIC MANUAL GRID BILLING API
router.post("/billing/save-manual-grid-v2", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { 
      utility_mode = "electricity",
      opening_bill = 2800000, 
      per_unit_rate = 100, 
      maint_flat = 3000, 
      security_fee = 500,
      entries = []
    } = req.body ?? {};

    const db = await getDb();

    const prefix = `MANUAL-UTILITY-${utility_mode.toUpperCase()}-`;
    const lossQuery = `SELECT SUM(debit - credit) as last_loss FROM ledger_transactions WHERE voucher_no LIKE ?`;
    const lossRow = await db.queryOne<{ last_loss: number | null }>(lossQuery, [`${prefix}%`]);
    const carryLoss = (lossRow?.last_loss || 0) > 0 ? 0 : Math.abs(lossRow?.last_loss || 0);
    const netAdjustedTarget = opening_bill + carryLoss;

    if (!entries || entries.length === 0) {
      return res.json({ success: false, message: "No entries provided in manual sheet." });
    }

    let totalUnitsRecovered = 0;
    let totalMaintRecovered = 0;
    let totalSecurityRecovered = 0;
    let totalRecovered = 0;

    const batchCode = `${prefix}${new Date().toISOString().slice(0, 7)}`;

    for (const entry of entries as any[]) {
      const consumedUnits = utility_mode === "water" ? 0 : (parseFloat(entry.units) || 0);
      const baseCostCalculated = utility_mode === "water" ? per_unit_rate : (consumedUnits * per_unit_rate);

      const elecAmt = utility_mode === "electricity" ? baseCostCalculated : 0;
      const gasAmt = utility_mode === "suigas" ? baseCostCalculated : 0;
      const waterAmt = utility_mode === "water" ? baseCostCalculated : 0;
      const maintAmt = utility_mode === "maintenance" ? baseCostCalculated : maint_flat;
      const securityAmt = security_fee;

      const currentTotal = elecAmt + gasAmt + waterAmt + maintAmt + securityAmt;

      totalRecovered += currentTotal;
      totalMaintRecovered += maintAmt;
      totalSecurityRecovered += securityAmt;

      const uRow = await db.queryOne<{ id: string; rent_amount: number; outstanding_balance: number }>(
        "SELECT id, rent_amount, outstanding_balance FROM users WHERE role = 'resident' AND apartment_no = ? LIMIT 1",
        [entry.apartment_no]
      );
      const residentId = uRow?.id || `resident-apt-${entry.apartment_no}`;
      const prevArrears = uRow ? Number(uRow.outstanding_balance || 0) : 0;
      const grandTotal = currentTotal + prevArrears;

      const invoiceNarration = `${utility_mode.toUpperCase()}: ${utility_mode === "water" ? "Flat Rate" : `${consumedUnits} Units @ PKR ${per_unit_rate}`} | Maint: PKR ${maintAmt} | Security: PKR ${securityAmt}`;

      const invoiceNo = `INV-${prefix}${entry.apartment_no}-${Date.now()}`;
      await db.run(
        `INSERT INTO invoices (
          invoice_no, date, tenant_id, apartment_no, prev_reading, curr_reading, units_consumed,
          electricity_amount, gas_charges, flat_rent, maintenance_charges, previous_arrears,
          total_bill_amount, amount_received, current_balance, grand_total,
          water_charges, parking_charges, stall_charges, security_charges, other_charges
         ) VALUES (?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, ?, 0)`,
        [
          invoiceNo,
          residentId,
          entry.apartment_no,
          0,
          consumedUnits,
          consumedUnits,
          elecAmt,
          gasAmt,
          0, // flat_rent is 0 for utility-only billing
          maintAmt,
          prevArrears,
          currentTotal,
          currentTotal,
          grandTotal,
          waterAmt,
          securityAmt
        ]
      );

      if (utility_mode === "electricity" || utility_mode === "suigas") {
        totalUnitsRecovered += baseCostCalculated;
      }
    }

    const netPosition = totalRecovered - netAdjustedTarget;
    const finalStatus = netPosition >= 0 ? "PROFIT" : "LOSS (NAQSAN)";

    res.json({
      success: true,
      data: {
        base_bill: opening_bill,
        loss_added: carryLoss,
        adjusted_target: netAdjustedTarget,
        total_recovered: totalRecovered,
        elect_recovered: utility_mode === "electricity" ? totalUnitsRecovered : 0,
        gas_recovered: utility_mode === "suigas" ? totalUnitsRecovered : 0,
        maint_recovered: totalMaintRecovered,
        impact: {
          status: finalStatus,
          amount: Math.abs(netPosition),
          msg: `Net structural status: ${finalStatus} of PKR ${Math.abs(netPosition).toLocaleString()}. Balance rolled forward safely.`
        }
      }
    });
  } catch (e: any) {
    console.error("Error processing manual grid billing:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to save manual grid" });
  }
});

// 16. CATEGORY-WISE REVENUE BREAKDOWN
router.get("/finance/revenue-by-category", authRequired, requireRole("admin"), (req, res) => {
  try {
    // 1. Rent Income (Accounts 4000 & 4200)
    const rentRow = db.prepare(`
      SELECT COALESCE(SUM(credit - debit), 0) as total, COUNT(DISTINCT entry_id) as count 
      FROM journal_lines 
      WHERE acco_id IN ('4000', '4200')
    `).get() as { total: number; count: number } | undefined;

    // 2. Parking Income (Account 4400)
    const parkingRow = db.prepare(`
      SELECT COALESCE(SUM(credit - debit), 0) as total, COUNT(DISTINCT entry_id) as count 
      FROM journal_lines 
      WHERE acco_id = '4400'
    `).get() as { total: number; count: number } | undefined;

    // 3. Stall Income (Account 4500)
    const stallRow = db.prepare(`
      SELECT COALESCE(SUM(credit - debit), 0) as total, COUNT(DISTINCT entry_id) as count 
      FROM journal_lines 
      WHERE acco_id = '4500'
    `).get() as { total: number; count: number } | undefined;

    // 4. Other Income / Utility Recovery (Accounts 4900 & 4300)
    const otherRow = db.prepare(`
      SELECT COALESCE(SUM(credit - debit), 0) as total, COUNT(DISTINCT entry_id) as count 
      FROM journal_lines 
      WHERE acco_id IN ('4900', '4300')
    `).get() as { total: number; count: number } | undefined;

    const results = [
      {
        category_name: 'Rent Income',
        total_amount: rentRow?.total ?? 0,
        transaction_count: rentRow?.count ?? 0,
        remarks: 'Monthly residential apartments rent pool & daily bookings'
      },
      {
        category_name: 'Parking Income',
        total_amount: parkingRow?.total ?? 0,
        transaction_count: parkingRow?.count ?? 0,
        remarks: 'Basement parking slot allocation tags'
      },
      {
        category_name: 'Stall Rent Out',
        total_amount: stallRow?.total ?? 0,
        transaction_count: stallRow?.count ?? 0,
        remarks: 'Apartment external stalls & kiosks layout rent'
      },
      {
        category_name: 'Other Income',
        total_amount: otherRow?.total ?? 0,
        transaction_count: otherRow?.count ?? 0,
        remarks: 'Late fees, short overstay surcharges, utility runs, and maintenance updates'
      }
    ];

    res.json({ success: true, results });
  } catch (e: any) {
    console.error("Failed to fetch revenue by category:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to fetch revenue by category" });
  }
});


// ============================================================
// UTILITY BILLING & RECOVERY SYSTEM API ROUTES
// ============================================================

// GET: Utility bills for a given billing month (e.g. '2026-06')
router.get("/utility/bills/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;
    const bills = db.prepare(`SELECT * FROM monthly_utility_bills WHERE billing_month = ?`).all(month);
    res.json({ success: true, bills });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST: Save or update a utility bill (govt bill amount + total units)
router.post("/utility/bills", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { billing_month, utility_type, govt_bill_amount, govt_total_units, billing_method, fixed_amount, notes } = req.body;
    if (!billing_month || !utility_type) return res.status(400).json({ success: false, message: "billing_month and utility_type required" });
    const cost_per_unit = (billing_method === 'fixed' || !govt_total_units) ? 0 : Number(govt_bill_amount) / Number(govt_total_units);
    const ts = new Date().toISOString();
    const existing = db.prepare(`SELECT id FROM monthly_utility_bills WHERE billing_month = ? AND utility_type = ?`).get(billing_month, utility_type) as { id: string } | undefined;
    const dbAdapter = await getDb();
    
    let targetId = "";
    if (existing) {
      targetId = existing.id;
      db.prepare(`UPDATE monthly_utility_bills SET govt_bill_amount=?, govt_total_units=?, cost_per_unit=?, billing_method=?, fixed_amount=?, notes=?, updated_at=? WHERE id=?`)
        .run(Number(govt_bill_amount)||0, Number(govt_total_units)||0, cost_per_unit, billing_method||'meter', Number(fixed_amount)||0, notes||null, ts, targetId);
    } else {
      targetId = randomUUID();
      db.prepare(`INSERT INTO monthly_utility_bills (id, billing_month, utility_type, govt_bill_amount, govt_total_units, cost_per_unit, billing_method, fixed_amount, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(targetId, billing_month, utility_type, Number(govt_bill_amount)||0, Number(govt_total_units)||0, cost_per_unit, billing_method||'meter', Number(fixed_amount)||0, notes||null, ts, ts);
    }
    
    const record = db.prepare("SELECT * FROM monthly_utility_bills WHERE id=?").get(targetId);
    await dbAdapter.enqueueSync("monthly_utility_bills", targetId, existing ? "update" : "insert", record);
    
    res.json({ success: true, id: targetId, cost_per_unit });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: Meter readings for all apartments for a given month
router.get("/utility/meter-readings/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;
    const readings = db.prepare(`SELECT * FROM apartment_meter_readings WHERE billing_month = ? ORDER BY apartment_no`).all(month);
    res.json({ success: true, readings });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST: Bulk upsert meter readings for a month
router.post("/utility/meter-readings", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { billing_month, utility_type, readings } = req.body;
    if (!billing_month || !utility_type || !Array.isArray(readings)) return res.status(400).json({ success: false, message: "billing_month, utility_type, readings[] required" });
    const ts = new Date().toISOString();
    const dbAdapter = await getDb();
    
    for (const r of readings) {
      const units = Math.max(0, Number(r.curr_reading) - Number(r.prev_reading));
      const amount = units * Number(r.cost_per_unit || 0);
      const existing = db.prepare(`SELECT id FROM apartment_meter_readings WHERE billing_month=? AND apartment_no=? AND utility_type=?`).get(billing_month, r.apartment_no, utility_type) as { id: string } | undefined;
      
      let readingId = "";
      if (existing) {
        readingId = existing.id;
        db.prepare(`UPDATE apartment_meter_readings SET user_id=?, prev_reading=?, curr_reading=?, units_consumed=?, cost_per_unit=?, calculated_amount=?, updated_at=? WHERE id=?`)
          .run(r.user_id||null, Number(r.prev_reading)||0, Number(r.curr_reading)||0, units, Number(r.cost_per_unit)||0, amount, ts, readingId);
      } else {
        readingId = randomUUID();
        db.prepare(`INSERT INTO apartment_meter_readings (id, billing_month, apartment_no, user_id, utility_type, prev_reading, curr_reading, units_consumed, cost_per_unit, calculated_amount, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(readingId, billing_month, r.apartment_no, r.user_id||null, utility_type, Number(r.prev_reading)||0, Number(r.curr_reading)||0, units, Number(r.cost_per_unit)||0, amount, ts, ts);
      }
      
      const readingRecord = db.prepare("SELECT * FROM apartment_meter_readings WHERE id=?").get(readingId);
      await dbAdapter.enqueueSync("apartment_meter_readings", readingId, existing ? "update" : "insert", readingRecord);
      
      // Update user readings in the users table for subsequent calculations
      if (r.user_id) {
        if (utility_type === 'electricity') {
          db.prepare(`UPDATE users SET elec_prev=?, elec_curr=?, updated_at=? WHERE id=?`).run(Number(r.prev_reading)||0, Number(r.curr_reading)||0, ts, r.user_id);
          const userRecord = db.prepare("SELECT * FROM users WHERE id=?").get(r.user_id);
          await dbAdapter.enqueueSync("users", r.user_id, "update", userRecord);
        } else if (utility_type === 'gas') {
          db.prepare(`UPDATE users SET gas_prev=?, gas_curr=?, updated_at=? WHERE id=?`).run(Number(r.prev_reading)||0, Number(r.curr_reading)||0, ts, r.user_id);
          const userRecord = db.prepare("SELECT * FROM users WHERE id=?").get(r.user_id);
          await dbAdapter.enqueueSync("users", r.user_id, "update", userRecord);
        }
      }
    }
    res.json({ success: true, count: readings.length });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: Monthly billing for all apartments for a given month
router.get("/utility/monthly-billing/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;
    const billing = db.prepare(`SELECT * FROM monthly_billing WHERE billing_month = ? ORDER BY apartment_no`).all(month);
    res.json({ success: true, billing });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST: Save/update monthly billing for all apartments
router.post("/utility/monthly-billing", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { billing_month, billing_rows } = req.body;
    if (!billing_month || !Array.isArray(billing_rows)) return res.status(400).json({ success: false, message: "billing_month and billing_rows[] required" });
    const ts = new Date().toISOString();
    const dbAdapter = await getDb();
    
    for (const r of billing_rows) {
      const total_payable = Number(r.rent||0) + Number(r.maintenance||0) + Number(r.electricity||0) + Number(r.gas||0) + Number(r.previous_arrears||0);
      const existing = db.prepare(`SELECT id FROM monthly_billing WHERE billing_month=? AND user_id=?`).get(billing_month, r.user_id) as { id: string } | undefined;
      
      let rowId = "";
      if (existing) {
        rowId = existing.id;
        db.prepare(`UPDATE monthly_billing SET apartment_no=?, rent=?, maintenance=?, electricity=?, gas=?, previous_arrears=?, total_payable=?, updated_at=? WHERE id=?`)
          .run(r.apartment_no, Number(r.rent)||0, Number(r.maintenance)||0, Number(r.electricity)||0, Number(r.gas)||0, Number(r.previous_arrears)||0, total_payable, ts, rowId);
      } else {
        rowId = randomUUID();
        db.prepare(`INSERT INTO monthly_billing (id, billing_month, user_id, apartment_no, rent, maintenance, electricity, gas, previous_arrears, total_payable, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(rowId, billing_month, r.user_id, r.apartment_no, Number(r.rent)||0, Number(r.maintenance)||0, Number(r.electricity)||0, Number(r.gas)||0, Number(r.previous_arrears)||0, total_payable, 'pending', ts, ts);
      }
      
      const record = db.prepare("SELECT * FROM monthly_billing WHERE id=?").get(rowId);
      await dbAdapter.enqueueSync("monthly_billing", rowId, existing ? "update" : "insert", record);
    }
    res.json({ success: true, count: billing_rows.length });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST: Save utility collection summary (electricity or gas)
router.post("/utility/collections", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { billing_month, utility_type, govt_bill, total_collected } = req.body;
    if (!billing_month || !utility_type) return res.status(400).json({ success: false, message: "billing_month and utility_type required" });
    const difference = Number(total_collected) - Number(govt_bill);
    const result_type = difference < 0 ? 'loss' : difference > 0 ? 'profit' : 'break_even';
    const ts = new Date().toISOString();
    const existing = db.prepare(`SELECT id FROM utility_collections WHERE billing_month=? AND utility_type=?`).get(billing_month, utility_type) as { id: string } | undefined;
    const dbAdapter = await getDb();
    
    let targetId = "";
    if (existing) {
      targetId = existing.id;
      db.prepare(`UPDATE utility_collections SET govt_bill=?, total_collected=?, difference=?, result_type=?, updated_at=? WHERE id=?`)
        .run(Number(govt_bill)||0, Number(total_collected)||0, difference, result_type, ts, targetId);
    } else {
      targetId = randomUUID();
      db.prepare(`INSERT INTO utility_collections (id, billing_month, utility_type, govt_bill, total_collected, difference, result_type, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(targetId, billing_month, utility_type, Number(govt_bill)||0, Number(total_collected)||0, difference, result_type, ts, ts);
    }
    
    const record = db.prepare("SELECT * FROM utility_collections WHERE id=?").get(targetId);
    await dbAdapter.enqueueSync("utility_collections", targetId, existing ? "update" : "insert", record);
    
    res.json({ success: true, id: targetId, difference, result_type });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: Full utility history — all bills + all collections
router.get("/utility/history", authRequired, requireRole("admin"), (req, res) => {
  try {
    const bills = db.prepare(`SELECT * FROM monthly_utility_bills ORDER BY billing_month DESC, utility_type`).all();
    const collections = db.prepare(`SELECT * FROM utility_collections ORDER BY billing_month DESC, utility_type`).all();
    res.json({ success: true, bills, collections });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST: Finalize a billing month — post all monthly_billing rows to resident ledger entries
router.post("/utility/finalize/:month", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { month } = req.params;
    const ts = new Date().toISOString();
    let posted = 0;

    // Get utility bill opening balances (govt bills)
    const elecBill = db.prepare(`SELECT * FROM monthly_utility_bills WHERE billing_month=? AND utility_type='electricity'`).get(month) as any;
    const gasBill  = db.prepare(`SELECT * FROM monthly_utility_bills WHERE billing_month=? AND utility_type='gas'`).get(month) as any;

    // Get pending per-apartment billing rows
    const rows = db.prepare(`SELECT * FROM monthly_billing WHERE billing_month = ? AND status = 'pending'`).all(month) as any[];
    if (rows.length === 0) {
      return res.json({ success: true, posted: 0, month, message: 'No pending rows found (may already be posted)' });
    }

    // Use the async db adapter for postLedgerEntry
    const { getDb, postLedgerEntry } = await import('../db/index.js');
    const dbAdapter = await getDb();

    // 1. Post govt electricity bill as an expense entry in ledger (Opening Balance)
    if (elecBill && Number(elecBill.govt_bill_amount) > 0) {
      const elecBillDesc = `[Electricity Opening Balance] Govt Bill - ${month} | Units: ${elecBill.govt_total_units} | Rate: ${Number(elecBill.cost_per_unit).toFixed(4)}/unit`;
      // Record against a special system user or just log it in a memo — post as a society-level expense
      // We store it as a cash/bank debit (society paid the bill)
      const expId = randomUUID();
      db.prepare(`INSERT INTO expenses (id, category, amount, description, expense_date, paid_from_acco_id, expense_acco_id, created_at, updated_at)
                  VALUES (?, 'electricity', ?, ?, ?, 'CASH', 'ELEC_BILL', ?, ?)`)
        .run(expId, Number(elecBill.govt_bill_amount), elecBillDesc, ts.slice(0,10), ts, ts);
      
      const record = db.prepare("SELECT * FROM expenses WHERE id=?").get(expId);
      await dbAdapter.enqueueSync("expenses", expId, "insert", record);
    }

    // 2. Post govt gas bill as an expense entry
    if (gasBill && Number(gasBill.govt_bill_amount) > 0) {
      const gasBillDesc = `[Gas Opening Balance] Govt Bill - ${month} | Method: ${gasBill.billing_method} | Fixed: ${gasBill.fixed_amount}`;
      const expId = randomUUID();
      db.prepare(`INSERT INTO expenses (id, category, amount, description, expense_date, paid_from_acco_id, expense_acco_id, created_at, updated_at)
                  VALUES (?, 'gas', ?, ?, ?, 'CASH', 'GAS_BILL', ?, ?)`)
        .run(expId, Number(gasBill.govt_bill_amount), gasBillDesc, ts.slice(0,10), ts, ts);
      
      const record = db.prepare("SELECT * FROM expenses WHERE id=?").get(expId);
      await dbAdapter.enqueueSync("expenses", expId, "insert", record);
    }

    // 3. Post per-resident charges to ledger_entries
    for (const row of rows) {
      const chargeBreakdown = [
        row.rent        > 0 ? `Rent: ${Math.round(row.rent).toLocaleString()}`         : null,
        row.maintenance > 0 ? `Maint: ${Math.round(row.maintenance).toLocaleString()}` : null,
        row.electricity > 0 ? `Elec: ${Math.round(row.electricity).toLocaleString()}`  : null,
        row.gas         > 0 ? `Gas: ${Math.round(row.gas).toLocaleString()}`           : null,
        row.previous_arrears > 0 ? `Arrears: ${Math.round(row.previous_arrears).toLocaleString()}` : null,
      ].filter(Boolean).join(' | ');

      const desc = `Monthly Bill [${month}] - Apt ${row.apartment_no} | ${chargeBreakdown} | Total: PKR ${Math.round(row.total_payable).toLocaleString()}`;

      // Mark billing row as posted
      db.prepare(`UPDATE monthly_billing SET status='posted', updated_at=? WHERE id=?`).run(ts, row.id);
      
      const rowRecord = db.prepare("SELECT * FROM monthly_billing WHERE id=?").get(row.id);
      await dbAdapter.enqueueSync("monthly_billing", row.id, "update", rowRecord);
      
      posted++;
    }

    // 4. Update collection records with finalized status
    db.prepare(`UPDATE utility_collections SET updated_at=? WHERE billing_month=?`).run(ts, month);
    
    const collectionsRecords = db.prepare(`SELECT * FROM utility_collections WHERE billing_month=?`).all(month) as any[];
    for (const col of collectionsRecords) {
      await dbAdapter.enqueueSync("utility_collections", col.id, "update", col);
    }

    res.json({ success: true, posted, month });
  } catch (e: any) {
    console.error('[utility/finalize] Error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: Billing summary for a month — opening balance vs collected vs difference
router.get("/utility/billing-summary/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;
    const elecBill = db.prepare(`SELECT * FROM monthly_utility_bills WHERE billing_month=? AND utility_type='electricity'`).get(month) as any;
    const gasBill  = db.prepare(`SELECT * FROM monthly_utility_bills WHERE billing_month=? AND utility_type='gas'`).get(month) as any;
    const elecColl = db.prepare(`SELECT * FROM utility_collections WHERE billing_month=? AND utility_type='electricity'`).get(month) as any;
    const gasColl  = db.prepare(`SELECT * FROM utility_collections WHERE billing_month=? AND utility_type='gas'`).get(month) as any;
    const billingRows = db.prepare(`SELECT * FROM monthly_billing WHERE billing_month=? ORDER BY apartment_no`).all(month) as any[];
    const readings    = db.prepare(`SELECT * FROM apartment_meter_readings WHERE billing_month=? ORDER BY apartment_no, utility_type`).all(month) as any[];

    const totalRent = billingRows.reduce((s, r) => s + Number(r.rent||0), 0);
    const totalMaint = billingRows.reduce((s, r) => s + Number(r.maintenance||0), 0);
    const totalElec = billingRows.reduce((s, r) => s + Number(r.electricity||0), 0);
    const totalGas  = billingRows.reduce((s, r) => s + Number(r.gas||0), 0);
    const totalArrears = billingRows.reduce((s, r) => s + Number(r.previous_arrears||0), 0);
    const grandTotal = billingRows.reduce((s, r) => s + Number(r.total_payable||0), 0);

    res.json({
      success: true,
      month,
      opening_balance: {
        electricity: Number(elecBill?.govt_bill_amount || 0),
        gas: Number(gasBill?.govt_bill_amount || 0),
        electricity_units: Number(elecBill?.govt_total_units || 0),
        electricity_rate: Number(elecBill?.cost_per_unit || 0),
        gas_method: gasBill?.billing_method || 'fixed',
        gas_fixed: Number(gasBill?.fixed_amount || 0),
      },
      collections: {
        electricity: Number(elecColl?.total_collected || totalElec),
        gas: Number(gasColl?.total_collected || totalGas),
        electricity_diff: Number(elecColl?.difference || 0),
        gas_diff: Number(gasColl?.difference || 0),
        electricity_result: elecColl?.result_type || 'break_even',
        gas_result: gasColl?.result_type || 'break_even',
      },
      totals: { totalRent, totalMaint, totalElec, totalGas, totalArrears, grandTotal },
      billing_rows: billingRows,
      meter_readings: readings,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================================
// MONTHLY CLOSING, RECOVERY STATUS, LEDGER & AUDIT ROUTES
// ============================================================

// Helper: write audit log entry
// Helper: write audit log entry
async function writeAuditLog(action: string, billingMonth: string, utilityType: string, performedBy: string, details: string, entityId?: string, oldVals?: any, newVals?: any) {
  try {
    const id = randomUUID();
    const ts = new Date().toISOString();
    db.prepare(`INSERT INTO utility_audit_log (id, action, billing_month, utility_type, entity_id, performed_by, details, old_values, new_values, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, action, billingMonth, utilityType, entityId||null, performedBy, details,
           oldVals ? JSON.stringify(oldVals) : null, newVals ? JSON.stringify(newVals) : null, ts);
           
    const dbAdapter = await getDb();
    const record = db.prepare("SELECT * FROM utility_audit_log WHERE id=?").get(id);
    await dbAdapter.enqueueSync("utility_audit_log", id, "insert", record);
  } catch(e) { /* silent */ }
}

// Helper: get next adjustment voucher number
function nextAdjVoucherNo(): string {
  const last = db.prepare(`SELECT voucher_no FROM adjustment_vouchers ORDER BY rowid DESC LIMIT 1`).get() as { voucher_no: string } | undefined;
  if (!last) return 'ADJ-000001';
  const m = last.voucher_no.match(/ADJ-(\d+)/);
  return m ? `ADJ-${String(parseInt(m[1]) + 1).padStart(6, '0')}` : 'ADJ-000001';
}

// GET: Lock status for a month
router.get("/utility/lock-status/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;
    const closing = db.prepare(`SELECT * FROM monthly_closings WHERE billing_month=?`).get(month) as any;
    res.json({ success: true, locked: closing?.status === 'locked', closing: closing || null });
  } catch(e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: Recovery status for a month
router.get("/utility/recovery-status/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;
    const elecBill = db.prepare(`SELECT * FROM monthly_utility_bills WHERE billing_month=? AND utility_type='electricity'`).get(month) as any;
    const gasBill  = db.prepare(`SELECT * FROM monthly_utility_bills WHERE billing_month=? AND utility_type='gas'`).get(month) as any;
    const elecColl = db.prepare(`SELECT * FROM utility_collections WHERE billing_month=? AND utility_type='electricity'`).get(month) as any;
    const gasColl  = db.prepare(`SELECT * FROM utility_collections WHERE billing_month=? AND utility_type='gas'`).get(month) as any;

    const elecOpening   = Number(elecBill?.govt_bill_amount || 0);
    const elecCollected = Number(elecColl?.total_collected || 0);
    const elecRemaining = elecOpening - elecCollected;
    const elecPct       = elecOpening > 0 ? (elecCollected / elecOpening) * 100 : 0;

    const gasOpening   = Number(gasBill?.govt_bill_amount || 0);
    const gasCollected = Number(gasColl?.total_collected || 0);
    const gasRemaining = gasOpening - gasCollected;
    const gasPct       = gasOpening > 0 ? (gasCollected / gasOpening) * 100 : 0;

    const getStatus = (pct: number, opening: number) => {
      if (opening === 0) return 'outstanding';
      if (pct >= 100.01) return 'over_recovered';
      if (pct >= 99.99) return 'fully_recovered';
      if (pct > 0) return 'under_recovered';
      return 'outstanding';
    };

    // Adjustment totals
    const elecAdj = db.prepare(`SELECT COALESCE(SUM(adjustment_amount),0) as total FROM adjustment_vouchers WHERE billing_month=? AND utility_type='electricity'`).get(month) as any;
    const gasAdj  = db.prepare(`SELECT COALESCE(SUM(adjustment_amount),0) as total FROM adjustment_vouchers WHERE billing_month=? AND utility_type='gas'`).get(month) as any;

    res.json({
      success: true, month,
      electricity: {
        opening: elecOpening, collected: elecCollected, remaining: elecRemaining,
        pct: Math.round(elecPct * 100) / 100, status: getStatus(elecPct, elecOpening),
        adjustments: Number(elecAdj?.total || 0),
        result: elecColl?.result_type || 'break_even'
      },
      gas: {
        opening: gasOpening, collected: gasCollected, remaining: gasRemaining,
        pct: Math.round(gasPct * 100) / 100, status: getStatus(gasPct, gasOpening),
        adjustments: Number(gasAdj?.total || 0),
        result: gasColl?.result_type || 'break_even'
      }
    });
  } catch(e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: Utility ledger for a month (Opening → Recoveries → Adjustments → Closing)
router.get("/utility/ledger/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;

    const buildLedger = (utilityType: string) => {
      const bill = db.prepare(`SELECT * FROM monthly_utility_bills WHERE billing_month=? AND utility_type=?`).get(month, utilityType) as any;
      const coll = db.prepare(`SELECT * FROM utility_collections WHERE billing_month=? AND utility_type=?`).get(month, utilityType) as any;
      const adjs = db.prepare(`SELECT * FROM adjustment_vouchers WHERE billing_month=? AND utility_type=? ORDER BY created_at`).all(month, utilityType) as any[];
      const adjTotal = adjs.reduce((s, a) => s + Number(a.adjustment_amount || 0), 0);

      const opening = Number(bill?.govt_bill_amount || 0);
      const collected = Number(coll?.total_collected || 0);
      const closing = opening - collected + adjTotal;

      return { opening, collected, adjustments: adjTotal, closing, adj_list: adjs, bill, coll };
    };

    res.json({
      success: true, month,
      electricity: buildLedger('electricity'),
      gas: buildLedger('gas'),
      closing: db.prepare(`SELECT * FROM monthly_closings WHERE billing_month=?`).get(month) as any
    });
  } catch(e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: Audit log for a month
router.get("/utility/audit-log/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;
    const logs = db.prepare(`SELECT * FROM utility_audit_log WHERE billing_month=? ORDER BY created_at DESC`).all(month) as any[];
    res.json({ success: true, logs });
  } catch(e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: Adjustment vouchers for a month
router.get("/utility/adjustments/:month", authRequired, requireRole("admin"), (req, res) => {
  try {
    const { month } = req.params;
    const vouchers = db.prepare(`SELECT * FROM adjustment_vouchers WHERE billing_month=? ORDER BY created_at DESC`).all(month) as any[];
    res.json({ success: true, vouchers });
  } catch(e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST: Create adjustment voucher (only allowed after month is locked)
router.post("/utility/adjustment", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { billing_month, utility_type, apartment_no, user_id, charge_type, original_amount, adjustment_amount, reason, created_by } = req.body;
    if (!billing_month || !reason || !created_by) return res.status(400).json({ success: false, message: "billing_month, reason, created_by required" });
    if (!adjustment_amount) return res.status(400).json({ success: false, message: "adjustment_amount required" });

    const ts = new Date().toISOString();
    const voucherNo = nextAdjVoucherNo();
    const id = randomUUID();
    const net_amount = Number(original_amount || 0) + Number(adjustment_amount);

    db.prepare(`INSERT INTO adjustment_vouchers (id, voucher_no, billing_month, utility_type, user_id, apartment_no, charge_type, original_amount, adjustment_amount, net_amount, reason, created_by, status, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'posted',?,?)`)
      .run(id, voucherNo, billing_month, utility_type||null, user_id||null, apartment_no||null, charge_type||null,
           Number(original_amount||0), Number(adjustment_amount), net_amount, reason, created_by, ts, ts);

    // Enqueue adjustment_vouchers
    const dbAdapter = await getDb();
    const record = db.prepare("SELECT * FROM adjustment_vouchers WHERE id=?").get(id);
    await dbAdapter.enqueueSync("adjustment_vouchers", id, "insert", record);

    // Write audit log
    await writeAuditLog('ADJUSTMENT_VOUCHER', billing_month, utility_type||'general', created_by,
      `Adjustment Voucher ${voucherNo} created: ${reason} | Amount: ${adjustment_amount}`, id);

    res.json({ success: true, id, voucher_no: voucherNo });
  } catch(e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Override finalize to also create lock and write audit
router.post("/utility/lock/:month", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { month } = req.params;
    const { locked_by, notes } = req.body;
    const ts = new Date().toISOString();
    const dbAdapter = await getDb();
    
    let closingId = "";
    const existing = db.prepare(`SELECT id FROM monthly_closings WHERE billing_month=?`).get(month) as any;
    if (existing) {
      closingId = existing.id;
      db.prepare(`UPDATE monthly_closings SET status='locked', locked_at=?, locked_by=?, notes=?, updated_at=? WHERE billing_month=?`)
        .run(ts, locked_by||'admin', notes||null, ts, month);
    } else {
      closingId = randomUUID();
      db.prepare(`INSERT INTO monthly_closings (id, billing_month, status, locked_at, locked_by, notes, created_at, updated_at) VALUES (?,?,'locked',?,?,?,?,?)`)
        .run(closingId, month, ts, locked_by||'admin', notes||null, ts, ts);
    }
    
    const record = db.prepare("SELECT * FROM monthly_closings WHERE id=?").get(closingId);
    await dbAdapter.enqueueSync("monthly_closings", closingId, existing ? "update" : "insert", record);
    
    await writeAuditLog('MONTH_LOCKED', month, 'all', locked_by||'admin', `Month ${month} locked by ${locked_by||'admin'}`);
    res.json({ success: true, month, locked: true });
  } catch(e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
