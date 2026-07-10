-- Migration: RLS + policies for residence and gate_logs
-- Disable any loose global access if active

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.residence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gate_logs ENABLE ROW LEVEL SECURITY;

-- Drop any known overly-permissive policies (no-op if absent)
DROP POLICY IF EXISTS "Public access" ON public.residence;
DROP POLICY IF EXISTS "Allow all" ON public.residence;
DROP POLICY IF EXISTS "Demo anon all residence" ON public.residence;

DROP POLICY IF EXISTS "Public access" ON public.gate_logs;
DROP POLICY IF EXISTS "Allow all" ON public.gate_logs;
DROP POLICY IF EXISTS "Demo anon all gate_logs" ON public.gate_logs;

-- ==========================================
-- 1. RESIDENCE TABLE POLICIES
-- ==========================================

-- POLICY: Admin has complete unrestricted access (Total Control)
DROP POLICY IF EXISTS admin_all_residence ON public.residence;
CREATE POLICY admin_all_residence ON public.residence
    FOR ALL
    TO authenticated
    USING ((auth.jwt() ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- POLICY: Public / Desktop App can only view active residences
DROP POLICY IF EXISTS public_read_residence ON public.residence;
CREATE POLICY public_read_residence ON public.residence
    FOR SELECT
    TO anon, authenticated
    USING (status = 'active');


-- ==========================================
-- 2. GATE LOGS (MARGALLA GATEWAY CLIENTS)
-- ==========================================

-- POLICY: Admin can audit, delete, and modify all logs
DROP POLICY IF EXISTS admin_all_gate_logs ON public.gate_logs;
CREATE POLICY admin_all_gate_logs ON public.gate_logs
    FOR ALL
    TO authenticated
    USING ((auth.jwt() ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- POLICY: Desktop App / System can insert new logs on access scans
DROP POLICY IF EXISTS client_insert_gate_logs ON public.gate_logs;
CREATE POLICY client_insert_gate_logs ON public.gate_logs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Note: consider restricting INSERT to a signed client or service_role if possible.
