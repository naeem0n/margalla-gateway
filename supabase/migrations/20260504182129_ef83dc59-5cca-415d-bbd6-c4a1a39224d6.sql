-- Add client_id column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id text UNIQUE;

-- Sequence for numeric portion
CREATE SEQUENCE IF NOT EXISTS public.client_id_seq START 1000;

-- Helper to generate a client id given a role prefix
CREATE OR REPLACE FUNCTION public.generate_client_id(_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('public.client_id_seq');
  RETURN upper(_prefix) || '-' || lpad(n::text, 5, '0');
END;
$$;

-- Allow admins to view all profiles (so admin panel can list/assign)
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
