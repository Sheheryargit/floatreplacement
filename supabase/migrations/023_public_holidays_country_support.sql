-- Generalize public holidays to support multiple countries (AU + IN) with low-risk backward compatibility.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS public_holiday_country text NOT NULL DEFAULT 'None';

UPDATE public.people
SET public_holiday_country = CASE
  WHEN public_holiday_region IS NULL OR btrim(public_holiday_region) = '' OR lower(btrim(public_holiday_region)) = 'none' THEN 'None'
  WHEN upper(public_holiday_region) = 'AU' OR upper(public_holiday_region) LIKE 'AU-%' THEN 'AU'
  WHEN upper(public_holiday_region) = 'IN' OR upper(public_holiday_region) LIKE 'IN-%' THEN 'IN'
  ELSE 'None'
END;

CREATE TABLE IF NOT EXISTS public.holiday_catalog (
  id bigserial PRIMARY KEY,
  country_code text NOT NULL,
  year int NOT NULL,
  holiday_date date NOT NULL,
  name text NOT NULL,
  holiday_type text NOT NULL DEFAULT 'Public',
  is_national boolean NOT NULL DEFAULT false,
  region_codes text[]
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_holiday_catalog_country_date_name_national
  ON public.holiday_catalog (country_code, holiday_date, name)
  WHERE region_codes IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_holiday_catalog_country_date_name_regions
  ON public.holiday_catalog (country_code, holiday_date, name, region_codes)
  WHERE region_codes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_holiday_catalog_country_year
  ON public.holiday_catalog (country_code, year);

CREATE INDEX IF NOT EXISTS idx_holiday_catalog_regions
  ON public.holiday_catalog USING gin (region_codes);

INSERT INTO public.holiday_catalog (country_code, year, holiday_date, name, holiday_type, is_national, region_codes)
SELECT
  'AU',
  c.year,
  c.holiday_date,
  c.name,
  c.holiday_type,
  c.is_national,
  c.region_codes
FROM public.au_holiday_catalog c
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_person_public_holidays (p_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c text;
  r text;
  s_txt text;
  e_txt text;
  d_start date;
  d_end date;
  y0 int;
  y1 int;
BEGIN
  SELECT
    public_holiday_country,
    public_holiday_region,
    start_date,
    end_date INTO c,
    r,
    s_txt,
    e_txt
  FROM
    public.people
  WHERE
    id = p_person_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.person_public_holidays
  WHERE person_id = p_person_id;

  c := upper(btrim(COALESCE(c, '')));
  r := upper(btrim(COALESCE(r, '')));

  IF c = '' OR c = 'NONE' THEN
    IF r = 'AU' OR r LIKE 'AU-%' THEN
      c := 'AU';
    ELSIF r = 'IN' OR r LIKE 'IN-%' THEN
      c := 'IN';
    ELSE
      RETURN;
    END IF;
  END IF;

  IF r = '' OR r = 'NONE' THEN
    r := c;
  END IF;

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

  INSERT INTO public.person_public_holidays (person_id, holiday_date, name, holiday_type)
  SELECT
    p_person_id,
    hc.holiday_date,
    hc.name,
    hc.holiday_type
  FROM
    public.holiday_catalog hc
  WHERE
    hc.country_code = c
    AND hc.year IN (y0, y1)
    AND (d_start IS NULL OR hc.holiday_date >= d_start)
    AND (d_end IS NULL OR hc.holiday_date <= d_end)
    AND (
      hc.is_national = TRUE
      OR (
        hc.region_codes IS NOT NULL
        AND r <> c
        AND r = ANY (hc.region_codes)
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_person_public_holidays ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_person_public_holidays (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_people_public_holidays ON public.people;
CREATE TRIGGER trg_people_public_holidays
  AFTER INSERT OR UPDATE ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_refresh_person_public_holidays ();

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.people LOOP
    PERFORM public.refresh_person_public_holidays(rec.id);
  END LOOP;
END
$$;
