-- 1. Replace the public apartment listing view with a dedicated safe table.
DROP VIEW IF EXISTS public.apartments_public;

CREATE TABLE IF NOT EXISTS public.apartments_public (
  id uuid PRIMARY KEY,
  number text NOT NULL,
  type text,
  floor integer,
  bedrooms integer,
  area_sqft integer,
  rent numeric NOT NULL DEFAULT 0,
  description text,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL
);

GRANT SELECT ON public.apartments_public TO anon, authenticated;
GRANT ALL ON public.apartments_public TO service_role;

ALTER TABLE public.apartments_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public apartment listings" ON public.apartments_public;
CREATE POLICY "Anyone can view public apartment listings"
ON public.apartments_public
FOR SELECT
TO anon, authenticated
USING (status IN ('available', 'reserved', 'maintenance'));

CREATE OR REPLACE FUNCTION public.sync_apartments_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.apartments_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status IN ('available', 'reserved', 'maintenance') THEN
    INSERT INTO public.apartments_public (
      id, number, type, floor, bedrooms, area_sqft, rent, description, media_urls, status
    ) VALUES (
      NEW.id, NEW.number, NEW.type, NEW.floor, NEW.bedrooms, NEW.area_sqft,
      NEW.rent, NEW.description, COALESCE(NEW.media_urls, '[]'::jsonb), NEW.status
    )
    ON CONFLICT (id) DO UPDATE SET
      number = EXCLUDED.number,
      type = EXCLUDED.type,
      floor = EXCLUDED.floor,
      bedrooms = EXCLUDED.bedrooms,
      area_sqft = EXCLUDED.area_sqft,
      rent = EXCLUDED.rent,
      description = EXCLUDED.description,
      media_urls = EXCLUDED.media_urls,
      status = EXCLUDED.status;
  ELSE
    DELETE FROM public.apartments_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_apartments_public() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_sync_apartments_public ON public.apartments;
CREATE TRIGGER trg_sync_apartments_public
AFTER INSERT OR UPDATE OR DELETE ON public.apartments
FOR EACH ROW EXECUTE FUNCTION public.sync_apartments_public();

INSERT INTO public.apartments_public (
  id, number, type, floor, bedrooms, area_sqft, rent, description, media_urls, status
)
SELECT id, number, type, floor, bedrooms, area_sqft, rent, description, COALESCE(media_urls, '[]'::jsonb), status
FROM public.apartments
WHERE status IN ('available', 'reserved', 'maintenance')
ON CONFLICT (id) DO UPDATE SET
  number = EXCLUDED.number,
  type = EXCLUDED.type,
  floor = EXCLUDED.floor,
  bedrooms = EXCLUDED.bedrooms,
  area_sqft = EXCLUDED.area_sqft,
  rent = EXCLUDED.rent,
  description = EXCLUDED.description,
  media_urls = EXCLUDED.media_urls,
  status = EXCLUDED.status;

-- 2. Prevent direct RPC-style execution of security-definer helpers by app users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_audit_log() FROM anon, authenticated, public;