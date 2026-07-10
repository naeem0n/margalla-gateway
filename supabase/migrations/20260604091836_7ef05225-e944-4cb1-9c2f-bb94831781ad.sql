DO $$
BEGIN
  PERFORM cron.unschedule('mgt-auto-backup-daily');
EXCEPTION WHEN others THEN NULL;
END $$;