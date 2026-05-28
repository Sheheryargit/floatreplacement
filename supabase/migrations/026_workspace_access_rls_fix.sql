-- Fix RLS recursion: is_workspace_admin() must bypass RLS when reading workspace_access.
-- Add SECURITY DEFINER RPC for admin list (authenticated workspace admins only).

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(nullif(trim(auth.jwt() ->> 'email'), ''))
$$;

create or replace function public.is_workspace_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_access wa
    where wa.email = public.current_user_email()
      and wa.access_enabled = true
      and wa.is_workspace_admin = true
  )
$$;

create or replace function public.list_workspace_access_admin()
returns table (
  email text,
  access_enabled boolean,
  is_workspace_admin boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select wa.email, wa.access_enabled, wa.is_workspace_admin, wa.updated_at
  from public.workspace_access wa
  where public.is_workspace_admin()
  order by wa.email
$$;

revoke all on function public.list_workspace_access_admin() from public;
grant execute on function public.list_workspace_access_admin() to authenticated;
