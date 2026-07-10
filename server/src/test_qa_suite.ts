import { getDb, postLedgerEntry } from "./db/index.js";
import { randomUUID } from "node:crypto";

async function runQaTestSuite() {
  console.log("=================================================================");
  console.log("             MARGALLA GATEWAY ERP INTEGRATION QA SUITE           ");
  console.log("=================================================================\n");

  const db = await getDb();
  console.log(`Database Mode: ${db.mode.toUpperCase()}`);

  const testUserId = `qa-resident-${randomUUID().slice(0, 8)}`;
  const testApt = "QA-101";

  try {
    // Cleanup any leftovers (if any)
    await db.run("DELETE FROM ledger_entries WHERE user_id = ?", [testUserId]);
    await db.run("DELETE FROM users WHERE id = ?", [testUserId]);
    await db.run("DELETE FROM ledger_transactions WHERE main_acco_id LIKE ? OR contra_acco_id LIKE ?", [`%${testUserId}%`, `%${testUserId}%`]);
    await db.run("DELETE FROM journal_lines WHERE acco_id LIKE ?", [`%${testUserId}%`]);

    console.log("-----------------------------------------------------------------");
    console.log("TEST 1: Real Transaction Testing (Invoicing, Payments & Balance Flow)");
    console.log("-----------------------------------------------------------------");
    
    // 1. Create a Resident
    console.log("Creating QA Resident: Rent = 100,000, Security Deposit = 50,000...");
    await db.run(
      `INSERT INTO users (id, client_id, email, password_hash, full_name, role, apartment_no, rent_amount, security_deposit, outstanding_balance, permissions_json, created_at, updated_at)
       VALUES (?, ?, 'qa-tenant@margalla.local', 'hashed_pwd', 'QA Test Tenant', 'resident', ?, 100000, 50000, 0, '{}', datetime('now'), datetime('now'))`,
      [testUserId, `MG-${testUserId.slice(0, 10).toUpperCase()}`, testApt]
    );

    // Verify initial balance
    let user = await db.queryOne<{ outstanding_balance: number }>("SELECT outstanding_balance FROM users WHERE id = ?", [testUserId]);
    console.log(`Initial Outstanding Balance: ${user?.outstanding_balance}`);

    // Post Rent Invoice 1 = 100,000
    console.log("\nPosting Month 1 Rent Invoice (PKR 100,000)...");
    const entry1 = await postLedgerEntry(db, {
      user_id: testUserId,
      entry_date: "2026-06-01",
      entry_type: "rent",
      description: "Rent Invoice (June 2026)",
      debit: 100000,
      credit: 0,
      created_by: "qa-suite"
    });
    console.log(`Rent Invoice 1 posted. Voucher: ${entry1.voucher_no}, Running Balance: ${entry1.balance_after}`);

    // Post Payment 1 = 1,000
    console.log("\nPosting Rent Payment 1 (PKR 1,000)...");
    const entry2 = await postLedgerEntry(db, {
      user_id: testUserId,
      entry_date: "2026-06-05",
      entry_type: "rent",
      description: "Rent Payment - Bank Transfer",
      debit: 0,
      credit: 1000,
      created_by: "qa-suite"
    });
    console.log(`Payment 1 posted. Voucher: ${entry2.voucher_no}, Running Balance: ${entry2.balance_after}`);

    // Post Payment 2 = 2,000
    console.log("\nPosting Rent Payment 2 (PKR 2,000)...");
    const entry3 = await postLedgerEntry(db, {
      user_id: testUserId,
      entry_date: "2026-06-10",
      entry_type: "rent",
      description: "Rent Payment - Cash",
      debit: 0,
      credit: 2000,
      created_by: "qa-suite"
    });
    console.log(`Payment 2 posted. Voucher: ${entry3.voucher_no}, Running Balance: ${entry3.balance_after}`);

    // Assert Month 1 Balance is 97,000
    user = await db.queryOne<{ outstanding_balance: number }>("SELECT outstanding_balance FROM users WHERE id = ?", [testUserId]);
    console.log(`\nMonth 1 Final Outstanding Balance: ${user?.outstanding_balance}`);
    const isM1Correct = user?.outstanding_balance === 97000;
    if (isM1Correct) {
      console.log("✅ SUCCESS: Outstanding Balance equals exactly 97,000 after payments!");
    } else {
      throw new Error(`Outstanding Balance check failed. Expected 97000, got ${user?.outstanding_balance}`);
    }

    // Post Rent Invoice 2 = 100,000 (Next month)
    console.log("\nPosting Month 2 Rent Invoice (PKR 100,000)...");
    const entry4 = await postLedgerEntry(db, {
      user_id: testUserId,
      entry_date: "2026-07-01",
      entry_type: "rent",
      description: "Rent Invoice (July 2026)",
      debit: 100000,
      credit: 0,
      created_by: "qa-suite"
    });
    console.log(`Rent Invoice 2 posted. Voucher: ${entry4.voucher_no}, Running Balance: ${entry4.balance_after}`);

    // Assert Month 2 Balance is 197,000 (Carry forward check)
    user = await db.queryOne<{ outstanding_balance: number }>("SELECT outstanding_balance FROM users WHERE id = ?", [testUserId]);
    console.log(`\nMonth 2 Outstanding Balance (Carry Forward): ${user?.outstanding_balance}`);
    const isM2Correct = user?.outstanding_balance === 197000;
    if (isM2Correct) {
      console.log("✅ SUCCESS: Outstanding balance carries forward correctly to 197,000!");
    } else {
      throw new Error(`Carry forward check failed. Expected 197000, got ${user?.outstanding_balance}`);
    }

    console.log("\n-----------------------------------------------------------------");
    console.log("TEST 2: PDF Statement Data Integrity Testing");
    console.log("-----------------------------------------------------------------");
    
    // Fetch statement data mimicking the `/api/ledger/statement/:userId` endpoint
    const statementEntries = await db.query<any>(
      "SELECT * FROM ledger_entries WHERE user_id = ? ORDER BY entry_date ASC, created_at ASC",
      [testUserId]
    );

    const userProfile = await db.queryOne<any>(
      "SELECT full_name, client_id, apartment_no, security_deposit, outstanding_balance FROM users WHERE id = ?",
      [testUserId]
    );

    let opening_balance = userProfile.outstanding_balance;
    if (statementEntries.length > 0) {
      opening_balance = Number(statementEntries[0].balance_after ?? 0) - Number(statementEntries[0].debit ?? 0) + Number(statementEntries[0].credit ?? 0);
    }

    const statementPayload = {
      user: userProfile,
      entries: statementEntries,
      opening_balance,
      closing_balance: userProfile.outstanding_balance,
      security_deposit: userProfile.security_deposit
    };

    console.log("Validating required fields in PDF Statement Payload...");
    const hasName = !!statementPayload.user.full_name;
    const hasId = !!statementPayload.user.client_id;
    const hasApt = !!statementPayload.user.apartment_no;
    const hasOpening = statementPayload.opening_balance !== undefined;
    const hasHistory = Array.isArray(statementPayload.entries) && statementPayload.entries.length > 0;
    const hasOutstanding = statementPayload.closing_balance !== undefined;
    const hasDeposit = statementPayload.security_deposit !== undefined;

    console.log(`- Resident Name: "${statementPayload.user.full_name}" -> ${hasName ? "OK" : "MISSING"}`);
    console.log(`- Resident ID: "${statementPayload.user.client_id}" -> ${hasId ? "OK" : "MISSING"}`);
    console.log(`- Apartment No: "${statementPayload.user.apartment_no}" -> ${hasApt ? "OK" : "MISSING"}`);
    console.log(`- Opening Balance: ${statementPayload.opening_balance} -> ${hasOpening ? "OK" : "MISSING"}`);
    console.log(`- History Rows Count: ${statementPayload.entries.length} -> ${hasHistory ? "OK" : "MISSING"}`);
    console.log(`- Outstanding Balance: ${statementPayload.closing_balance} -> ${hasOutstanding ? "OK" : "MISSING"}`);
    console.log(`- Security Deposit Balance: ${statementPayload.security_deposit} -> ${hasDeposit ? "OK" : "MISSING"}`);

    if (hasName && hasId && hasApt && hasOpening && hasHistory && hasOutstanding && hasDeposit) {
      console.log("✅ SUCCESS: Statement API payload contains all mandatory PDF output fields!");
    } else {
      throw new Error("PDF statement payload validation failed.");
    }

    console.log("\n-----------------------------------------------------------------");
    console.log("TEST 3: Security Deposit Isolation & P&L Exclusion Testing");
    console.log("-----------------------------------------------------------------");

    // Post Security Deposit = 50,000
    console.log("Posting Security Deposit (PKR 50,000)...");
    const securityEntry = await postLedgerEntry(db, {
      user_id: testUserId,
      entry_date: "2026-06-01",
      entry_type: "security",
      description: "Security Deposit Received",
      debit: 0,
      credit: 50000,
      created_by: "qa-suite"
    });

    console.log(`Security Deposit posted. Voucher: ${securityEntry.voucher_no}, Running Balance (Should not add to Rent): ${securityEntry.balance_after}`);

    // Verify double-entry accounts affected by this security deposit entry
    const securityTX = await db.query<any>(
      "SELECT main_acco_id, contra_acco_id, debit, credit FROM ledger_transactions WHERE voucher_no = ?",
      [securityEntry.voucher_no]
    );

    console.log("Double entry routes for Security Deposit voucher:");
    console.table(securityTX);

    const isSecurityHeldCredited = securityTX.some(t => t.main_acco_id === `2100.1.1.${testUserId}` && t.credit === 50000);
    const isCashDebited = securityTX.some(t => t.main_acco_id === "1000" && t.debit === 50000);

    console.log(`- Security Deposits Held (Account 2100) Credited: ${isSecurityHeldCredited ? "YES" : "NO"}`);
    console.log(`- Cash Account (Account 1000) Debited: ${isCashDebited ? "YES" : "NO"}`);

    // Verify that the security deposit does NOT affect Rent Income (account 4000)
    const incomeAffected = securityTX.some(t => t.main_acco_id === "4000" || t.contra_acco_id === "4000");
    console.log(`- Touches Rent Income (Account 4000): ${incomeAffected ? "YES" : "NO"}`);

    if (isSecurityHeldCredited && isCashDebited && !incomeAffected) {
      console.log("✅ SUCCESS: Security Deposit is fully isolated as a Liability (2100) and excluded from Profit & Loss / Rental Income!");
    } else {
      throw new Error("Security Deposit Isolation check failed.");
    }

    console.log("\n-----------------------------------------------------------------");
    console.log("TEST 4: Journal Entry Auto-posting & Double Entry Sync Testing");
    console.log("-----------------------------------------------------------------");

    // Let's inspect the double entry journal tables for all transactions generated under the test resident
    const journalEntries = await db.query<any>(
      `SELECT je.voucher_no, je.entry_date, je.description, jl.acco_id, jl.debit, jl.credit 
       FROM journal_entries je 
       JOIN journal_lines jl ON je.id = jl.entry_id 
       WHERE je.voucher_no IN (
         SELECT DISTINCT voucher_no FROM ledger_entries WHERE user_id = ?
       )
       ORDER BY je.voucher_no ASC, jl.debit DESC`,
      [testUserId]
    );

    console.log("Generated Journal Entries & Lines:");
    console.table(journalEntries);

    // Let's verify that for every unique voucher, debits equal credits
    const uniqueVouchers = Array.from(new Set(journalEntries.map(j => j.voucher_no)));
    let balancedCount = 0;

    for (const vNo of uniqueVouchers) {
      const lines = journalEntries.filter(j => j.voucher_no === vNo);
      const totalDebits = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredits = lines.reduce((s, l) => s + l.credit, 0);
      const diff = Math.abs(totalDebits - totalCredits);
      console.log(`- Voucher ${vNo}: Debits = ${totalDebits}, Credits = ${totalCredits}, Diff = ${diff}`);
      if (diff < 0.001) balancedCount++;
    }

    if (balancedCount === uniqueVouchers.length && uniqueVouchers.length > 0) {
      console.log(`✅ SUCCESS: All ${balancedCount} generated journal entries are perfectly balanced double-entry pairs!`);
    } else {
      throw new Error(`Double entry validation failed. Balanced entries: ${balancedCount}/${uniqueVouchers.length}`);
    }

    console.log("\n-----------------------------------------------------------------");
    console.log("TEST 5: Trial Balance Completeness & Balancing Verification");
    console.log("-----------------------------------------------------------------");

    // Fetch the trial balance of ALL accounts linked to the test user
    const trialBalance = await db.query<{ account: string; type: string; debits: number; credits: number; net: number }>(`
      SELECT 
        acco_id as account,
        (SELECT account_type FROM chart_of_accounts WHERE acco_id = jl.acco_id) as type,
        SUM(debit) as debits,
        SUM(credit) as credits,
        SUM(debit - credit) as net
      FROM journal_lines jl
      WHERE entry_id IN (
        SELECT id FROM journal_entries WHERE voucher_no IN (
          SELECT DISTINCT voucher_no FROM ledger_entries WHERE user_id = ?
        )
      )
      GROUP BY acco_id
    `, [testUserId]);

    console.log("Trial Balance Report for Test transaction context:");
    console.table(trialBalance);

    const totals = trialBalance.reduce((a, b) => {
      a.debits += b.debits;
      a.credits += b.credits;
      a.net += b.net;
      return a;
    }, { debits: 0, credits: 0, net: 0 });

    console.log(`Trial Balance Totals:`);
    console.log(`- Total Debits:  PKR ${totals.debits.toLocaleString()}`);
    console.log(`- Total Credits: PKR ${totals.credits.toLocaleString()}`);
    console.log(`- Net Difference: PKR ${totals.net}`);

    if (Math.abs(totals.net) < 0.001) {
      console.log("✅ SUCCESS: Trial Balance equals exactly 0! Net debits and credits match perfectly.");
    } else {
      throw new Error(`Trial Balance did not balance. Net difference: ${totals.net}`);
    }

    console.log("\n=================================================================");
    console.log("          ALL 5 INTEGRATION QA TEST CATEGORIES PASSED!");
    console.log("=================================================================");

  } catch (error: any) {
    console.error("\n❌ QA TEST SUITE FAILED:");
    console.error(error);
  } finally {
    // Cleanup test data to prevent database pollution
    console.log("\nCleaning up QA test resident records from database...");
    try {
      // 1. Delete leases referencing residents of this user
      await db.run(
        "DELETE FROM leases WHERE resident_id IN (SELECT id FROM residents WHERE user_id = ?)",
        [testUserId]
      );
      // 2. Delete residents referencing this user
      await db.run("DELETE FROM residents WHERE user_id = ?", [testUserId]);
      // 3. Delete double-entry lines and transactions completely (both sides) using ledger_entries before deleting it
      await db.run("DELETE FROM ledger_transactions WHERE voucher_no IN (SELECT voucher_no FROM ledger_entries WHERE user_id = ?)", [testUserId]);
      await db.run("DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE voucher_no IN (SELECT voucher_no FROM ledger_entries WHERE user_id = ?))", [testUserId]);
      await db.run("DELETE FROM journal_entries WHERE voucher_no IN (SELECT voucher_no FROM ledger_entries WHERE user_id = ?)", [testUserId]);
      // 4. Delete ledger entries referencing this user
      await db.run("DELETE FROM ledger_entries WHERE user_id = ?", [testUserId]);
      // 5. Delete chart of accounts referencing this user
      await db.run("DELETE FROM chart_of_accounts WHERE acco_id LIKE ?", [`%${testUserId}%`]);
      // 6. Delete the user
      await db.run("DELETE FROM users WHERE id = ?", [testUserId]);
      console.log("Cleanup finished successfully.");
    } catch (cleanupErr: any) {
      console.error("Cleanup failed:", cleanupErr.message);
    }
  }
}

runQaTestSuite();
