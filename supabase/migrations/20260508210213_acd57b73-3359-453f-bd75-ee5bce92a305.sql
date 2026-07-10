REVOKE ALL ON FUNCTION public.update_resident_stats(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_resident_stats(UUID, INTEGER, INTEGER) TO authenticated;