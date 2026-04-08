-- Individual availability: normalized store + transactional RPC (source of truth).
-- Generates weekly "Other / Leave" rows for unchecked Mon–Fri (repeat_id = weekly for UI).

CREATE TABLE IF NOT EXISTS public.user_availability (
  person_id uuid PRIMARY KEY REFERENCES public.people (id) ON DELETE CASCADE,
  employment_type text NOT NULL DEFAULT 'FT' CHECK (employment_type IN ('FT', 'PT')),
  weekly_hours numeric NOT NULL DEFAULT 37.5 CHECK (weekly_hours >= 0::numeric AND weekly_hours <= 168::numeric),
  mon boolean NOT NULL DEFAULT true,
  tue boolean NOT NULL DEFAULT true,
  wed boolean NOT NULL DEFAULT true,
  thu boolean NOT NULL DEFAULT true,
  fri boolean NOT NULL DEFAULT true,
  hours_per_day numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_availability IS 'Mon–Fri working pattern and target weekly hours; hours_per_day is derived from selected days.';

-- Optional per-date overrides (future: sick, custom shorter days)
CREATE TABLE IF NOT EXISTS public.user_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  person_id uuid NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  on_date date NOT NULL,
  available_hours numeric,
  note text,
  UNIQUE (person_id, on_date)
);

COMMENT ON TABLE public.user_availability_overrides IS 'Per-date availability overrides; not applied in v1 generator (reserved for reporting / future).';

