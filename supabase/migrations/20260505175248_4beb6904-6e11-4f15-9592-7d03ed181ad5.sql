CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP POLICY IF EXISTS "Receipts publicly viewable" ON storage.objects;

CREATE POLICY "Receipts viewable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts' AND
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );