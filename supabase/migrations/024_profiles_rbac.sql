-- ============================================================================
-- 024: Profiles, RBAC roles, project leads, triggers, JWT hook, RLS
-- ============================================================================
-- Hierarchy:  Admin  →  Manager  →  Team Lead  →  Member
--
-- Admin      – full access, user management, everything
-- Manager    – CRUD all people / projects / allocations; cannot manage users
-- Team Lead  – CRUD allocations on projects they lead; read everything else
-- Member     – self-allocate (create/edit own allocations); read everything
--
-- A Team Lead can lead multiple projects and manage allocations/people
-- scoped to those projects via the project_leads junction table.
-- ============================================================================

-- 1. Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'team_lead', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  display_name text,
  app_role    public.app_role NOT NULL DEFAULT 'member',
  approved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz
);

COMMENT ON TABLE public.profiles IS 'One row per auth user. Auto-created on SSO sign-in. Admin approves + assigns role.';

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- 3. Project leads junction table (team lead ↔ project)
CREATE TABLE IF NOT EXISTS public.project_leads (
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_project_leads_profile ON public.project_leads (profile_id);

COMMENT ON TABLE public.project_leads IS 'Junction: which profiles are team leads on which projects.';

-- 3b. Link people (resources) to profiles (auth users) for self-allocation
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_people_profile_id ON public.people (profile_id) WHERE profile_id IS NOT NULL;

COMMENT ON COLUMN public.people.profile_id IS 'Optional FK to profiles. When set, this person can self-allocate.';

-- 4. Auto-provision trigger: insert a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1),
      ''
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    last_sign_in_at = now(),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop if exists to make migration idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Update last_sign_in_at on subsequent logins (auth.users update fires on token refresh)
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET last_sign_in_at = now(),
      email = COALESCE(NEW.email, email),
      display_name = COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
        display_name
      ),
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_updated();

-- 5. Custom access token hook: inject app_role and approved into JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  profile_role public.app_role;
  profile_approved boolean;
BEGIN
  claims := event -> 'claims';

  SELECT app_role, approved INTO profile_role, profile_approved
  FROM public.profiles
  WHERE id = (event ->> 'user_id')::uuid;

  IF profile_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(profile_role));
    claims := jsonb_set(claims, '{approved}', to_jsonb(COALESCE(profile_approved, false)));
  ELSE
    -- No profile yet (race condition); default to unapproved member
    claims := jsonb_set(claims, '{app_role}', '"member"');
    claims := jsonb_set(claims, '{approved}', 'false');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin (required for auth hooks)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;

-- 6. RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can read all profiles (for admin panel)
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'admin' AND p.approved = true
    )
  );

-- Admins can update profiles (approve users, change roles)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'admin' AND p.approved = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'admin' AND p.approved = true
    )
  );

-- No direct insert/delete from client — trigger handles creation, admin manages via update
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- 6b. RLS on project_leads
ALTER TABLE public.project_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_leads_select"
  ON public.project_leads FOR SELECT
  TO authenticated USING (public.is_approved_user());

-- Only admin/manager can assign or remove project leads
CREATE POLICY "project_leads_modify"
  ON public.project_leads FOR ALL
  TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));

GRANT SELECT, INSERT, DELETE ON public.project_leads TO authenticated;
REVOKE ALL ON public.project_leads FROM anon;

-- ============================================================================
-- 7. Helper functions
-- ============================================================================

-- Check if current user is approved
CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND approved = true
  );
$$;

-- Check if current user has one of the given roles (and is approved)
CREATE OR REPLACE FUNCTION public.has_role(required_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND approved = true
      AND app_role::text = ANY(required_roles)
  );
$$;

-- Check if current user is a team lead for a specific project
CREATE OR REPLACE FUNCTION public.is_project_lead(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_leads
    WHERE project_id = p_project_id AND profile_id = auth.uid()
  )
  AND public.has_role(ARRAY['team_lead']);
$$;

-- Check if current user is a team lead for the project owning an allocation
CREATE OR REPLACE FUNCTION public.is_lead_for_allocation(alloc_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allocations a
    JOIN public.project_leads pl ON pl.project_id = a.project_id
    WHERE a.id = alloc_id AND pl.profile_id = auth.uid()
  )
  AND public.has_role(ARRAY['team_lead']);
$$;

-- Check if the current user IS one of the people assigned to an allocation
-- (used for self-allocation: members can manage their own allocations)
CREATE OR REPLACE FUNCTION public.is_own_allocation(alloc_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allocation_people ap
    JOIN public.people p ON p.id = ap.person_id
    WHERE ap.allocation_id = alloc_id
      AND p.profile_id = auth.uid()
  )
  AND public.is_approved_user();
$$;

-- Check if the current user's linked person matches a given person_id
-- (used for allocation_people: members can only add/remove themselves)
CREATE OR REPLACE FUNCTION public.is_own_person(p_person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.people
    WHERE id = p_person_id AND profile_id = auth.uid()
  )
  AND public.is_approved_user();
$$;

GRANT EXECUTE ON FUNCTION public.is_approved_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_lead TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lead_for_allocation TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_allocation TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_person TO authenticated;

-- ============================================================================
-- 8. Role-based RLS on ALL existing public tables
-- ============================================================================
-- READ:  all approved users (every role can see everything)
-- WRITE: depends on the table and role hierarchy
--
--   people, projects, lookups, workspace_settings, holidays, availability:
--     admin + manager can write
--
--   projects (UPDATE only):
--     team_lead can update projects they lead
--
--   allocations, allocation_people, allocation_labels:
--     admin + manager can write any
--     team_lead can write on projects they lead

-- ----------------------------------------------------------------
-- people — admin/manager can write; team_lead/member read-only
-- ----------------------------------------------------------------
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "people_select_all" ON public.people;
DROP POLICY IF EXISTS "people_insert_all" ON public.people;
DROP POLICY IF EXISTS "people_update_all" ON public.people;
DROP POLICY IF EXISTS "people_delete_all" ON public.people;
DROP POLICY IF EXISTS "people_approved_select" ON public.people;
DROP POLICY IF EXISTS "people_approved_modify" ON public.people;

CREATE POLICY "people_read" ON public.people
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "people_write" ON public.people
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
REVOKE ALL ON public.people FROM anon;

-- ----------------------------------------------------------------
-- projects — admin/manager can write; team_lead can UPDATE their projects
-- ----------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_select_all" ON public.projects;
DROP POLICY IF EXISTS "projects_approved_select" ON public.projects;
DROP POLICY IF EXISTS "projects_approved_modify" ON public.projects;

