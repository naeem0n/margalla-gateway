-- Migration: Remove demo-open policies and restrict SECURITY DEFINER functions
-- Removes permissive 'Demo anon' policies and revokes EXECUTE from public/anon

-- DROP demo policies (no-op if already removed)
DO $$ BEGIN
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon all coa" ON public.chart_of_accounts'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon all journal" ON public.journal_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon all jlines" ON public.journal_lines'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;

  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon read apartments" ON public.apartments'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon insert apartments" ON public.apartments'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon update apartments" ON public.apartments'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon delete apartments" ON public.apartments'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;

  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon read daily_bookings" ON public.daily_bookings'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon insert daily_bookings" ON public.daily_bookings'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon update daily_bookings" ON public.daily_bookings'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon delete daily_bookings" ON public.daily_bookings'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;

  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon read finance_entries" ON public.finance_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon insert finance_entries" ON public.finance_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon update finance_entries" ON public.finance_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon delete finance_entries" ON public.finance_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;

  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon read ledger_entries" ON public.ledger_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon insert ledger_entries" ON public.ledger_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon update ledger_entries" ON public.ledger_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon delete ledger_entries" ON public.ledger_entries'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;

  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon read payment_requests" ON public.payment_requests'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon insert payment_requests" ON public.payment_requests'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;

  -- Add similar DROPs for other demo policies (complaints, staff, parking_slots, documents, notification_logs)
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon all complaints" ON public.complaints'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon all staff" ON public.staff'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon all parking_slots" ON public.parking_slots'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon all documents" ON public.documents'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS "Demo anon all notification_logs" ON public.notification_logs'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip'; END;
END $$;

-- Tighten execute privileges for SECURITY DEFINER functions created in accounting phase.
REVOKE EXECUTE ON FUNCTION public.fn_finance_to_journal() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fn_finance_to_journal() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_map_category_to_account(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fn_map_category_to_account(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_trial_balance(date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fn_trial_balance(date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_profit_loss(date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fn_profit_loss(date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_balance_sheet(date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fn_balance_sheet(date) TO authenticated;

-- Revoke any accidental public EXECUTE on trigger-only functions to be safe
REVOKE EXECUTE ON FUNCTION public.fn_finance_to_journal() FROM public;

-- Note: After applying this migration, ensure RLS policies are added/repaired to explicit authenticated role checks.
