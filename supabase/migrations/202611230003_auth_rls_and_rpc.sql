-- ============================================================================
-- Civilense Phase 2 Migration 0003: Auth Triggers, RLS Policies & Trusted RPCs
-- ============================================================================

-- 1. Automatic profile creation on auth.users signup (never allows Coordinator)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role TEXT;
  v_safe_role TEXT;
  v_full_name TEXT;
BEGIN
  v_requested_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'Citizen');
  -- Self-signup can ONLY choose Citizen or Volunteer; Coordinator requires admin SQL/service_role
  IF v_requested_role IN ('Citizen', 'Volunteer') THEN
    v_safe_role := v_requested_role;
  ELSE
    v_safe_role := 'Citizen';
  END IF;

  v_full_name := trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  IF char_length(v_full_name) < 2 THEN
    v_full_name := split_part(COALESCE(NEW.email, 'Civilense Member'), '@', 1);
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, v_full_name, v_safe_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Prevent ordinary users from elevating their own role in public.profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.role() <> 'service_role'
       AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Role changes are restricted to trusted administrative processes.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 3. Trusted Coordinator role check helper
CREATE OR REPLACE FUNCTION public.is_coordinator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'Coordinator'
  );
$$;

-- 4. Enable Row Level Security across all application tables
ALTER TABLE public.india_national_boundary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_state_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civic_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_followups ENABLE ROW LEVEL SECURITY;

-- Geo reference tables: public read-only
DROP POLICY IF EXISTS "Public read india_national_boundary" ON public.india_national_boundary;
CREATE POLICY "Public read india_national_boundary"
  ON public.india_national_boundary FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read india_state_rules" ON public.india_state_rules;
CREATE POLICY "Public read india_state_rules"
  ON public.india_state_rules FOR SELECT
  TO anon, authenticated
  USING (true);

-- Profiles: users read & update own name only (never role, never other users' private profiles)
DROP POLICY IF EXISTS "Users select own profile" ON public.profiles;
CREATE POLICY "Users select own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_coordinator());

DROP POLICY IF EXISTS "Users update own profile name" ON public.profiles;
CREATE POLICY "Users update own profile name"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Civic Issues:
-- Public tracking reads civic_issues directly using sanitized columns; reporter_id is revoked from anon/authenticated.
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

DROP POLICY IF EXISTS "Citizens can submit civic_issues" ON public.civic_issues;
CREATE POLICY "Citizens can submit civic_issues"
  ON public.civic_issues FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    country_code = 'IN'
    AND status = 'Submitted'
    AND (
      (is_anonymous = true AND reporter_id IS NULL)
      OR (auth.uid() IS NOT NULL AND is_anonymous = false AND reporter_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Coordinators update civic_issues" ON public.civic_issues;
CREATE POLICY "Coordinators update civic_issues"
  ON public.civic_issues FOR UPDATE
  TO authenticated
  USING (public.is_coordinator())
  WITH CHECK (public.is_coordinator());

-- Issue Timeline:
-- Citizens and anonymous visitors can read non-identifying status history for India reports; changed_by is revoked.
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

DROP POLICY IF EXISTS "Insert initial timeline or coordinator update" ON public.issue_timeline;
CREATE POLICY "Insert initial timeline or coordinator update"
  ON public.issue_timeline FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (new_status = 'Submitted' AND previous_status IS NULL AND changed_by IS NULL)
    OR public.is_coordinator()
  );

-- Community Initiatives: public read, coordinator write
DROP POLICY IF EXISTS "Public read community_initiatives" ON public.community_initiatives;
CREATE POLICY "Public read community_initiatives"
  ON public.community_initiatives FOR SELECT
  TO anon, authenticated
  USING (country_code = 'IN');

DROP POLICY IF EXISTS "Coordinators insert community_initiatives" ON public.community_initiatives;
CREATE POLICY "Coordinators insert community_initiatives"
  ON public.community_initiatives FOR INSERT
  TO authenticated
  WITH CHECK (public.is_coordinator());

DROP POLICY IF EXISTS "Coordinators update community_initiatives" ON public.community_initiatives;
CREATE POLICY "Coordinators update community_initiatives"
  ON public.community_initiatives FOR UPDATE
  TO authenticated
  USING (public.is_coordinator())
  WITH CHECK (public.is_coordinator());

DROP POLICY IF EXISTS "Coordinators delete community_initiatives" ON public.community_initiatives;
CREATE POLICY "Coordinators delete community_initiatives"
  ON public.community_initiatives FOR DELETE
  TO authenticated
  USING (public.is_coordinator());

-- Volunteer Registrations: users manage only their own rows; coordinators read rosters
DROP POLICY IF EXISTS "Select own or coordinator volunteer_registrations" ON public.volunteer_registrations;
CREATE POLICY "Select own or coordinator volunteer_registrations"
  ON public.volunteer_registrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_coordinator());

DROP POLICY IF EXISTS "Insert own volunteer_registration" ON public.volunteer_registrations;
CREATE POLICY "Insert own volunteer_registration"
  ON public.volunteer_registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND registration_status = 'Registered'
    AND attendance_status = 'Pending'
  );

