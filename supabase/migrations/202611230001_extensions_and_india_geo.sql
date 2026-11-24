-- ============================================================================
-- Civilense Phase 2 Migration 0001: Extensions & India-Only PostGIS Validation
-- ============================================================================
-- Strategy Note:
--   A simple latitude/longitude bounding box over India ([6.5..37.2, 68.0..97.5])
--   incorrectly overlaps neighbouring countries (Pakistan, Nepal, Bhutan,
--   Bangladesh, Sri Lanka, China) and surrounding ocean waters.
--   Therefore, Civilense configures PostGIS (extensions.geometry(MultiPolygon, 4326))
--   with multi-polygon mainland + island geometries out-of-the-box and optional
--   high-resolution Survey of India / GADM State/UT polygon storage in
--   public.india_state_rules.boundary_geom.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- National boundary polygons (SRID 4326: lng, lat)
CREATE TABLE IF NOT EXISTS public.india_national_boundary (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  geom extensions.geometry(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Mainland India + Andaman & Nicobar + Lakshadweep polygons in PostGIS
INSERT INTO public.india_national_boundary (id, label, geom)
VALUES
  (
    'mainland',
    'India Mainland',
    extensions.ST_Multi(
      extensions.ST_GeomFromText(
        'POLYGON((
          68.15 23.70, 68.70 24.50, 71.10 24.90, 69.50 26.90, 70.50 28.00,
          73.80 30.10, 74.55 31.60, 74.40 32.60, 73.70 34.30, 74.30 35.20,
          74.60 37.05, 77.90 35.60, 79.10 34.40, 78.90 32.70, 79.10 31.30,
          80.30 30.10, 80.10 28.90, 81.90 27.90, 84.50 27.40, 88.10 26.40,
          88.00 27.15, 88.65 28.05, 88.90 27.20, 89.80 26.70, 92.10 26.80,
          91.60 27.80, 96.10 29.40, 97.40 28.20, 95.60 26.80, 94.60 24.50,
          93.40 23.70, 93.05 21.95, 92.20 22.90, 92.20 24.40, 92.40 25.15,
          89.90 25.20, 89.80 26.10, 88.30 26.30, 88.80 25.10, 88.60 24.10,
          89.00 22.60, 88.90 21.55, 87.50 21.60, 86.10 19.80, 83.40 17.70,
          81.20 15.80, 80.35 13.10, 79.90 10.30, 79.45 9.20, 77.55 8.05,
          76.90 8.45, 76.18 10.00, 74.82 12.80, 73.75 15.40, 72.75 18.95,
          72.70 20.80, 72.10 21.60, 70.90 20.70, 68.90 22.20, 68.30 23.10,
          68.15 23.70
        ))',
        4326
      )
    )
  ),
  (
    'andaman_nicobar',
    'Andaman and Nicobar Islands',
    extensions.ST_Multi(
      extensions.ST_GeomFromText(
        'POLYGON((
          92.80 13.70, 93.20 13.60, 93.10 11.50, 92.95 9.20, 93.95 6.74,
          93.60 6.80, 92.55 9.10, 92.40 11.50, 92.60 13.40, 92.80 13.70
        ))',
        4326
      )
    )
  ),
  (
    'lakshadweep',
    'Lakshadweep Islands',
    extensions.ST_Multi(
      extensions.ST_GeomFromText(
        'POLYGON((
          71.70 12.40, 73.90 12.40, 73.90 8.20, 71.70 8.20, 71.70 12.40
        ))',
        4326
      )
    )
  )
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_india_national_boundary_geom
  ON public.india_national_boundary USING GIST (geom);

