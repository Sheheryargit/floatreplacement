-- AU public holidays: catalog (Nager.Date), per-person materialized rows, sync on region change.
-- Static JSON also lives in public/holidays/ (Vite); DB is source for schedule queries.

ALTER TABLE people ADD COLUMN IF NOT EXISTS public_holiday_region text NOT NULL DEFAULT 'None';

UPDATE people SET public_holiday_region = CASE holidays
  WHEN 'None' THEN 'None'
  WHEN 'Australia — National' THEN 'AU'
  WHEN 'Australia — ACT' THEN 'AU-ACT'
  WHEN 'Australia — NSW' THEN 'AU-NSW'
  WHEN 'Australia — NT' THEN 'AU-NT'
  WHEN 'Australia — QLD' THEN 'AU-QLD'
  WHEN 'Australia — SA' THEN 'AU-SA'
  WHEN 'Australia — TAS' THEN 'AU-TAS'
  WHEN 'Australia — VIC' THEN 'AU-VIC'
  WHEN 'Australia — WA' THEN 'AU-WA'
  ELSE 'None'
END
WHERE holidays IS NOT NULL;

CREATE TABLE IF NOT EXISTS au_holiday_catalog (
  id bigserial PRIMARY KEY,
  year int NOT NULL,
  holiday_date date NOT NULL,
  name text NOT NULL,
  holiday_type text NOT NULL DEFAULT 'Public',
  is_national boolean NOT NULL DEFAULT false,
  region_codes text[]
);

CREATE INDEX IF NOT EXISTS idx_au_holiday_catalog_year ON au_holiday_catalog (year);
CREATE INDEX IF NOT EXISTS idx_au_holiday_catalog_regions ON au_holiday_catalog USING gin (region_codes);

CREATE TABLE IF NOT EXISTS person_public_holidays (
  person_id bigint NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name text NOT NULL,
  holiday_type text NOT NULL DEFAULT 'Public',
  PRIMARY KEY (person_id, holiday_date, name)
);

CREATE INDEX IF NOT EXISTS idx_person_public_holidays_person ON person_public_holidays (person_id);
CREATE INDEX IF NOT EXISTS idx_person_public_holidays_date ON person_public_holidays (holiday_date);

CREATE OR REPLACE FUNCTION refresh_person_public_holidays (p_person_id bigint)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  r text;
  y0 int;
  y1 int;