CREATE POLICY "projects_read" ON public.projects
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "projects_write" ON public.projects
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "projects_update_lead" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_project_lead(id))
  WITH CHECK (public.is_project_lead(id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
REVOKE ALL ON public.projects FROM anon;

-- ----------------------------------------------------------------
-- allocations — admin/manager: any; team_lead: their projects; member: self
-- ----------------------------------------------------------------
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allocations_select_all" ON public.allocations;
DROP POLICY IF EXISTS "allocations_approved_select" ON public.allocations;
DROP POLICY IF EXISTS "allocations_approved_modify" ON public.allocations;

CREATE POLICY "allocations_read" ON public.allocations
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "allocations_write" ON public.allocations
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "allocations_write_lead" ON public.allocations
  FOR ALL TO authenticated
  USING (public.is_project_lead(project_id))
  WITH CHECK (public.is_project_lead(project_id));
-- Self-allocation: members can write allocations where they are assigned
CREATE POLICY "allocations_write_self" ON public.allocations
  FOR ALL TO authenticated
  USING (public.is_own_allocation(id))
  WITH CHECK (public.is_approved_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocations TO authenticated;
REVOKE ALL ON public.allocations FROM anon;

-- ----------------------------------------------------------------
-- allocation_people — follows allocations' write rules
-- ----------------------------------------------------------------
ALTER TABLE public.allocation_people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allocation_people_approved_select" ON public.allocation_people;
DROP POLICY IF EXISTS "allocation_people_approved_modify" ON public.allocation_people;

CREATE POLICY "allocation_people_read" ON public.allocation_people
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "allocation_people_write" ON public.allocation_people
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "allocation_people_write_lead" ON public.allocation_people
  FOR ALL TO authenticated
  USING (public.is_lead_for_allocation(allocation_id))
  WITH CHECK (public.is_lead_for_allocation(allocation_id));
-- Self-allocation: members can add/remove themselves (person_id must be their own)
CREATE POLICY "allocation_people_write_self" ON public.allocation_people
  FOR ALL TO authenticated
  USING (public.is_own_person(person_id))
  WITH CHECK (public.is_own_person(person_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_people TO authenticated;
REVOKE ALL ON public.allocation_people FROM anon;

-- ----------------------------------------------------------------
-- allocation_labels — follows allocations' write rules
-- ----------------------------------------------------------------
ALTER TABLE public.allocation_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allocation_labels_approved_select" ON public.allocation_labels;
DROP POLICY IF EXISTS "allocation_labels_approved_modify" ON public.allocation_labels;

CREATE POLICY "allocation_labels_read" ON public.allocation_labels
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "allocation_labels_write" ON public.allocation_labels
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
CREATE POLICY "allocation_labels_write_lead" ON public.allocation_labels
  FOR ALL TO authenticated
  USING (public.is_lead_for_allocation(allocation_id))
  WITH CHECK (public.is_lead_for_allocation(allocation_id));
-- Self-allocation: members can label their own allocations
CREATE POLICY "allocation_labels_write_self" ON public.allocation_labels
  FOR ALL TO authenticated
  USING (public.is_own_allocation(allocation_id))
  WITH CHECK (public.is_own_allocation(allocation_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_labels TO authenticated;
REVOKE ALL ON public.allocation_labels FROM anon;

-- ----------------------------------------------------------------
-- workspace_settings — admin/manager write
-- ----------------------------------------------------------------
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_settings_select_all" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_settings_approved_select" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_settings_approved_modify" ON public.workspace_settings;

CREATE POLICY "workspace_settings_read" ON public.workspace_settings
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "workspace_settings_write" ON public.workspace_settings
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));

GRANT SELECT, INSERT, UPDATE ON public.workspace_settings TO authenticated;
REVOKE ALL ON public.workspace_settings FROM anon;

-- ----------------------------------------------------------------
-- person_public_holidays — admin/manager write
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "person_public_holidays_select_all" ON public.person_public_holidays;
DROP POLICY IF EXISTS "person_public_holidays_approved_select" ON public.person_public_holidays;
DROP POLICY IF EXISTS "person_public_holidays_approved_modify" ON public.person_public_holidays;

CREATE POLICY "person_public_holidays_read" ON public.person_public_holidays
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "person_public_holidays_write" ON public.person_public_holidays
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));

REVOKE ALL ON public.person_public_holidays FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_public_holidays TO authenticated;

-- ----------------------------------------------------------------
-- person_public_holiday_dismissals — admin/manager write
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "person_public_holiday_dismissals_select" ON public.person_public_holiday_dismissals;
DROP POLICY IF EXISTS "person_public_holiday_dismissals_insert" ON public.person_public_holiday_dismissals;
DROP POLICY IF EXISTS "person_public_holiday_dismissals_delete" ON public.person_public_holiday_dismissals;
DROP POLICY IF EXISTS "person_public_holiday_dismissals_approved_select" ON public.person_public_holiday_dismissals;
DROP POLICY IF EXISTS "person_public_holiday_dismissals_approved_modify" ON public.person_public_holiday_dismissals;

CREATE POLICY "person_public_holiday_dismissals_read" ON public.person_public_holiday_dismissals
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "person_public_holiday_dismissals_write" ON public.person_public_holiday_dismissals
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));

REVOKE ALL ON public.person_public_holiday_dismissals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_public_holiday_dismissals TO authenticated;

-- ----------------------------------------------------------------
-- user_availability — admin/manager write
-- ----------------------------------------------------------------
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_availability_approved_select" ON public.user_availability;
DROP POLICY IF EXISTS "user_availability_approved_modify" ON public.user_availability;

CREATE POLICY "user_availability_read" ON public.user_availability
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "user_availability_write" ON public.user_availability
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_availability TO authenticated;
REVOKE ALL ON public.user_availability FROM anon;

-- ----------------------------------------------------------------
-- user_availability_overrides — admin/manager write
-- ----------------------------------------------------------------
ALTER TABLE public.user_availability_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_availability_overrides_approved_select" ON public.user_availability_overrides;
DROP POLICY IF EXISTS "user_availability_overrides_approved_modify" ON public.user_availability_overrides;

CREATE POLICY "user_availability_overrides_read" ON public.user_availability_overrides
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "user_availability_overrides_write" ON public.user_availability_overrides
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin', 'manager']))
  WITH CHECK (public.has_role(ARRAY['admin', 'manager']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_availability_overrides TO authenticated;
REVOKE ALL ON public.user_availability_overrides FROM anon;

-- ----------------------------------------------------------------
-- lookup tables — admin/manager write
-- ----------------------------------------------------------------
ALTER TABLE public.lookup_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lookup_roles_approved_select" ON public.lookup_roles;
DROP POLICY IF EXISTS "lookup_roles_approved_modify" ON public.lookup_roles;
CREATE POLICY "lookup_roles_read" ON public.lookup_roles
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "lookup_roles_write" ON public.lookup_roles
  FOR ALL TO authenticated USING (public.has_role(ARRAY['admin', 'manager'])) WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_roles TO authenticated;
REVOKE ALL ON public.lookup_roles FROM anon;

ALTER TABLE public.lookup_depts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lookup_depts_approved_select" ON public.lookup_depts;
DROP POLICY IF EXISTS "lookup_depts_approved_modify" ON public.lookup_depts;
CREATE POLICY "lookup_depts_read" ON public.lookup_depts
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "lookup_depts_write" ON public.lookup_depts
  FOR ALL TO authenticated USING (public.has_role(ARRAY['admin', 'manager'])) WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_depts TO authenticated;
REVOKE ALL ON public.lookup_depts FROM anon;

ALTER TABLE public.lookup_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lookup_clients_approved_select" ON public.lookup_clients;
DROP POLICY IF EXISTS "lookup_clients_approved_modify" ON public.lookup_clients;
CREATE POLICY "lookup_clients_read" ON public.lookup_clients
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "lookup_clients_write" ON public.lookup_clients
  FOR ALL TO authenticated USING (public.has_role(ARRAY['admin', 'manager'])) WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_clients TO authenticated;
REVOKE ALL ON public.lookup_clients FROM anon;

ALTER TABLE public.lookup_people_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lookup_people_tags_approved_select" ON public.lookup_people_tags;
DROP POLICY IF EXISTS "lookup_people_tags_approved_modify" ON public.lookup_people_tags;
CREATE POLICY "lookup_people_tags_read" ON public.lookup_people_tags
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "lookup_people_tags_write" ON public.lookup_people_tags
  FOR ALL TO authenticated USING (public.has_role(ARRAY['admin', 'manager'])) WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_people_tags TO authenticated;
REVOKE ALL ON public.lookup_people_tags FROM anon;

ALTER TABLE public.lookup_project_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lookup_project_tags_approved_select" ON public.lookup_project_tags;
DROP POLICY IF EXISTS "lookup_project_tags_approved_modify" ON public.lookup_project_tags;
CREATE POLICY "lookup_project_tags_read" ON public.lookup_project_tags
  FOR SELECT TO authenticated USING (public.is_approved_user());
CREATE POLICY "lookup_project_tags_write" ON public.lookup_project_tags
  FOR ALL TO authenticated USING (public.has_role(ARRAY['admin', 'manager'])) WITH CHECK (public.has_role(ARRAY['admin', 'manager']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_project_tags TO authenticated;
REVOKE ALL ON public.lookup_project_tags FROM anon;

-- ----------------------------------------------------------------
-- au_holiday_catalog — read-only reference data
-- ----------------------------------------------------------------
ALTER TABLE public.au_holiday_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "au_holiday_catalog_approved_select" ON public.au_holiday_catalog;
CREATE POLICY "au_holiday_catalog_read" ON public.au_holiday_catalog
  FOR SELECT TO authenticated USING (public.is_approved_user());
GRANT SELECT ON public.au_holiday_catalog TO authenticated;
REVOKE ALL ON public.au_holiday_catalog FROM anon;
