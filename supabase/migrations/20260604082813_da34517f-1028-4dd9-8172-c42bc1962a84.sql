
-- 1. Remove CRM module
DROP TABLE IF EXISTS public.crm_leads CASCADE;

-- 2. Audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY "Admin read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS audit_logs_table_created_idx
  ON public.audit_logs(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx
  ON public.audit_logs(user_id, created_at DESC);

-- 3. Generic trigger function
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid text;
BEGIN
  BEGIN
    rid := COALESCE((NEW).id::text, (OLD).id::text);
  EXCEPTION WHEN others THEN
    rid := NULL;
  END;
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

-- 4. Attach trigger to key tables
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

-- 5. Schedule daily automatic cloud backup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule prior if exists
DO $$
BEGIN
  PERFORM cron.unschedule('mgt-auto-backup-daily');
EXCEPTION WHEN others THEN NULL;
END $$;

SELECT cron.schedule(
  'mgt-auto-backup-daily',
  '30 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--102ae039-3aae-42a7-9733-5705608c47dc.lovable.app/api/public/auto-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bmtleWV3eG9mdWNsZHNya2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA0MjEsImV4cCI6MjA5NTM2NjQyMX0.Xxxxw_VYNGYijAPWp4zdywYJAJe5TAEdjXmhFFiTFzY'
    ),
    body := jsonb_build_object('trigger','daily_cron')
  );
  $cron$
);
