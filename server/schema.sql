-- Margalla Gateway Rental Management Schema (SQLite + Postgres compatible)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  client_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  apartment_no TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'resident', 'thirdparty')),
  permissions_json TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  force_password_change INTEGER DEFAULT 1,
  cnic TEXT,
  rent_amount REAL DEFAULT 0,
  security_deposit REAL DEFAULT 0,
  agreement_url TEXT,
  gas_units REAL DEFAULT 0,
  water_units REAL DEFAULT 0,
  electricity_units REAL DEFAULT 0,
  fixed_maintenance REAL DEFAULT 0,
  outstanding_balance REAL DEFAULT 0,
  last_billing_date TEXT,
  joining_date TEXT,
  agreement_end_date TEXT,
  daily_rent_rate REAL DEFAULT 0.0,
  apartment_type TEXT,
  scope_profile TEXT,
  -- Decoupled utility meter reading fields
  elec_prev REAL DEFAULT 0,
  elec_curr REAL DEFAULT 0,
  elec_rate REAL DEFAULT 100,
  elec_arrears REAL DEFAULT 0,
  gas_prev REAL DEFAULT 0,
  gas_curr REAL DEFAULT 0,
  gas_rate REAL DEFAULT 120,
  gas_arrears REAL DEFAULT 0,
  water_prev REAL DEFAULT 0,
  water_curr REAL DEFAULT 0,
  water_rate REAL DEFAULT 80,
  water_arrears REAL DEFAULT 0,
  -- Income/charge fields per resident
  parking_rent REAL DEFAULT 0,
  stall_rent REAL DEFAULT 0,
  other_income REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('rent', 'security', 'maintenance', 'other')),
  description TEXT NOT NULL,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  balance_after REAL DEFAULT 0,
  voucher_no TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  owner_type TEXT NOT NULL,
  title TEXT NOT NULL,
  doc_type TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  description TEXT,
  status TEXT DEFAULT 'open',
  resolution TEXT,
  maintenance_cost REAL DEFAULT 0,
  assigned_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY (resident_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  error TEXT,
  action TEXT DEFAULT '',
  payload TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_resident ON complaints(resident_id);
CREATE INDEX IF NOT EXISTS idx_sync_pending ON sync_queue(synced_at);

CREATE TABLE IF NOT EXISTS parking_rules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  cnic TEXT,
  salary REAL DEFAULT 0,
  join_date TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  duty_start TEXT,
  duty_end TEXT,
  advance_balance REAL DEFAULT 0,
  photo_url TEXT,
  id_card_url TEXT,
  appointment_letter_url TEXT,
  father_name TEXT,
  address TEXT,
  witness_name TEXT,
  witness_cnic TEXT,
  witness_phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_salary_payments (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  period_month TEXT NOT NULL,
  gross_salary REAL NOT NULL,
  advance_deducted REAL DEFAULT 0,
  net_paid REAL NOT NULL,
  paid_at TEXT NOT NULL,
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS apartments (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  floor INTEGER,
  type TEXT,
  bedrooms INTEGER,
  area_sqft REAL,
  rent REAL DEFAULT 0,
  status TEXT DEFAULT 'available',
  description TEXT,
  notes TEXT,
  media_urls_json TEXT DEFAULT '[]',
  owner_name TEXT DEFAULT 'Margalla Gateway',
  ownership_type TEXT DEFAULT 'Company',
  dealer_company TEXT,
  dealer_commission REAL DEFAULT 0.00,
  furnishing_status TEXT DEFAULT 'Unfurnished',
  property_id TEXT,
  building_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  cnic TEXT,
  phone TEXT,
  apartment_no TEXT,
  purpose TEXT,
  vehicle_no TEXT,
  host_name TEXT,
  in_time TEXT NOT NULL,
  out_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  apartment_no TEXT,
  bill_type TEXT,
  category TEXT,
  type TEXT,
  amount REAL DEFAULT 0,
  due_date TEXT,
  method TEXT DEFAULT 'cash',
  reference TEXT,
  note TEXT,
  status TEXT DEFAULT 'pending',
  receipt_path TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  finance_entry_id TEXT,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'both')),
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  template_key TEXT,
  recipient_phone TEXT NOT NULL,
  recipient_user_id TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  trigger_type TEXT,
  reference_id TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL
);

