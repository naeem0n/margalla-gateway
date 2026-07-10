
-- ============================================================
-- Phase 1: Demo-mode RLS for remaining admin tables
-- ============================================================
DO $$ BEGIN
  -- finance_entries
  EXECUTE 'CREATE POLICY "Demo anon read finance_entries" ON public.finance_entries FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY "Demo anon insert finance_entries" ON public.finance_entries FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon update finance_entries" ON public.finance_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon delete finance_entries" ON public.finance_entries FOR DELETE TO anon, authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO anon, authenticated;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Demo anon read ledger_entries" ON public.ledger_entries FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY "Demo anon insert ledger_entries" ON public.ledger_entries FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon update ledger_entries" ON public.ledger_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon delete ledger_entries" ON public.ledger_entries FOR DELETE TO anon, authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries TO anon, authenticated;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Demo anon read payment_requests" ON public.payment_requests FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY "Demo anon insert payment_requests" ON public.payment_requests FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon update payment_requests" ON public.payment_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon delete payment_requests" ON public.payment_requests FOR DELETE TO anon, authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO anon, authenticated;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Demo anon read complaints" ON public.complaints FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY "Demo anon insert complaints" ON public.complaints FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon update complaints" ON public.complaints FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon delete complaints" ON public.complaints FOR DELETE TO anon, authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO anon, authenticated;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Demo anon read staff" ON public.staff FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY "Demo anon insert staff" ON public.staff FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon update staff" ON public.staff FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon delete staff" ON public.staff FOR DELETE TO anon, authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO anon, authenticated;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Demo anon read parking" ON public.parking_slots FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY "Demo anon insert parking" ON public.parking_slots FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon update parking" ON public.parking_slots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon delete parking" ON public.parking_slots FOR DELETE TO anon, authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_slots TO anon, authenticated;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Demo anon read profiles" ON public.profiles FOR SELECT TO anon, authenticated USING (true)';
  EXECUTE 'CREATE POLICY "Demo anon insert profiles" ON public.profiles FOR INSERT TO anon, authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon update profiles" ON public.profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Demo anon delete profiles" ON public.profiles FOR DELETE TO anon, authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;

-- ============================================================
-- Phase 2: Payment Requests schema additions
-- ============================================================
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS apartment_no text,
  ADD COLUMN IF NOT EXISTS bill_type text DEFAULT 'rent',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS finance_entry_id uuid;

-- ============================================================
-- Phase 3: Complaints — maintenance cost + linked expense
-- ============================================================
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS maintenance_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_entry_id uuid;

-- ============================================================
-- Phase 4: Staff — duty timings + advance balance
-- ============================================================
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS duty_start time,
  ADD COLUMN IF NOT EXISTS duty_end time,
  ADD COLUMN IF NOT EXISTS advance_balance numeric NOT NULL DEFAULT 0;

-- Staff advances log
CREATE TABLE IF NOT EXISTS public.staff_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  given_at timestamptz NOT NULL DEFAULT now(),
  given_by uuid,
  finance_entry_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_advances TO anon, authenticated;
GRANT ALL ON public.staff_advances TO service_role;
ALTER TABLE public.staff_advances ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Demo anon all staff_advances" ON public.staff_advances FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Staff salary payments log
CREATE TABLE IF NOT EXISTS public.staff_salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  gross_salary numeric NOT NULL DEFAULT 0,
  advance_deducted numeric NOT NULL DEFAULT 0,
  net_paid numeric NOT NULL DEFAULT 0,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid,
  finance_entry_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_salary_payments TO anon, authenticated;
