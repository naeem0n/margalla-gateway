-- Migration: Revoke public EXECUTE on SECURITY DEFINER functions, enable RLS, and create strict policies

DO $$
DECLARE
    func_record RECORD;
    sql_command TEXT;
BEGIN
    FOR func_record IN 
        SELECT p.proname, n.nspname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosecdef = true  -- Only security definer functions
          AND n.nspname = 'public' -- Focus on public schema
    LOOP
        -- 1. Revoke execution from PUBLIC entirely
        sql_command := format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC;', func_record.proname, func_record.args);
        EXECUTE sql_command;

        -- 2. Grant to authenticated users (Frontend/App Users)
        sql_command := format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated;', func_record.proname, func_record.args);
        EXECUTE sql_command;

        -- 3. Grant to service_role (Admin bypass / backend scripts)
        sql_command := format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role;', func_record.proname, func_record.args);
        EXECUTE sql_command;
    END LOOP;
END $$;

-- Enable RLS on all critical tables
ALTER TABLE IF EXISTS public.finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- MASTER RULE: ADMIN HAS UNRESTRICTED ACCESS FOR ALL TABLES
-- =======================================================
-- Note: Replace 'admin' check if your JWT claims structure is different (e.g., matching a role table)
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS boolean AS $$
  SELECT (auth.jwt() ->> 'role' = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- =======================================================
-- 1. FINANCE & LEDGER (Strict Admin Control / Read Only for Users)
-- =======================================================
DROP POLICY IF EXISTS admin_all_finance ON public.finance_entries;
CREATE POLICY admin_all_finance ON public.finance_entries FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_read_own_finance ON public.finance_entries;
CREATE POLICY user_read_own_finance ON public.finance_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_all_ledger ON public.ledger_entries;
CREATE POLICY admin_all_ledger ON public.ledger_entries FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_read_own_ledger ON public.ledger_entries;
CREATE POLICY user_read_own_ledger ON public.ledger_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =======================================================
-- 2. PAYMENT REQUESTS & COMPLAINTS (Users Insert/Read Own, Admin Controls)
-- =======================================================
DROP POLICY IF EXISTS admin_all_payments ON public.payment_requests;
CREATE POLICY admin_all_payments ON public.payment_requests FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_manage_payments ON public.payment_requests;
CREATE POLICY user_manage_payments ON public.payment_requests FOR ALL TO authenticated 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_all_complaints ON public.complaints;
CREATE POLICY admin_all_complaints ON public.complaints FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_manage_complaints ON public.complaints;
CREATE POLICY user_manage_complaints ON public.complaints FOR ALL TO authenticated 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =======================================================
-- 3. STAFF & PARKING SLOTS (Public/App Read, Admin Manage)
-- =======================================================
DROP POLICY IF EXISTS admin_all_staff ON public.staff;
CREATE POLICY admin_all_staff ON public.staff FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_view_staff ON public.staff;
CREATE POLICY user_view_staff ON public.staff FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS admin_all_parking ON public.parking_slots;
CREATE POLICY admin_all_parking ON public.parking_slots FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_view_parking ON public.parking_slots;
CREATE POLICY user_view_parking ON public.parking_slots FOR SELECT TO authenticated USING (true);

-- =======================================================
-- 4. DOCUMENTS & NOTIFICATION LOGS
-- =======================================================
DROP POLICY IF EXISTS admin_all_docs ON public.documents;
CREATE POLICY admin_all_docs ON public.documents FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_view_shared_docs ON public.documents;
CREATE POLICY user_view_shared_docs ON public.documents FOR SELECT TO authenticated 
    USING (is_public = true OR auth.uid() = owner_id);

DROP POLICY IF EXISTS admin_all_notifications ON public.notification_logs;
CREATE POLICY admin_all_notifications ON public.notification_logs FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_view_own_notifications ON public.notification_logs;
CREATE POLICY user_view_own_notifications ON public.notification_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =======================================================
-- 5. PROFILES (Users Update Own, Admin Oversees)
-- =======================================================
DROP POLICY IF EXISTS admin_all_profiles ON public.profiles;
CREATE POLICY admin_all_profiles ON public.profiles FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS user_manage_profile ON public.profiles;
CREATE POLICY user_manage_profile ON public.profiles FOR ALL TO authenticated 
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- End migration
