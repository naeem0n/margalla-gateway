ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS resident_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_entries_resident ON public.finance_entries(resident_id);