GRANT ALL ON public.staff_salary_payments TO service_role;
ALTER TABLE public.staff_salary_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "Demo anon all staff_salary_payments" ON public.staff_salary_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Phase 5: Trigger — finance_entries → ledger_entries (auto post)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_finance_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text;
  v_account_id uuid;
  v_account_label text;
  v_debit numeric := 0;
  v_credit numeric := 0;
  GENERAL_ACCOUNT_ID constant uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF NEW.resident_id IS NOT NULL THEN
    v_account_type := 'tenant';
    v_account_id := NEW.resident_id;
    SELECT COALESCE(full_name, apartment_no, id::text) INTO v_account_label FROM public.profiles WHERE id = NEW.resident_id;
  ELSE
    v_account_type := 'general';
    v_account_id := GENERAL_ACCOUNT_ID;
    v_account_label := 'General Building Account';
  END IF;

  IF NEW.type = 'expense' OR NEW.type::text = 'debit' THEN
    v_debit := NEW.amount;
  ELSE
    v_credit := NEW.amount;
  END IF;

  INSERT INTO public.ledger_entries(
    account_type, account_id, account_label, entry_date, description, category,
    debit, credit, reference, created_by
  ) VALUES (
    v_account_type, v_account_id, v_account_label, NEW.entry_date, NEW.description, NEW.category,
    v_debit, v_credit, NEW.id::text, NEW.created_by
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_finance_to_ledger ON public.finance_entries;
CREATE TRIGGER trg_finance_to_ledger
AFTER INSERT ON public.finance_entries
FOR EACH ROW EXECUTE FUNCTION public.fn_finance_to_ledger();

-- ============================================================
-- Phase 5: Trigger — complaint resolved → maintenance expense
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_complaint_resolved_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
BEGIN
  IF NEW.status = 'resolved'
     AND COALESCE(NEW.maintenance_cost, 0) > 0
     AND NEW.expense_entry_id IS NULL THEN
    INSERT INTO public.finance_entries(
      entry_date, description, category, type, amount, created_by, resident_id
    ) VALUES (
      CURRENT_DATE,
      'Maintenance — ' || NEW.title || ' (Complaint #' || substr(NEW.id::text,1,8) || ')',
      'Maintenance',
      'expense',
      NEW.maintenance_cost,
      NEW.assigned_to,
      NULL
    ) RETURNING id INTO v_entry_id;
    NEW.expense_entry_id := v_entry_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complaint_resolved_expense ON public.complaints;
CREATE TRIGGER trg_complaint_resolved_expense
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.fn_complaint_resolved_expense();

-- ============================================================
-- Phase 3: RPC — approve_payment_request (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_payment_request(_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.payment_requests%ROWTYPE;
  v_entry_id uuid;
BEGIN
  SELECT * INTO r FROM public.payment_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment request not found'; END IF;
  IF r.status = 'approved' THEN RETURN r.finance_entry_id; END IF;

  INSERT INTO public.finance_entries(
    entry_date, description, category, type, amount, resident_id, created_by
  ) VALUES (
    CURRENT_DATE,
    COALESCE(r.bill_type, 'rent') || ' collection' || COALESCE(' (' || r.reference || ')',''),
    COALESCE(r.bill_type, 'rent'),
    'income',
    r.amount,
    r.resident_id,
    r.reviewed_by
  ) RETURNING id INTO v_entry_id;

  UPDATE public.payment_requests
     SET status = 'approved',
         reviewed_at = now(),
         finance_entry_id = v_entry_id
   WHERE id = _id;

  RETURN v_entry_id;
END $$;

GRANT EXECUTE ON FUNCTION public.approve_payment_request(uuid) TO anon, authenticated;

-- ============================================================
-- Phase 5: RPC — give_staff_advance (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION public.give_staff_advance(_staff_id uuid, _amount numeric, _notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_advance_id uuid;
  v_name text;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT full_name INTO v_name FROM public.staff WHERE id = _staff_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Staff not found'; END IF;

  INSERT INTO public.finance_entries(entry_date, description, category, type, amount)
  VALUES (CURRENT_DATE, 'Salary Advance — ' || v_name, 'Staff Advance', 'expense', _amount)
  RETURNING id INTO v_entry_id;

  INSERT INTO public.staff_advances(staff_id, amount, finance_entry_id, notes)
  VALUES (_staff_id, _amount, v_entry_id, _notes)
  RETURNING id INTO v_advance_id;

  UPDATE public.staff SET advance_balance = advance_balance + _amount WHERE id = _staff_id;
  RETURN v_advance_id;
END $$;

GRANT EXECUTE ON FUNCTION public.give_staff_advance(uuid, numeric, text) TO anon, authenticated;

-- ============================================================
-- Phase 5: RPC — pay_staff_salary (atomic, deducts advance)
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_staff_salary(_staff_id uuid, _period date DEFAULT NULL, _gross numeric DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_gross numeric;
  v_adv numeric;
  v_net numeric;
  v_period date := COALESCE(_period, date_trunc('month', CURRENT_DATE)::date);
  v_entry_id uuid;
  v_payment_id uuid;
BEGIN
  SELECT full_name, salary, advance_balance INTO v_name, v_gross, v_adv
    FROM public.staff WHERE id = _staff_id FOR UPDATE;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Staff not found'; END IF;
  v_gross := COALESCE(_gross, v_gross);
  v_adv := COALESCE(v_adv, 0);
  v_net := GREATEST(v_gross - v_adv, 0);

  INSERT INTO public.finance_entries(entry_date, description, category, type, amount)
  VALUES (
    CURRENT_DATE,
    'Salary — ' || v_name || ' (' || to_char(v_period, 'Mon YYYY') || ')'
      || CASE WHEN v_adv > 0 THEN ' [Advance Deducted PKR ' || v_adv::text || ']' ELSE '' END,
    'Salary', 'expense', v_net
  ) RETURNING id INTO v_entry_id;

  INSERT INTO public.staff_salary_payments(
    staff_id, period_month, gross_salary, advance_deducted, net_paid, finance_entry_id
  ) VALUES (
    _staff_id, v_period, v_gross, v_adv, v_net, v_entry_id
  ) RETURNING id INTO v_payment_id;

  UPDATE public.staff SET advance_balance = 0 WHERE id = _staff_id;
  RETURN v_payment_id;
END $$;

GRANT EXECUTE ON FUNCTION public.pay_staff_salary(uuid, date, numeric) TO anon, authenticated;
