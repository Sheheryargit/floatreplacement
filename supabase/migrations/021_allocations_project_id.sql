-- Optional FK from allocations to projects for reporting and integrity.
-- Keeps project_label as the display/source of truth for the schedule bar text.

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_allocations_project_id ON public.allocations (project_id)
  WHERE project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.save_allocation(
  p_id uuid,
  p_expected_version int,
  p_person_ids uuid[],
  p_start_date text,
  p_end_date text,
  p_hours_per_day numeric,
  p_total_hours numeric,
  p_working_days int,
  p_project_label text,
  p_notes text,
  p_repeat_id text,
  p_is_leave boolean,
  p_leave_type text,
  p_updated_by text,
  p_project_color text,
  p_project_id uuid DEFAULT NULL
)
RETURNS public.allocations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.allocations;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO public.allocations (
      person_ids,
      start_date,
      end_date,
      hours_per_day,
      total_hours,
      working_days,
      project_label,
      project_id,
      notes,
      repeat_id,
      is_leave,
      leave_type,
      updated_by,
      project_color
    ) VALUES (
      COALESCE(p_person_ids, '{}'::uuid[]),
      p_start_date,
      p_end_date,
      COALESCE(p_hours_per_day, 0),
      COALESCE(p_total_hours, 0),
      p_working_days,
      COALESCE(p_project_label, ''),
      p_project_id,
      COALESCE(p_notes, ''),
      COALESCE(p_repeat_id, 'none'),
      COALESCE(p_is_leave, false),
      p_leave_type,
      p_updated_by,
      p_project_color
    )
    RETURNING * INTO r;

    INSERT INTO public.allocation_people (allocation_id, person_id)
    SELECT r.id, pid
    FROM unnest(COALESCE(p_person_ids, '{}'::uuid[])) AS pid
    ON CONFLICT DO NOTHING;

    RETURN r;
  END IF;

  UPDATE public.allocations
  SET
    person_ids = COALESCE(p_person_ids, '{}'::uuid[]),
    start_date = p_start_date,
    end_date = p_end_date,
    hours_per_day = COALESCE(p_hours_per_day, 0),
    total_hours = COALESCE(p_total_hours, 0),
    working_days = p_working_days,
    project_label = COALESCE(p_project_label, ''),
    project_id = p_project_id,
    notes = COALESCE(p_notes, ''),
    repeat_id = COALESCE(p_repeat_id, 'none'),
    is_leave = COALESCE(p_is_leave, false),
    leave_type = p_leave_type,
    updated_by = p_updated_by,
    project_color = p_project_color
  WHERE id = p_id
    AND version = p_expected_version
  RETURNING * INTO r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'optimistic_lock';
  END IF;

  DELETE FROM public.allocation_people WHERE allocation_id = p_id;

  INSERT INTO public.allocation_people (allocation_id, person_id)
  SELECT p_id, pid
  FROM unnest(COALESCE(p_person_ids, '{}'::uuid[])) AS pid
  ON CONFLICT DO NOTHING;

  RETURN r;
END;
$$;
