const { getDb, postLedgerEntry } = require('./server/src/db/index.js');
const crypto = require('crypto');

async function runTest() {
  const db = await getDb();
  console.log('--- Resetting Database ---');
  
  // Clear financial tables
  db.exec('DELETE FROM journal_lines');
  db.exec('DELETE FROM journal');
  db.exec('DELETE FROM ledger_entries');
  db.exec('DELETE FROM vendor_bills');
  db.exec('DELETE FROM payments');
  
  // Clear master data (for clean test)
  db.exec("DELETE FROM apartments");
  db.exec("DELETE FROM users WHERE role = 'resident'");

  // Verify all are zero
  const jlCount = db.prepare('SELECT COUNT(*) as c FROM journal_lines').get().c;
  const jCount = db.prepare('SELECT COUNT(*) as c FROM journal').get().c;
  const leCount = db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get().c;
  console.log('journal_lines count:', jlCount);
  console.log('journal count:', jCount);
  console.log('ledger_entries count:', leCount);

  console.log('\n--- Creating Master Data ---');
  const aptId = crypto.randomUUID();
  db.prepare('INSERT INTO apartments (id, number, type, status, rent_amount) VALUES (?, ?, ?, ?, ?)').run(aptId, 'A-101', '2bed', 'occupied', 30000);
  
  const tenantId = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, client_id, full_name, role, apartment_no, is_active) VALUES (?, ?, ?, ?, ?, ?)').run(tenantId, 'T-001', 'Test Tenant', 'resident', 'A-101', 1);

  console.log('\n--- Posting Rent Invoice ---');
  const invAmt = 30000;
  
  await postLedgerEntry(db, {
    user_id: tenantId,
    entry_date: new Date().toISOString().slice(0, 10),
    entry_type: 'rent',
    description: 'Monthly Rent Invoice',
    debit: invAmt,
    credit: 0,
    created_by: 'system'
  });

  console.log('\n--- Verifying Double Entry ---');
  const lines = db.prepare('SELECT account_code, debit, credit FROM journal_lines').all();
  console.log('Journal Lines:', lines);
  
  const openRes = db.prepare(
        SELECT jl.account_code, COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as ob 
        FROM journal_lines jl 
        JOIN journal j ON jl.journal_id = j.id 
        WHERE jl.account_code = '1200' AND jl.entity_id = ?
        GROUP BY jl.account_code
  ).all(tenantId);
  console.log('Opening Balance query result for 1200:', openRes);

}

runTest().catch(console.error);
