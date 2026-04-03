-- Recompute person_public_holidays on any people row update (e.g. availability dates),
-- and clip holidays to start_date / end_date when those are set (ISO text from app).

CREATE OR REPLACE FUNCTION refresh_person_public_holidays (p_person_id bigint)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  r text;
  s_txt text;
  e_txt text;
  d_start date;
  d_end date;
  y0 int;
  y1 int;
BEGIN
  SELECT
    public_holiday_region,
    start_date,
    end_date INTO r,
    s_txt,
    e_txt
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
  BEGIN
    d_start := NULLIF (btrim(COALESCE(s_txt, '')), '')::date;
  EXCEPTION
    WHEN OTHERS THEN
      d_start := NULL;
  END;
  BEGIN
    d_end := NULLIF (btrim(COALESCE(e_txt, '')), '')::date;
  EXCEPTION
    WHEN OTHERS THEN
      d_end := NULL;
  END;
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
      AND c.is_national = TRUE
      AND (d_start IS NULL
        OR c.holiday_date >= d_start)
      AND (d_end IS NULL
        OR c.holiday_date <= d_end);
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
          AND r = ANY (c.region_codes)))
      AND (d_start IS NULL
        OR c.holiday_date >= d_start)
      AND (d_end IS NULL
        OR c.holiday_date <= d_end);
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_people_public_holidays ON people;

CREATE TRIGGER trg_people_public_holidays
  AFTER INSERT OR UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION trg_refresh_person_public_holidays ();
