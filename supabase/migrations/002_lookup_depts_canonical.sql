-- Canonical department names (app default list). Safe to re-run.
INSERT INTO lookup_depts (name) VALUES
  ('Ninjas'),
  ('Transition'),
  ('Evergreen'),
  ('Data & AI'),
  ('Azkaban'),
  ('Meatballs'),
  ('Beans'),
  ('Secure'),
  ('India'),
  ('Support'),
  ('Platmechs'),
  ('Fire Nation'),
  ('CPS'),
  ('Sky'),
  ('Sliced Secure'),
  ('Anger Management'),
  ('Hornets')
ON CONFLICT (name) DO NOTHING;
