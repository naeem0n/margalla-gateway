import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Find the live database
const dbPaths = [
  path.join(__dirname, '..', 'margalla.db'),
  path.join(__dirname, '..', 'server', 'margalla.db'),
  path.join(process.env.APPDATA || '', 'margalla-gateway', 'data', 'margalla.db'),
];

console.log('=== DATABASE LOCATION SCAN ===');
for (const p of dbPaths) {
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  console.log((exists ? '[FOUND]' : '[MISSING]') + ' ' + p + (exists ? ' (' + size + ' bytes)' : ''));
}

// Pick the largest / most-data file
let chosenDb = null;
let chosenPath = null;
let maxResidents = -1;

for (const p of dbPaths) {
  if (!fs.existsSync(p)) continue;
  try {
    const testDb = new DatabaseSync(p);
    const r = testDb.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='resident'").get();
    console.log('\nResidents in ' + path.basename(path.dirname(p)) + '/' + path.basename(p) + ': ' + r.cnt);
    if (r.cnt > maxResidents) {
      if (chosenDb) chosenDb.close();
      maxResidents = r.cnt;
      chosenDb = testDb;
      chosenPath = p;
    } else {
      testDb.close();
    }
  } catch(e) {
    console.log('  Cannot query ' + p + ': ' + e.message);
  }
}

if (!chosenDb) {
  console.error('\nFATAL: No usable database found.');
  process.exit(1);
}

const db = chosenDb;
console.log('\n>>> USING DATABASE: ' + chosenPath + ' (' + maxResidents + ' residents) <<<\n');

// 1. All tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLES (' + tables.length + ') ===');
tables.forEach(t => console.log(' -', t.name));

// 2. Record counts
const keyTables = [
  'users','apartments','ledger_entries','invoices',
  'ledger_transactions','journal_entries','journal_lines',
  'chart_of_accounts','tenants','residents','leases',
  'receipt_vouchers','security_deposits','invoice_headers','invoice_items'
];
console.log('\n=== RECORD COUNTS ===');
for (const t of keyTables) {
  try {
    const r = db.prepare('SELECT COUNT(*) as cnt FROM ' + t).get();
    console.log('  ' + t + ': ' + r.cnt);
  } catch(e) {
    console.log('  ' + t + ': NOT FOUND');
  }
}

// 3. Resident list with billing fields
console.log('\n=== RESIDENTS (billing fields) ===');
try {
  const residents = db.prepare(`
    SELECT client_id, full_name, apartment_no, rent_amount, fixed_maintenance,
           outstanding_balance, elec_prev, elec_curr, elec_rate, gas_rate, parking_rent, stall_rent, other_income
    FROM users WHERE role='resident' ORDER BY apartment_no
  `).all();
  if (residents.length === 0) {
    console.log('  (no residents in this database)');
  }
  residents.forEach(r => {
    const units = Math.max(0, (r.elec_curr || 0) - (r.elec_prev || 0));
    const elecAmt = units * (r.elec_rate || 100);
    console.log(`  [${r.client_id}] ${r.full_name} | Apt: ${r.apartment_no} | Rent: ${r.rent_amount} | Maint: ${r.fixed_maintenance} | Balance: ${r.outstanding_balance}`);
    console.log(`    Elec: prev=${r.elec_prev} curr=${r.elec_curr} units=${units} rate=${r.elec_rate} => amt=${elecAmt}`);
    console.log(`    Gas(fixed): rate=${r.gas_rate} | Parking: ${r.parking_rent} | Stall: ${r.stall_rent} | Other: ${r.other_income}`);
  });
} catch(e) { console.log('  ERROR:', e.message); }

// 4. Apartments
console.log('\n=== APARTMENTS ===');
try {
  const apts = db.prepare("SELECT number, floor, status, rent FROM apartments ORDER BY number").all();
  console.log('  Total: ' + apts.length);
  apts.forEach(a => console.log(`  Apt ${a.number} | Floor: ${a.floor} | Status: ${a.status} | Rent: ${a.rent}`));
} catch(e) { console.log('  ERROR:', e.message); }

