-- After 021, Postgres may keep two overloads of save_allocation (old 15-arg + new 16-arg).
-- PostgREST then fails to resolve the RPC. Keep only the version that includes p_project_id.

DROP FUNCTION IF EXISTS public.save_allocation(
  uuid,
  integer,
  uuid[],
  text,
  text,
  numeric,
  numeric,
  integer,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text
);
