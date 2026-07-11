import { Router } from "express";
import { getDb, newId, now } from "../db/index.js";
import { authRequired, requireRole, requireAccountingRole } from "../middleware/auth.js";

const router = Router();

/**
 * UNIVERSAL ACCOUNTING SYSTEM - DOUBLE ENTRY BOOKKEEPING
 * 
 * Rules:
 * 1. Every transaction MUST have equal Debit and Credit (Double Entry)
 * 2. Running Balance = Previous Balance + Debit - Credit
 * 3. Pending Balance = Total Billed - Amount Received
 * 4. All entries must be balanced and accurate
 */

// ============================================
// HELPER: Create Double Entry Journal Entry
// ============================================
async function createJournalEntry(
  db: any,
  data: {
    voucher_no: string;
    entry_date: string;
    description: string;
    debit_account: string;   // e.g., "1200" (Cash/Bank)
    credit_account: string;  // e.g., "4000" (Revenue)
    amount: number;
    reference?: string;
    tenant_id?: string;
    apartment_no?: string;
  }
) {
  const entry_id = newId();
  const ts = now();
  const { voucher_no, entry_date, description, debit_account, credit_account, amount, reference, tenant_id, apartment_no } = data;

  // VALIDATION: Debit must equal Credit
  if (amount <= 0) {
    throw new Error("Transaction amount must be greater than zero");
  }

  // VALIDATION: Account codes must exist
  const debitAccountExists = await db.queryOne(
    `SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?`,
    [debit_account]
  );
  const creditAccountExists = await db.queryOne(
    `SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?`,
    [credit_account]
  );

  if (!debitAccountExists || !creditAccountExists) {
    console.warn(`Creating missing accounts: ${debit_account}, ${credit_account}`);
    // Auto-create accounts if they don't exist
    if (!debitAccountExists) {
      await db.run(
        `INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)`,
        [debit_account, `Account ${debit_account}`, "Asset"]
      );
    }
    if (!creditAccountExists) {
      await db.run(
        `INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)`,
        [credit_account, `Account ${credit_account}`, "Liability"]
      );
    }
  }

  try {
    let entry_type = "JV";
    if (voucher_no.startsWith("RV")) entry_type = "RV";
    else if (voucher_no.startsWith("PV")) entry_type = "PV";
    else if (voucher_no.startsWith("RI")) entry_type = "RI";
    else if (voucher_no.startsWith("RF")) entry_type = "RF";
    else {
      const descLower = (description || "").toLowerCase();
      if (descLower.includes("[rv-") || descLower.includes("receipt voucher")) {
        entry_type = "RV";
      } else if (descLower.includes("[pv-") || descLower.includes("payment voucher")) {
        entry_type = "PV";
      } else if (descLower.includes("[ri-") || descLower.includes("rental invoice")) {
        entry_type = "RI";
      } else if (descLower.includes("[rf-") || descLower.includes("refund voucher")) {
        entry_type = "RF";
      }
    }
    // 1. Create Journal Entry Header
    await db.run(
      `INSERT INTO journal_entries (id, voucher_no, entry_type, entry_date, description, reference, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry_id, voucher_no, entry_type, entry_date, description, reference || voucher_no, ts, ts]
    );

    // 2. Create Debit Line
    const debit_line_id = newId();
    await db.run(
      `INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [debit_line_id, entry_id, debit_account, amount, ts, ts]
    );

    // 3. Create Credit Line
    const credit_line_id = newId();
    await db.run(
      `INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
      [credit_line_id, entry_id, credit_account, amount, ts, ts]
    );

    // 4. Post to General Ledger (Debit Entry)
    const debit_gl_id = newId();
    const debit_balance = await calculateAccountBalance(db, debit_account, amount, 0);
    await db.run(
      `INSERT INTO general_ledger (id, entry_id, line_id, acco_id, tx_date, description, debit, credit, balance_after, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [debit_gl_id, entry_id, debit_line_id, debit_account, entry_date, description, amount, debit_balance, ts, ts]
    );

    // 5. Post to General Ledger (Credit Entry)
    const credit_gl_id = newId();
    const credit_balance = await calculateAccountBalance(db, credit_account, 0, amount);
    await db.run(
      `INSERT INTO general_ledger (id, entry_id, line_id, acco_id, tx_date, description, debit, credit, balance_after, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [credit_gl_id, entry_id, credit_line_id, credit_account, entry_date, description, amount, credit_balance, ts, ts]
    );

    // 6. Update Tenant/Owner Ledger if applicable
    if (tenant_id) {
      await updateTenantLedger(db, tenant_id, entry_id, amount, voucher_no.startsWith("RV") ? "credit" : "debit");
      
      // Legacy UI Compatibility: Insert into legacy ledger_entries table
      let legacy_type = "other";
      if (voucher_no.startsWith("RI")) legacy_type = "rent";
      else if (voucher_no.startsWith("RV")) legacy_type = "rent";
      
      const type = voucher_no.startsWith("RV") ? "credit" : "debit";
      const userRec = await db.queryOne(`SELECT outstanding_balance FROM users WHERE id = ?`, [tenant_id]);
      
      await db.run(
        `INSERT INTO ledger_entries (id, user_id, entry_date, entry_type, description, debit, credit, balance_after, voucher_no, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), tenant_id, entry_date, legacy_type, description, type === "debit" ? amount : 0, type === "credit" ? amount : 0, userRec?.outstanding_balance || 0, voucher_no, ts, ts]
      );
    }

    return { entry_id, voucher_no, debit_line_id, credit_line_id };
  } catch (error: any) {
    console.error("Journal entry creation failed:", error);
    throw new Error(`Double entry posting failed: ${error.message}`);
  }
}

