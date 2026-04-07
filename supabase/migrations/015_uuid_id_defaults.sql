-- Fix: UUID primary keys must have server-side defaults for inserts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.people
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.projects
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.allocations
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

