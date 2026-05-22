-- Default People.access tier: "User" (RBAC key `user` in the app). Normalize legacy empty/em dash.

UPDATE public.people
SET access = 'User'
WHERE access IS NULL
   OR trim(access) = ''
   OR trim(access) = '—';

ALTER TABLE public.people
  ALTER COLUMN access SET DEFAULT 'User';