-- Idempotent key for generated weekday-off rows (repeat_id stays "weekly" for schedule UI)
ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS availability_slot_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_allocations_availability_slot
  ON public.allocations (availability_slot_key)
  WHERE availability_slot_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- get_person_availability(person_id) -> jsonb
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_person_availability (p_person_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  ua user_availability%ROWTYPE;
  wt text;
  emp text;
  n_work int;
  hpd numeric;
BEGIN
  SELECT
    work_type INTO wt
  FROM
    people
  WHERE
    id = p_person_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    * INTO ua
  FROM
    user_availability
  WHERE
    person_id = p_person_id;

  IF NOT FOUND THEN
    emp := CASE WHEN lower(COALESCE(wt, '')) LIKE '%part%' THEN
      'PT'
    ELSE
      'FT'
    END;
    RETURN jsonb_build_object(
      'person_id', p_person_id, 'employment_type', emp, 'weekly_hours', 37.5, 'mon', true, 'tue', true, 'wed', true, 'thu', true, 'fri', true, 'hours_per_day', 7.5, 'from_defaults', true);
  END IF;

  n_work := (CASE WHEN ua.mon THEN
      1
    ELSE
      0
    END) + (CASE WHEN ua.tue THEN
      1
    ELSE
      0
    END) + (CASE WHEN ua.wed THEN
      1
    ELSE
      0
    END) + (CASE WHEN ua.thu THEN
      1
    ELSE
      0
    END) + (CASE WHEN ua.fri THEN
      1
    ELSE
      0
    END);
  hpd := CASE WHEN n_work > 0 THEN
    round((ua.weekly_hours / n_work)::numeric, 4)
  ELSE
    0::numeric
  END;
  RETURN jsonb_build_object(
    'person_id', ua.person_id, 'employment_type', ua.employment_type, 'weekly_hours', ua.weekly_hours, 'mon', ua.mon, 'tue', ua.tue, 'wed', ua.wed, 'thu', ua.thu, 'fri', ua.fri, 'hours_per_day', hpd, 'from_defaults', false, 'updated_at', ua.updated_at);
END;
$$;

-- ---------------------------------------------------------------------------
-- put_person_availability(...) -> jsonb  (transactional + idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.put_person_availability (
  p_person_id uuid,
  p_employment_type text,
  p_weekly_hours numeric,
  p_mon boolean,
  p_tue boolean,
  p_wed boolean,
  p_thu boolean,
  p_fri boolean
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  n_work int;
  hpd numeric;
  d_mon date := date '2024-01-01';
  -- Anchor Mondays: 2024-01-01 is Monday; Tue +1 … Fri +4
  new_id uuid;
  slot text;
  day_dates date[] := ARRAY[d_mon, d_mon + 1, d_mon + 2, d_mon + 3, d_mon + 4];
  day_on boolean[] := ARRAY[p_mon, p_tue, p_wed, p_thu, p_fri];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = p_person_id) THEN
    RAISE EXCEPTION 'person not found';
  END IF;

  IF upper(trim(p_employment_type)) NOT IN ('FT', 'PT') THEN
    RAISE EXCEPTION 'invalid employment_type';
  END IF;

  n_work := (CASE WHEN p_mon THEN
      1
    ELSE
      0
    END) + (CASE WHEN p_tue THEN
      1
    ELSE
      0
    END) + (CASE WHEN p_wed THEN
      1
    ELSE
      0
    END) + (CASE WHEN p_thu THEN
      1
    ELSE
      0
    END) + (CASE WHEN p_fri THEN
      1
    ELSE
      0
    END);

  IF n_work = 0 THEN
    RAISE EXCEPTION 'select_at_least_one_weekday';
  END IF;

  hpd := round((p_weekly_hours / n_work)::numeric, 4);

  INSERT INTO user_availability (
    person_id,
    employment_type,
    weekly_hours,
    mon,
    tue,
    wed,
    thu,
    fri,
    hours_per_day,
    updated_at)
  VALUES (
    p_person_id,
    upper(trim(p_employment_type)),
    p_weekly_hours,
    p_mon,
    p_tue,
    p_wed,
    p_thu,
    p_fri,
    hpd,
    now())
ON CONFLICT (person_id)
  DO UPDATE SET
    employment_type = EXCLUDED.employment_type,
    weekly_hours = EXCLUDED.weekly_hours,
    mon = EXCLUDED.mon,
    tue = EXCLUDED.tue,
    wed = EXCLUDED.wed,
    thu = EXCLUDED.thu,
    fri = EXCLUDED.fri,
    hours_per_day = EXCLUDED.hours_per_day,
    updated_at = now();

  -- Remove previous generated rows for this person (idempotent)
  DELETE FROM public.allocations
  WHERE availability_slot_key LIKE 'avail_off:' || p_person_id::text || ':%';

  -- Unchecked weekday => weekly leave block (repeat_id = weekly for schedule UI)
  FOR dow IN 1..5 LOOP
    IF day_on[dow] THEN
      CONTINUE;
    END IF;
    slot := 'avail_off:' || p_person_id::text || ':' || dow::text;
    INSERT INTO public.allocations (
      person_ids,
      start_date,
      end_date,
      hours_per_day,
      total_hours,
      working_days,
      project_label,
      notes,
      repeat_id,
      is_leave,
      leave_type,
      updated_by,
      project_color,
      availability_slot_key)
  VALUES (
    ARRAY[p_person_id]::uuid[],
    to_char(day_dates[dow], 'YYYY-MM-DD'),
    to_char(day_dates[dow], 'YYYY-MM-DD'),
    hpd,
    hpd,
    1,
    'Other',
    'Leave',
    'weekly',
    true,
    'other',
    'availability',
    NULL,
    slot)
  RETURNING
    id INTO new_id;
    INSERT INTO public.allocation_people (allocation_id, person_id)
      VALUES (new_id, p_person_id);
  END LOOP;

  RETURN public.get_person_availability (p_person_id);
END;
$$;

-- Recalculate = same as put (explicit alias for clients / ops)
CREATE OR REPLACE FUNCTION public.recalculate_person_availability (p_person_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  r user_availability%ROWTYPE;
BEGIN
  SELECT
    * INTO r
  FROM
    user_availability
  WHERE
    person_id = p_person_id;

  IF NOT FOUND THEN
    RETURN public.put_person_availability (p_person_id, 'FT', 37.5, true, true, true, true, true);
  END IF;

  RETURN public.put_person_availability (p_person_id, r.employment_type, r.weekly_hours, r.mon, r.tue, r.wed, r.thu, r.fri);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_person_availability (uuid) TO anon,
  authenticated;

GRANT EXECUTE ON FUNCTION public.put_person_availability (uuid, text, numeric, boolean, boolean, boolean, boolean, boolean) TO anon,
  authenticated;

GRANT EXECUTE ON FUNCTION public.recalculate_person_availability (uuid) TO anon,
  authenticated;
