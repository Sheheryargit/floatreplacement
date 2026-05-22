-- Backfill allocation_people from allocations.person_ids (idempotent).
-- Supabase Dashboard → SQL → paste & run.

-- Only pairs where person exists and is not archived (matches FK people.id).
INSERT INTO public.allocation_people (allocation_id, person_id)
SELECT a.id, x.pid
FROM public.allocations a
CROSS JOIN LATERAL unnest(COALESCE(a.person_ids, '{}'::uuid[])) AS x(pid)
INNER JOIN public.people p ON p.id = x.pid
WHERE cardinality(COALESCE(a.person_ids, '{}'::uuid[])) > 0
ON CONFLICT DO NOTHING;

-- Diagnostics: phantom person_ids (UUID not present in people at all — re-import or delete allocations).
-- SELECT a.id, a.start_date, a.project_label, x.pid AS missing_person_id
-- FROM public.allocations a
-- CROSS JOIN LATERAL unnest(COALESCE(a.person_ids, '{}'::uuid[])) AS x(pid)
-- LEFT JOIN public.people p ON p.id = x.pid
-- WHERE cardinality(COALESCE(a.person_ids, '{}'::uuid[])) > 0
--   AND p.id IS NULL;