// ============================================
// HELPER: Calculate Account Balance
// ============================================
async function calculateAccountBalance(db: any, acco_id: string, debit: number, credit: number): Promise<number> {
  const lastEntry = await db.queryOne<{ balance_after: number }>(
    `SELECT balance_after FROM general_ledger 
     WHERE acco_id = ? 
     ORDER BY tx_date DESC, created_at DESC 
     LIMIT 1`,
    [acco_id]
  );

  const previousBalance = lastEntry?.balance_after || 0;
  // Running Balance Formula: Previous Balance + Debit - Credit
  return previousBalance + debit - credit;
}

// ============================================
// HELPER: Update Tenant Ledger
// ============================================
async function updateTenantLedger(db: any, tenant_id: string, entry_id: string, amount: number, type: "debit" | "credit") {
  const tenant_ledger_id = newId();
  const ts = now();

  // Get previous balance
  const lastEntry = await db.queryOne<{ balance_after: number }>(
    `SELECT balance_after FROM tenant_ledger 
     WHERE tenant_id = ? 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [tenant_id]
  );

  const previousBalance = lastEntry?.balance_after || 0;
  const debit = type === "debit" ? amount : 0;
  const credit = type === "credit" ? amount : 0;
  const balance_after = previousBalance + debit - credit;

  await db.run(
    `INSERT INTO tenant_ledger (id, tenant_id, entry_id, debit, credit, balance_after, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenant_ledger_id, tenant_id, entry_id, debit, credit, balance_after, ts, ts]
  );

  // Update user outstanding balance
  await db.run(
    `UPDATE users SET outstanding_balance = ?, updated_at = ? WHERE id = ?`,
    [balance_after, ts, tenant_id]
  );
}

