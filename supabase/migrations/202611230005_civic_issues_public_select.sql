-- ============================================================================
-- Civilense Phase 2 Migration 0005: Direct Sanitized Public Read on civic_issues
-- ============================================================================
-- Enables querying civic_issues directly from the Supabase client without
-- requiring the public_civic_issues view, while keeping reporter_id private.

REVOKE SELECT ON public.civic_issues FROM anon, authenticated;
GRANT SELECT (
  id,
  report_code,
  title,
  description,
  category,
  state,
  district,
  city,
  locality,
  pin_code,
  country_code,
  latitude,
  longitude,
  image_path,
  is_anonymous,
  status,
  safety_advisory_shown,
  created_at,
  updated_at
) ON public.civic_issues TO anon, authenticated;

DROP POLICY IF EXISTS "Select own or coordinator civic_issues" ON public.civic_issues;
DROP POLICY IF EXISTS "Public read sanitized civic_issues" ON public.civic_issues;
CREATE POLICY "Public read sanitized civic_issues"
  ON public.civic_issues FOR SELECT
  TO anon, authenticated
  USING (country_code = 'IN');
