
-- Allow residents to pre-register their own visitors and view them
CREATE POLICY "Residents pre-register visitors"
ON public.visitors
FOR INSERT TO authenticated
WITH CHECK (
  apartment_no IS NOT NULL
  AND apartment_no = (SELECT apartment_no FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Residents view own visitors"
ON public.visitors
FOR SELECT TO authenticated
USING (
  apartment_no IS NOT NULL
  AND apartment_no = (SELECT apartment_no FROM public.profiles WHERE id = auth.uid())
);

-- Payment requests: residents upload a receipt; admins review and mark paid
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'bank_transfer',
  reference text,
  receipt_path text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents insert own payment requests"
ON public.payment_requests FOR INSERT TO authenticated
WITH CHECK (resident_id = auth.uid());

CREATE POLICY "Residents view own payment requests"
ON public.payment_requests FOR SELECT TO authenticated
USING (resident_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin/staff update payment requests"
ON public.payment_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin delete payment requests"
ON public.payment_requests FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
