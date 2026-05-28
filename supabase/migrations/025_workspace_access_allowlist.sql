-- Workspace access allowlist + Workspace Admin
-- Enforces "only allowlisted Deloitte emails can access the app".

-- 1) Table
create table if not exists public.workspace_access (
  email text primary key,
  access_enabled boolean not null default true,
  is_workspace_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Ensure Deloitte domains only.
-- Allow: @deloitte.com and @deloitte.com.au
alter table public.workspace_access
  drop constraint if exists workspace_access_email_deloitte_domain;

alter table public.workspace_access
  add constraint workspace_access_email_deloitte_domain
  check (
    email ~* '^[a-z0-9._+-]+@deloitte\.com$'
    or email ~* '^[a-z0-9._+-]+@deloitte\.com\.au$'
  );

-- 2) Helpers / normalization
create or replace function public.normalize_workspace_access_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  new.updated_at := now();
  if new.updated_by is null then
    begin
      new.updated_by := auth.uid();
    exception when others then
      -- ignore if auth.uid() is unavailable
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_access_normalize_email on public.workspace_access;
create trigger workspace_access_normalize_email
before insert or update on public.workspace_access
for each row
execute function public.normalize_workspace_access_email();

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
as $$
  select exists (
    select 1
    from public.workspace_access wa
    where wa.email = public.current_user_email()
      and wa.access_enabled = true
      and wa.is_workspace_admin = true
  )
$$;

-- 3) RLS
alter table public.workspace_access enable row level security;

drop policy if exists "workspace_access_select_self_or_admin" on public.workspace_access;
create policy "workspace_access_select_self_or_admin"
on public.workspace_access
for select
to authenticated
using (
  public.is_workspace_admin()
  or email = public.current_user_email()
);

drop policy if exists "workspace_access_admin_insert" on public.workspace_access;
create policy "workspace_access_admin_insert"
on public.workspace_access
for insert
to authenticated
with check (public.is_workspace_admin());

drop policy if exists "workspace_access_admin_update" on public.workspace_access;
create policy "workspace_access_admin_update"
on public.workspace_access
for update
to authenticated
using (public.is_workspace_admin())
with check (public.is_workspace_admin());

drop policy if exists "workspace_access_admin_delete" on public.workspace_access;
create policy "workspace_access_admin_delete"
on public.workspace_access
for delete
to authenticated
using (public.is_workspace_admin());

-- 4) Seed initial users (Deloitte allowlist)
-- Note: One provided email had a domain typo: scsubbaiah@deloiotte.com.au → corrected to @deloitte.com.au
insert into public.workspace_access (email, access_enabled, is_workspace_admin)
values
  ('syar@deloitte.com.au', true, true),
  ('vsaha@deloitte.com.au', true, true),
  ('lmulcahy@deloitte.com.au', true, true),

  ('scsubbaiah@deloitte.com.au', true, false),
  ('dihopkins@deloitte.com.au', true, false),
  ('ashdubey@deloitte.com.au', true, false),
  ('lalanger@deloitte.com.au', true, false),
  ('jaarnold@deloitte.com.au', true, false),
  ('apunj@deloitte.com.au', true, false),
  ('ssharma38@deloitte.com.au', true, false),
  ('athnair@deloitte.com.au', true, false),
  ('jincjoseph@deloitte.com.au', true, false),
  ('rbaliga@deloitte.com.au', true, false),
  ('ssiriwardena@deloitte.com.au', true, false),
  ('abrown2@deloitte.com.au', true, false),
  ('katechapman@deloitte.com.au', true, false),
  ('jenmatthews@deloitte.com.au', true, false),
  ('dpenny@deloitte.com.au', true, false),
  ('joklaassen@deloitte.com.au', true, false),
  ('chwhatman@deloitte.com.au', true, false),
  ('mamibrahim@deloitte.com.au', true, false),
  ('clenton@deloitte.com.au', true, false),
  ('nstrugnell@deloitte.com.au', true, false),
  ('visriram@deloitte.com.au', true, false),
  ('vkamisetty@deloitte.com.au', true, false),
  ('twparekh@deloitte.com.au', true, false),
  ('tbartlem@deloitte.com.au', true, false),
  ('tkirby@deloitte.com.au', true, false),
  ('srmahanty@deloitte.com.au', true, false),
  ('skatasani@deloitte.com.au', true, false),
  ('romcgarel@deloitte.com.au', true, false),
  ('kchalla@deloitte.com.au', true, false),
  ('johfan@deloitte.com.au', true, false),
  ('gwimetal@deloitte.com.au', true, false),
  ('dche@deloitte.com.au', true, false),
  ('danscott@deloitte.com.au', true, false),
  ('bwakefield@deloitte.com.au', true, false),

  ('jsenathiraja@deloitte.com.au', true, false),
  ('mambrosino@deloitte.com.au', true, false),
  ('chrnewell@deloitte.com.au', true, false),
  ('akshaysharma3@deloitte.com.au', true, false),
  ('hmichaelides@deloitte.com.au', true, false)
on conflict (email) do update
set
  access_enabled = excluded.access_enabled,
  is_workspace_admin = excluded.is_workspace_admin;

