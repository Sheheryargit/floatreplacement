-- User-dismissed public holidays (synthetic calendar rows hidden from schedule until restored).
-- Survives catalog refresh; distinct from deleting a row in person_public_holidays (which is regenerated).

CREATE TABLE IF NOT EXISTS public.person_public_holiday_dismissals (
  person_id uuid NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, holiday_date, name)
);

CREATE INDEX IF NOT EXISTS idx_pph_dismissals_person ON public.person_public_holiday_dismissals (person_id);

COMMENT ON TABLE public.person_public_holiday_dismissals IS 'Hides a materialized or static public holiday for one person (schedule UI delete).';

GRANT SELECT, INSERT, DELETE ON public.person_public_holiday_dismissals TO anon, authenticated;

ALTER TABLE public.person_public_holiday_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_public_holiday_dismissals_select" ON public.person_public_holiday_dismissals;

DROP POLICY IF EXISTS "person_public_holiday_dismissals_insert" ON public.person_public_holiday_dismissals;

DROP POLICY IF EXISTS "person_public_holiday_dismissals_delete" ON public.person_public_holiday_dismissals;

CREATE POLICY "person_public_holiday_dismissals_select"
  ON public.person_public_holiday_dismissals
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "person_public_holiday_dismissals_insert"
  ON public.person_public_holiday_dismissals
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "person_public_holiday_dismissals_delete"
  ON public.person_public_holiday_dismissals
  FOR DELETE
  TO anon, authenticated
  USING (true);