DROP POLICY IF EXISTS "Update own volunteer_registration" ON public.volunteer_registrations;
CREATE POLICY "Update own volunteer_registration"
  ON public.volunteer_registrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_coordinator())
  WITH CHECK (
    public.is_coordinator()
    OR (user_id = auth.uid() AND registration_status IN ('Registered', 'Cancelled'))
  );

-- Intervention Evidence: public only sees Approved evidence; coordinators manage & approve
DROP POLICY IF EXISTS "Read approved or coordinator intervention_evidence" ON public.intervention_evidence;
CREATE POLICY "Read approved or coordinator intervention_evidence"
  ON public.intervention_evidence FOR SELECT
  TO anon, authenticated
  USING (
    verification_status = 'Approved'
    OR public.is_coordinator()
    OR (auth.uid() IS NOT NULL AND submitted_by = auth.uid())
  );

DROP POLICY IF EXISTS "Coordinators manage intervention_evidence" ON public.intervention_evidence;
CREATE POLICY "Coordinators manage intervention_evidence"
  ON public.intervention_evidence FOR ALL
  TO authenticated
  USING (public.is_coordinator())
  WITH CHECK (public.is_coordinator());

-- Issue Follow-Ups: coordinators manage, public views via sanitized public_issue_followups
DROP POLICY IF EXISTS "Coordinators manage issue_followups" ON public.issue_followups;
CREATE POLICY "Coordinators manage issue_followups"
  ON public.issue_followups FOR ALL
  TO authenticated
  USING (public.is_coordinator())
  WITH CHECK (public.is_coordinator());

-- ============================================================================
-- Sanitized Public Views (Never Expose Private Account Info / Reporter IDs)
-- ============================================================================

CREATE OR REPLACE VIEW public.public_civic_issues
WITH (security_barrier = true)
AS
SELECT
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
FROM public.civic_issues
WHERE country_code = 'IN';

CREATE OR REPLACE VIEW public.public_issue_timeline
WITH (security_barrier = true)
AS
SELECT
  id,
  issue_id,
  previous_status,
  new_status,
  action_description,
  actor_role,
  created_at
FROM public.issue_timeline;

CREATE OR REPLACE VIEW public.public_approved_evidence
WITH (security_barrier = true)
AS
SELECT
  id,
  issue_id,
  initiative_id,
  evidence_type,
  image_path,
  summary,
  verification_status,
  created_at
FROM public.intervention_evidence
WHERE verification_status = 'Approved';

CREATE OR REPLACE VIEW public.public_issue_followups
WITH (security_barrier = true)
AS
SELECT
  id,
  issue_id,
  checked_at,
  recurrence_detected,
  outcome,
  observations,
  evidence_path
FROM public.issue_followups;

CREATE OR REPLACE VIEW public.public_initiative_counts
WITH (security_barrier = true)
AS
SELECT
  ci.id AS initiative_id,
  COUNT(vr.id) FILTER (WHERE vr.registration_status = 'Registered')::INTEGER AS registered_count
FROM public.community_initiatives ci
LEFT JOIN public.volunteer_registrations vr
  ON vr.initiative_id = ci.id
GROUP BY ci.id;

GRANT SELECT ON public.public_civic_issues TO anon, authenticated;
GRANT SELECT ON public.public_issue_timeline TO anon, authenticated;
GRANT SELECT ON public.public_approved_evidence TO anon, authenticated;
GRANT SELECT ON public.public_issue_followups TO anon, authenticated;
GRANT SELECT ON public.public_initiative_counts TO anon, authenticated;

