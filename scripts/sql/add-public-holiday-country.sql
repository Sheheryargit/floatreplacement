-- Run in Supabase Dashboard → SQL → New query if person create fails with:
-- "Could not find the 'public_holiday_country' column of 'people' in the schema cache"
--
-- For the full holiday catalog + triggers, run all pending migrations instead:
--   npm run supabase:migrate:hosted
-- or paste supabase/migrations/023_public_holidays_country_support.sql

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS public_holiday_country text NOT NULL DEFAULT 'None';

UPDATE public.people
SET public_holiday_country = CASE
  WHEN public_holiday_region IS NULL OR btrim(public_holiday_region) = '' OR lower(btrim(public_holiday_region)) = 'none' THEN 'None'
  WHEN upper(public_holiday_region) = 'AU' OR upper(public_holiday_region) LIKE 'AU-%' THEN 'AU'
  WHEN upper(public_holiday_region) = 'IN' OR upper(public_holiday_region) LIKE 'IN-%' THEN 'IN'
  ELSE 'None'
END
WHERE public_holiday_country IS NULL OR public_holiday_country = 'None';
