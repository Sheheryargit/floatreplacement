-- Fix: after UUID migration, legacy_person_id in person_public_holidays must be nullable.
-- New rows are keyed by person_id (uuid) and no longer need a legacy bigint id.

ALTER TABLE public.person_public_holidays
  ALTER COLUMN legacy_person_id DROP NOT NULL;

-- Optional: keep legacy ids unique-ish per person/date/name when present.
CREATE INDEX IF NOT EXISTS idx_person_public_holidays_legacy_person
  ON public.person_public_holidays (legacy_person_id)
  WHERE legacy_person_id IS NOT NULL;

