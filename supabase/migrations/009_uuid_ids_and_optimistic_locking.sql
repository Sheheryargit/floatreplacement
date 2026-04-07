-- Phase 1: UUID primary keys + optimistic locking.
--
-- This migration converts core tables from bigint PKs to UUID PKs while preserving the old bigint ids
-- in legacy_* columns for data migration and debugging.
--
-- IMPORTANT:
-- - Run in a maintenance window.
-- - Take a backup first.
-- - If you have external clients relying on bigint ids, update them before applying.
--
-- Requires pgcrypto for gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- people: bigint id -> uuid id (keep legacy_id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS id_uuid uuid;

UPDATE public.people
SET id_uuid = gen_random_uuid()
WHERE id_uuid IS NULL;

ALTER TABLE public.people
  ALTER COLUMN id_uuid SET NOT NULL;

-- Swap primary key to uuid.
-- Drop dependent FKs first (person_public_holidays -> people).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'person_public_holidays_person_id_fkey'
      AND conrelid = 'public.person_public_holidays'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.person_public_holidays DROP CONSTRAINT person_public_holidays_person_id_fkey';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'people_pkey'
      AND conrelid = 'public.people'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.people DROP CONSTRAINT people_pkey';
  END IF;
END $$;

ALTER TABLE public.people
  ADD CONSTRAINT people_pkey PRIMARY KEY (id_uuid);

-- Preserve old bigint ids
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'people'
      AND column_name = 'legacy_id'
  ) THEN
    -- already migrated
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.people RENAME COLUMN id TO legacy_id';
  EXECUTE 'ALTER TABLE public.people RENAME COLUMN id_uuid TO id';
END $$;

-- Ensure updated_at exists and is maintained.
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- projects: bigint id -> uuid id (keep legacy_id), team_ids bigint[] -> uuid[]
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS id_uuid uuid;

UPDATE public.projects
SET id_uuid = gen_random_uuid()
WHERE id_uuid IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN id_uuid SET NOT NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS team_ids_uuid uuid[] DEFAULT '{}'::uuid[];

-- Backfill team_ids_uuid from legacy team_ids via people.legacy_id
UPDATE public.projects pr
SET team_ids_uuid = COALESCE((
  SELECT array_agg(p.id ORDER BY p.legacy_id)
  FROM public.people p
  WHERE p.legacy_id = ANY (pr.team_ids)
), '{}'::uuid[]);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_pkey'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.projects DROP CONSTRAINT projects_pkey';
  END IF;
END $$;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_pkey PRIMARY KEY (id_uuid);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'legacy_id'
  ) THEN
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.projects RENAME COLUMN id TO legacy_id';
  EXECUTE 'ALTER TABLE public.projects RENAME COLUMN id_uuid TO id';
  EXECUTE 'ALTER TABLE public.projects RENAME COLUMN team_ids TO legacy_team_ids';
  EXECUTE 'ALTER TABLE public.projects RENAME COLUMN team_ids_uuid TO team_ids';
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- allocations: bigint id -> uuid id (keep legacy_id), person_ids bigint[] -> uuid[]
-- Add optimistic locking: version + updated_at bump trigger.
-- ---------------------------------------------------------------------------
ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS id_uuid uuid;

UPDATE public.allocations
SET id_uuid = gen_random_uuid()
WHERE id_uuid IS NULL;

ALTER TABLE public.allocations
  ALTER COLUMN id_uuid SET NOT NULL;

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS person_ids_uuid uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.allocations a
SET person_ids_uuid = COALESCE((
  SELECT array_agg(p.id ORDER BY p.legacy_id)
  FROM public.people p
  WHERE p.legacy_id = ANY (a.person_ids)
), '{}'::uuid[]);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'allocations_pkey'
      AND conrelid = 'public.allocations'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.allocations DROP CONSTRAINT allocations_pkey';
  END IF;
END $$;

ALTER TABLE public.allocations
  ADD CONSTRAINT allocations_pkey PRIMARY KEY (id_uuid);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'allocations'
      AND column_name = 'legacy_id'
  ) THEN
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.allocations RENAME COLUMN id TO legacy_id';
  EXECUTE 'ALTER TABLE public.allocations RENAME COLUMN id_uuid TO id';
  EXECUTE 'ALTER TABLE public.allocations RENAME COLUMN person_ids TO legacy_person_ids';
  EXECUTE 'ALTER TABLE public.allocations RENAME COLUMN person_ids_uuid TO person_ids';
END $$;

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.trg_allocations_bump_version_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_allocations_bump_version_updated_at ON public.allocations;
CREATE TRIGGER trg_allocations_bump_version_updated_at
  BEFORE UPDATE ON public.allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_allocations_bump_version_updated_at();

-- ---------------------------------------------------------------------------
-- person_public_holidays: bigint person_id -> uuid person_id (people.id is now uuid)
-- ---------------------------------------------------------------------------
ALTER TABLE public.person_public_holidays
  ADD COLUMN IF NOT EXISTS person_id_uuid uuid;

UPDATE public.person_public_holidays ph
SET person_id_uuid = p.id
FROM public.people p
WHERE p.legacy_id = ph.person_id
  AND ph.person_id_uuid IS NULL;

ALTER TABLE public.person_public_holidays
  ALTER COLUMN person_id_uuid SET NOT NULL;

-- Replace PK and FK to point at uuid id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'person_public_holidays_pkey'
      AND conrelid = 'public.person_public_holidays'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.person_public_holidays DROP CONSTRAINT person_public_holidays_pkey';
  END IF;
END $$;

-- Drop old FK if present (name varies); attempt best-effort.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.person_public_holidays'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.person_public_holidays DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.person_public_holidays
  ADD CONSTRAINT person_public_holidays_pkey PRIMARY KEY (person_id_uuid, holiday_date, name);

ALTER TABLE public.person_public_holidays
  ADD CONSTRAINT person_public_holidays_person_id_fkey
  FOREIGN KEY (person_id_uuid) REFERENCES public.people(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'person_public_holidays'
      AND column_name = 'legacy_person_id'
  ) THEN
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.person_public_holidays RENAME COLUMN person_id TO legacy_person_id';
  EXECUTE 'ALTER TABLE public.person_public_holidays RENAME COLUMN person_id_uuid TO person_id';
END $$;

CREATE INDEX IF NOT EXISTS idx_person_public_holidays_person ON public.person_public_holidays (person_id);