-- 1. Chart of Accounts Table (For Acco ID structure)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    acco_id TEXT PRIMARY KEY, -- e.g., '2000.1.1.2.125'
    acco_name TEXT NOT NULL,  -- e.g., 'Sufiyan Zahoor /Data Entry'
    account_type TEXT NOT NULL -- Asset, Liability, Equity, Revenue, Expense
);

-- 2. Bulletproof Ledger Transactions Table
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL,      -- e.g., 'RV-1024'
    tx_date TEXT NOT NULL,         -- Date of entry
    description TEXT,              -- Narration / Remarks
    main_acco_id TEXT,             -- Target Account ID
    contra_acco_id TEXT,           -- Linked Account ID
    debit REAL DEFAULT 0.0,
    credit REAL DEFAULT 0.0,
    units_consumed INTEGER,
    per_unit_rate REAL,
    FOREIGN KEY(main_acco_id) REFERENCES chart_of_accounts(acco_id),
    FOREIGN KEY(contra_acco_id) REFERENCES chart_of_accounts(acco_id)
);

-- 3. Fixed Assets Table (Furniture, Fixtures, Electronics)
CREATE TABLE IF NOT EXISTS company_assets (
    asset_id TEXT PRIMARY KEY,       -- e.g., 'AST-001'
    asset_name TEXT NOT NULL,       -- e.g., 'Inverter AC 1.5 Ton'
    category TEXT NOT NULL,          -- Furniture, Fixture, Electronics, Vehicle
    purchase_date TEXT NOT NULL,
    purchase_cost REAL NOT NULL,    -- Original Rate
    depreciation_rate REAL DEFAULT 0.0, -- Har saal kitne % value kam hogi (e.g., 10%)
    current_value REAL NOT NULL      -- Current calculated rate after depreciation
);

-- 4. Maintenance Inventory Table
CREATE TABLE IF NOT EXISTS inventory_stock (
    item_id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,        -- e.g., 'LED Bulb 12W', 'Gate Lock'
    quantity INTEGER DEFAULT 0,
    unit_cost REAL DEFAULT 0.0,
    total_value REAL GENERATED ALWAYS AS (quantity * unit_cost) STORED
);

-- 5. Manual Entry Company Assets Table
CREATE TABLE IF NOT EXISTS manual_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code TEXT UNIQUE,          -- e.g., 'AST-101'
    asset_name TEXT NOT NULL,        -- e.g., 'Sofa Set Executive Room'
    category TEXT NOT NULL,          -- Furniture, Fixture, Appliance, Maintenance
    purchase_rate REAL NOT NULL,     -- Original rate jo pehle tha
    current_manual_rate REAL NOT NULL, -- Manual adjustment rate (Jo user khud put karega)
    remarks TEXT                     -- Condition ya location note karne ke liye
);

-- 6. Apartment Manual Assets Table
CREATE TABLE IF NOT EXISTS apartment_manual_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code TEXT UNIQUE,
    apartment_no TEXT NOT NULL,       -- Link directly to units (e.g., '801', 'A-101')
    asset_name TEXT NOT NULL,
    category TEXT NOT NULL,
    purchase_rate REAL NOT NULL,
    current_manual_rate REAL NOT NULL, -- Pure manual valuation rate
    remarks TEXT
);

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    apartment_no TEXT NOT NULL,
    flat_rent REAL NOT NULL,
    maintenance_charges REAL NOT NULL
);

