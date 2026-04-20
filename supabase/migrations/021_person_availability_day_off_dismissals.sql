-- Hide a single weekly-repeating "Off" occurrence for one person on one date.
-- Mirrors migration 019 (person_public_holiday_dismissals): the underlying
-- avail_off:<person>:<dow> allocation row is the source of truth for the weekly
-- pattern; this table records per-date exceptions the user X'd out on the timeline.
CREATE TABLE IF NOT EXISTS public.person_availability_day_off_dismissals (
  person_id uuid NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  slot_dow smallint NOT NULL CHECK (slot_dow BETWEEN 1 AND 5),
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, occurrence_date, slot_dow)
);

CREATE INDEX IF NOT EXISTS idx_pado_dismissals_person
  ON public.person_availability_day_off_dismissals (person_id);

COMMENT ON TABLE public.person_availability_day_off_dismissals IS
  'Per-date dismissals of the weekly "off day" availability block. Remove a row here to restore the block.';

GRANT SELECT, INSERT, DELETE ON public.person_availability_day_off_dismissals
  TO anon, authenticated;

ALTER TABLE public.person_availability_day_off_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pado_dismissals_select" ON public.person_availability_day_off_dismissals;
DROP POLICY IF EXISTS "pado_dismissals_insert" ON public.person_availability_day_off_dismissals;
DROP POLICY IF EXISTS "pado_dismissals_delete" ON public.person_availability_day_off_dismissals;

CREATE POLICY "pado_dismissals_select"
  ON public.person_availability_day_off_dismissals
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "pado_dismissals_insert"
  ON public.person_availability_day_off_dismissals
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "pado_dismissals_delete"
  ON public.person_availability_day_off_dismissals
  FOR DELETE
  TO anon, authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
