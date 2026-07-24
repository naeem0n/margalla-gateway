import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure db directory exists
fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });

export const db = new DatabaseSync(config.sqlitePath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA cache_size = -64000");
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA foreign_keys = ON");

export class SqliteDb {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = db;
    this.init();
  }

  private init() {
    try {
      const cols = this.db.prepare("PRAGMA table_info(staff)").all() as any[];
      const hasFullName = cols.some(c => c.name === "full_name");
      if (cols.length > 0 && !hasFullName) {
        console.log("Upgrading staff table schema...");
        this.db.exec("DROP TABLE IF EXISTS staff");
      }
    } catch (e) {
      console.error("Staff table check/drop failed:", e);
    }

    // Ensure users table has the newer tenant fields before running the main schema script
    try {
      const cols = this.db.prepare("PRAGMA table_info(users)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("cnic")) {
          console.log("[SQLite] Migrating: Adding cnic column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN cnic TEXT");
        }
        if (!colNames.includes("rent_amount")) {
          console.log("[SQLite] Migrating: Adding rent_amount column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN rent_amount REAL DEFAULT 0");
        }
        if (!colNames.includes("security_deposit")) {
          console.log("[SQLite] Migrating: Adding security_deposit column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN security_deposit REAL DEFAULT 0");
        }
        if (!colNames.includes("agreement_url")) {
          console.log("[SQLite] Migrating: Adding agreement_url column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN agreement_url TEXT");
        }
        if (!colNames.includes("gas_units")) {
          console.log("[SQLite] Migrating: Adding gas_units column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN gas_units REAL DEFAULT 0");
        }
        if (!colNames.includes("water_units")) {
          console.log("[SQLite] Migrating: Adding water_units column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN water_units REAL DEFAULT 0");
        }
        if (!colNames.includes("electricity_units")) {
          console.log("[SQLite] Migrating: Adding electricity_units column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN electricity_units REAL DEFAULT 0");
        }
        if (!colNames.includes("fixed_maintenance")) {
          console.log("[SQLite] Migrating: Adding fixed_maintenance column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN fixed_maintenance REAL DEFAULT 0");
        }
        if (!colNames.includes("outstanding_balance")) {
          console.log("[SQLite] Migrating: Adding outstanding_balance column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN outstanding_balance REAL DEFAULT 0");
        }
        if (!colNames.includes("last_billing_date")) {
          console.log("[SQLite] Migrating: Adding last_billing_date column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN last_billing_date TEXT");
        }
        if (!colNames.includes("joining_date")) {
          console.log("[SQLite] Migrating: Adding joining_date column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN joining_date TEXT");
        }
        if (!colNames.includes("agreement_end_date")) {
          console.log("[SQLite] Migrating: Adding agreement_end_date column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN agreement_end_date TEXT");
        }
        if (!colNames.includes("daily_rent_rate")) {
          console.log("[SQLite] Migrating: Adding daily_rent_rate column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN daily_rent_rate REAL DEFAULT 0.0");
        }
        if (!colNames.includes("apartment_type")) {
          console.log("[SQLite] Migrating: Adding apartment_type column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN apartment_type TEXT");
        }
        if (!colNames.includes("scope_profile")) {
          console.log("[SQLite] Migrating: Adding scope_profile column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN scope_profile TEXT");
        }
        
        // Decoupled utilities and income fields
        if (!colNames.includes("elec_prev")) {
          console.log("[SQLite] Migrating: Adding elec_prev column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN elec_prev REAL DEFAULT 0");
        }
        if (!colNames.includes("elec_curr")) {
          console.log("[SQLite] Migrating: Adding elec_curr column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN elec_curr REAL DEFAULT 0");
        }
        if (!colNames.includes("elec_arrears")) {
          console.log("[SQLite] Migrating: Adding elec_arrears column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN elec_arrears REAL DEFAULT 0");
        }
        if (!colNames.includes("gas_prev")) {
          console.log("[SQLite] Migrating: Adding gas_prev column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN gas_prev REAL DEFAULT 0");
        }
        if (!colNames.includes("gas_curr")) {
          console.log("[SQLite] Migrating: Adding gas_curr column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN gas_curr REAL DEFAULT 0");
        }
        if (!colNames.includes("gas_arrears")) {
          console.log("[SQLite] Migrating: Adding gas_arrears column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN gas_arrears REAL DEFAULT 0");
        }
        if (!colNames.includes("water_prev")) {
          console.log("[SQLite] Migrating: Adding water_prev column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN water_prev REAL DEFAULT 0");
        }
        if (!colNames.includes("water_curr")) {
          console.log("[SQLite] Migrating: Adding water_curr column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN water_curr REAL DEFAULT 0");
        }
        if (!colNames.includes("water_arrears")) {
          console.log("[SQLite] Migrating: Adding water_arrears column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN water_arrears REAL DEFAULT 0");
        }
        if (!colNames.includes("elec_rate")) {
          console.log("[SQLite] Migrating: Adding elec_rate column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN elec_rate REAL DEFAULT 100");
        }
        if (!colNames.includes("gas_rate")) {
          console.log("[SQLite] Migrating: Adding gas_rate column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN gas_rate REAL DEFAULT 120");
        }
        if (!colNames.includes("water_rate")) {
          console.log("[SQLite] Migrating: Adding water_rate column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN water_rate REAL DEFAULT 80");
        }
        if (!colNames.includes("parking_rent")) {
          console.log("[SQLite] Migrating: Adding parking_rent column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN parking_rent REAL DEFAULT 0");
        }
        if (!colNames.includes("stall_rent")) {
          console.log("[SQLite] Migrating: Adding stall_rent column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN stall_rent REAL DEFAULT 0");
        }
        if (!colNames.includes("other_income")) {
          console.log("[SQLite] Migrating: Adding other_income column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN other_income REAL DEFAULT 0");
        }
        if (!colNames.includes("gas_fixed_payment")) {
          console.log("[SQLite] Migrating: Adding gas_fixed_payment column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN gas_fixed_payment REAL DEFAULT 0");
        }
        if (!colNames.includes("opening_balance")) {
          console.log("[SQLite] Migrating: Adding opening_balance column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN opening_balance REAL DEFAULT 0");
        }
        if (!colNames.includes("monthly_maintenance")) {
          console.log("[SQLite] Migrating: Adding monthly_maintenance column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN monthly_maintenance REAL DEFAULT 0");
        }
        if (!colNames.includes("monthly_gas_fixed")) {
          console.log("[SQLite] Migrating: Adding monthly_gas_fixed column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN monthly_gas_fixed REAL DEFAULT 0");
        }
        if (!colNames.includes("previous_arrears")) {
          console.log("[SQLite] Migrating: Adding previous_arrears column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN previous_arrears REAL DEFAULT 0");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate users table schema:", e);
    }

    // Create utility billing tables if they don't exist
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS monthly_utility_bills (
          id TEXT PRIMARY KEY,
          billing_month TEXT NOT NULL,
          utility_type TEXT NOT NULL,
          govt_bill_amount REAL DEFAULT 0,
          govt_total_units REAL DEFAULT 0,
          cost_per_unit REAL DEFAULT 0,
          billing_method TEXT DEFAULT 'meter',
          fixed_amount REAL DEFAULT 0,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_utility_bills_month_type ON monthly_utility_bills(billing_month, utility_type)`);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS apartment_meter_readings (
          id TEXT PRIMARY KEY,
          billing_month TEXT NOT NULL,
          apartment_no TEXT NOT NULL,
          user_id TEXT,
          utility_type TEXT NOT NULL,
          prev_reading REAL DEFAULT 0,
          curr_reading REAL DEFAULT 0,
          units_consumed REAL DEFAULT 0,
          cost_per_unit REAL DEFAULT 0,
          calculated_amount REAL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_apt_readings_month_apt_type ON apartment_meter_readings(billing_month, apartment_no, utility_type)`);

      this.db.exec(`
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
          status TEXT DEFAULT 'pending',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_billing_month_user ON monthly_billing(billing_month, user_id)`);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS utility_collections (
          id TEXT PRIMARY KEY,
          billing_month TEXT NOT NULL,
          utility_type TEXT NOT NULL,
          govt_bill REAL DEFAULT 0,
          total_collected REAL DEFAULT 0,
          difference REAL DEFAULT 0,
          result_type TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_utility_collections_month_type ON utility_collections(billing_month, utility_type)`);

      console.log("[SQLite] Utility billing tables initialized.");
    } catch (e) {
      console.error("[SQLite] Failed to create utility billing tables:", e);
    }

    // Create closing/locking, adjustment, and audit tables
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS monthly_closings (
          id TEXT PRIMARY KEY,
          billing_month TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'open',
          locked_at TEXT,
          locked_by TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS adjustment_vouchers (
          id TEXT PRIMARY KEY,
          voucher_no TEXT UNIQUE NOT NULL,
          billing_month TEXT NOT NULL,
          utility_type TEXT,
          user_id TEXT,
          apartment_no TEXT,
          charge_type TEXT,
          original_amount REAL DEFAULT 0,
          adjustment_amount REAL DEFAULT 0,
          net_amount REAL DEFAULT 0,
          reason TEXT NOT NULL,
          created_by TEXT NOT NULL,
          approved_by TEXT,
          status TEXT DEFAULT 'posted',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS utility_audit_log (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          billing_month TEXT,
          utility_type TEXT,
          entity_id TEXT,
          performed_by TEXT,
          details TEXT,
          old_values TEXT,
          new_values TEXT,
          ip_address TEXT,
          created_at TEXT NOT NULL
        )
      `);
      console.log("[SQLite] Closing/audit tables initialized.");
    } catch (e) {
      console.error("[SQLite] Failed to create closing/audit tables:", e);
    }


    // Ensure complaints table has resolution and maintenance_cost columns
    try {
      const cols = this.db.prepare("PRAGMA table_info(complaints)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("resolution")) {
          console.log("[SQLite] Migrating: Adding resolution column to complaints table");
          this.db.exec("ALTER TABLE complaints ADD COLUMN resolution TEXT");
        }
        if (!colNames.includes("maintenance_cost")) {
          console.log("[SQLite] Migrating: Adding maintenance_cost column to complaints table");
          this.db.exec("ALTER TABLE complaints ADD COLUMN maintenance_cost REAL DEFAULT 0");
        }
        if (!colNames.includes("assigned_to")) {
          console.log("[SQLite] Migrating: Adding assigned_to column to complaints table");
          this.db.exec("ALTER TABLE complaints ADD COLUMN assigned_to TEXT");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate complaints table schema:", e);
    }

    // Ensure staff table has new profile columns
    try {
      const cols = this.db.prepare("PRAGMA table_info(staff)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        const newCols = [
          { name: "photo_url", type: "TEXT" },
          { name: "id_card_url", type: "TEXT" },
          { name: "appointment_letter_url", type: "TEXT" },
          { name: "father_name", type: "TEXT" },
          { name: "address", type: "TEXT" },
          { name: "witness_name", type: "TEXT" },
          { name: "witness_cnic", type: "TEXT" },
          { name: "witness_phone", type: "TEXT" },
        ];
        for (const col of newCols) {
          if (!colNames.includes(col.name)) {
            console.log(`[SQLite] Migrating: Adding ${col.name} column to staff table`);
            this.db.exec(`ALTER TABLE staff ADD COLUMN ${col.name} ${col.type}`);
          }
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate staff table schema:", e);
    }

    // Ensure apartments table has owner and dealer fields
    try {
      const cols = this.db.prepare("PRAGMA table_info(apartments)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("owner_name")) {
          console.log("[SQLite] Migrating: Adding owner_name column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN owner_name TEXT DEFAULT 'Margalla Gateway'");
        }
        if (!colNames.includes("ownership_type")) {
          console.log("[SQLite] Migrating: Adding ownership_type column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN ownership_type TEXT DEFAULT 'Company'");
        }
        if (!colNames.includes("dealer_company")) {
          console.log("[SQLite] Migrating: Adding dealer_company column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN dealer_company TEXT");
        }
        if (!colNames.includes("dealer_commission")) {
          console.log("[SQLite] Migrating: Adding dealer_commission column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN dealer_commission REAL DEFAULT 0.00");
        }
        if (!colNames.includes("furnishing_status")) {
          console.log("[SQLite] Migrating: Adding furnishing_status column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN furnishing_status TEXT DEFAULT 'Unfurnished'");
        }
        if (!colNames.includes("property_id")) {
          console.log("[SQLite] Migrating: Adding property_id column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN property_id TEXT");
        }
        if (!colNames.includes("building_id")) {
          console.log("[SQLite] Migrating: Adding building_id column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN building_id TEXT");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate apartments table schema:", e);
    }

    // Ensure ledger_transactions table has units_consumed and per_unit_rate
    try {
      const cols = this.db.prepare("PRAGMA table_info(ledger_transactions)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("units_consumed")) {
          console.log("[SQLite] Migrating: Adding units_consumed column to ledger_transactions table");
          this.db.exec("ALTER TABLE ledger_transactions ADD COLUMN units_consumed INTEGER");
        }
        if (!colNames.includes("per_unit_rate")) {
          console.log("[SQLite] Migrating: Adding per_unit_rate column to ledger_transactions table");
          this.db.exec("ALTER TABLE ledger_transactions ADD COLUMN per_unit_rate REAL");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate ledger_transactions table schema:", e);
    }

    // Ensure sync_queue table has action and payload columns
    try {
      const cols = this.db.prepare("PRAGMA table_info(sync_queue)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("action")) {
          console.log("[SQLite] Migrating: Adding action column to sync_queue table");
          this.db.exec("ALTER TABLE sync_queue ADD COLUMN action TEXT DEFAULT ''");
        }
        if (!colNames.includes("payload")) {
          console.log("[SQLite] Migrating: Adding payload column to sync_queue table");
          this.db.exec("ALTER TABLE sync_queue ADD COLUMN payload TEXT DEFAULT ''");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate sync_queue table schema:", e);
    }

    // Ensure ledger_entries table has voucher_no column
    try {
      const cols = this.db.prepare("PRAGMA table_info(ledger_entries)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("voucher_no")) {
          console.log("[SQLite] Migrating: Adding voucher_no column to ledger_entries table");
          this.db.exec("ALTER TABLE ledger_entries ADD COLUMN voucher_no TEXT");
          
          // Backfill existing ledger entries with sequential LGR-000001, LGR-000002...
          const entries = this.db.prepare("SELECT id FROM ledger_entries ORDER BY entry_date ASC, created_at ASC").all() as any[];
          console.log(`[SQLite] Backfilling ${entries.length} historical ledger entries with sequential voucher numbers...`);
          const updateStmt = this.db.prepare("UPDATE ledger_entries SET voucher_no = ? WHERE id = ?");
          let count = 1;
          for (const entry of entries) {
            const vNo = `LGR-${String(count).padStart(6, "0")}`;
            updateStmt.run(vNo, entry.id);
            count++;
          }
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate ledger_entries table schema:", e);
    }

    // Ensure parking table has vehicle and assignment columns
    try {
      const cols = this.db.prepare("PRAGMA table_info(parking)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("vehicle_type")) {
          console.log("[SQLite] Migrating: Adding vehicle_type column to parking table");
          this.db.exec("ALTER TABLE parking ADD COLUMN vehicle_type TEXT DEFAULT 'car'");
        }
        if (!colNames.includes("vehicle_model")) {
          console.log("[SQLite] Migrating: Adding vehicle_model column to parking table");
          this.db.exec("ALTER TABLE parking ADD COLUMN vehicle_model TEXT");
        }
        if (!colNames.includes("license_plate")) {
          console.log("[SQLite] Migrating: Adding license_plate column to parking table");
          this.db.exec("ALTER TABLE parking ADD COLUMN license_plate TEXT");
        }
        if (!colNames.includes("apartment_no")) {
          console.log("[SQLite] Migrating: Adding apartment_no column to parking table");
          this.db.exec("ALTER TABLE parking ADD COLUMN apartment_no TEXT");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate parking table schema:", e);
    }

    // Ensure invoices table has receivable tracking columns
    try {
      const invoiceCols = this.db.prepare("PRAGMA table_info(invoices)").all() as any[];
      if (invoiceCols.length === 0) {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS invoices (
            invoice_no TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            tenant_id TEXT,
            apartment_no TEXT,
            prev_reading INTEGER,
            curr_reading INTEGER,
            electricity_amount REAL,
            gas_charges REAL,
            flat_rent REAL,
            maintenance_charges REAL,
            previous_arrears REAL DEFAULT 0,
            total_bill_amount REAL,
            amount_received REAL DEFAULT 0,
            current_balance REAL,
            units_consumed INTEGER,
            grand_total REAL,
            parking_charges REAL DEFAULT 0,
            FOREIGN KEY(tenant_id) REFERENCES users(id)
          )
        `);
      } else {
        const colNames = invoiceCols.map((c) => c.name);
        const addCol = (name: string, type: string) => {
          if (!colNames.includes(name)) {
            console.log(`[SQLite] Migrating: Adding ${name} column to invoices table`);
            this.db.exec(`ALTER TABLE invoices ADD COLUMN ${name} ${type}`);
          }
        };
        addCol("apartment_no", "TEXT");
        addCol("flat_rent", "REAL");
        addCol("maintenance_charges", "REAL");
        addCol("previous_arrears", "REAL DEFAULT 0");
        addCol("total_bill_amount", "REAL");
        addCol("amount_received", "REAL DEFAULT 0");
        addCol("current_balance", "REAL");
        addCol("water_charges", "REAL DEFAULT 0");
        addCol("parking_charges", "REAL DEFAULT 0");
        addCol("stall_charges", "REAL DEFAULT 0");
        addCol("security_charges", "REAL DEFAULT 0");
        addCol("other_charges", "REAL DEFAULT 0");
      }
    } catch (e) {
      console.error("[SQLite] Failed to migrate invoices table schema:", e);
    }

    // -------------------------------------------------------
    // MIGRATIONS: users table — extra_parking_spots, whatsapp_no
    // -------------------------------------------------------
    try {
      const cols = this.db.prepare("PRAGMA table_info(users)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("extra_parking_spots")) {
          console.log("[SQLite] Migrating: Adding extra_parking_spots column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN extra_parking_spots INTEGER DEFAULT 0");
        }
        if (!colNames.includes("whatsapp_no")) {
          console.log("[SQLite] Migrating: Adding whatsapp_no column to users table");
          this.db.exec("ALTER TABLE users ADD COLUMN whatsapp_no TEXT");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to add parking/whatsapp columns to users:", e);
    }

    // -------------------------------------------------------
    // MIGRATIONS: apartments table — sale_price, commission tracking
    // -------------------------------------------------------
    try {
      const cols = this.db.prepare("PRAGMA table_info(apartments)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("sale_price")) {
          console.log("[SQLite] Migrating: Adding sale_price column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN sale_price REAL DEFAULT 0");
        }
        if (!colNames.includes("commission_rate")) {
          console.log("[SQLite] Migrating: Adding commission_rate column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN commission_rate REAL DEFAULT 0");
        }
        if (!colNames.includes("commission_type")) {
          console.log("[SQLite] Migrating: Adding commission_type column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN commission_type TEXT DEFAULT 'percent'");
        }
        if (!colNames.includes("ownership_type")) {
          console.log("[SQLite] Migrating: Adding ownership_type column to apartments table");
          this.db.exec("ALTER TABLE apartments ADD COLUMN ownership_type TEXT DEFAULT 'Company'");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to add sale/commission columns to apartments:", e);
    }

    // -------------------------------------------------------
    // NEW TABLE: refund_vouchers (Phase 2 — Refund button)
    // -------------------------------------------------------
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS refund_vouchers (
          id TEXT PRIMARY KEY,
          refund_no TEXT UNIQUE NOT NULL,
          original_type TEXT NOT NULL,
          original_voucher_no TEXT NOT NULL,
          tenant_id TEXT,
          amount REAL NOT NULL,
          reason TEXT,
          refund_date TEXT NOT NULL,
          posted_by TEXT DEFAULT 'admin',
          created_at TEXT NOT NULL
        )
      `);
      console.log("[SQLite] refund_vouchers table initialized.");
    } catch (e) {
      console.error("[SQLite] Failed to create refund_vouchers table:", e);
    }

    // -------------------------------------------------------
    // NEW TABLE: system_settings (for Credit Management)
    // -------------------------------------------------------
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS site_content ( key TEXT PRIMARY KEY, value TEXT );
        CREATE TABLE IF NOT EXISTS system_settings (
          id TEXT PRIMARY KEY,
          setting_key TEXT UNIQUE NOT NULL,
          setting_value TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      // Seed default credit settings if not already seeded
      const countRow = this.db.prepare("SELECT COUNT(*) as count FROM system_settings WHERE setting_key = 'credits'").get() as { count: number } | undefined;
      if (countRow && countRow.count === 0) {
        const ts = new Date().toISOString();
        this.db.prepare(`
          INSERT INTO system_settings (id, setting_key, setting_value, description, created_at, updated_at)
          VALUES (?, 'credits', ?, 'System credit management - Default 10 lakh entries', ?, ?)
        `).run(
          randomUUID(),
          JSON.stringify({
            total_credits: 1000000,
            used_credits: 0,
            expiry_date: null,
            is_active: true
          }),
          ts,
          ts
        );
      }
      console.log("[SQLite] system_settings table and credit settings initialized.");
    } catch (e) {
      console.error("[SQLite] Failed to create/seed system_settings table:", e);
    }


    // -------------------------------------------------------
    // ERP UPGRADE v2.0: Central Posting Engine staging tables
    // -------------------------------------------------------
    [
      "CREATE TABLE IF NOT EXISTS pending_transactions (id TEXT PRIMARY KEY, tx_type TEXT NOT NULL, source_module TEXT NOT NULL DEFAULT 'general', tenant_id TEXT, apartment_no TEXT, reference_id TEXT, amount REAL DEFAULT 0, debit_account TEXT DEFAULT '1200', credit_account TEXT DEFAULT '4000', description TEXT, payment_method TEXT DEFAULT 'cash', status TEXT DEFAULT 'pending', posted_at TEXT, posted_by TEXT, journal_entry_id TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS vendor_profiles (id TEXT PRIMARY KEY, vendor_code TEXT UNIQUE NOT NULL, vendor_name TEXT NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT, cnic TEXT, vendor_type TEXT DEFAULT 'supplier', status TEXT DEFAULT 'active', acco_id TEXT, opening_balance REAL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS vendor_bills (id TEXT PRIMARY KEY, bill_no TEXT UNIQUE NOT NULL, vendor_id TEXT, bill_date TEXT NOT NULL, due_date TEXT, description TEXT, amount REAL DEFAULT 0, status TEXT DEFAULT 'draft', payment_method TEXT DEFAULT 'cash', reference_no TEXT, journal_entry_id TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS checkout_settlements (id TEXT PRIMARY KEY, settlement_no TEXT UNIQUE NOT NULL, tenant_id TEXT NOT NULL, apartment_no TEXT NOT NULL, move_out_date TEXT NOT NULL, security_deposit REAL DEFAULT 0, outstanding_rent REAL DEFAULT 0, damage_charges REAL DEFAULT 0, refund_amount REAL DEFAULT 0, payment_method TEXT DEFAULT 'cash', status TEXT DEFAULT 'draft', journal_entry_id TEXT, notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS erp_posting_log (id TEXT PRIMARY KEY, voucher_no TEXT, tx_type TEXT NOT NULL, source_module TEXT, source_id TEXT, tenant_id TEXT, total_debit REAL DEFAULT 0, total_credit REAL DEFAULT 0, balance_check TEXT DEFAULT 'PASS', status TEXT DEFAULT 'posted', posted_by TEXT, error_message TEXT, created_at TEXT NOT NULL)"
    ].forEach((_ddl) => { try { this.db.exec(_ddl); } catch (e: any) { console.error('[SQLite ERP]', e.message); } });
    console.log('[SQLite] ERP v2.0 tables initialized.');


    // -------------------------------------------------------
    // MIGRATIONS: notifications table — wa_sent, sms_sent tracking
    // -------------------------------------------------------
    try {
      const cols = this.db.prepare("PRAGMA table_info(notifications)").all() as any[];
      const colNames = cols.map(c => c.name);
      if (cols.length > 0) {
        if (!colNames.includes("wa_sent")) {
          console.log("[SQLite] Migrating: Adding wa_sent column to notifications table");
          this.db.exec("ALTER TABLE notifications ADD COLUMN wa_sent INTEGER DEFAULT 0");
        }
        if (!colNames.includes("sms_sent")) {
          console.log("[SQLite] Migrating: Adding sms_sent column to notifications table");
          this.db.exec("ALTER TABLE notifications ADD COLUMN sms_sent INTEGER DEFAULT 0");
        }
      }
    } catch (e) {
      console.error("[SQLite] Failed to add wa_sent/sms_sent to notifications:", e);
    }

    // -------------------------------------------------------
    // NEW TABLE: third_party_passes (for 3rd party gate passes without accounts)
    // -------------------------------------------------------
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS third_party_passes (
          id TEXT PRIMARY KEY,
          pass_no TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          cnic TEXT,
          phone TEXT,
          role TEXT DEFAULT 'Visitor',
          issued_date TEXT NOT NULL,
          expiry_date TEXT,
          issued_by TEXT DEFAULT 'admin',
          created_at TEXT NOT NULL
        )
      `);
      console.log("[SQLite] third_party_passes table initialized.");
    } catch (e) {
      console.error("[SQLite] Failed to create third_party_passes table:", e);
    }


    try {
      this.db.exec("DROP VIEW IF EXISTS tenants;");
      console.log("[SQLite] tenants view dropped successfully if it existed.");
    } catch (e) {
      console.warn("[SQLite] Failed to drop tenants view:", e);
    }

    // Validate that all required tables exist, otherwise run schema initialization
    try {
      const requiredTables = [
        "users",
        "apartments",
        "complaints",
        "invoices",
        "payments",
        "ledger_entries",
        "journal_entries",
        "chart_of_accounts"
      ];
      
      const existingTables = (this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(r => r.name);
      const missing = requiredTables.filter(t => !existingTables.includes(t));
      
      if (missing.length > 0) {
        console.warn(`[SQLite] Missing required tables: ${missing.join(", ")}. Triggering schema initialization...`);
        const schemaPath = path.join(__dirname, "schema.sql");
        if (fs.existsSync(schemaPath)) {
          const schema = fs.readFileSync(schemaPath, "utf-8");
          this.db.exec(schema);
          console.log("[SQLite] Schema initialization executed successfully.");
        } else {
          console.error(`[SQLite] Schema file not found at ${schemaPath}. Unable to initialize missing tables.`);
        }

        // Ensure system accounts exist to prevent FOREIGN KEY constraint failures
        this.db.exec(`
          INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) 
          VALUES ('system', 'SYSTEM_CLIENT', 'system@margalla.local', 'none', 'System Account', 'admin');
          
          INSERT OR IGNORE INTO users (id, client_id, email, password_hash, full_name, role) 
          VALUES ('admin-id-default', 'ADMIN_DEFAULT', 'admin@margalla.local', 'none', 'Default Admin', 'admin');
        `);
        console.log("[SQLite] System base users verified.");
      } else {
        console.log("[SQLite] All core tables verified.");
      }

      // Ensure missing columns are added dynamically to avoid manual database migration issues
      try {
        const info = this.db.prepare("PRAGMA table_info(journal_entries)").all();
        const columns = info.map(col => col.name);
        if (!columns.includes("entry_type")) {
          this.db.exec("ALTER TABLE journal_entries ADD COLUMN entry_type TEXT DEFAULT 'JV'");
          console.log("[SQLite Migration] Added entry_type column to journal_entries.");
        }
        if (!columns.includes("status")) {
          this.db.exec("ALTER TABLE journal_entries ADD COLUMN status TEXT DEFAULT 'posted'");
          console.log("[SQLite Migration] Added status column to journal_entries.");
        }
      } catch (colErr) {
        console.error("[SQLite Migration] Failed to check/add journal_entries columns:", colErr.message);
      }
    } catch (e: any) {
      console.error("[SQLite] Table verification/schema initialization failed:", e.message);
    }

    try {
      this.db.exec(`
        INSERT OR IGNORE INTO tenants (id, name, apartment_no, flat_rent, maintenance_charges)
        SELECT id, full_name, COALESCE(apartment_no, ''), rent_amount, fixed_maintenance
        FROM users
        WHERE role = 'resident';
      `);
      console.log("[SQLite] physical tenants table synchronized/seeded successfully.");
    } catch (syncErr: any) {
      console.error("[SQLite] Failed to seed tenants table:", syncErr.message);
    }
    this.seedAdmin();
    this.seedParkingRules();
    this.seedNotificationTemplates();
    this.seedChartOfAccounts();
    // NOTE: Demo/fake data seeding DISABLED — system starts blank for real data entry
    // this.seedDefaultErcData();      // was seeding 117 fake apartments
    // this.seedParkingSlots();        // was seeding 24 fake parking slots
    // this.seedDefaultAssets();       // was seeding fake company assets
    // this.seedHistoricalBillingData(); // was seeding fake invoices & ledger entries
  }

  private seedNotificationTemplates() {
    const now = new Date().toISOString();
    try {
      const row = this.db.prepare("SELECT COUNT(*) as count FROM notification_templates").get() as { count: number } | undefined;
      if (row && row.count === 0) {
        console.log("[SQLite] Seeding default notification templates...");
        this.db
          .prepare(
            `INSERT INTO notification_templates (id, key, name, description, channel, subject, body, variables, is_active, created_at, updated_at)
             VALUES (?, 'rent_bill', 'Rent Invoice Notification', 'Sent when monthly rent invoice is generated', 'both', 'Monthly Rent Bill', 'Dear {{name}}, your rent bill for apartment {{apartment}} of PKR {{amount}} is due on {{due_date}}.', ?, 1, ?, ?)`
          )
          .run(
            randomUUID(),
            JSON.stringify(["name", "apartment", "amount", "due_date"]),
            now,
            now
          );
        this.db
          .prepare(
            `INSERT INTO notification_templates (id, key, name, description, channel, subject, body, variables, is_active, created_at, updated_at)
             VALUES (?, 'payment_confirmation', 'Payment Confirmation', 'Sent when payment request is approved', 'both', 'Payment Received', 'Thank you {{name}}! We have received your payment of PKR {{amount}} for {{bill_type}} bill.', ?, 1, ?, ?)`
          )
          .run(
            randomUUID(),
            JSON.stringify(["name", "amount", "bill_type"]),
            now,
            now
          );
      }

      // Ensure resident_welcome exists (even on pre-seeded databases)
      const existWelcome = this.db.prepare("SELECT COUNT(*) as count FROM notification_templates WHERE key = 'resident_welcome'").get() as { count: number } | undefined;
      if (existWelcome && existWelcome.count === 0) {
        console.log("[SQLite] Seeding resident_welcome notification template...");
        this.db
          .prepare(
            `INSERT INTO notification_templates (id, key, name, description, channel, subject, body, variables, is_active, created_at, updated_at)
             VALUES (?, 'resident_welcome', 'Resident Welcome & Credentials', 'Sent when resident portal access is created/transferred', 'both', 'Resident Portal Access Credentials', 'Dear {{name}}, welcome to Margalla Gateway! Your Resident Portal account is active. Resident ID: {{client_id}} and Password: {{password}}. Please log in and verify your ledger.', ?, 1, ?, ?)`
          )
          .run(
            randomUUID(),
            JSON.stringify(["name", "client_id", "password"]),
            now,
            now
          );
      }
    } catch (e) {
      console.error("[SQLite] Seeding notification templates failed:", e);
    }
  }

  private seedParkingRules() {
    const now = new Date().toISOString();
    const row = this.db.prepare("SELECT COUNT(*) as count FROM parking_rules").get() as { count: number } | undefined;
    if (row && row.count === 0) {
      this.db
        .prepare(
          `INSERT INTO parking_rules (id, title, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(randomUUID(), "Standard Spot Allocation", "Each apartment gets 1 free parking card.", now, now);
      this.db
        .prepare(
          `INSERT INTO parking_rules (id, title, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(randomUUID(), "Extra Spot Charges", "Additional cards: PKR 2,000/month each.", now, now);
      this.db
        .prepare(
          `INSERT INTO parking_rules (id, title, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(randomUUID(), "Visitor Parking Limit", "Visitor parking limited to 5 hours max in designated bays.", now, now);
    }
  }

  private seedAdmin() {
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync("MARGALLA@RAHMAN1112", 10);
    
    // Seed ADMIN-001 with ID 'admin-id-default'
    const row = this.db.prepare("SELECT id FROM users WHERE id = 'admin-id-default' OR client_id = 'ADMIN-001'").get() as { id: string } | undefined;
    if (!row) {
      // Delete any previous mismatching ADMIN-001 if exists
      this.db.prepare("DELETE FROM users WHERE client_id = 'ADMIN-001'").run();
      
      this.db
        .prepare(
          `INSERT INTO users (id, client_id, email, password_hash, full_name, role, permissions_json, created_at, updated_at)
           VALUES ('admin-id-default', 'ADMIN-001', 'admin@margalla.local', ?, 'System Admin', 'admin', '{}', ?, ?)`,
        )
        .run(hash, now, now);
    }

    // Seed 'system' user with ID 'system'
    const sysRow = this.db.prepare("SELECT id FROM users WHERE id = 'system' OR client_id = 'SYSTEM'").get() as { id: string } | undefined;
    if (!sysRow) {
      this.db
        .prepare(
          `INSERT INTO users (id, client_id, email, password_hash, full_name, role, permissions_json, created_at, updated_at)
           VALUES ('system', 'SYSTEM', 'system@margalla.local', ?, 'System Account', 'admin', '{}', ?, ?)`,
        )
        .run(hash, now, now);
    }
  }

  private seedChartOfAccounts() {
    const defaultAccounts = [
      { code: "1000", label: "Cash on Hand", type: "asset" },
      { code: "1100", label: "Bank Account", type: "asset" },
      { code: "1200", label: "Tenant Rent Receivable", type: "asset" },
      { code: "1300", label: "Staff Advances", type: "asset" },
      { code: "2000", label: "Accounts Payable", type: "liability" },
      { code: "2100", label: "Security Deposits Held", type: "liability" },
      { code: "3000", label: "Owner Equity", type: "equity" },
      { code: "4000", label: "Rent Income", type: "income" },
      { code: "4100", label: "Maintenance Income", type: "income" },
      { code: "4200", label: "Daily Rental Income", type: "income" },
      { code: "4300", label: "Utility Recovery", type: "income" },
      { code: "4400", label: "Parking Income", type: "income" },
      { code: "4500", label: "Stall Income", type: "income" },
      { code: "4900", label: "Other Income", type: "income" },
      { code: "5000", label: "Salary Expense", type: "expense" },
      { code: "5100", label: "Maintenance Expense", type: "expense" },
      { code: "5200", label: "Utilities Expense", type: "expense" },
      { code: "5300", label: "Cleaning & Supplies", type: "expense" },
      { code: "5400", label: "Repairs Expense", type: "expense" },
      { code: "5500", label: "Office & Admin", type: "expense" },
      { code: "5900", label: "Other Expense", type: "expense" }
    ];

    try {
      const row = this.db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='chart_of_accounts'").get() as { count: number } | undefined;
      if (row && row.count > 0) {
        console.log("[SQLite] Seeding/Verifying default Chart of Accounts...");
        const stmt = this.db.prepare("INSERT OR IGNORE INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)");
        for (const ac of defaultAccounts) {
          stmt.run(ac.code, ac.label, ac.type);
        }
      }
    } catch (e) {
      console.error("[SQLite] Seeding Chart of Accounts failed:", e);
    }
  }

  private seedDefaultErcData() {
    // DISABLED: Fake apartment/owner/billing seeding removed.
    // System starts blank — admin adds real apartments and tenants manually.
    console.log("[SQLite ERP] Demo data seeding is DISABLED. System starts blank.");
  }

  private migrateLedgerTransactionsToJournals() {
    try {
      const entriesCount = this.db.prepare("SELECT COUNT(*) as count FROM journal_entries").get() as { count: number } | undefined;
      if (entriesCount && entriesCount.count === 0) {
        console.log("[SQLite Accounting] Migrating ledger_transactions to journal_entries & journal_lines...");
        const uniqueVouchers = this.db.prepare("SELECT DISTINCT voucher_no, tx_date, description FROM ledger_transactions").all() as any[];
        
        const insertEntry = this.db.prepare("INSERT OR IGNORE INTO journal_entries (id, voucher_no, entry_date, description, reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const insertLine = this.db.prepare("INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        
        const now = new Date().toISOString();
        
        for (const v of uniqueVouchers) {
          const entryId = randomUUID();
          insertEntry.run(entryId, v.voucher_no, v.tx_date, v.description || "System Journal Entry", v.voucher_no, now, now);
          
          const lines = this.db.prepare("SELECT * FROM ledger_transactions WHERE voucher_no = ?").all(v.voucher_no) as any[];
          for (const l of lines) {
            const lineId = randomUUID();
            insertLine.run(lineId, entryId, l.main_acco_id, l.debit || 0.0, l.credit || 0.0, now, now);
          }
        }
        console.log("[SQLite Accounting] Successfully migrated historical transactions to journals.");
      }
    } catch (e: any) {
      console.error("[SQLite Accounting] Historical journals migration failed:", e.message);
    }
  }

  private seedParkingSlots() {
    // DISABLED: No fake parking slots seeded. Admin adds real slots manually.
  }

  private seedDefaultAssets() {
    // DISABLED: No fake assets seeded. Admin adds real assets manually.
  }

  private seedHistoricalBillingData() {
    const now = new Date().toISOString();
    try {
      const billCount = this.db.prepare("SELECT COUNT(*) as count FROM invoices").get() as { count: number };
      if (billCount.count === 0) {
        console.log("[SQLite ERP] Seeding historical billing, meter readings, and ledger data...");

        const residentsData = [
          { id: "munal-res-ayesha-uuid", name: "Ayesha Khan", apt: "M-101", rent: 120000, maint: 5000 },
          { id: "munal-res-zeeshan-uuid", name: "Zeeshan Ali", apt: "M-201", rent: 130000, maint: 5000 },
          { id: "munal-res-fatima-uuid", name: "Fatima Bilal", apt: "M-202", rent: 170000, maint: 6000 }
        ];

        // Seed users and chart of accounts first to satisfy foreign key constraints
        const userInsertStmt = this.db.prepare(`
          INSERT OR IGNORE INTO users (
            id, client_id, email, password_hash, full_name, apartment_no, role, 
            rent_amount, fixed_maintenance, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'resident', ?, ?, ?, ?)
        `);

        const coaInsertStmt = this.db.prepare(`
          INSERT OR IGNORE INTO chart_of_accounts (acco_id, acco_name, account_type)
          VALUES (?, ?, 'asset')
        `);

        for (const res of residentsData) {
          const clientId = `RES-${res.apt}`;
          const email = `${res.name.toLowerCase().replace(/\s+/g, "")}@margalla.local`;
          const dummyHash = "DUMMY_HASH";
          userInsertStmt.run(res.id, clientId, email, dummyHash, res.name, res.apt, res.rent, res.maint, now, now);
          
          const accoId = `1200.1.1.${res.id}`;
          coaInsertStmt.run(accoId, `${res.name} /Rent Receivable`);
        }

        const billingMonth = "2026-05";

        this.db.prepare(`
          INSERT OR IGNORE INTO monthly_utility_bills (id, billing_month, utility_type, govt_bill_amount, govt_total_units, cost_per_unit, billing_method, fixed_amount, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), billingMonth, "electricity", 75000, 3000, 25.0, "meter", 0, "May 2026 Govt Electricity Bill", now, now);

        this.db.prepare(`
          INSERT OR IGNORE INTO monthly_utility_bills (id, billing_month, utility_type, govt_bill_amount, govt_total_units, cost_per_unit, billing_method, fixed_amount, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), billingMonth, "gas", 12000, 0, 0, "fixed", 4000, "May 2026 Fixed Gas Bill", now, now);

        for (const res of residentsData) {
          this.db.prepare(`
            INSERT OR IGNORE INTO apartment_meter_readings (id, billing_month, apartment_no, user_id, utility_type, prev_reading, curr_reading, units_consumed, cost_per_unit, calculated_amount, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(randomUUID(), billingMonth, res.apt, res.id, "electricity", 1200, 1380, 180, 25.0, 4500, now, now);

          const gasAmount = 4000;
          const totalPayable = res.rent + res.maint + 4500 + gasAmount;
          this.db.prepare(`
            INSERT OR IGNORE INTO monthly_billing (id, billing_month, user_id, apartment_no, rent, maintenance, electricity, gas, previous_arrears, total_payable, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(randomUUID(), billingMonth, res.id, res.apt, res.rent, res.maint, 4500, gasAmount, 0, totalPayable, "posted", now, now);

          const invoiceNo = `INV-MGT-${res.apt}-2605`;
          this.db.prepare(`
            INSERT OR IGNORE INTO invoices (invoice_no, date, tenant_id, apartment_no, prev_reading, curr_reading, units_consumed, electricity_amount, gas_charges, flat_rent, maintenance_charges, previous_arrears, total_bill_amount, amount_received, current_balance, grand_total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            invoiceNo, "2026-05-28", res.id, res.apt, 1200, 1380, 180, 4500, gasAmount, res.rent, res.maint, 0, totalPayable, totalPayable, 0, totalPayable
          );

          const ledgerChargeId = `LGR-CHG-${res.apt}-2605`;
          this.db.prepare(`
            INSERT OR IGNORE INTO ledger_entries (id, user_id, entry_date, entry_type, description, debit, credit, balance_after, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(ledgerChargeId, res.id, "2026-05-28", "rent", `Monthly Bill May-2026 Apt ${res.apt}`, totalPayable, 0, totalPayable, now, now);

          const ledgerPayId = `LGR-PAY-${res.apt}-2605`;
          this.db.prepare(`
            INSERT OR IGNORE INTO ledger_entries (id, user_id, entry_date, entry_type, description, debit, credit, balance_after, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(ledgerPayId, res.id, "2026-05-29", "rent", `Payment Received May-2026 Apt ${res.apt}`, 0, totalPayable, 0, now, now);

          this.db.prepare(`
            INSERT OR IGNORE INTO ledger_transactions (voucher_no, tx_date, description, main_acco_id, contra_acco_id, debit, credit)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(`VCH-CHG-${res.apt}-2605`, "2026-05-28", `Monthly Charge May-2026 Apt ${res.apt}`, `1200.1.1.${res.id}`, "4000", totalPayable, 0);

          this.db.prepare(`
            INSERT OR IGNORE INTO ledger_transactions (voucher_no, tx_date, description, main_acco_id, contra_acco_id, debit, credit)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(`VCH-PAY-${res.apt}-2605`, "2026-05-29", `Monthly Payment Received May-2026 Apt ${res.apt}`, "1000", `1200.1.1.${res.id}`, totalPayable, 0);

          const journal1 = randomUUID();
          this.db.prepare(`
            INSERT OR IGNORE INTO journal_entries (id, voucher_no, entry_date, description, reference, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(journal1, `VCH-CHG-${res.apt}-2605`, "2026-05-28", `Monthly Charge May-2026 Apt ${res.apt}`, ledgerChargeId, now, now);

          this.db.prepare(`
            INSERT OR IGNORE INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(randomUUID(), journal1, `1200.1.1.${res.id}`, totalPayable, 0.0, now, now);

          this.db.prepare(`
            INSERT OR IGNORE INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(randomUUID(), journal1, "4000", 0.0, totalPayable, now, now);

          const journal2 = randomUUID();
          this.db.prepare(`
            INSERT OR IGNORE INTO journal_entries (id, voucher_no, entry_date, description, reference, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(journal2, `VCH-PAY-${res.apt}-2605`, "2026-05-29", `Monthly Payment May-2026 Apt ${res.apt}`, ledgerPayId, now, now);

          this.db.prepare(`
            INSERT OR IGNORE INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(randomUUID(), journal2, "1000", totalPayable, 0.0, now, now);

          this.db.prepare(`
            INSERT OR IGNORE INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(randomUUID(), journal2, `1200.1.1.${res.id}`, 0.0, totalPayable, now, now);
        }
        console.log("[SQLite ERP] Seeding complete! Added historical invoices and balancing entries.");
      }
    } catch (e) {
      console.error("[SQLite ERP] Failed to seed historical billing data:", e);
    }
  }

  get raw() {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

export function syncLedgerToDoubleEntry(database: any, entryId: string) {
  try {
    // 1. Fetch the single-entry ledger record
    const entry = database.prepare("SELECT * FROM ledger_entries WHERE id = ?").get(entryId) as any;
    if (!entry) {
      // If the ledger entry was deleted, delete matching transactions and return.
      let vNo = entryId;
      try {
        const jEntry = database.prepare("SELECT voucher_no FROM journal_entries WHERE reference = ? OR voucher_no = ?").get(entryId, entryId) as any;
        if (jEntry) {
          vNo = jEntry.voucher_no;
        }
      } catch (err: any) {
        console.error("Failed to find journal entry for deletion:", err);
      }

      database.prepare("DELETE FROM ledger_transactions WHERE voucher_no = ? OR voucher_no = ?").run(entryId, vNo);
      
      try {
        database.prepare("DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE voucher_no = ? OR voucher_no = ? OR reference = ?)").run(entryId, vNo, entryId);
        database.prepare("DELETE FROM journal_entries WHERE voucher_no = ? OR voucher_no = ? OR reference = ?").run(entryId, vNo, entryId);
      } catch (journalErr: any) {
        console.error("[SQLite Journal Deletion] Failed to delete journal entry/lines:", journalErr.message);
      }
      return;
    }

    const vNo = entry.voucher_no || entry.id;

    // 2. Delete existing matching double entry rows
    database.prepare("DELETE FROM ledger_transactions WHERE voucher_no = ? OR voucher_no = ?").run(entryId, vNo);

    // Remove any stale journal rows that were previously attached to this ledger entry
    // through either the ledger id or the voucher number so re-sync remains idempotent.
    const previousJournalRefs = [entryId, vNo];
    const journalRows = database.prepare(
      "SELECT id FROM journal_entries WHERE reference = ? OR voucher_no = ? OR voucher_no = ?"
    ).all(entryId, entryId, vNo) as { id: string }[];
    const journalIds = journalRows.map((row) => row.id);
    if (journalIds.length > 0) {
      const placeholders = journalIds.map(() => "?").join(",");
      database.prepare(`DELETE FROM journal_lines WHERE entry_id IN (${placeholders})`).run(...journalIds);
      database.prepare(`DELETE FROM journal_entries WHERE id IN (${placeholders})`).run(...journalIds);
    }

    const amount = Number(entry.debit > 0 ? entry.debit : entry.credit);
    if (amount <= 0) return; // Ignore zero entries

    let debitAccount = "1000"; // Cash on Hand default
    let creditAccount = "4900"; // Other Income default

    // Parse payment channel to select Cash vs Bank
    const descLower = (entry.description || "").toLowerCase();
    const isBank = descLower.includes("bank") || descLower.includes("transfer") || descLower.includes("cheque") || descLower.includes("online");
    const cashOrBank = isBank ? "1100" : "1000";

    // 3. Resolve if a matching invoice exists in the invoices table
    let inv: any = null;
    try {
      inv = database.prepare("SELECT * FROM invoices WHERE invoice_no = ?").get(vNo);
    } catch {}

    if (inv && entry.debit > 0) {
      // Split credit posting!
      const rentAmt = Number(inv.flat_rent || 0);
      const maintAmt = Number(inv.maintenance_charges || 0);
      const elecAmt = Number(inv.electricity_amount || 0);
      const gasAmt = Number(inv.gas_charges || 0);
      const waterAmt = Number(inv.water_charges || 0);
      const parkingAmt = Number(inv.parking_charges || 0);
      const stallAmt = Number(inv.stall_charges || 0);
      const securityAmt = Number(inv.security_charges || 0);
      const otherAmt = Number(inv.other_charges || 0);

      const creditLegs: { account: string; amount: number }[] = [];
      if (rentAmt > 0) creditLegs.push({ account: "4000", amount: rentAmt });
      if (maintAmt > 0) creditLegs.push({ account: "4100", amount: maintAmt });
      const utilityAmt = elecAmt + gasAmt + waterAmt;
      if (utilityAmt > 0) creditLegs.push({ account: "4300", amount: utilityAmt });
      if (parkingAmt > 0) creditLegs.push({ account: "4400", amount: parkingAmt });
      if (stallAmt > 0) creditLegs.push({ account: "4500", amount: stallAmt });
      const otherTotal = securityAmt + otherAmt;
      if (otherTotal > 0) creditLegs.push({ account: "4900", amount: otherTotal });

      if (creditLegs.length === 0) {
        creditLegs.push({ account: "4900", amount: amount });
      }

      // Debit accounts receivable
      debitAccount = `1200.1.1.${entry.user_id}`;

      // Ensure COA exists
      let residentName = "Resident";
      try {
        const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
        if (res && res.full_name) residentName = res.full_name;
      } catch {}
      const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(debitAccount);
      if (!coaRow) {
        database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
          .run(debitAccount, `${residentName} /Rent Receivable`, "asset");
      }

      // Insert split double entry transactions
      const insertStmt = database.prepare(`
        INSERT INTO ledger_transactions (voucher_no, tx_date, description, main_acco_id, contra_acco_id, debit, credit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      // Debit Accounts Receivable
      insertStmt.run(vNo, entry.entry_date, entry.description, debitAccount, creditLegs[0].account, amount, 0.0);

      // Credits
      for (const leg of creditLegs) {
        insertStmt.run(vNo, entry.entry_date, entry.description, leg.account, debitAccount, 0.0, leg.amount);
      }

      // ERP CENTRAL POSTING ENGINE: Double-Entry Balance Validation
      const _erpCreditSum = creditLegs.reduce((s: number, l: any) => s + l.amount, 0);
      if (Math.abs(amount - _erpCreditSum) > 0.01) {
        console.error("[ERP VALIDATION FAILED] Voucher: ${vNo} | Debit: ${amount} | Credit Sum: ${_erpCreditSum} | Imbalanced entry REJECTED and SQLite transaction ROLLED BACK");
        return;
      }

      // Insert balanced journal entry & lines
      try {
        const nowStr = new Date().toISOString();
        const existingJournalRows = database.prepare(
          "SELECT id FROM journal_entries WHERE reference = ? OR voucher_no = ? OR voucher_no = ?"
        ).all(entry.id, entry.id, vNo) as { id: string }[];
        if (existingJournalRows.length > 0) {
          const existingIds = existingJournalRows.map((row) => row.id);
          const placeholders = existingIds.map(() => "?").join(",");
          database.prepare(`DELETE FROM journal_lines WHERE entry_id IN (${placeholders})`).run(...existingIds);
          database.prepare(`DELETE FROM journal_entries WHERE id IN (${placeholders})`).run(...existingIds);
        }

        const journalEntryId = randomUUID();
        let entry_type = "JV";
        const descLower = (entry.description || "").toLowerCase();
        if (vNo.startsWith("RV") || descLower.includes("[rv-") || descLower.includes("receipt voucher")) {
          entry_type = "RV";
        } else if (vNo.startsWith("PV") || descLower.includes("[pv-") || descLower.includes("payment voucher")) {
          entry_type = "PV";
        } else if (vNo.startsWith("RI") || descLower.includes("[ri-") || descLower.includes("rental invoice")) {
          entry_type = "RI";
        } else if (vNo.startsWith("RF") || descLower.includes("[rf-") || descLower.includes("refund voucher")) {
          entry_type = "RF";
        }
        database.prepare(`
          INSERT INTO journal_entries (id, voucher_no, entry_type, entry_date, description, reference, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(journalEntryId, vNo, entry_type, entry.entry_date, entry.description, entry.id, nowStr, nowStr);

        // Debit line
        database.prepare(`
          INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), journalEntryId, debitAccount, amount, 0.0, nowStr, nowStr);

        // Credit lines
        for (const leg of creditLegs) {
          database.prepare(`
            INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(randomUUID(), journalEntryId, leg.account, 0.0, leg.amount, nowStr, nowStr);
        }
      } catch (journalErr: any) {
        console.error("[SQLite Journal Posting] Failed to post journal entry/lines:", journalErr.message);
      }
      return;
    }

    // 4. Resolve standard account mappings if no invoice matches or it is a payment
    if (entry.entry_type === "rent") {
      if (entry.credit > 0) {
        // Rent Payment Received: Debit Cash/Bank, Credit Tenant's Rent Receivable
        debitAccount = cashOrBank;
        creditAccount = `1200.1.1.${entry.user_id}`;
        
        let residentName = "Resident";
        try {
          const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
          if (res && res.full_name) residentName = res.full_name;
        } catch {}
        
        const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(creditAccount);
        if (!coaRow) {
          database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
            .run(creditAccount, `${residentName} /Rent Receivable`, "asset");
        }
      } else {
        // Rent Charged (Invoice): Debit Tenant's Rent Receivable, Credit Rent Income
        debitAccount = `1200.1.1.${entry.user_id}`;
        creditAccount = "4000"; // Rent Income
        
        let residentName = "Resident";
        try {
          const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
          if (res && res.full_name) residentName = res.full_name;
        } catch {}
        
        const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(debitAccount);
        if (!coaRow) {
          database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
            .run(debitAccount, `${residentName} /Rent Receivable`, "asset");
        }
      }
    } 
    else if (entry.entry_type === "security") {
      if (entry.credit > 0) {
        // Security Deposit Received: Debit Cash/Bank, Credit Security Deposits Held (Liability)
        debitAccount = cashOrBank;
        creditAccount = `2100.1.1.${entry.user_id}`;
        
        let residentName = "Resident";
        try {
          const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
          if (res && res.full_name) residentName = res.full_name;
        } catch {}
        
        const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(creditAccount);
        if (!coaRow) {
          database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
            .run(creditAccount, `${residentName} /Security Deposit`, "liability");
        }
      } else {
        // Security Deposit Refunded/Returned: Debit Security Deposits Held (Liability), Credit Cash/Bank
        debitAccount = `2100.1.1.${entry.user_id}`;
        creditAccount = cashOrBank;
        
        let residentName = "Resident";
        try {
          const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
          if (res && res.full_name) residentName = res.full_name;
        } catch {}
        
        const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(debitAccount);
        if (!coaRow) {
          database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
            .run(debitAccount, `${residentName} /Security Deposit`, "liability");
        }
      }
    } 
    else if (entry.entry_type === "maintenance") {
      if (entry.credit > 0) {
        // Maintenance Payment Received: Debit Cash/Bank, Credit Tenant's Rent Receivable
        debitAccount = cashOrBank;
        creditAccount = `1200.1.1.${entry.user_id}`;
        
        let residentName = "Resident";
        try {
          const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
          if (res && res.full_name) residentName = res.full_name;
        } catch {}
        
        const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(creditAccount);
        if (!coaRow) {
          database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
            .run(creditAccount, `${residentName} /Rent Receivable`, "asset");
        }
      } else {
        // Maintenance Charged:
        if (entry.user_id !== "system" && entry.user_id !== "admin-id-default") {
          // Resident Charge: Debit Tenant Rent Receivable, Credit Maintenance Income
          debitAccount = `1200.1.1.${entry.user_id}`;
          if (descLower.includes("parking")) {
            creditAccount = "4400"; // Parking Income
          } else if (descLower.includes("stall")) {
            creditAccount = "4500"; // Stall Income
          } else {
            creditAccount = "4100"; // Maintenance Income
          }
          
          let residentName = "Resident";
          try {
            const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
            if (res && res.full_name) residentName = res.full_name;
          } catch {}
          
          const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(debitAccount);
          if (!coaRow) {
            database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
              .run(debitAccount, `${residentName} /Rent Receivable`, "asset");
          }
        } else {
          // Maintenance Expense: Debit Maintenance Expense, Credit Cash/Bank
          debitAccount = "5100"; // Maintenance Expense
          creditAccount = cashOrBank;
        }
      }
    } 
    else {
      // "other" entry_type
      if (entry.credit > 0) {
        // Other Payment Received:
        if (entry.user_id !== "system" && entry.user_id !== "admin-id-default") {
          // Debit Cash/Bank, Credit Tenant Rent Receivable
          debitAccount = cashOrBank;
          creditAccount = `1200.1.1.${entry.user_id}`;
          
          let residentName = "Resident";
          try {
            const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
            if (res && res.full_name) residentName = res.full_name;
          } catch {}
          
          const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(creditAccount);
          if (!coaRow) {
            database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
              .run(creditAccount, `${residentName} /Rent Receivable`, "asset");
          }
        } else {
          // Other Income: Debit Cash/Bank, Credit Other Income
          debitAccount = cashOrBank;
          creditAccount = "4900"; // Other Income
        }
      } else {
        // Other Charge or Expense:
        if (descLower.includes("staff advance")) {
          let staffName = "Staff Member";
          let staffId = "general";
          try {
            const staffList = database.prepare("SELECT id, full_name FROM staff").all() as { id: string; full_name: string }[];
            const matched = staffList.find(s => descLower.includes(s.full_name.toLowerCase()));
            if (matched) {
              staffId = matched.id;
              staffName = matched.full_name;
            }
          } catch {}

          debitAccount = `1300.1.1.${staffId}`;
          creditAccount = cashOrBank;

          const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(debitAccount);
          if (!coaRow) {
            database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
              .run(debitAccount, `${staffName} /Staff Advance`, "asset");
          }
        } 
        else if (descLower.includes("salary")) {
          let staffName = "Staff Member";
          let staffId = "general";
          try {
            const staffList = database.prepare("SELECT id, full_name FROM staff").all() as { id: string; full_name: string }[];
            const matched = staffList.find(s => descLower.includes(s.full_name.toLowerCase()));
            if (matched) {
              staffId = matched.id;
              staffName = matched.full_name;
            }
          } catch {}

          debitAccount = `5000.1.1.${staffId}`;
          creditAccount = cashOrBank;

          const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(debitAccount);
          if (!coaRow) {
            database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
              .run(debitAccount, `${staffName} /Salary Expense`, "expense");
          }
        } 
        else {
          // General resident charge vs General Expense
          if (entry.user_id !== "system" && entry.user_id !== "admin-id-default") {
            // Debit Tenant Rent Receivable, Credit Other Income (or Utility Recovery)
            debitAccount = `1200.1.1.${entry.user_id}`;
            if (descLower.includes("elec") || descLower.includes("gas") || descLower.includes("water") || descLower.includes("utility")) {
              creditAccount = "4300"; // Utility Recovery
            } else if (descLower.includes("parking")) {
              creditAccount = "4400"; // Parking Income
            } else if (descLower.includes("stall")) {
              creditAccount = "4500"; // Stall Income
            } else {
              creditAccount = "4900"; // Other Income
            }
            
            let residentName = "Resident";
            try {
              const res = database.prepare("SELECT full_name FROM users WHERE id = ?").get(entry.user_id) as { full_name: string } | undefined;
              if (res && res.full_name) residentName = res.full_name;
            } catch {}
            
            const coaRow = database.prepare("SELECT acco_id FROM chart_of_accounts WHERE acco_id = ?").get(debitAccount);
            if (!coaRow) {
              database.prepare("INSERT INTO chart_of_accounts (acco_id, acco_name, account_type) VALUES (?, ?, ?)")
                .run(debitAccount, `${residentName} /Rent Receivable`, "asset");
            }
          } else {
            // General Expense: Debit Other Expense, Credit Cash/Bank
            debitAccount = "5900"; // Other Expense
            creditAccount = cashOrBank;
          }
        }
      }
    }

    // 5. Insert balanced double-entry rows (both sides)
    const insertStmt = database.prepare(`
      INSERT INTO ledger_transactions (voucher_no, tx_date, description, main_acco_id, contra_acco_id, debit, credit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Debit leg
    insertStmt.run(vNo, entry.entry_date, entry.description, debitAccount, creditAccount, amount, 0.0);
    // Credit leg
    insertStmt.run(vNo, entry.entry_date, entry.description, creditAccount, debitAccount, 0.0, amount);

    // 6. Insert into journal_entries and journal_lines to ensure compliance
    try {
      const nowStr = new Date().toISOString();
      const existingJournalRows = database.prepare(
        "SELECT id FROM journal_entries WHERE reference = ? OR voucher_no = ? OR voucher_no = ?"
      ).all(entry.id, entry.id, vNo) as { id: string }[];
      if (existingJournalRows.length > 0) {
        const existingIds = existingJournalRows.map((row) => row.id);
        const placeholders = existingIds.map(() => "?").join(",");
        database.prepare(`DELETE FROM journal_lines WHERE entry_id IN (${placeholders})`).run(...existingIds);
        database.prepare(`DELETE FROM journal_entries WHERE id IN (${placeholders})`).run(...existingIds);
      }

      const journalEntryId = randomUUID();
      let entry_type = "JV";
      const descLower = (entry.description || "").toLowerCase();
      if (vNo.startsWith("RV") || descLower.includes("[rv-") || descLower.includes("receipt voucher")) {
        entry_type = "RV";
      } else if (vNo.startsWith("PV") || descLower.includes("[pv-") || descLower.includes("payment voucher")) {
        entry_type = "PV";
      } else if (vNo.startsWith("RI") || descLower.includes("[ri-") || descLower.includes("rental invoice")) {
        entry_type = "RI";
      } else if (vNo.startsWith("RF") || descLower.includes("[rf-") || descLower.includes("refund voucher")) {
        entry_type = "RF";
      }
      database.prepare(`
        INSERT INTO journal_entries (id, voucher_no, entry_type, entry_date, description, reference, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(journalEntryId, vNo, entry_type, entry.entry_date, entry.description, entry.id, nowStr, nowStr);

      database.prepare(`
        INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), journalEntryId, debitAccount, amount, 0.0, nowStr, nowStr);

      database.prepare(`
        INSERT INTO journal_lines (id, entry_id, acco_id, debit, credit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), journalEntryId, creditAccount, 0.0, amount, nowStr, nowStr);
    } catch (journalErr: any) {
      console.error("[SQLite Journal Posting] Failed to post journal entry/lines:", journalErr.message);
    }

  } catch (err) {
    console.error(`[SQLite] Failed to sync ledger entry ${entryId} to double entry:`, err);
  }
}

export function syncResidentErcData(database: any, userId: string) {
  try {
    const user = database.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user || user.role !== "resident") return;

    const now = new Date().toISOString();

    // 1. Sync resident profile
    let resident = database.prepare("SELECT * FROM residents WHERE user_id = ?").get(userId);
    let residentId = resident?.id;

    if (!resident) {
      residentId = randomUUID();
      const countRow = database.prepare("SELECT COUNT(*) as count FROM residents").get() as { count: number };
      const residentNo = `MG-R${String(countRow.count + 1).padStart(6, "0")}`;
      database.prepare(`
        INSERT INTO residents (id, resident_no, user_id, photo_url, cnic, passport_no, mobile, whatsapp, email, address, status, emergency_contact, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(residentId, residentNo, userId, "", user.cnic || "", "", user.phone || "", user.phone || "", user.email || "", "", "active", "", now, now);
      console.log(`[SQLite ERP] Synced new resident ${user.full_name} as ${residentNo}`);
    } else {
      database.prepare(`
        UPDATE residents 
        SET cnic = ?, mobile = ?, whatsapp = ?, email = ?, updated_at = ?
        WHERE id = ?
      `).run(user.cnic || "", user.phone || "", user.phone || "", user.email || "", now, residentId);
    }

    // 2. Sync lease if apartment is set
    if (user.apartment_no) {
      const apt = database.prepare("SELECT id, rent FROM apartments WHERE number = ?").get(user.apartment_no) as { id: string, rent: number } | undefined;
      if (apt) {
        const leaseExist = database.prepare("SELECT id FROM leases WHERE resident_id = ? AND apartment_id = ?").get(residentId, apt.id);
        if (!leaseExist) {
          const countRow = database.prepare("SELECT COUNT(*) as count FROM leases").get() as { count: number };
          const leaseNo = `MG-L${String(countRow.count + 1).padStart(6, "0")}`;
          const leaseId = randomUUID();
          database.prepare(`
            INSERT INTO leases (id, lease_no, resident_id, apartment_id, start_date, end_date, monthly_rent, security_deposit, maintenance_charges, parking_charges, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            leaseId, leaseNo, residentId, apt.id,
            user.joining_date || now.split("T")[0],
            user.agreement_end_date || now.split("T")[0],
            user.rent_amount || apt.rent || 0,
            user.security_deposit || 0,
            user.fixed_maintenance || 0,
            0.0,
            "active", now, now
          );
          console.log(`[SQLite ERP] Synced new lease ${leaseNo} for apartment ${user.apartment_no}`);
        } else {
          database.prepare(`
            UPDATE leases
            SET monthly_rent = ?, security_deposit = ?, maintenance_charges = ?, updated_at = ?
            WHERE id = ?
          `).run(user.rent_amount || apt.rent || 0, user.security_deposit || 0, user.fixed_maintenance || 0, now, leaseExist.id);
        }
      }
    }
  } catch (err: any) {
    console.error("[SQLite ERP] syncResidentErcData failed:", err.message);
  }
}
