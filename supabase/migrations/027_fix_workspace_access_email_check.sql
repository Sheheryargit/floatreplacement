-- Fix broken Deloitte email CHECK (025 used over-escaped regex; valid *.com.au rows failed).

alter table public.workspace_access
  drop constraint if exists workspace_access_email_deloitte_domain;

alter table public.workspace_access
  add constraint workspace_access_email_deloitte_domain
  check (
    email ~* '^[a-z0-9._+-]+@deloitte\.com$'
    or email ~* '^[a-z0-9._+-]+@deloitte\.com\.au$'
  );
