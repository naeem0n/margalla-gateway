
-- 1. Revoke EXECUTE from anon/public on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_client_id(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.generate_client_id(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_resident_stats(uuid, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_resident_stats(uuid, integer, integer) TO authenticated;

-- Trigger-only functions: revoke from everyone (still runnable as triggers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_booking_status_change() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public, authenticated;

-- 2. Tighten daily_bookings INSERT so residents cannot set financial values
DROP POLICY IF EXISTS "Authenticated insert bookings" ON public.daily_bookings;

CREATE POLICY "Authenticated insert bookings"
ON public.daily_bookings
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR (
    created_by = auth.uid()
    AND rate_per_night = 0
    AND parking_charge_per_day = 0
    AND total_amount = 0
  )
);

-- Also prevent residents from updating financial fields on bookings they own
CREATE OR REPLACE FUNCTION public.restrict_booking_financial_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.rate_per_night IS DISTINCT FROM OLD.rate_per_night
     OR NEW.parking_charge_per_day IS DISTINCT FROM OLD.parking_charge_per_day
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
    RAISE EXCEPTION 'Only admin/staff can change booking financial fields';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_booking_financial_change() FROM anon, public, authenticated;

DROP TRIGGER IF EXISTS trg_restrict_booking_financial_change ON public.daily_bookings;
CREATE TRIGGER trg_restrict_booking_financial_change
BEFORE UPDATE ON public.daily_bookings
FOR EACH ROW
EXECUTE FUNCTION public.restrict_booking_financial_change();
