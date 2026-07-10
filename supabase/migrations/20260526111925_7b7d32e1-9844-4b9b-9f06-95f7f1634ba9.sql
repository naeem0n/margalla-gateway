
-- Lock down trigger-only & internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_client_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_client_id(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Restrict listing of public site-assets bucket (CDN access by direct URL still works)
DROP POLICY IF EXISTS "Public read site-assets" ON storage.objects;
CREATE POLICY "Admins list site-assets" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'site-assets' AND has_role(auth.uid(), 'admin'));
