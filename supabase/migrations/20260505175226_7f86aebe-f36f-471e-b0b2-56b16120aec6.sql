-- Finance entry type enum
CREATE TYPE public.finance_type AS ENUM ('credit', 'debit');

-- Finance entries table
CREATE TABLE public.finance_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  category TEXT,
  type public.finance_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  receipt_url TEXT,
  balance_after NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_entries_date ON public.finance_entries(entry_date DESC, created_at DESC);

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff view finance"
  ON public.finance_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff insert finance"
  ON public.finance_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff update finance"
  ON public.finance_entries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins delete finance"
  ON public.finance_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_finance_updated_at
  BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Receipts publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

CREATE POLICY "Admins and staff upload receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts' AND
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Admins and staff update receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts' AND
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Admins delete receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin')
  );