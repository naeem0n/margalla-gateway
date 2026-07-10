
-- 1. Apartments
DROP POLICY IF EXISTS "Anyone read apartments" ON public.apartments;

CREATE OR REPLACE VIEW public.apartments_public
WITH (security_invoker = on) AS
SELECT id, number, type, floor, bedrooms, area_sqft, description, media_urls, status
FROM public.apartments;
GRANT SELECT ON public.apartments_public TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated read apartments basic" ON public.apartments;
CREATE POLICY "Authenticated read apartments basic"
ON public.apartments FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- 2. Profiles update restriction
DROP POLICY IF EXISTS "Profiles updatable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updatable by owner safe cols" ON public.profiles;
CREATE POLICY "Profiles updatable by owner safe cols"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND rent_amount       = (SELECT rent_amount       FROM public.profiles WHERE id = auth.uid())
  AND security_deposit  = (SELECT security_deposit  FROM public.profiles WHERE id = auth.uid())
  AND reward_points     = (SELECT reward_points     FROM public.profiles WHERE id = auth.uid())
  AND warning_count     = (SELECT warning_count     FROM public.profiles WHERE id = auth.uid())
  AND is_approved       = (SELECT is_approved       FROM public.profiles WHERE id = auth.uid())
  AND extra_parking_spots = (SELECT extra_parking_spots FROM public.profiles WHERE id = auth.uid())
  AND client_id IS NOT DISTINCT FROM (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  AND cnic      IS NOT DISTINCT FROM (SELECT cnic      FROM public.profiles WHERE id = auth.uid())
  AND apartment_no IS NOT DISTINCT FROM (SELECT apartment_no FROM public.profiles WHERE id = auth.uid())
  AND agreement_url IS NOT DISTINCT FROM (SELECT agreement_url FROM public.profiles WHERE id = auth.uid())
);

-- 3. Receipts storage policies
DROP POLICY IF EXISTS "Residents read own receipts" ON storage.objects;
CREATE POLICY "Residents read own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Residents upload own receipts" ON storage.objects;
CREATE POLICY "Residents upload own receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Move pg_net out of public schema (drop + recreate in extensions schema)
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
