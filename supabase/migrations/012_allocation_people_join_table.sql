-- Phase 3: Normalize allocations.person_ids into join table for integrity.
-- This keeps allocations.person_ids (uuid[]) for backward compatibility for now,
-- but establishes real foreign keys + cascade deletes.

CREATE TABLE IF NOT EXISTS public.allocation_people (
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  PRIMARY KEY (allocation_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_allocation_people_person ON public.allocation_people (person_id);
CREATE INDEX IF NOT EXISTS idx_allocation_people_allocation ON public.allocation_people (allocation_id);

-- Backfill from allocations.person_ids if join table is empty.
INSERT INTO public.allocation_people (allocation_id, person_id)
SELECT a.id, pid
FROM public.allocations a,
LATERAL unnest(COALESCE(a.person_ids, '{}'::uuid[])) AS pid
WHERE NOT EXISTS (SELECT 1 FROM public.allocation_people ap LIMIT 1)
ON CONFLICT DO NOTHING;