BEGIN
  SELECT
    public_holiday_region INTO r
  FROM
    people
  WHERE
    id = p_person_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  DELETE FROM person_public_holidays
  WHERE person_id = p_person_id;
  IF r IS NULL OR trim(r) = '' OR lower(trim(r)) = 'none' THEN
    RETURN;
  END IF;
  r := trim(r);
  y0 := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  y1 := y0 + 1;
  IF r = 'AU' THEN
    INSERT INTO person_public_holidays (person_id, holiday_date, name, holiday_type)
    SELECT
      p_person_id,
      c.holiday_date,
      c.name,
      c.holiday_type
    FROM
      au_holiday_catalog c
    WHERE
      c.year IN (y0, y1)
      AND c.is_national = TRUE;
  ELSE
    INSERT INTO person_public_holidays (person_id, holiday_date, name, holiday_type)
    SELECT
      p_person_id,
      c.holiday_date,
      c.name,
      c.holiday_type
    FROM
      au_holiday_catalog c
    WHERE
      c.year IN (y0, y1)
      AND (c.is_national = TRUE
        OR (c.region_codes IS NOT NULL
          AND r = ANY (c.region_codes)));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_refresh_person_public_holidays ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  PERFORM
    refresh_person_public_holidays (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_people_public_holidays ON people;

CREATE TRIGGER trg_people_public_holidays
  AFTER INSERT OR UPDATE OF public_holiday_region ON people
  FOR EACH ROW
  EXECUTE FUNCTION trg_refresh_person_public_holidays ();

INSERT INTO au_holiday_catalog (year, holiday_date, name, holiday_type, is_national, region_codes) VALUES
(2025, '2025-01-01'::date, 'New Year''s Day', 'Public', true, NULL),
(2025, '2025-01-27'::date, 'Australia Day', 'Public', true, NULL),
(2025, '2025-03-03'::date, 'Labour Day', 'Public', false, ARRAY['AU-WA']::text[]),
(2025, '2025-03-10'::date, 'Canberra Day', 'Public', false, ARRAY['AU-ACT']::text[]),
(2025, '2025-03-10'::date, 'Adelaide Cup Day', 'Public', false, ARRAY['AU-SA']::text[]),
(2025, '2025-03-10'::date, 'Eight Hours Day', 'Public', false, ARRAY['AU-TAS']::text[]),
(2025, '2025-03-10'::date, 'Labour Day', 'Public', false, ARRAY['AU-VIC']::text[]),
(2025, '2025-04-18'::date, 'Good Friday', 'Public', true, NULL),
(2025, '2025-04-19'::date, 'Holy Saturday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-QLD','AU-SA','AU-VIC']::text[]),
(2025, '2025-04-20'::date, 'Easter Sunday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-QLD','AU-SA','AU-VIC','AU-WA']::text[]),
(2025, '2025-04-21'::date, 'Easter Monday', 'Public', true, NULL),
(2025, '2025-04-25'::date, 'Anzac Day', 'Public', true, NULL),
(2025, '2025-05-05'::date, 'May Day', 'Public', false, ARRAY['AU-NT']::text[]),
(2025, '2025-05-05'::date, 'Labour Day', 'Public', false, ARRAY['AU-QLD']::text[]),
(2025, '2025-06-02'::date, 'Reconciliation Day', 'Public', false, ARRAY['AU-ACT']::text[]),
(2025, '2025-06-02'::date, 'Western Australia Day', 'Public', false, ARRAY['AU-WA']::text[]),
(2025, '2025-06-09'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-SA','AU-TAS','AU-VIC']::text[]),
(2025, '2025-08-04'::date, 'Picnic Day', 'Public', false, ARRAY['AU-NT']::text[]),
(2025, '2025-09-26'::date, 'Friday before AFL Grand Final', 'Public', false, ARRAY['AU-VIC']::text[]),
(2025, '2025-09-29'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-WA']::text[]),
(2025, '2025-10-06'::date, 'Labour Day', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-SA']::text[]),
(2025, '2025-10-06'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-QLD']::text[]),
(2025, '2025-11-04'::date, 'Melbourne Cup', 'Public', false, ARRAY['AU-VIC']::text[]),
(2025, '2025-12-25'::date, 'Christmas Day', 'Public', true, NULL),
(2025, '2025-12-26'::date, 'St. Stephen''s Day', 'Public', true, NULL),
(2026, '2026-01-01'::date, 'New Year''s Day', 'Public', true, NULL),
(2026, '2026-01-26'::date, 'Australia Day', 'Public', true, NULL),
(2026, '2026-03-02'::date, 'Labour Day', 'Public', false, ARRAY['AU-WA']::text[]),
(2026, '2026-03-09'::date, 'Canberra Day', 'Public', false, ARRAY['AU-ACT']::text[]),
(2026, '2026-03-09'::date, 'Adelaide Cup Day', 'Public', false, ARRAY['AU-SA']::text[]),
(2026, '2026-03-09'::date, 'Eight Hours Day', 'Public', false, ARRAY['AU-TAS']::text[]),
(2026, '2026-03-09'::date, 'Labour Day', 'Public', false, ARRAY['AU-VIC']::text[]),
(2026, '2026-04-03'::date, 'Good Friday', 'Public', true, NULL),
(2026, '2026-04-04'::date, 'Holy Saturday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-QLD','AU-SA','AU-VIC']::text[]),
(2026, '2026-04-05'::date, 'Easter Sunday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-QLD','AU-SA','AU-VIC','AU-WA']::text[]),
(2026, '2026-04-06'::date, 'Easter Monday', 'Public', true, NULL),
(2026, '2026-04-25'::date, 'Anzac Day', 'Public', true, NULL),
(2026, '2026-04-27'::date, 'Anzac Day', 'Public', false, ARRAY['AU-WA']::text[]),
(2026, '2026-05-04'::date, 'May Day', 'Public', false, ARRAY['AU-NT']::text[]),
(2026, '2026-05-04'::date, 'Labour Day', 'Public', false, ARRAY['AU-QLD']::text[]),
(2026, '2026-06-01'::date, 'Reconciliation Day', 'Public', false, ARRAY['AU-ACT']::text[]),
(2026, '2026-06-01'::date, 'Western Australia Day', 'Public', false, ARRAY['AU-WA']::text[]),
(2026, '2026-06-08'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-SA','AU-TAS','AU-VIC']::text[]),
(2026, '2026-08-03'::date, 'Picnic Day', 'Public', false, ARRAY['AU-NT']::text[]),
(2026, '2026-09-28'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-WA']::text[]),
(2026, '2026-10-05'::date, 'Labour Day', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-SA']::text[]),
(2026, '2026-10-05'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-QLD']::text[]),
(2026, '2026-11-03'::date, 'Melbourne Cup', 'Public', false, ARRAY['AU-VIC']::text[]),
(2026, '2026-12-25'::date, 'Christmas Day', 'Public', true, NULL),
(2026, '2026-12-28'::date, 'St. Stephen''s Day', 'Public', true, NULL),
(2027, '2027-01-01'::date, 'New Year''s Day', 'Public', true, NULL),
(2027, '2027-01-26'::date, 'Australia Day', 'Public', true, NULL),
(2027, '2027-03-01'::date, 'Labour Day', 'Public', false, ARRAY['AU-WA']::text[]),
(2027, '2027-03-08'::date, 'Canberra Day', 'Public', false, ARRAY['AU-ACT']::text[]),
(2027, '2027-03-08'::date, 'Adelaide Cup Day', 'Public', false, ARRAY['AU-SA']::text[]),
(2027, '2027-03-08'::date, 'Eight Hours Day', 'Public', false, ARRAY['AU-TAS']::text[]),
(2027, '2027-03-08'::date, 'Labour Day', 'Public', false, ARRAY['AU-VIC']::text[]),
(2027, '2027-03-26'::date, 'Good Friday', 'Public', true, NULL),
(2027, '2027-03-27'::date, 'Holy Saturday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-QLD','AU-SA','AU-VIC']::text[]),
(2027, '2027-03-28'::date, 'Easter Sunday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-QLD','AU-SA','AU-VIC','AU-WA']::text[]),
(2027, '2027-03-29'::date, 'Easter Monday', 'Public', true, NULL),
(2027, '2027-04-25'::date, 'Anzac Day', 'Public', true, NULL),
(2027, '2027-04-26'::date, 'Anzac Day', 'Public', false, ARRAY['AU-WA']::text[]),
(2027, '2027-05-03'::date, 'May Day', 'Public', false, ARRAY['AU-NT']::text[]),
(2027, '2027-05-03'::date, 'Labour Day', 'Public', false, ARRAY['AU-QLD']::text[]),
(2027, '2027-05-31'::date, 'Reconciliation Day', 'Public', false, ARRAY['AU-ACT']::text[]),
(2027, '2027-06-07'::date, 'Western Australia Day', 'Public', false, ARRAY['AU-WA']::text[]),
(2027, '2027-06-14'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-NT','AU-SA','AU-TAS','AU-VIC']::text[]),
(2027, '2027-08-02'::date, 'Picnic Day', 'Public', false, ARRAY['AU-NT']::text[]),
(2027, '2027-09-24'::date, 'Friday before AFL Grand Final (Tentative Date)', 'Public', false, ARRAY['AU-VIC']::text[]),
(2027, '2027-09-27'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-WA']::text[]),
(2027, '2027-10-04'::date, 'Labour Day', 'Public', false, ARRAY['AU-ACT','AU-NSW','AU-SA']::text[]),
(2027, '2027-10-04'::date, 'King''s Birthday', 'Public', false, ARRAY['AU-QLD']::text[]),
(2027, '2027-11-02'::date, 'Melbourne Cup', 'Public', false, ARRAY['AU-VIC']::text[]),
(2027, '2027-12-27'::date, 'Christmas Day', 'Public', true, NULL),
(2027, '2027-12-28'::date, 'St. Stephen''s Day', 'Public', true, NULL);

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
  SELECT
    id
  FROM
    people
    LOOP
      PERFORM
        refresh_person_public_holidays (rec.id);
    END LOOP;
END
$$;
