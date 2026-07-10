# Margalla Gateway ERP Production Baseline v1.0 Guidelines

The codebase is marked as **PRODUCTION BASELINE – VERSION 1.0**. The ERP is commercially deployable and all core systems are frozen.

## Core Rules

### 1. Do Not Break Existing System
- Do NOT redesign the UI, change the sidebar, modify the dashboard, or rename pages.
- Do NOT remove routes, modules, APIs, database tables, or database columns.
- Do NOT change existing stable accounting logic or workflows unless fixing a verified production defect.
- Maintain 100% backward compatibility and preserve all existing data.

### 2. Frozen Modules
The following modules must remain functional exactly as they are:
- Dashboard, Residents, Apartments, Buildings, Towers.
- Resident Portal, Third Party Portal.
- Corporate Rental Ledger, Resident Ledger.
- Monthly Billing, Utility Billing, Receipt Voucher, Daily Cash Book.
- Journal Entries, General Ledger, Trial Balance, Profit & Loss, Balance Sheet.
- Accounting Reports, Security Deposit Management, Backup & Restore.
- Offline SQLite Database, Electron Desktop EXE.
- PDF Printing, WhatsApp Integration, Email Integration.

### 3. Accounting Rules
- Every financial transaction must automatically post to: Resident Ledger, Journal Entry, General Ledger, Trial Balance, Balance Sheet, Cash Book, and Accounting Reports.
- No manual accounting entries are allowed.
- Debit must always equal Credit (Trial Balance Difference must always be ZERO).
- Security Deposits must remain isolated in Liability (Account `2100`) and must NEVER appear as Rent Income, Revenue, or Profit.
- No duplicate ledger entries, double-posting of invoices, or double-posting of payments.

### 4. Database Rules
- Never drop existing tables, recreate production tables, or rename columns.
- Only additive migrations are allowed. Never delete production financial data.
- Databases: Production (`margalla.db`), Testing (`demo.db`), Development (`dev.db`). Never mix production data with demo/development data.

### 5. Billing & Payment Rules
- Monthly Invoice is the only billing source. It consists of: Rent, Electricity, Gas (Fixed Amount), Maintenance, Parking, Other Charges, and Previous Balance.
- Invoices must automatically create: Resident Ledger debit, Accounting Entry, Journal line, and update Running/Outstanding Balances.
- Payments must automatically: Update Resident Ledger, Outstanding Balance, Cash Book, Trial Balance, Balance Sheet, P&L, and generate a Receipt Voucher and Journal Entry.

### 6. Resident Ledger
- The Resident Ledger is the Single Source of Truth.
- All statements (PDF, Preview, Corporate Ledger, Outstanding/Running Balances) must read dynamically from the general ledger transactions.

### 7. Administrative Controls
- Only Super Admin can: Create Resident IDs, Reset Passwords, Create Third Party Accounts, Assign Apartments, Create Leases, Run Monthly Billing, Approve Payments, Run Accounting, and perform Backup/Restore database actions.

### 8. UI & Usability Policy
- Keep current styling, colors, sidebar, and navigation. 
- Improve usability and usability controls only. Do not replace layouts or duplicate pages. Extend existing modules instead of creating new ones.

### 9. Version Policy
- Bug Fixes: Version `1.0.x`
- Small Features: Version `1.1`
- Major Features: Version `2.0`
- Never modify the production baseline directly.

### 10. QA Verification
Every future update must pass:
- TypeScript Compile check (`npx tsc --noEmit`)
- Production Build check (`npm run build`)
- Electron Build check
- Ledger, Journal, and Trial Balance Verification
- Backup and Restore Verification
- PDF, WhatsApp, and Email Redirect Link Verification
