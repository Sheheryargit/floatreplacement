-- Workspace-wide standup department rotation order (shared across users).
ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS standup_department_order text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN workspace_settings.standup_department_order IS 'Ordered department names for standup slideshow; empty string means no department';
