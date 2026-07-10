
ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS area_sqft integer,
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rent_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS security_deposit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agreement_url text,
  ADD COLUMN IF NOT EXISTS cnic text,
  ADD COLUMN IF NOT EXISTS email text;

-- Allow admin to delete profiles
DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert profiles (for adding tenants manually)
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
CREATE POLICY "Admins insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage policies for site-assets (public) and documents (private)
DROP POLICY IF EXISTS "Staff write site assets" ON storage.objects;
CREATE POLICY "Staff write site assets" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'site-assets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')))
  WITH CHECK (bucket_id = 'site-assets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

DROP POLICY IF EXISTS "Public read site assets" ON storage.objects;
CREATE POLICY "Public read site assets" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "Staff manage documents" ON storage.objects;
CREATE POLICY "Staff manage documents" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')))
  WITH CHECK (bucket_id = 'documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));

DROP POLICY IF EXISTS "Resident reads own documents storage" ON storage.objects;
CREATE POLICY "Resident reads own documents storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