-- ============================================================================
-- Trusted Server-Side RPC Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_civic_issue(
  p_category TEXT,
  p_title TEXT,
  p_description TEXT,
  p_state TEXT,
  p_district TEXT,
  p_city TEXT,
  p_locality TEXT,
  p_pin_code TEXT,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_image_path TEXT DEFAULT NULL,
  p_is_anonymous BOOLEAN DEFAULT true,
  p_safety_advisory_shown BOOLEAN DEFAULT false
)
RETURNS public.public_civic_issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
  v_code TEXT;
  v_reporter UUID;
  v_inserted_id UUID;
  v_result public.public_civic_issues%ROWTYPE;
BEGIN
  v_seq := nextval('public.civic_report_seq');
  v_code := format('CIV-%s-%s', to_char(now(), 'YYYY'), v_seq);

  IF p_is_anonymous THEN
    v_reporter := NULL;
  ELSE
    v_reporter := auth.uid();
  END IF;

  INSERT INTO public.civic_issues (
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
    reporter_id,
    is_anonymous,
    status,
    safety_advisory_shown
  )
  VALUES (
    v_code,
    trim(p_title),
    trim(p_description),
    p_category,
    trim(p_state),
    trim(p_district),
    trim(p_city),
    trim(p_locality),
    trim(p_pin_code),
    'IN',
    p_latitude,
    p_longitude,
    p_image_path,
    v_reporter,
    COALESCE(p_is_anonymous, true),
    'Submitted',
    COALESCE(p_safety_advisory_shown, false)
  )
  RETURNING id INTO v_inserted_id;

  IF p_image_path IS NOT NULL AND char_length(trim(p_image_path)) > 0 THEN
    INSERT INTO public.intervention_evidence (
      issue_id,
      evidence_type,
      image_path,
      summary,
      submitted_by,
      verification_status
    )
    VALUES (
      v_inserted_id,
      'before',
      trim(p_image_path),
      'Initial reported site condition',
      v_reporter,
      'Approved'
    );
  END IF;

  INSERT INTO public.issue_timeline (
    issue_id,
    previous_status,
    new_status,
    action_description,
    changed_by,
    actor_role
  )
  VALUES (
    v_inserted_id,
    NULL,
    'Submitted',
    CASE
      WHEN COALESCE(p_is_anonymous, true)
        THEN 'Report submitted anonymously for coordinator verification.'
      ELSE 'Report submitted for coordinator verification.'
    END,
    v_reporter,
    'Citizen Report'
  );

  SELECT * INTO v_result FROM public.public_civic_issues WHERE id = v_inserted_id;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_civic_issue(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, TEXT, BOOLEAN, BOOLEAN
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.coordinator_update_issue(
  p_issue_id UUID,
  p_new_status TEXT,
  p_note TEXT,
  p_after_image_path TEXT DEFAULT NULL,
  p_resolution_summary TEXT DEFAULT NULL,
  p_approve_evidence BOOLEAN DEFAULT FALSE,
  p_followup_outcome TEXT DEFAULT NULL
)
RETURNS public.public_civic_issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.civic_issues%ROWTYPE;
  v_coord_name TEXT;
  v_note TEXT;
  v_result public.public_civic_issues%ROWTYPE;
BEGIN
  IF NOT public.is_coordinator() THEN
    RAISE EXCEPTION 'Only authorised Civic Coordinators can update issue workflows.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM public.civic_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Civic issue not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT full_name INTO v_coord_name FROM public.profiles WHERE id = auth.uid();
  v_note := COALESCE(NULLIF(trim(p_note), ''), format('Status updated to %s.', p_new_status));

  UPDATE public.civic_issues
  SET status = p_new_status
  WHERE id = p_issue_id;

  INSERT INTO public.issue_timeline (
    issue_id,
    previous_status,
    new_status,
    action_description,
    changed_by,
    actor_role
  )
  VALUES (
    p_issue_id,
    v_existing.status,
    p_new_status,
    v_note,
    auth.uid(),
    format('%s (Coordinator)', COALESCE(v_coord_name, 'Civic Coordinator'))
  );

  IF p_followup_outcome IS NOT NULL AND p_followup_outcome <> '' THEN
    INSERT INTO public.issue_followups (
      issue_id,
      checked_by,
      recurrence_detected,
      outcome,
      observations
    )
    VALUES (
      p_issue_id,
      auth.uid(),
      p_followup_outcome = 'Marked Recurring',
      p_followup_outcome,
      v_note
    );
  END IF;

  IF p_after_image_path IS NOT NULL AND trim(p_after_image_path) <> '' THEN
    INSERT INTO public.intervention_evidence (
      issue_id,
      evidence_type,
      image_path,
      summary,
      submitted_by,
      verification_status,
      verified_by
    )
    VALUES (
      p_issue_id,
      'after',
      trim(p_after_image_path),
      COALESCE(NULLIF(trim(p_resolution_summary), ''), v_note),
      auth.uid(),
      CASE WHEN p_approve_evidence OR p_new_status = 'Resolved' THEN 'Approved' ELSE 'Pending' END,
      CASE WHEN p_approve_evidence OR p_new_status = 'Resolved' THEN auth.uid() ELSE NULL END
    );
  ELSIF p_approve_evidence OR p_new_status = 'Resolved' THEN
    UPDATE public.intervention_evidence
    SET
      verification_status = 'Approved',
      verified_by = auth.uid(),
      summary = COALESCE(NULLIF(trim(p_resolution_summary), ''), summary)
    WHERE issue_id = p_issue_id
      AND evidence_type = 'after';
  END IF;

  SELECT * INTO v_result FROM public.public_civic_issues WHERE id = p_issue_id;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coordinator_update_issue(
  UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_for_initiative(p_initiative_id UUID)
RETURNS TABLE (
  registration_id UUID,
  registered_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_init public.community_initiatives%ROWTYPE;
  v_existing public.volunteer_registrations%ROWTYPE;
  v_active_count INTEGER;
  v_reg_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Please sign in before registering for a community initiative.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_init
  FROM public.community_initiatives
  WHERE id = p_initiative_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community initiative not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_init.status <> 'Open' THEN
    RAISE EXCEPTION 'Cannot register: initiative status is %.', v_init.status
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.volunteer_registrations
  WHERE initiative_id = p_initiative_id AND user_id = v_user_id;

  IF FOUND AND v_existing.registration_status = 'Registered' THEN
    RAISE EXCEPTION 'You are already registered for this community initiative.'
      USING ERRCODE = '23505';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.volunteer_registrations
  WHERE initiative_id = p_initiative_id AND registration_status = 'Registered';

  IF v_active_count >= v_init.capacity THEN
    RAISE EXCEPTION 'Volunteer capacity for this initiative is currently full.'
      USING ERRCODE = '22023';
  END IF;

  IF FOUND THEN
    UPDATE public.volunteer_registrations
    SET registration_status = 'Registered', registered_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_reg_id;
  ELSE
    INSERT INTO public.volunteer_registrations (initiative_id, user_id, registration_status)
    VALUES (p_initiative_id, v_user_id, 'Registered')
    RETURNING id INTO v_reg_id;
  END IF;

  RETURN QUERY
  SELECT
    v_reg_id,
    v_active_count + 1,
    format('Registration confirmed for %s.', v_init.title);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_initiative(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_initiative_registration(p_initiative_id UUID)
RETURNS TABLE (
  registered_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_init_title TEXT;
  v_active_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.volunteer_registrations
  SET registration_status = 'Cancelled'
  WHERE initiative_id = p_initiative_id
    AND user_id = v_user_id
    AND registration_status = 'Registered';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active registration found for this activity.' USING ERRCODE = 'P0002';
  END IF;

  SELECT title INTO v_init_title FROM public.community_initiatives WHERE id = p_initiative_id;
  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.volunteer_registrations
  WHERE initiative_id = p_initiative_id AND registration_status = 'Registered';

  RETURN QUERY
  SELECT v_active_count, format('Registration cancelled for %s.', COALESCE(v_init_title, 'initiative'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_initiative_registration(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_coordinator_initiative_roster(p_initiative_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  initiative_id UUID,
  volunteer_name TEXT,
  volunteer_email TEXT,
  registration_status TEXT,
  attendance_status TEXT,
  registered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_coordinator() THEN
    RAISE EXCEPTION 'Only authorised Civic Coordinators can view volunteer rosters.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    vr.id,
    vr.initiative_id,
    p.full_name AS volunteer_name,
    u.email::TEXT AS volunteer_email,
    vr.registration_status,
    vr.attendance_status,
    vr.registered_at
  FROM public.volunteer_registrations vr
  JOIN public.profiles p ON p.id = vr.user_id
  JOIN auth.users u ON u.id = vr.user_id
  WHERE vr.registration_status = 'Registered'
    AND (p_initiative_id IS NULL OR vr.initiative_id = p_initiative_id)
  ORDER BY vr.registered_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coordinator_initiative_roster(UUID) TO authenticated;
