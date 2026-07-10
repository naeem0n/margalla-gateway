
CREATE TYPE booking_status AS ENUM ('booked', 'checked_in', 'checked_out', 'cancelled');

CREATE TABLE public.daily_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_no text NOT NULL,
  guest_name text NOT NULL,
  guest_phone text,
  check_in_date date NOT NULL,
  check_in_time time NOT NULL DEFAULT '14:00',
  check_out_date date NOT NULL,
  check_out_time time NOT NULL DEFAULT '12:00',
  nights integer NOT NULL DEFAULT 1,
  rate_per_night numeric NOT NULL DEFAULT 0,
  extra_parking_spots integer NOT NULL DEFAULT 0,
  parking_charge_per_day numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status booking_status NOT NULL DEFAULT 'booked',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents view own bookings"
ON public.daily_bookings FOR SELECT TO authenticated
USING (created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Authenticated insert bookings"
ON public.daily_bookings FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owner or staff update bookings"
ON public.daily_bookings FOR UPDATE TO authenticated
USING (created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owner or admin delete bookings"
ON public.daily_bookings FOR DELETE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER daily_bookings_set_updated_at
BEFORE UPDATE ON public.daily_bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Restrict who can change status to admin/staff
CREATE OR REPLACE FUNCTION public.restrict_booking_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
     AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Only admin/staff can change booking status (residents may only cancel)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_bookings_restrict_status
BEFORE UPDATE ON public.daily_bookings
FOR EACH ROW EXECUTE FUNCTION public.restrict_booking_status_change();

REVOKE EXECUTE ON FUNCTION public.restrict_booking_status_change() FROM PUBLIC, anon, authenticated;