-- Reference table for all 28 Indian States + 8 Union Territories (36 total)
CREATE TABLE IF NOT EXISTS public.india_state_rules (
  state_name TEXT PRIMARY KEY,
  pin_prefixes INTEGER[] NOT NULL,
  min_lat DOUBLE PRECISION NOT NULL,
  max_lat DOUBLE PRECISION NOT NULL,
  min_lng DOUBLE PRECISION NOT NULL,
  max_lng DOUBLE PRECISION NOT NULL,
  -- Optional exact Survey of India / GADM State/UT polygon
  boundary_geom extensions.geometry(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_india_state_rules_geom
  ON public.india_state_rules USING GIST (boundary_geom);

INSERT INTO public.india_state_rules (state_name, pin_prefixes, min_lat, max_lat, min_lng, max_lng)
VALUES
  ('Andaman and Nicobar Islands', ARRAY[74], 6.5, 14.0, 92.0, 94.5),
  ('Andhra Pradesh', ARRAY[51,52,53], 12.3, 19.3, 76.5, 85.0),
  ('Arunachal Pradesh', ARRAY[79], 26.4, 29.6, 91.4, 97.5),
  ('Assam', ARRAY[78], 24.0, 28.2, 89.5, 96.2),
  ('Bihar', ARRAY[80,81,82,83,84,85], 24.1, 27.7, 83.2, 88.4),
  ('Chandigarh', ARRAY[16], 30.5, 30.9, 76.6, 77.0),
  ('Chhattisgarh', ARRAY[49], 17.7, 24.3, 80.1, 84.6),
  ('Dadra and Nagar Haveli and Daman and Diu', ARRAY[39], 20.0, 21.0, 70.8, 73.4),
  ('Delhi', ARRAY[11], 28.3, 28.95, 76.75, 77.45),
  ('Goa', ARRAY[40], 14.8, 15.9, 73.5, 74.5),
  ('Gujarat', ARRAY[36,37,38,39], 20.0, 24.9, 68.0, 74.6),
  ('Haryana', ARRAY[12,13], 27.5, 31.0, 74.3, 77.7),
  ('Himachal Pradesh', ARRAY[17], 30.3, 33.3, 75.5, 79.1),
  ('Jammu and Kashmir', ARRAY[18,19], 32.2, 35.4, 73.5, 77.5),
  ('Jharkhand', ARRAY[81,82,83], 21.9, 25.5, 83.2, 87.95),
  ('Karnataka', ARRAY[56,57,58,59], 11.4, 18.6, 74.0, 78.7),
  ('Kerala', ARRAY[67,68,69], 8.1, 12.9, 74.7, 77.5),
  ('Ladakh', ARRAY[19], 32.2, 37.2, 75.3, 79.5),
  ('Lakshadweep', ARRAY[68], 8.0, 12.5, 71.5, 74.1),
  ('Madhya Pradesh', ARRAY[45,46,47,48], 21.0, 27.0, 73.9, 82.9),
  ('Maharashtra', ARRAY[40,41,42,43,44], 15.5, 22.2, 72.5, 81.0),
  ('Manipur', ARRAY[79], 23.7, 25.8, 92.9, 94.9),
  ('Meghalaya', ARRAY[79], 25.0, 26.2, 89.8, 92.9),
  ('Mizoram', ARRAY[79], 21.8, 24.6, 92.1, 93.6),
  ('Nagaland', ARRAY[79], 25.1, 27.1, 93.2, 95.3),
  ('Odisha', ARRAY[75,76,77], 17.7, 22.7, 81.3, 87.6),
  ('Puducherry', ARRAY[53,60,67], 10.7, 17.0, 75.4, 82.4),
  ('Punjab', ARRAY[14,15,16], 29.4, 32.6, 73.8, 77.0),
  ('Rajasthan', ARRAY[30,31,32,33,34], 23.0, 30.3, 69.4, 78.4),
  ('Sikkim', ARRAY[73], 27.0, 28.2, 87.9, 89.0),
  ('Tamil Nadu', ARRAY[60,61,62,63,64], 8.0, 13.7, 76.1, 80.5),
  ('Telangana', ARRAY[50], 15.7, 20.0, 77.1, 81.5),
  ('Tripura', ARRAY[79], 22.8, 24.6, 91.0, 92.5),
  ('Uttar Pradesh', ARRAY[20,21,22,23,24,25,26,27,28], 23.8, 30.6, 77.0, 84.8),
  ('Uttarakhand', ARRAY[24,25,26], 28.6, 31.6, 77.5, 81.2),
  ('West Bengal', ARRAY[70,71,72,73,74], 21.4, 27.3, 85.8, 90.0)
ON CONFLICT (state_name) DO UPDATE
SET
  pin_prefixes = EXCLUDED.pin_prefixes,
  min_lat = EXCLUDED.min_lat,
  max_lat = EXCLUDED.max_lat,
  min_lng = EXCLUDED.min_lng,
  max_lng = EXCLUDED.max_lng;

CREATE OR REPLACE FUNCTION public.contains_overseas_location_text(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_text, '') ~* '\y(united states|usa|united kingdom|uk|england|london|new york|los angeles|san francisco|toronto|canada|dubai|uae|singapore|australia|sydney|melbourne|germany|berlin|france|paris|tokyo|japan|pakistan|karachi|lahore|islamabad|bangladesh|dhaka|sri lanka|colombo|nepal|kathmandu|bhutan|thimphu|china|beijing|shanghai)\y';
$$;

CREATE OR REPLACE FUNCTION public.is_coordinate_within_india(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_point extensions.geometry(Point, 4326);
BEGIN
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_latitude < 6.5 OR p_latitude > 37.2 OR p_longitude < 68.0 OR p_longitude > 97.5 THEN
    RETURN FALSE;
  END IF;

  v_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326);

  RETURN EXISTS (
    SELECT 1
    FROM public.india_national_boundary b
    WHERE extensions.ST_Covers(b.geom, v_point)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_india_location(
  p_country_code TEXT,
  p_state TEXT,
  p_district TEXT,
  p_city TEXT,
  p_locality TEXT,
  p_pin_code TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rule public.india_state_rules%ROWTYPE;
  v_pin_prefix INTEGER;
  v_point extensions.geometry(Point, 4326);
BEGIN
  IF COALESCE(upper(trim(p_country_code)), '') <> 'IN' THEN
    RAISE EXCEPTION 'Civilense operates exclusively within India (country_code must equal IN).'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(trim(p_pin_code), '') !~ '^[1-8][0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid Indian PIN code "%". Must be 6 digits starting with 1-8.', p_pin_code
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_rule
  FROM public.india_state_rules
  WHERE lower(state_name) = lower(trim(COALESCE(p_state, '')))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'State or Union Territory "%" is not a valid Indian State/UT.', p_state
      USING ERRCODE = '22023';
  END IF;

  v_pin_prefix := substring(trim(p_pin_code) FROM 1 FOR 2)::INTEGER;
  IF NOT (v_pin_prefix = ANY(v_rule.pin_prefixes)) THEN
    RAISE EXCEPTION 'PIN code % does not belong to Indian postal circle for %.', p_pin_code, v_rule.state_name
      USING ERRCODE = '22023';
  END IF;

  IF public.contains_overseas_location_text(
    concat_ws(' ', p_district, p_city, p_locality)
  ) THEN
    RAISE EXCEPTION 'Overseas place names are not permitted. Civilense operates only in India.'
      USING ERRCODE = '22023';
  END IF;

  IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
    RAISE EXCEPTION 'Latitude and longitude must both be provided when coordinates are supplied.'
      USING ERRCODE = '22023';
  END IF;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    IF NOT public.is_coordinate_within_india(p_latitude, p_longitude) THEN
      RAISE EXCEPTION 'Coordinates (%, %) fall outside Indian territory and are rejected.', p_latitude, p_longitude
        USING ERRCODE = '22023';
    END IF;

    v_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326);

    IF v_rule.boundary_geom IS NOT NULL THEN
      IF NOT extensions.ST_Covers(v_rule.boundary_geom, v_point) THEN
        RAISE EXCEPTION 'Coordinates (%, %) fall outside the PostGIS boundary for %.', p_latitude, p_longitude, v_rule.state_name
          USING ERRCODE = '22023';
      END IF;
    ELSE
      IF p_latitude < v_rule.min_lat OR p_latitude > v_rule.max_lat
         OR p_longitude < v_rule.min_lng OR p_longitude > v_rule.max_lng THEN
        RAISE EXCEPTION 'Coordinates (%, %) do not match %.', p_latitude, p_longitude, v_rule.state_name
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;
END;
$$;
