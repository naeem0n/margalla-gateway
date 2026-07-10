
-- 1. Prevent privilege escalation via profile self-update
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
     OR NEW.warning_count IS DISTINCT FROM OLD.warning_count
     OR NEW.reward_points IS DISTINCT FROM OLD.reward_points
     OR NEW.extra_parking_spots IS DISTINCT FROM OLD.extra_parking_spots
     OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Not authorized to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2. Restrict listing of public site-assets bucket (CDN file access still works)
DROP POLICY IF EXISTS "Public read site-assets" ON storage.objects;
CREATE POLICY "Admins list site-assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Revoke execute on SECURITY DEFINER stats function from end users
REVOKE EXECUTE ON FUNCTION public.update_resident_stats(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
