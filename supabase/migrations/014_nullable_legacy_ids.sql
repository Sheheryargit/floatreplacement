-- Fix: after UUID migration, legacy bigint ids should be nullable for new rows.
-- Otherwise inserts fail with "null value in column legacy_id violates not-null constraint".

ALTER TABLE public.people
  ALTER COLUMN legacy_id DROP NOT NULL;

ALTER TABLE public.projects
  ALTER COLUMN legacy_id DROP NOT NULL;

ALTER TABLE public.allocations
  ALTER COLUMN legacy_id DROP NOT NULL;

-- Optional: keep legacy ids unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS uq_people_legacy_id ON public.people (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_legacy_id ON public.projects (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_allocations_legacy_id ON public.allocations (legacy_id) WHERE legacy_id IS NOT NULL;

