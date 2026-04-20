-- Anchor put_person_availability weekly rows at the first occurrence of each
-- weekday on-or-after today so profile changes apply to future iterations only.
-- Previous behaviour used a fixed 2024-01-01 reference week, forcing the schedule
-- client to fast-forward ~120 weeks to reach the current view.
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
  today_date date := current_date;
  today_isodow int := extract(isodow from current_date)::int;  -- 1=Mon..7=Sun
  new_id uuid;
  slot text;
  anchor_date date;
  day_on boolean[] := ARRAY[p_mon, p_tue, p_wed, p_thu, p_fri];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = p_person_id) THEN
    RAISE EXCEPTION 'person not found';
  END IF;

  IF upper(trim(p_employment_type)) NOT IN ('FT', 'PT') THEN
    RAISE EXCEPTION 'invalid employment_type';
  END IF;

  n_work := (CASE WHEN p_mon THEN 1 ELSE 0 END)
    + (CASE WHEN p_tue THEN 1 ELSE 0 END)
    + (CASE WHEN p_wed THEN 1 ELSE 0 END)
    + (CASE WHEN p_thu THEN 1 ELSE 0 END)
    + (CASE WHEN p_fri THEN 1 ELSE 0 END);

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

  -- Replace this person's generated rows. Deletion is scoped to
  -- `avail_off:<person>:*` so hand-entered leave / work allocations are untouched.
  DELETE FROM public.allocations
  WHERE availability_slot_key LIKE 'avail_off:' || p_person_id::text || ':%';

  -- Insert a weekly row per off weekday, anchored at the first occurrence of that
  -- weekday on-or-after today — so past weeks keep whatever they showed before,
  -- and the new pattern only materialises from this week forward.
  FOR dow IN 1..5 LOOP
    IF day_on[dow] THEN
      CONTINUE;
    END IF;
    slot := 'avail_off:' || p_person_id::text || ':' || dow::text;
    anchor_date := today_date + (((dow - today_isodow) % 7 + 7) % 7);
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
    to_char(anchor_date, 'YYYY-MM-DD'),
    to_char(anchor_date, 'YYYY-MM-DD'),
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

GRANT EXECUTE ON FUNCTION public.put_person_availability (uuid, text, numeric, boolean, boolean, boolean, boolean, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
