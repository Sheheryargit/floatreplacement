-- Browser (anon / authenticated) must be able to SELECT materialized rows for the schedule.
-- Without a policy, RLS-on tables return no rows; without GRANT, PostgREST returns permission denied.

GRANT SELECT ON public.person_public_holidays TO anon, authenticated;

ALTER TABLE public.person_public_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_public_holidays_select_all" ON public.person_public_holidays;

CREATE POLICY "person_public_holidays_select_all"
  ON public.person_public_holidays
  FOR SELECT
  TO anon, authenticated
  USING (true);
