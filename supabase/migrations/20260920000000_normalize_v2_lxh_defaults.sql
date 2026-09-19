-- Normalize V2 LxH preset defaults so the second dimension is stored as height.
-- Safe to re-run: only rows with missing height and populated width are changed.
UPDATE public.estimate_v2_presets
SET default_height = default_width,
    default_width = NULL
WHERE active = true
  AND measurement_type = 'LxH'
  AND default_height IS NULL
  AND default_width IS NOT NULL;
