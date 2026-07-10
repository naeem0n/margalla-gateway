
-- Apartments: allow demo (anon) full access alongside existing admin/staff policies
CREATE POLICY "Demo anon read apartments" ON public.apartments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo anon insert apartments" ON public.apartments
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo anon update apartments" ON public.apartments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Demo anon delete apartments" ON public.apartments
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apartments TO anon, authenticated;

-- Daily bookings: allow demo (anon) full access
CREATE POLICY "Demo anon read daily_bookings" ON public.daily_bookings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo anon insert daily_bookings" ON public.daily_bookings
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Demo anon update daily_bookings" ON public.daily_bookings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Demo anon delete daily_bookings" ON public.daily_bookings
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_bookings TO anon, authenticated;
