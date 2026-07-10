ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS reward_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_parking_spots INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_resident_stats(uid UUID, p_change INTEGER, w_change INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins/staff can adjust resident stats
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET
    reward_points = GREATEST(0, reward_points + p_change),
    warning_count = GREATEST(0, warning_count + w_change)
  WHERE id = uid;
END;
$$;