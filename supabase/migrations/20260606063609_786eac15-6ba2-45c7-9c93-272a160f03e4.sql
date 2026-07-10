
-- =========================================================
-- PHASE 1: FULL ACCOUNTING LAYER
-- =========================================================

-- 1) CHART OF ACCOUNTS ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','income','expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  parent_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/staff read coa" ON public.chart_of_accounts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE POLICY "Admin write coa" ON public.chart_of_accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));
-- Demo anon (matches existing demo-mode posture)
CREATE POLICY "Demo anon all coa" ON public.chart_of_accounts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed default chart
INSERT INTO public.chart_of_accounts (code, name, account_type, normal_balance) VALUES
  ('1000','Cash on Hand','asset','debit'),
  ('1100','Bank Account','asset','debit'),
  ('1200','Tenant Rent Receivable','asset','debit'),
  ('1300','Staff Advances','asset','debit'),
  ('2000','Accounts Payable','liability','credit'),
  ('2100','Security Deposits Held','liability','credit'),
  ('3000','Owner Equity','equity','credit'),
  ('4000','Rent Income','income','credit'),
  ('4100','Maintenance Income','income','credit'),
  ('4200','Daily Rental Income','income','credit'),
  ('4300','Utility Recovery','income','credit'),
  ('4900','Other Income','income','credit'),
  ('5000','Salary Expense','expense','debit'),
  ('5100','Maintenance Expense','expense','debit'),
  ('5200','Utilities Expense','expense','debit'),
  ('5300','Cleaning & Supplies','expense','debit'),
  ('5400','Repairs Expense','expense','debit'),
  ('5500','Office & Admin','expense','debit'),
  ('5900','Other Expense','expense','debit')
ON CONFLICT (code) DO NOTHING;

-- 2) JOURNAL ENTRIES + LINES (double-entry) ---------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  description text NOT NULL,
  source_table text,
  source_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/staff read journal" ON public.journal_entries
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE POLICY "Admin/staff write journal" ON public.journal_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE POLICY "Demo anon all journal" ON public.journal_entries
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_code text NOT NULL REFERENCES public.chart_of_accounts(code),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_journal ON public.journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/staff read jlines" ON public.journal_lines
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE POLICY "Admin/staff write jlines" ON public.journal_lines
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE POLICY "Demo anon all jlines" ON public.journal_lines
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3) CATEGORY → ACCOUNT MAPPER ---------------------------------------
CREATE OR REPLACE FUNCTION public.fn_map_category_to_account(_type text, _category text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE c text := lower(coalesce(_category,''));
BEGIN
  IF _type = 'income' THEN
    IF c LIKE '%daily%' OR c LIKE '%booking%' THEN RETURN '4200';
    ELSIF c LIKE '%maint%' THEN RETURN '4100';
    ELSIF c LIKE '%util%' OR c LIKE '%electric%' OR c LIKE '%gas%' OR c LIKE '%water%' THEN RETURN '4300';
    ELSIF c LIKE '%rent%' OR c = '' THEN RETURN '4000';
    ELSE RETURN '4900';
    END IF;
  ELSE -- expense (or 'debit')
    IF c LIKE '%salary%' OR c LIKE '%payroll%' OR c LIKE '%advance%' THEN RETURN '5000';
    ELSIF c LIKE '%maint%' THEN RETURN '5100';
    ELSIF c LIKE '%util%' OR c LIKE '%electric%' OR c LIKE '%gas%' OR c LIKE '%water%' THEN RETURN '5200';
    ELSIF c LIKE '%clean%' OR c LIKE '%supplies%' THEN RETURN '5300';
    ELSIF c LIKE '%repair%' THEN RETURN '5400';
    ELSIF c LIKE '%office%' OR c LIKE '%admin%' THEN RETURN '5500';
    ELSE RETURN '5900';
    END IF;
  END IF;
END $$;

-- 4) AUTO-POST FROM finance_entries → journal ------------------------
CREATE OR REPLACE FUNCTION public.fn_finance_to_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_id uuid;
  v_account text;
  v_type text := NEW.type::text;
BEGIN
  v_account := public.fn_map_category_to_account(v_type, NEW.category);

  INSERT INTO public.journal_entries(entry_date, reference, description, source_table, source_id, created_by)
  VALUES (NEW.entry_date, NEW.id::text, NEW.description, 'finance_entries', NEW.id, NEW.created_by)
  RETURNING id INTO v_journal_id;

  IF v_type = 'income' OR v_type = 'credit' THEN
    -- Dr Cash, Cr Income account
    INSERT INTO public.journal_lines(journal_id, account_code, debit, credit, memo)
    VALUES (v_journal_id, '1000', NEW.amount, 0, NEW.description),
           (v_journal_id, v_account, 0, NEW.amount, NEW.category);
  ELSE
    -- Dr Expense, Cr Cash
    INSERT INTO public.journal_lines(journal_id, account_code, debit, credit, memo)
    VALUES (v_journal_id, v_account, NEW.amount, 0, NEW.category),
           (v_journal_id, '1000', 0, NEW.amount, NEW.description);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_finance_to_journal ON public.finance_entries;
