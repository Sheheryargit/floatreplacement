-- Structured schedule filters (AND of rules; drill-down UI). Legacy tag array remains for backward compatibility.
ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS schedule_allocation_filter jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN workspace_settings.schedule_allocation_filter IS 'JSON array of {field, op, values} schedule filter rules';