// ============================================
// POST: Receipt Voucher (RV)
// ============================================
router.post("/rv", authRequired, requireAccountingRole, async (req, res) => {
  try {
    const db = await getDb();
    const {
      voucher_no,
      date,
      tenant_id,
      apartment_no,
      amount,
      payment_method,
      reference_no,
      remarks,
      received_from,
      purpose
    } = req.body;

    if (!voucher_no || !date || !amount) {
      return res.status(400).json({ error: "Missing required fields: voucher_no, date, amount" });
    }

    const cleanVoucherNo = voucher_no.startsWith("RV-") ? voucher_no : `RV-${voucher_no}`;
    const description = `[${cleanVoucherNo}] Received from ${received_from || "Customer"} - ${purpose || "Payment received"}. ${remarks || ""}`;

    // Double Entry: Debit Cash (1000), Credit Revenue/Receivable (4000)
    const result = await createJournalEntry(db, {
      voucher_no: cleanVoucherNo,
      entry_date: date,
      description,
      debit_account: "1000",  // Cash/Bank Account
      credit_account: "4000", // Revenue/Income Account
      amount: Number(amount),
      reference: reference_no,
      tenant_id,
      apartment_no
    });

    // Insert into receipt_vouchers table
    await db.run(
      `INSERT INTO receipt_vouchers (id, voucher_no, date, tenant_id, amount, payment_method, reference_no, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), cleanVoucherNo, date, tenant_id || null, amount, payment_method || "Cash", reference_no || "", remarks || "", now(), now()]
    );

    res.json({
      success: true,
      message: "Receipt Voucher posted successfully with double-entry",
      voucher_no: cleanVoucherNo,
      entry_id: result.entry_id,
      amount
    });
  } catch (error: any) {
    console.error("RV posting error:", error);
    res.status(500).json({ error: error.message || "Failed to post Receipt Voucher" });
  }
});

// ============================================
// POST: Payment Voucher (PV)
// ============================================
router.post("/pv", authRequired, requireAccountingRole, async (req, res) => {
  try {
    const db = await getDb();
    const {
      voucher_no,
      date,
      paid_to,
      amount,
      payment_method,
      category,
      remarks,
      tenant_id,
      apartment_no
    } = req.body;

    if (!voucher_no || !date || !amount) {
      return res.status(400).json({ error: "Missing required fields: voucher_no, date, amount" });
    }

    const cleanVoucherNo = voucher_no.startsWith("PV-") ? voucher_no : `PV-${voucher_no}`;
    const description = `[${cleanVoucherNo}] Paid to ${paid_to || "Vendor"} - ${category || "Expense payment"}. ${remarks || ""}`;

    // Determine expense account code based on category
    let expenseAccount = "5900"; // Default: Other Expense
    if (category === "maintenance" || category === "maintenance_charges") expenseAccount = "5200";
    else if (category === "salary" || category === "staff") expenseAccount = "5100";
    else if (category === "utilities" || category === "electricity" || category === "gas") expenseAccount = "5300";
    else if (category === "payment_voucher") expenseAccount = "5900";

    // Double Entry: Debit Expense (5xxx), Credit Cash (1000)
    const result = await createJournalEntry(db, {
      voucher_no: cleanVoucherNo,
      entry_date: date,
      description,
      debit_account: expenseAccount,
      credit_account: "1000", // Cash/Bank Account
      amount: Number(amount),
      reference: cleanVoucherNo,
      tenant_id: tenant_id || undefined,
      apartment_no: apartment_no || undefined
    });

    // Insert into expenses table
    await db.run(
      `INSERT INTO expenses (id, category, amount, description, expense_date, paid_from_acco_id, expense_acco_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), category || "payment_voucher", amount, description, date, "1000", expenseAccount, now(), now()]
    );

    res.json({
      success: true,
      message: "Payment Voucher posted successfully with double-entry",
      voucher_no: cleanVoucherNo,
      entry_id: result.entry_id,
      amount
    });
  } catch (error: any) {
    console.error("PV posting error:", error);
    res.status(500).json({ error: error.message || "Failed to post Payment Voucher" });
  }
});


