-- 1. Safe apartment listings view: expose only marketing-safe fields, never tenant_id or notes.
DROP VIEW IF EXISTS public.apartments_public;
CREATE VIEW public.apartments_public
WITH (security_barrier = true) AS
SELECT
  id,
  number,
  type,
  floor,
  bedrooms,
  area_sqft,
  rent,
  description,
  media_urls,
  status
FROM public.apartments
WHERE status IN ('available', 'reserved', 'maintenance');

GRANT SELECT ON public.apartments_public TO anon, authenticated;

-- Keep the base apartments table restricted to staff/admin only.
DROP POLICY IF EXISTS "Authenticated read apartments basic" ON public.apartments;
CREATE POLICY "Authenticated read apartments basic"
ON public.apartments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- 2. Residents can read only their own finance entries.
DROP POLICY IF EXISTS "Residents view own finance entries" ON public.finance_entries;
CREATE POLICY "Residents view own finance entries"
ON public.finance_entries
FOR SELECT
TO authenticated
USING (resident_id = auth.uid());

-- 3. Restore database-triggered audit logging for all application table writes.
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
  rid text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  rid := row_data ->> 'id';

  INSERT INTO public.audit_logs(table_name, record_id, action, old_data, new_data, user_id)
  VALUES (
    TG_TABLE_NAME,
    rid,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'profiles','user_roles','apartments','parking_slots','staff',
    'complaints','visitors','announcements','documents',
    'finance_entries','ledger_entries','payment_requests',
    'daily_bookings','notification_templates','notification_logs','site_content'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log()',
      t, t
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.audit_logs IS 'Audit entries are written automatically by SECURITY DEFINER triggers. Direct user inserts remain blocked by RLS.';