-- 2. Utility Invoices Table (receivable tracking)
CREATE TABLE IF NOT EXISTS invoices (
    invoice_no TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    tenant_id TEXT,
    apartment_no TEXT,
    prev_reading INTEGER,
    curr_reading INTEGER,
    electricity_amount REAL DEFAULT 0,
    gas_charges REAL DEFAULT 0,
    flat_rent REAL DEFAULT 0,
    maintenance_charges REAL DEFAULT 0,
    previous_arrears REAL DEFAULT 0,
    total_bill_amount REAL DEFAULT 0,
    amount_received REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    units_consumed INTEGER DEFAULT 0,
    grand_total REAL DEFAULT 0,
    -- Extended charge columns (required for parking, stall, water, other income)
    water_charges REAL DEFAULT 0,
    parking_charges REAL DEFAULT 0,
    stall_charges REAL DEFAULT 0,
    security_charges REAL DEFAULT 0,
    other_charges REAL DEFAULT 0,
    FOREIGN KEY(tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT,
  permission_name TEXT,
  FOREIGN KEY(role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  property_id TEXT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE TABLE IF NOT EXISTS parking (
  id TEXT PRIMARY KEY,
  slot_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'available',
  assigned_tenant_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (assigned_tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cnic TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  resident_no TEXT UNIQUE NOT NULL,
  user_id TEXT,
  photo_url TEXT,
  cnic TEXT,
  passport_no TEXT,
  mobile TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  status TEXT DEFAULT 'active',
  emergency_contact TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS leases (
  id TEXT PRIMARY KEY,
  lease_no TEXT UNIQUE NOT NULL,
  resident_id TEXT,
  apartment_id TEXT,
  start_date TEXT,
  end_date TEXT,
  monthly_rent REAL DEFAULT 0,
  security_deposit REAL DEFAULT 0,
  maintenance_charges REAL DEFAULT 0,
  parking_charges REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (apartment_id) REFERENCES apartments(id)
);

CREATE TABLE IF NOT EXISTS daily_bookings (
  id TEXT PRIMARY KEY,
  apartment_no TEXT,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  cnic TEXT,
  check_in_date TEXT,
  check_in_time TEXT,
  check_out_date TEXT,
  check_out_time TEXT,
  nights INTEGER DEFAULT 1,
  rate_per_night REAL DEFAULT 0,
  extra_parking_spots INTEGER DEFAULT 0,
  parking_charge_per_day REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'booked',
  receipt_no TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meter_readings (
  id TEXT PRIMARY KEY,
  apartment_id TEXT,
  utility_type TEXT NOT NULL,
  prev_reading REAL DEFAULT 0,
  curr_reading REAL DEFAULT 0,
  rate_per_unit REAL DEFAULT 0,
  units_consumed REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  reading_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (apartment_id) REFERENCES apartments(id)
);

CREATE TABLE IF NOT EXISTS utility_charges (
  id TEXT PRIMARY KEY,
  invoice_id TEXT,
  type TEXT,
  amount REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_headers (
  id TEXT PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  tenant_id TEXT,
  total_amount REAL DEFAULT 0,
  amount_received REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT,
  item_type TEXT,
  amount REAL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoice_headers(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT,
  tenant_id TEXT,
  amount REAL DEFAULT 0,
  payment_method TEXT,
  reference_no TEXT,
  status TEXT DEFAULT 'success',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoice_headers(id),
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS receipt_vouchers (
  id TEXT PRIMARY KEY,
  voucher_no TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  tenant_id TEXT,
  amount REAL DEFAULT 0,
  payment_method TEXT,
  reference_no TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS security_deposits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'held',
  transaction_type TEXT DEFAULT 'receive',
  date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  voucher_no TEXT UNIQUE,
  entry_date TEXT NOT NULL,
  description TEXT,
  reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT,
  acco_id TEXT,
  debit REAL DEFAULT 0.0,
  credit REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id),
  FOREIGN KEY (acco_id) REFERENCES chart_of_accounts(acco_id)
);

CREATE TABLE IF NOT EXISTS general_ledger (
  id TEXT PRIMARY KEY,
  entry_id TEXT,
  line_id TEXT,
  acco_id TEXT,
  tx_date TEXT,
  description TEXT,
  debit REAL DEFAULT 0.0,
  credit REAL DEFAULT 0.0,
  balance_after REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id),
  FOREIGN KEY (line_id) REFERENCES journal_lines(id),
  FOREIGN KEY (acco_id) REFERENCES chart_of_accounts(acco_id)
);

CREATE TABLE IF NOT EXISTS tenant_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  entry_id TEXT,
  debit REAL DEFAULT 0.0,
  credit REAL DEFAULT 0.0,
  balance_after REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES users(id),
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE IF NOT EXISTS owner_ledger (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  entry_id TEXT,
  debit REAL DEFAULT 0.0,
  credit REAL DEFAULT 0.0,
  balance_after REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id),
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE IF NOT EXISTS cash_accounts (
  id TEXT PRIMARY KEY,
  account_name TEXT,
  acco_id TEXT,
  balance REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (acco_id) REFERENCES chart_of_accounts(acco_id)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  bank_name TEXT,
  account_number TEXT,
  acco_id TEXT,
  balance REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (acco_id) REFERENCES chart_of_accounts(acco_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT,
  amount REAL DEFAULT 0,
  description TEXT,
  expense_date TEXT,
  paid_from_acco_id TEXT,
  expense_acco_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  entity_type TEXT,
  entity_id TEXT,
  note_date TEXT,
  note_time TEXT,
  author_id TEXT,
  content TEXT,
  is_warning INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  details TEXT,
  timestamp TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  table_name TEXT,
  record_id TEXT,
  amount REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_headers (
  id TEXT PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  tenant_id TEXT,
  total_amount REAL DEFAULT 0,
  amount_received REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT,
  item_type TEXT,
  amount REAL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoice_headers(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT,
  tenant_id TEXT,
  amount REAL DEFAULT 0,
  payment_method TEXT,
  reference_no TEXT,
  status TEXT DEFAULT 'success',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoice_headers(id),
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS receipt_vouchers (
  id TEXT PRIMARY KEY,
  voucher_no TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  tenant_id TEXT,
  amount REAL DEFAULT 0,
  payment_method TEXT,
  reference_no TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS security_deposits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'held',
  transaction_type TEXT DEFAULT 'receive',
  date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  voucher_no TEXT UNIQUE,
  entry_date TEXT NOT NULL,
  description TEXT,
  reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT,
  acco_id TEXT,
  debit REAL DEFAULT 0.0,
  credit REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id),
  FOREIGN KEY (acco_id) REFERENCES chart_of_accounts(acco_id)
);

CREATE TABLE IF NOT EXISTS general_ledger (
  id TEXT PRIMARY KEY,
  entry_id TEXT,
  line_id TEXT,
  acco_id TEXT,
  tx_date TEXT,
  description TEXT,
  debit REAL DEFAULT 0.0,
  credit REAL DEFAULT 0.0,
  balance_after REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id),
  FOREIGN KEY (line_id) REFERENCES journal_lines(id),
  FOREIGN KEY (acco_id) REFERENCES chart_of_accounts(acco_id)
);

CREATE TABLE IF NOT EXISTS tenant_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  entry_id TEXT,
  debit REAL DEFAULT 0.0,
  credit REAL DEFAULT 0.0,
  balance_after REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES users(id),
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE IF NOT EXISTS owner_ledger (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  entry_id TEXT,
  debit REAL DEFAULT 0.0,
  credit REAL DEFAULT 0.0,
  balance_after REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id),
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE IF NOT EXISTS cash_accounts (
  id TEXT PRIMARY KEY,
  account_name TEXT,
  acco_id TEXT,
  balance REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (acco_id) REFERENCES chart_of_accounts(acco_id)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  bank_name TEXT,
  account_number TEXT,
  acco_id TEXT,
  balance REAL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (acco_id) REFERENCES chart_of_accounts(acco_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT,
  amount REAL DEFAULT 0,
  description TEXT,
  expense_date TEXT,
  paid_from_acco_id TEXT,
  expense_acco_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  entity_type TEXT,
  entity_id TEXT,
  note_date TEXT,
  note_time TEXT,
  author_id TEXT,
  content TEXT,
  is_warning INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  details TEXT,
  timestamp TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  table_name TEXT,
  record_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  status TEXT NOT NULL,
  details TEXT,
  performed_by TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================
-- HOUSING SOCIETY BILLING & UTILITY RECOVERY SYSTEM TABLES
-- ============================================================

-- Monthly utility bills entered by admin (govt bill amount + total units)
CREATE TABLE IF NOT EXISTS monthly_utility_bills (
  id TEXT PRIMARY KEY,
  billing_month TEXT NOT NULL,
  utility_type TEXT NOT NULL CHECK (utility_type IN ('electricity', 'gas')),
  govt_bill_amount REAL DEFAULT 0,
  govt_total_units REAL DEFAULT 0,
  cost_per_unit REAL DEFAULT 0,
  billing_method TEXT DEFAULT 'meter' CHECK (billing_method IN ('meter', 'fixed')),
  fixed_amount REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_utility_bills_month_type ON monthly_utility_bills(billing_month, utility_type);

-- Per-apartment meter readings per month
CREATE TABLE IF NOT EXISTS apartment_meter_readings (
  id TEXT PRIMARY KEY,
  billing_month TEXT NOT NULL,
  apartment_no TEXT NOT NULL,
  user_id TEXT,
  utility_type TEXT NOT NULL CHECK (utility_type IN ('electricity', 'gas')),
  prev_reading REAL DEFAULT 0,
  curr_reading REAL DEFAULT 0,
  units_consumed REAL DEFAULT 0,
  cost_per_unit REAL DEFAULT 0,
  calculated_amount REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_apt_readings_month_apt_type ON apartment_meter_readings(billing_month, apartment_no, utility_type);

-- Monthly per-apartment billing (all charges combined)
CREATE TABLE IF NOT EXISTS monthly_billing (
  id TEXT PRIMARY KEY,
  billing_month TEXT NOT NULL,
  user_id TEXT NOT NULL,
  apartment_no TEXT NOT NULL,
  rent REAL DEFAULT 0,
  maintenance REAL DEFAULT 0,
  electricity REAL DEFAULT 0,
  gas REAL DEFAULT 0,
  previous_arrears REAL DEFAULT 0,
  total_payable REAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'paid')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_billing_month_user ON monthly_billing(billing_month, user_id);

-- Monthly utility collection totals and loss/profit tracking
CREATE TABLE IF NOT EXISTS utility_collections (
  id TEXT PRIMARY KEY,
  billing_month TEXT NOT NULL,
  utility_type TEXT NOT NULL CHECK (utility_type IN ('electricity', 'gas')),
  govt_bill REAL DEFAULT 0,
  total_collected REAL DEFAULT 0,
  difference REAL DEFAULT 0,
  result_type TEXT NOT NULL CHECK (result_type IN ('loss', 'profit', 'break_even')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_utility_collections_month_type ON utility_collections(billing_month, utility_type);

-- Track executed remote support fixes to prevent duplicate runs
CREATE TABLE IF NOT EXISTS remote_fixes_log (
  id TEXT PRIMARY KEY,
  description TEXT,
  executed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT
);


-- ============================================================
-- ERP UPGRADE v2.0: Central Posting Engine Staging Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_transactions (
  id TEXT PRIMARY KEY,
  tx_type TEXT NOT NULL,
  source_module TEXT NOT NULL DEFAULT 'general',
  tenant_id TEXT,
  apartment_no TEXT,
  reference_id TEXT,
  amount REAL DEFAULT 0,
  debit_account TEXT DEFAULT '1200',
  credit_account TEXT DEFAULT '4000',
  description TEXT,
  payment_method TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'pending',
  posted_at TEXT,
  posted_by TEXT,
  journal_entry_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_profiles (
  id TEXT PRIMARY KEY,
  vendor_code TEXT UNIQUE NOT NULL,
  vendor_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  cnic TEXT,
  vendor_type TEXT DEFAULT 'supplier',
  status TEXT DEFAULT 'active',
  acco_id TEXT,
  opening_balance REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_bills (
  id TEXT PRIMARY KEY,
  bill_no TEXT UNIQUE NOT NULL,
  vendor_id TEXT,
  bill_date TEXT NOT NULL,
  due_date TEXT,
  description TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  payment_method TEXT DEFAULT 'cash',
  reference_no TEXT,
  journal_entry_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkout_settlements (
  id TEXT PRIMARY KEY,
  settlement_no TEXT UNIQUE NOT NULL,
  tenant_id TEXT NOT NULL,
  apartment_no TEXT NOT NULL,
  move_out_date TEXT NOT NULL,
  security_deposit REAL DEFAULT 0,
  outstanding_rent REAL DEFAULT 0,
  damage_charges REAL DEFAULT 0,
  refund_amount REAL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'draft',
  journal_entry_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_posting_log (
  id TEXT PRIMARY KEY,
  voucher_no TEXT,
  tx_type TEXT NOT NULL,
  source_module TEXT,
  source_id TEXT,
  tenant_id TEXT,
  total_debit REAL DEFAULT 0,
  total_credit REAL DEFAULT 0,
  balance_check TEXT DEFAULT 'PASS',
  status TEXT DEFAULT 'posted',
  posted_by TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

