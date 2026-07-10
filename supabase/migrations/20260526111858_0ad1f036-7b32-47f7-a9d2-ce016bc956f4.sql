
-- ============================================================
-- CONSOLIDATED MARGALLA GATEWAY SCHEMA
-- ============================================================

-- Enums
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'resident', 'partner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.finance_type AS ENUM ('credit', 'debit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.booking_status AS ENUM ('booked', 'checked_in', 'checked_out', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== PROFILES =====
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  apartment_no TEXT,
  client_id TEXT UNIQUE,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  reward_points INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  extra_parking_spots INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== USER ROLES =====
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profile policies
DROP POLICY IF EXISTS "Profiles viewable by owner" ON public.profiles;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Profiles updatable by owner" ON public.profiles;
CREATE POLICY "Profiles updatable by owner" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Profiles insertable by owner" ON public.profiles;
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- New user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'resident')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Client id
CREATE SEQUENCE IF NOT EXISTS public.client_id_seq START 1000;
CREATE OR REPLACE FUNCTION public.generate_client_id(_prefix text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint;
BEGIN n := nextval('public.client_id_seq'); RETURN upper(_prefix) || '-' || lpad(n::text, 5, '0'); END;
$$;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ===== FINANCE =====
CREATE TABLE IF NOT EXISTS public.finance_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  category TEXT,
  type public.finance_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  receipt_url TEXT,
  balance_after NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID,
  resident_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins and staff view finance" ON public.finance_entries;
CREATE POLICY "Admins and staff view finance" ON public.finance_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Admins and staff insert finance" ON public.finance_entries;
CREATE POLICY "Admins and staff insert finance" ON public.finance_entries FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Admins and staff update finance" ON public.finance_entries;
CREATE POLICY "Admins and staff update finance" ON public.finance_entries FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Admins delete finance" ON public.finance_entries;
CREATE POLICY "Admins delete finance" ON public.finance_entries FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_finance_updated_at ON public.finance_entries;
CREATE TRIGGER trg_finance_updated_at BEFORE UPDATE ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== ANNOUNCEMENTS =====
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone signed-in can view active announcements" ON public.announcements;
CREATE POLICY "Anyone signed-in can view active announcements" ON public.announcements FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Admins/staff insert announcements" ON public.announcements;
CREATE POLICY "Admins/staff insert announcements" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Admins/staff update announcements" ON public.announcements;
CREATE POLICY "Admins/staff update announcements" ON public.announcements FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Admins delete announcements" ON public.announcements;
CREATE POLICY "Admins delete announcements" ON public.announcements FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS announcements_updated_at ON public.announcements;
CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== SITE CONTENT =====
CREATE TABLE IF NOT EXISTS public.site_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view site content" ON public.site_content;
CREATE POLICY "Anyone can view site content" ON public.site_content FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage site content" ON public.site_content;
CREATE POLICY "Admins manage site content" ON public.site_content FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ===== DAILY BOOKINGS =====
CREATE TABLE IF NOT EXISTS public.daily_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_no text NOT NULL,
  guest_name text NOT NULL,
  guest_phone text,
  check_in_date date NOT NULL,
  check_in_time time NOT NULL DEFAULT '14:00',
  check_out_date date NOT NULL,
  check_out_time time NOT NULL DEFAULT '12:00',
  nights integer NOT NULL DEFAULT 1,
  rate_per_night numeric NOT NULL DEFAULT 0,
  extra_parking_spots integer NOT NULL DEFAULT 0,
  parking_charge_per_day numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status booking_status NOT NULL DEFAULT 'booked',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Residents view own bookings" ON public.daily_bookings;
CREATE POLICY "Residents view own bookings" ON public.daily_bookings FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Authenticated insert bookings" ON public.daily_bookings;
CREATE POLICY "Authenticated insert bookings" ON public.daily_bookings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')
    OR (created_by = auth.uid() AND rate_per_night = 0 AND parking_charge_per_day = 0 AND total_amount = 0));
DROP POLICY IF EXISTS "Owner or staff update bookings" ON public.daily_bookings;
CREATE POLICY "Owner or staff update bookings" ON public.daily_bookings FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Owner or admin delete bookings" ON public.daily_bookings;
CREATE POLICY "Owner or admin delete bookings" ON public.daily_bookings FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS daily_bookings_set_updated_at ON public.daily_bookings;
CREATE TRIGGER daily_bookings_set_updated_at BEFORE UPDATE ON public.daily_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PHASE 1: OPERATIONS TABLES
-- ============================================================