// ============================================
// POST: Rental Invoice (RI)
// ============================================
router.post("/ri", authRequired, requireAccountingRole, async (req, res) => {
  try {
    const db = await getDb();
    const {
      invoice_no,
      date,
      tenant_id,
      apartment_no,
      rent,
      maintenance,
      electricity,
      gas,
      water,
      parking,
      other_charges,
      previous_arrears
    } = req.body;

    if (!invoice_no || !date || !tenant_id) {
      return res.status(400).json({ error: "Missing required fields: invoice_no, date, tenant_id" });
    }

    const total_bill = 
      Number(rent || 0) + 
      Number(maintenance || 0) + 
      Number(electricity || 0) + 
      Number(gas || 0) + 
      Number(water || 0) +
      Number(parking || 0) +
      Number(other_charges || 0);

    const grand_total = total_bill + Number(previous_arrears || 0);

    const cleanInvoiceNo = invoice_no.startsWith("RI-") ? invoice_no : `RI-${invoice_no}`;
    const description = `[${cleanInvoiceNo}] Rental Invoice for ${apartment_no} - Rent: ${rent}, Maintenance: ${maintenance}, Utilities: ${electricity + gas + water}`;

    // Double Entry: Debit Accounts Receivable (1200), Credit Revenue (4000)
    const result = await createJournalEntry(db, {
      voucher_no: cleanInvoiceNo,
      entry_date: date,
      description,
      debit_account: "1200",  // Accounts Receivable
      credit_account: "4000", // Revenue/Income
      amount: grand_total,
      reference: cleanInvoiceNo,
      tenant_id,
      apartment_no
    });

    // Insert into invoices table
    await db.run(
      `INSERT INTO invoices (invoice_no, date, tenant_id, apartment_no, flat_rent, maintenance_charges, electricity_amount, gas_charges, water_charges, parking_charges, other_charges, previous_arrears, total_bill_amount, grand_total, amount_received, current_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [cleanInvoiceNo, date, tenant_id, apartment_no, rent || 0, maintenance || 0, electricity || 0, gas || 0, water || 0, parking || 0, other_charges || 0, previous_arrears || 0, total_bill, grand_total, grand_total]
    );

    res.json({
      success: true,
      message: "Rental Invoice posted successfully with double-entry",
      invoice_no: cleanInvoiceNo,
      entry_id: result.entry_id,
      total_bill,
      grand_total
    });
  } catch (error: any) {
    console.error("RI posting error:", error);
    res.status(500).json({ error: error.message || "Failed to post Rental Invoice" });
  }
});

// ============================================
// POST: Refund Entry
// ============================================
router.post("/refund", authRequired, requireAccountingRole, async (req, res) => {
  try {
    const db = await getDb();
    const {
      refund_no,
      date,
      original_type,
      original_voucher_no,
      tenant_id,
      amount,
      reason
    } = req.body;

    if (!refund_no || !date || !amount || !original_type) {
      return res.status(400).json({ error: "Missing required fields: refund_no, date, amount, original_type" });
    }

    const cleanRefundNo = refund_no.startsWith("RF-") ? refund_no : `RF-${refund_no}`;
    const description = `[${cleanRefundNo}] Refund for ${original_type} ${original_voucher_no} - Reason: ${reason || "Customer request"}`;

    // Double Entry: Debit Revenue/Liability (4000), Credit Cash (1000)
    // This reverses the original entry
    const result = await createJournalEntry(db, {
      voucher_no: cleanRefundNo,
      entry_date: date,
      description,
      debit_account: "4000",  // Revenue (reverse)
      credit_account: "1000", // Cash/Bank (refund paid)
      amount: Number(amount),
      reference: original_voucher_no,
      tenant_id
    });

    // Insert into refund_vouchers table
    await db.run(
      `INSERT INTO refund_vouchers (id, refund_no, original_type, original_voucher_no, tenant_id, amount, reason, refund_date, posted_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), cleanRefundNo, original_type, original_voucher_no, tenant_id || null, amount, reason || "", date, req.user?.sub || "admin", now()]
    );

    res.json({
      success: true,
      message: "Refund processed successfully with double-entry reversal",
      refund_no: cleanRefundNo,
      entry_id: result.entry_id,
      amount
    });
  } catch (error: any) {
    console.error("Refund posting error:", error);
    res.status(500).json({ error: error.message || "Failed to process refund" });
  }
});

