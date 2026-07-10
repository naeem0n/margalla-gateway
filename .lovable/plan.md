# Margalla Gateway — Overhaul Plan

Commercial rental management only (lease + daily bookings + maintenance + payroll). No buy/sell anywhere in copy or schema.

I'll ship this in 5 focused phases so each one is reviewable. Tell me to start at Phase 1, or reorder.

---

## Phase 1 — RLS + Demo Auth Fix (foundation)

The portals were opened without login for demo, so `auth.uid()` is NULL and every admin RLS policy fails. Two options:

- **(A) Keep demo-open**: extend permissive anon policies to the tables admin screens write to: `apartments` ✅ already done, `daily_bookings` ✅, plus `finance_entries`, `ledger_entries`, `payment_requests`, `complaints`, `staff`, `parking_slots`, `documents`, `notification_logs`.
- **(B) Restore real auth**: re-add the `_authenticated` gate on `/admin`, seed an admin user, drop the demo policies.

**Recommendation: (A) for now** so you can keep clicking through. I'll add a clear "Demo Mode" banner in the admin topbar and a TODO migration to revert before launch.

Also fix the frontend insert payloads to stop sending `created_by: auth.uid()` when no session exists (currently throws on `daily_bookings`).

---

## Phase 2 — Automated Accounting & Ledger

Schema:
- Add `accounts` concept via existing `ledger_entries.account_type` ∈ `tenant | general | staff`.
- New DB trigger `fn_finance_to_ledger()` on `finance_entries` AFTER INSERT:
  - If `resident_id` set → post `ledger_entries` row with `account_type='tenant'`, `account_id=resident_id`.
  - Else → `account_type='general'`, `account_id = '00000000-0000-0000-0000-000000000000'` (building account).
  - `debit` = amount when `type='expense'`, `credit` = amount when `type='income'`.
  - Updates running `balance_after` per account via SQL window function.

UI (`/admin/accounting`):
- Single "Add Entry" modal: Type (Income/Expense), Category, Amount, Date, Resident (searchable dropdown, default "None — General Ledger"), Description, optional Receipt upload.
- Revenue card on dashboard = `SUM(credit) - SUM(debit)` on general ledger for current month, live via Supabase realtime channel.
- Toast on insert: "Posted to {Ali Khan's ledger | General Ledger}".

---

## Phase 3 — Payment Requests

UI (`/admin/payment-requests`):
- "+ Create Request" modal: Resident, Type (Rent/Utilities/Parking/Other), Amount, Due Date, Note.
- Table columns: Resident · Apt · Type · Amount · Due · Status badge (Pending/Approved/Overdue/Rejected) · Actions.
- Status auto-computes Overdue when `due_date < today AND status='pending'` (view).
- **Approve action** calls a Postgres function `approve_payment_request(id)` that runs in one transaction:
  1. `UPDATE payment_requests SET status='approved', reviewed_at=now()`
  2. `INSERT INTO finance_entries(type='income', resident_id, amount, category='Rent Collection', description='Invoice #...')` — trigger from Phase 2 propagates to ledger + revenue.
  3. Toast: "Approved. PKR X credited to revenue."

Resident side (`/resident/bills`): list own requests, "Pay Now" uploads receipt → creates a follow-up `payment_requests` row in `pending`.

---

## Phase 4 — Complaints with Auto-Expense

Schema:
- Add `maintenance_cost numeric` and `expense_entry_id uuid` columns to `complaints`.
- Trigger `fn_complaint_resolved_expense()` AFTER UPDATE: when `status` transitions to `resolved` and `maintenance_cost > 0`, insert `finance_entries(type='expense', category='Maintenance', amount=maintenance_cost, description='Complaint #{id}: {title}')` and store the returned id in `expense_entry_id` (idempotent).

UI (`/admin/complaints`):
- Table: Apt · Title · Category · Priority · Status · Reported · Actions.
- "Update Status" dialog with status select; when "Resolved" is picked, reveal "Maintenance Cost (PKR)" input + "Resolution notes".
- Toast: "Resolved. PKR X logged as Maintenance expense."

---

## Phase 5 — Staff: Advances, Salary Run, PDFs

Schema additions:
- `staff`: add `duty_start time`, `duty_end time`, `advance_balance numeric default 0`.
- New table `staff_salary_payments(id, staff_id, period_month, gross_salary, advance_deducted, net_paid, paid_at, paid_by, finance_entry_id)`.
- New table `staff_advances(id, staff_id, amount, given_at, given_by, finance_entry_id)`.

Flows:
- "Give Advance" modal → inserts `staff_advances` + `finance_entries(expense, category='Staff Advance')` + `UPDATE staff SET advance_balance = advance_balance + amount`.
- "Pay Salary" button on staff row → modal shows: Gross, Outstanding Advance, **Net = Gross − Advance**. Confirm →
  1. Insert `staff_salary_payments`
  2. Insert `finance_entries(expense, category='Salary', amount=net_paid)`
  3. `UPDATE staff SET advance_balance = 0`
  4. Toast: "Paid PKR {net}. Advance settled."

Staff profile drawer: Duty timings, CNIC, Join date, advance history, salary history.

**PDF generation** (client-side, using existing `src/lib/pdf.ts` — extend if thin):
- **Resident Statement** (`/admin/tenants` → row → "Download Statement"): header with Margalla Gateway logo + address, resident block, period selector, full `ledger_entries` table for that resident, running balance, totals footer.
- **Resident Invoice** (from a Payment Request row → "Download Invoice"): single-page invoice with bill-to, line item, amount due, bank details from `site_content`.
- **Salary Slip** (next to a processed salary): employee block, period, earnings (gross), deductions (advance), net pay, signature line.

All PDFs use the dark-on-white print theme (not the dark UI) with brand color accents from `--primary`.

---

## Realtime + Toasts

- Subscribe `/admin/accounting`, `/admin/payment-requests`, `/admin/complaints`, `/admin/staff` to their Supabase tables via `postgres_changes` and refetch on event.
- Every successful mutation → `sonner` toast with concrete number ("PKR 45,000 credited").

---

## Technical notes (for the engineer side)

- All triggers `SECURITY DEFINER` with `SET search_path = public`.
- `approve_payment_request` is a `SECURITY DEFINER` SQL function so RLS on `finance_entries` isn't re-checked mid-transaction.
- PDFs: `jspdf` + `jspdf-autotable` (lightweight, no server roundtrip). Logo embedded as base64 from `src/assets`.
- No new edge functions — everything is either DB trigger or `createServerFn`.
- Migrations chunked per phase so a single failure doesn't block the others.

---

**Confirm and I'll start with Phase 1 (RLS fix + demo banner + payload fix). Or say "do all phases" and I'll ship them in sequence in one go.**