CREATE TRIGGER trg_finance_to_journal
  AFTER INSERT ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_finance_to_journal();

-- 5) BACKFILL existing finance entries into journal ------------------
DO $$
DECLARE r record;
DECLARE v_journal_id uuid; v_account text; v_type text;
BEGIN
  FOR r IN
    SELECT fe.* FROM public.finance_entries fe
    LEFT JOIN public.journal_entries je
      ON je.source_table='finance_entries' AND je.source_id = fe.id
    WHERE je.id IS NULL
    ORDER BY fe.entry_date
  LOOP
    v_type := r.type::text;
    v_account := public.fn_map_category_to_account(v_type, r.category);
    INSERT INTO public.journal_entries(entry_date, reference, description, source_table, source_id, created_by)
    VALUES (r.entry_date, r.id::text, r.description, 'finance_entries', r.id, r.created_by)
    RETURNING id INTO v_journal_id;
    IF v_type='income' OR v_type='credit' THEN
      INSERT INTO public.journal_lines(journal_id, account_code, debit, credit, memo) VALUES
        (v_journal_id,'1000', r.amount, 0, r.description),
        (v_journal_id, v_account, 0, r.amount, r.category);
    ELSE
      INSERT INTO public.journal_lines(journal_id, account_code, debit, credit, memo) VALUES
        (v_journal_id, v_account, r.amount, 0, r.category),
        (v_journal_id,'1000', 0, r.amount, r.description);
    END IF;
  END LOOP;
END $$;

-- 6) REPORT FUNCTIONS -------------------------------------------------
-- Trial Balance: per account totals up to _to_date
CREATE OR REPLACE FUNCTION public.fn_trial_balance(_from date, _to date)
RETURNS TABLE(code text, name text, account_type text, normal_balance text, total_debit numeric, total_credit numeric, balance numeric)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT
    coa.code, coa.name, coa.account_type, coa.normal_balance,
    COALESCE(SUM(jl.debit),0) AS total_debit,
    COALESCE(SUM(jl.credit),0) AS total_credit,
    CASE WHEN coa.normal_balance='debit'
      THEN COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)
      ELSE COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
    END AS balance
  FROM public.chart_of_accounts coa
  LEFT JOIN public.journal_lines jl ON jl.account_code = coa.code
  LEFT JOIN public.journal_entries je ON je.id = jl.journal_id
    AND je.entry_date BETWEEN _from AND _to
  GROUP BY coa.code, coa.name, coa.account_type, coa.normal_balance
  ORDER BY coa.code;
$$;

-- Profit & Loss
CREATE OR REPLACE FUNCTION public.fn_profit_loss(_from date, _to date)
RETURNS TABLE(code text, name text, account_type text, amount numeric)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT coa.code, coa.name, coa.account_type,
    CASE WHEN coa.account_type='income'
      THEN COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
      ELSE COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)
    END AS amount
  FROM public.chart_of_accounts coa
  LEFT JOIN public.journal_lines jl ON jl.account_code = coa.code
  LEFT JOIN public.journal_entries je ON je.id = jl.journal_id
    AND je.entry_date BETWEEN _from AND _to
  WHERE coa.account_type IN ('income','expense')
  GROUP BY coa.code, coa.name, coa.account_type
  ORDER BY coa.code;
$$;

-- Balance Sheet (as of _as_of)
CREATE OR REPLACE FUNCTION public.fn_balance_sheet(_as_of date)
RETURNS TABLE(code text, name text, account_type text, amount numeric)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT coa.code, coa.name, coa.account_type,
    CASE WHEN coa.normal_balance='debit'
      THEN COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)
      ELSE COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
    END AS amount
  FROM public.chart_of_accounts coa
  LEFT JOIN public.journal_lines jl ON jl.account_code = coa.code
  LEFT JOIN public.journal_entries je ON je.id = jl.journal_id
    AND je.entry_date <= _as_of
  WHERE coa.account_type IN ('asset','liability','equity')
  GROUP BY coa.code, coa.name, coa.account_type, coa.normal_balance
  ORDER BY coa.code;
$$;
