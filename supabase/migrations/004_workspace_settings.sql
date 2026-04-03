-- Singleton workspace UI prefs (schedule tag filter + starred people tags)
CREATE TABLE IF NOT EXISTS workspace_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  starred_people_tags text[] NOT NULL DEFAULT '{}',
  schedule_people_tag_filter text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO workspace_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