// 5. DUPLICATE INVOICE CHECK
console.log('\n=== DUPLICATE INVOICES CHECK ===');
try {
  const dupes = db.prepare(`
    SELECT tenant_id, date, COUNT(*) as cnt
    FROM invoices
    GROUP BY tenant_id, date
    HAVING COUNT(*) > 1
    ORDER BY date DESC
  `).all();
  if (dupes.length === 0) {
    console.log('  PASS: No duplicate invoices.');
  } else {
    console.log('  FAIL: DUPLICATE INVOICES FOUND:');
    dupes.forEach(d => {
      const user = db.prepare("SELECT full_name, apartment_no FROM users WHERE id=?").get(d.tenant_id);
      console.log('    tenant=' + (user ? user.full_name + ' (' + user.apartment_no + ')' : d.tenant_id) + ' date=' + d.date + ' count=' + d.cnt);
    });
  }
} catch(e) { console.log('  ERROR:', e.message); }

// 6. DUPLICATE LEDGER ENTRIES CHECK
console.log('\n=== DUPLICATE LEDGER ENTRIES CHECK ===');
try {
  const dupes = db.prepare(`
    SELECT user_id, entry_date, entry_type, description, COUNT(*) as cnt
    FROM ledger_entries
    GROUP BY user_id, entry_date, entry_type
    HAVING COUNT(*) > 1
    ORDER BY entry_date DESC
  `).all();
  if (dupes.length === 0) {
    console.log('  PASS: No duplicate ledger entries.');
  } else {
    console.log('  FAIL: DUPLICATE LEDGER ENTRIES:');
    dupes.forEach(d => {
      const user = db.prepare("SELECT full_name FROM users WHERE id=?").get(d.user_id);
      console.log('    user=' + (user ? user.full_name : d.user_id) + ' date=' + d.entry_date + ' type=' + d.entry_type + ' count=' + d.cnt);
    });
  }
} catch(e) { console.log('  ERROR:', e.message); }

// 7. SECURITY DEPOSIT ACCOUNTING CHECK
console.log('\n=== SECURITY DEPOSIT ACCOUNTING ===');
try {
  const secEntries = db.prepare("SELECT * FROM ledger_entries WHERE entry_type='security' ORDER BY entry_date DESC").all();
  console.log('  Security ledger entries: ' + secEntries.length);
  if (secEntries.length > 0) {
    secEntries.slice(0, 10).forEach(e => {
      console.log(`  [${e.entry_date}] ${e.description} debit=${e.debit} credit=${e.credit}`);
    });
  }

  // Any security amounts posted to income accounts (should NEVER happen)
  const badSecurity = db.prepare(`
    SELECT lt.voucher_no, lt.main_acco_id, lt.credit, lt.debit
    FROM ledger_transactions lt
    WHERE lt.voucher_no IN (SELECT id FROM ledger_entries WHERE entry_type='security')
    AND lt.main_acco_id LIKE '4%'
  `).all();
  if (badSecurity.length === 0) {
    console.log('  PASS: No security deposits posted to income accounts.');
  } else {
    console.log('  FAIL: Security deposits posted to INCOME accounts (BUG):');
    badSecurity.forEach(b => console.log('    acct=' + b.main_acco_id + ' debit=' + b.debit + ' credit=' + b.credit));
  }
} catch(e) { console.log('  ERROR:', e.message); }

// 8. JOURNAL BALANCE CHECK
console.log('\n=== JOURNAL BALANCE CHECK ===');
try {
  const imbalanced = db.prepare(`
    SELECT voucher_no, SUM(debit) as total_debit, SUM(credit) as total_credit,
           ABS(SUM(debit) - SUM(credit)) as diff
    FROM ledger_transactions
    GROUP BY voucher_no
    HAVING ABS(SUM(debit) - SUM(credit)) > 0.01
    ORDER BY diff DESC
    LIMIT 20
  `).all();
  if (imbalanced.length === 0) {
    console.log('  PASS: All journal entries balanced.');
  } else {
    console.log('  FAIL: ' + imbalanced.length + ' IMBALANCED JOURNAL ENTRIES:');
    imbalanced.forEach(i => console.log(`    voucher=${i.voucher_no} debit=${i.total_debit} credit=${i.total_credit} diff=${i.diff}`));
  }
} catch(e) { console.log('  ERROR:', e.message); }

// 9. GAS BILLING VERIFICATION
console.log('\n=== GAS BILLING (must be FIXED, not units-based) ===');
try {
  const gasChecks = db.prepare("SELECT client_id, full_name, gas_rate, gas_prev, gas_curr FROM users WHERE role='resident'").all();
  if (gasChecks.length === 0) console.log('  (no residents)');
  gasChecks.forEach(r => {
    const gasUnits = (r.gas_curr || 0) - (r.gas_prev || 0);
    if (gasUnits !== 0) {
      console.log(`  WARN: ${r.full_name} gas_prev=${r.gas_prev} gas_curr=${r.gas_curr} units=${gasUnits} -- gas must be FIXED monthly charge only`);
    } else {
      console.log(`  OK:   ${r.full_name} gas_rate=${r.gas_rate} (fixed monthly charge)`);
    }
  });
} catch(e) { console.log('  ERROR:', e.message); }

