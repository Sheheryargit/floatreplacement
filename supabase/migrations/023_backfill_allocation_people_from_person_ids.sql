-- Ensures allocation_people matches allocations.person_ids (idempotent).
-- Safe after CSV/import paths that populated person_ids without join rows, or stale embed joins.
--
-- Run via `supabase db push` / migrations, or paste into Dashboard SQL Editor once.

-- Only insert when person exists (avoids FK violation if person_ids stale after people were removed).
INSERT INTO public.allocation_people (allocation_id, person_id)
SELECT a.id, x.pid
FROM public.allocations a
CROSS JOIN LATERAL unnest(COALESCE(a.person_ids, '{}'::uuid[])) AS x(pid)
INNER JOIN public.people p ON p.id = x.pid
WHERE cardinality(COALESCE(a.person_ids, '{}'::uuid[])) > 0
ON CONFLICT DO NOTHING;
