
-- 1. Apartments: hide sensitive columns (tenant_id, notes) from anonymous users via column-level GRANT
REVOKE SELECT ON public.apartments FROM anon;
GRANT SELECT (id, number, floor, type, bedrooms, area_sqft, description, media_urls, status, rent, created_at, updated_at) ON public.apartments TO anon;

-- 2. daily_bookings: prevent residents from escalating financial fields on UPDATE
DROP POLICY IF EXISTS "Owner or staff update bookings" ON public.daily_bookings;
CREATE POLICY "Owner or staff update bookings"
ON public.daily_bookings
FOR UPDATE
TO authenticated
USING (
  (created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
)
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

-- 3. user_roles: explicit restrictive policy so only admins can INSERT/UPDATE/DELETE
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from clients (keep service_role)
REVOKE EXECUTE ON FUNCTION public.generate_client_id(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_resident_stats(uuid, integer, integer) FROM PUBLIC, anon, authenticated;

-- 5. Storage: remove broad public listing policy on site-assets.
-- Public bucket files remain accessible via their public object URLs; only API listing is blocked.
DROP POLICY IF EXISTS "Public read site assets" ON storage.objects;