// ============================================
// GET: General Ledger Report
// ============================================
router.get("/general-ledger", authRequired, requireAccountingRole, async (req, res) => {
  try {
    const db = await getDb();
    const { account_id, from_date, to_date } = req.query;

    let sql = `SELECT * FROM general_ledger WHERE 1=1`;
    const params: any[] = [];

    if (account_id) {
      sql += ` AND acco_id = ?`;
      params.push(account_id);
    }

    if (from_date) {
      sql += ` AND tx_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      sql += ` AND tx_date <= ?`;
      params.push(to_date);
    }

    sql += ` ORDER BY tx_date ASC, created_at ASC`;

    const entries = await db.query(sql, params);

    res.json({
      success: true,
      entries,
      count: entries.length
    });
  } catch (error: any) {
    console.error("General Ledger fetch error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch General Ledger" });
  }
});

// ============================================
// GET: Trial Balance
// ============================================
router.get("/trial-balance", authRequired, requireAccountingRole, async (req, res) => {
  try {
    const db = await getDb();
    const { as_of_date } = req.query;

    let sql = `
      SELECT 
        gl.acco_id,
        coa.acco_name,
        coa.account_type,
        SUM(gl.debit) as total_debit,
        SUM(gl.credit) as total_credit,
        (SUM(gl.debit) - SUM(gl.credit)) as balance
      FROM general_ledger gl
      LEFT JOIN chart_of_accounts coa ON gl.acco_id = coa.acco_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (as_of_date) {
      sql += ` AND gl.tx_date <= ?`;
      params.push(as_of_date);
    }

    sql += ` GROUP BY gl.acco_id, coa.acco_name, coa.account_type`;

    const accounts = await db.query(sql, params);

    const total_debit = accounts.reduce((sum: number, acc: any) => sum + Number(acc.total_debit || 0), 0);
    const total_credit = accounts.reduce((sum: number, acc: any) => sum + Number(acc.total_credit || 0), 0);
    const is_balanced = Math.abs(total_debit - total_credit) < 0.01; // Allow for rounding

    res.json({
      success: true,
      accounts,
      summary: {
        total_debit,
        total_credit,
        difference: total_debit - total_credit,
        is_balanced
      }
    });
  } catch (error: any) {
    console.error("Trial Balance fetch error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch Trial Balance" });
  }
});

// ============================================
// GET: Account Balance
// ============================================
router.get("/account-balance/:acco_id", authRequired, requireAccountingRole, async (req, res) => {
  try {
    const db = await getDb();
    const { acco_id } = req.params;

    const lastEntry = await db.queryOne<{ balance_after: number; tx_date: string }>(
      `SELECT balance_after, tx_date FROM general_ledger 
       WHERE acco_id = ? 
       ORDER BY tx_date DESC, created_at DESC 
       LIMIT 1`,
      [acco_id]
    );

    const account = await db.queryOne<{ acco_name: string; account_type: string }>(
      `SELECT acco_name, account_type FROM chart_of_accounts WHERE acco_id = ?`,
      [acco_id]
    );

    res.json({
      success: true,
      acco_id,
      acco_name: account?.acco_name || "Unknown Account",
      account_type: account?.account_type || "Unknown",
      balance: lastEntry?.balance_after || 0,
      as_of_date: lastEntry?.tx_date || now()
    });
  } catch (error: any) {
    console.error("Account balance fetch error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch account balance" });
  }
});

export default router;
