-- Materialize default availability (37.5h, Mon–Fri) for people who have no user_availability row yet.
-- Uses existing recalculate_person_availability → put_person_availability when missing.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      id
    FROM
      people
    WHERE
      NOT EXISTS (
        SELECT
          1
        FROM
          user_availability ua
        WHERE
          ua.person_id = people.id)
    LOOP
      PERFORM public.recalculate_person_availability (r.id);
    END LOOP;
END
$$;