-- STAFF
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role text NOT NULL,
  phone text,
  cnic text,
  salary numeric(12,2) NOT NULL DEFAULT 0,
  join_date date DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/staff read staff" ON public.staff FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Admin write staff" ON public.staff FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_staff BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- APARTMENTS
CREATE TABLE IF NOT EXISTS public.apartments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  floor int,
  type text,
  bedrooms int DEFAULT 1,
  rent numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  tenant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read apartments" ON public.apartments FOR SELECT USING (true);
CREATE POLICY "Admin/staff write apartments" ON public.apartments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE TRIGGER touch_apartments BEFORE UPDATE ON public.apartments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PARKING
CREATE TABLE IF NOT EXISTS public.parking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_no text NOT NULL UNIQUE,
  vehicle_no text,
  vehicle_type text,
  owner_name text,
  apartment_id uuid REFERENCES public.apartments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available',
  monthly_fee numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.parking_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read parking" ON public.parking_slots FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff write parking" ON public.parking_slots FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- VISITORS
CREATE TABLE IF NOT EXISTS public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name text NOT NULL,
  cnic text,
  phone text,
  apartment_no text,
  host_name text,
  purpose text,
  in_time timestamptz DEFAULT now(),
  out_time timestamptz,
  vehicle_no text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read visitors" ON public.visitors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff write visitors" ON public.visitors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- COMPLAINTS
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_no text,
  resident_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  resolution text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Resident sees own complaints" ON public.complaints FOR SELECT TO authenticated
  USING (resident_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Resident creates own complaints" ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (resident_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff updates complaints" ON public.complaints FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Admin delete complaints" ON public.complaints FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_complaints BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LEDGER
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type text NOT NULL,
  account_id uuid NOT NULL,
  account_label text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  debit numeric(12,2) NOT NULL DEFAULT 0,
  credit numeric(12,2) NOT NULL DEFAULT 0,
  reference text,
  category text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON public.ledger_entries (account_type, account_id, entry_date);
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read all ledger" ON public.ledger_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Resident reads own ledger" ON public.ledger_entries FOR SELECT TO authenticated
  USING (account_type = 'tenant' AND account_id = auth.uid());
CREATE POLICY "Staff write ledger" ON public.ledger_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_id uuid,
  title text NOT NULL,
  doc_type text,
  file_path text NOT NULL,
  file_size int,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read documents" ON public.documents FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Resident reads own docs" ON public.documents FOR SELECT TO authenticated
  USING (owner_type = 'tenant' AND owner_id = auth.uid());
CREATE POLICY "Staff write documents" ON public.documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('site-assets', 'site-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Receipts viewable by authenticated" ON storage.objects;
CREATE POLICY "Receipts viewable by authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));
DROP POLICY IF EXISTS "Admins and staff upload receipts" ON storage.objects;
CREATE POLICY "Admins and staff upload receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));

DROP POLICY IF EXISTS "Staff read documents bucket" ON storage.objects;
CREATE POLICY "Staff read documents bucket" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));
DROP POLICY IF EXISTS "Staff upload documents bucket" ON storage.objects;
CREATE POLICY "Staff upload documents bucket" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));
DROP POLICY IF EXISTS "Staff delete documents bucket" ON storage.objects;
CREATE POLICY "Staff delete documents bucket" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));

DROP POLICY IF EXISTS "Public read site-assets" ON storage.objects;
CREATE POLICY "Public read site-assets" ON storage.objects FOR SELECT USING (bucket_id = 'site-assets');
DROP POLICY IF EXISTS "Admins upload site-assets" ON storage.objects;
CREATE POLICY "Admins upload site-assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND has_role(auth.uid(), 'admin'));

-- update_resident_stats helper used by directory page
CREATE OR REPLACE FUNCTION public.update_resident_stats(uid UUID, p_change INTEGER, w_change INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.profiles SET reward_points = GREATEST(0, reward_points + p_change),
    warning_count = GREATEST(0, warning_count + w_change) WHERE id = uid;
END;
$$;
REVOKE ALL ON FUNCTION public.update_resident_stats(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_resident_stats(uuid, integer, integer) TO authenticated;
