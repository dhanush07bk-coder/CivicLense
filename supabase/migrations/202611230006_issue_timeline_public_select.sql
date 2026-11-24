-- ============================================================================
-- Civilense Phase 2 Migration 0006: Direct Sanitized Public Read on issue_timeline
-- ============================================================================
-- Enables querying issue_timeline directly from the Supabase client without
-- requiring the public_issue_timeline view, while keeping changed_by private
-- and preserving existing INSERT/UPDATE/DELETE RLS protections.

REVOKE SELECT ON public.issue_timeline FROM anon, authenticated;
GRANT SELECT (
  id,
  issue_id,
  previous_status,
  new_status,
  action_description,
  actor_role,
  created_at
) ON public.issue_timeline TO anon, authenticated;

DROP POLICY IF EXISTS "Coordinators read raw issue_timeline" ON public.issue_timeline;
DROP POLICY IF EXISTS "Public read permitted issue_timeline" ON public.issue_timeline;
CREATE POLICY "Public read permitted issue_timeline"
  ON public.issue_timeline FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.civic_issues ci
      WHERE ci.id = issue_id
        AND ci.country_code = 'IN'
    )
  );
