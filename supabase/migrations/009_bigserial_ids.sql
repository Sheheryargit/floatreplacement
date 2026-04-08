-- Migration 009: Server-generated IDs via sequences (no client max(id)+1).
-- Run in Supabase SQL editor after deploy. Safe to re-run: IF NOT EXISTS on sequences.

-- allocations
CREATE SEQUENCE IF NOT EXISTS allocations_id_seq;
SELECT setval(
  'allocations_id_seq',
  COALESCE((SELECT MAX(id) FROM allocations), 0) + 1,
  false
);
ALTER TABLE allocations ALTER COLUMN id SET DEFAULT nextval('allocations_id_seq');
ALTER SEQUENCE allocations_id_seq OWNED BY allocations.id;

-- people
CREATE SEQUENCE IF NOT EXISTS people_id_seq;
SELECT setval(
  'people_id_seq',
  COALESCE((SELECT MAX(id) FROM people), 0) + 1,
  false
);
ALTER TABLE people ALTER COLUMN id SET DEFAULT nextval('people_id_seq');
ALTER SEQUENCE people_id_seq OWNED BY people.id;

-- projects
CREATE SEQUENCE IF NOT EXISTS projects_id_seq;
SELECT setval(
  'projects_id_seq',
  COALESCE((SELECT MAX(id) FROM projects), 0) + 1,
  false
);
ALTER TABLE projects ALTER COLUMN id SET DEFAULT nextval('projects_id_seq');
ALTER SEQUENCE projects_id_seq OWNED BY projects.id;
