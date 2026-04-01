-- floatreplacement — initial schema (bigint IDs match frontend)
-- In Supabase: Dashboard → SQL → New query → paste EVERYTHING in this file → Run.
-- Do not paste the filepath (e.g. supabase/migrations/...); only the SQL below.

CREATE TABLE IF NOT EXISTS lookup_roles (
  name text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS lookup_depts (
  name text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS lookup_clients (
  name text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS lookup_people_tags (
  name text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS lookup_project_tags (
  name text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS allocation_labels (
  label text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS people (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  email text DEFAULT '',
  role text DEFAULT '—',
  department text DEFAULT '',
  access text DEFAULT '—',
  tags text[] DEFAULT '{}',
  type text DEFAULT 'Employee',
  cost_rate text DEFAULT '0',
  bill_rate text DEFAULT '0',
  start_date text DEFAULT '',
  end_date text DEFAULT '',
  work_type text DEFAULT 'Full-time',
  notes text DEFAULT '',
  holidays text DEFAULT 'None',
  archived boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  code text DEFAULT '',
  client text DEFAULT '',
  tags text[] DEFAULT '{}',
  stage text DEFAULT 'draft',
  billable boolean DEFAULT true,
  color text,
  owner text DEFAULT '',
  start_date text DEFAULT '',
  end_date text DEFAULT '',
  notes text DEFAULT '',
  team_ids bigint[] DEFAULT '{}',
  manager_edit boolean DEFAULT false,
  archived boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allocations (
  id bigint PRIMARY KEY,
  person_ids bigint[] NOT NULL DEFAULT '{}',
  start_date text NOT NULL,
  end_date text NOT NULL,
  hours_per_day numeric DEFAULT 0,
  total_hours numeric DEFAULT 0,
  working_days int,
  project_label text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  repeat_id text DEFAULT 'none',
  is_leave boolean DEFAULT false,
  leave_type text,
  updated_by text,
  updated_at timestamptz,
  project_color text,
  created_at timestamptz DEFAULT now()
);

-- Seed lookups (same defaults as app seeds)
INSERT INTO lookup_roles (name) VALUES
  ('Graduate'), ('Consultant'), ('Senior Consultant'), ('Manager'), ('Engineer'),
  ('Senior Specialist Lead'), ('Principal'), ('Director')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lookup_depts (name) VALUES
  ('Fire Nation'), ('Eaas'), ('Sky'), ('Transition'), ('Anger Management'),
  ('Azkaban'), ('Sliced Secure'), ('Hornets')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lookup_clients (name) VALUES
  ('Wellness Lab'), ('Perth Airport'), ('SunCorp'), ('Australia Post'), ('Mecca'),
  ('CMS'), ('ACCC'), ('Arts Centre'), ('University of Adelaide'), ('ADHA'), ('Deloitte')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lookup_people_tags (name) VALUES
  ('Azure'), ('.NET'), ('Cloud Secure'), ('Data&AI'), ('SDM'), ('Firenation'),
  ('UI and UX Design'), ('service management'), ('AWS Platform'), ('Azkaban'), ('Secure')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lookup_project_tags (name) VALUES
  ('Data&AI'), ('Cloud Secure'), ('CMS'), ('.NET'), ('Azure'), ('AWS'), ('UI/UX'), ('SDM')
ON CONFLICT (name) DO NOTHING;

INSERT INTO allocation_labels (label) VALUES
  ('ASF / ASF Managed Services'),
  ('ARTC / Cloud Managed Services'),
  ('Internal / Admin & Ops')
ON CONFLICT (label) DO NOTHING;
