-- Phase 2: indexes for common schedule queries.
-- Assumes allocations.person_ids is uuid[] (post-migration 009).

CREATE INDEX IF NOT EXISTS idx_allocations_start_date ON public.allocations (start_date);
CREATE INDEX IF NOT EXISTS idx_allocations_end_date ON public.allocations (end_date);
CREATE INDEX IF NOT EXISTS idx_allocations_person_ids_gin ON public.allocations USING gin (person_ids);