// 10. RECENT INVOICES CALCULATION AUDIT
console.log('\n=== RECENT INVOICES (calculation audit) ===');
try {
  const invs = db.prepare(`
    SELECT i.invoice_no, i.date, u.full_name, u.apartment_no,
           i.flat_rent, i.electricity_amount, i.gas_charges, i.maintenance_charges,
           i.parking_charges, i.stall_charges, i.other_charges, i.previous_arrears,
           i.total_bill_amount, i.grand_total, i.units_consumed, i.amount_received, i.current_balance
    FROM invoices i LEFT JOIN users u ON i.tenant_id = u.id
    ORDER BY i.date DESC LIMIT 15
  `).all();
  if (invs.length === 0) {
    console.log('  (no invoices found)');
  }
  let calcErrors = 0;
  invs.forEach(inv => {
    const computed = (inv.flat_rent||0)+(inv.electricity_amount||0)+(inv.gas_charges||0)+
                     (inv.maintenance_charges||0)+(inv.parking_charges||0)+(inv.stall_charges||0)+(inv.other_charges||0);
    const withArrears = computed + (inv.previous_arrears||0);
    const match = Math.abs(withArrears - (inv.total_bill_amount||0)) < 1;
    if (!match) calcErrors++;
    const flag = match ? 'OK  ' : 'MISMATCH!';
    console.log(`  [${flag}] ${inv.invoice_no} | ${inv.full_name} (${inv.apartment_no}) | ${inv.date}`);
    console.log(`    rent=${inv.flat_rent||0} elec=${inv.electricity_amount||0} gas=${inv.gas_charges||0} maint=${inv.maintenance_charges||0} parking=${inv.parking_charges||0} other=${inv.other_charges||0}`);
    console.log(`    arrears=${inv.previous_arrears||0} => computed=${withArrears.toFixed(2)} stored=${inv.total_bill_amount} grand=${inv.grand_total} received=${inv.amount_received} balance=${inv.current_balance}`);
  });
  console.log(`  Calculation errors: ${calcErrors} / ${invs.length}`);
} catch(e) { console.log('  ERROR:', e.message); }

// 11. CHART OF ACCOUNTS
console.log('\n=== CHART OF ACCOUNTS ===');
try {
  const coa = db.prepare("SELECT acco_id, acco_name, account_type FROM chart_of_accounts ORDER BY acco_id").all();
  coa.forEach(a => console.log(`  [${a.acco_id}] ${a.acco_name} (${a.account_type})`));
} catch(e) { console.log('  ERROR:', e.message); }

// 12. RECEIPT VOUCHERS
console.log('\n=== RECEIPT VOUCHERS ===');
try {
  const rvs = db.prepare("SELECT * FROM receipt_vouchers ORDER BY created_at DESC LIMIT 10").all();
  if (rvs.length === 0) {
    console.log('  (no receipt vouchers)');
  }
  rvs.forEach(r => console.log(`  [${r.voucher_no||r.id}] tenant=${r.tenant_id} amount=${r.amount} date=${r.payment_date||r.created_at}`));
} catch(e) { console.log('  ERROR:', e.message); }

// 13. LEDGER ENTRY TYPES USED
console.log('\n=== LEDGER ENTRY TYPES SUMMARY ===');
try {
  const types = db.prepare("SELECT entry_type, COUNT(*) as cnt, SUM(debit) as total_debit, SUM(credit) as total_credit FROM ledger_entries GROUP BY entry_type").all();
  types.forEach(t => console.log(`  ${t.entry_type}: ${t.cnt} entries | debit=${t.total_debit||0} credit=${t.total_credit||0}`));
} catch(e) { console.log('  ERROR:', e.message); }

// 14. Users count by role
console.log('\n=== USERS BY ROLE ===');
try {
  const roles = db.prepare("SELECT role, COUNT(*) as cnt FROM users GROUP BY role").all();
  roles.forEach(r => console.log(`  ${r.role}: ${r.cnt}`));
} catch(e) { console.log('  ERROR:', e.message); }

db.close();
console.log('\n=== AUDIT COMPLETE ===');
