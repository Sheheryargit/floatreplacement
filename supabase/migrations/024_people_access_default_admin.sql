-- Workspace uses full access for all signed-in users; normalize people.access to Admin.

UPDATE public.people
SET access = 'Admin'
WHERE access IS NULL
   OR trim(access) = ''
   OR trim(access) = '—'
   OR lower(trim(access)) IN ('user', 'member', 'manager');

ALTER TABLE public.people
  ALTER COLUMN access SET DEFAULT 'Admin';
