-- ============================================================================
-- Civilense Phase 2B Migration 0007: Standardised public_* Tables, RLS & RPCs
-- ============================================================================
-- Authoritative schema aligned to the 7 Supabase tables:
--   1. public_profiles
--   2. public_civic_issues
--   3. public_issue_timeline
--   4. public_community_initiatives
--   5. public_volunteer_registrations
--   6. public_intervention_evidence
--   7. public_issue_followups
--
-- Idempotent: preserves all existing records while enforcing PostGIS India-only
-- geographic guards, column-scoped public reads, RLS, and SECURITY DEFINER RPCs.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.civic_report_seq START WITH 1001 INCREMENT BY 1;

-- ============================================================================
-- 1. Core Tables (public_* naming)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.public_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  role TEXT NOT NULL DEFAULT 'Citizen' CHECK (role IN ('Citizen', 'Volunteer', 'Coordinator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.public_civic_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code TEXT NOT NULL UNIQUE CHECK (report_code ~ '^CIV-[0-9]{4}-[0-9]{4,}$'),
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 5),
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 15),
  category TEXT NOT NULL CHECK (
    category IN (
      'Waste and Sanitation',
      'Public Space Damage',
      'Infrastructure / Electrical Hazard',
      'Public Obstruction',
      'Other Civic Issue'
    )
  ),
  state TEXT NOT NULL REFERENCES public.india_state_rules(state_name),
  district TEXT NOT NULL CHECK (char_length(trim(district)) >= 2),
  city TEXT NOT NULL CHECK (char_length(trim(city)) >= 2),
  locality TEXT NOT NULL CHECK (char_length(trim(locality)) >= 3),
  pin_code TEXT NOT NULL CHECK (pin_code ~ '^[1-8][0-9]{5}$'),
  country_code CHAR(2) NOT NULL DEFAULT 'IN' CHECK (country_code = 'IN'),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  image_path TEXT,
  reporter_id UUID REFERENCES public.public_profiles(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (
    status IN (
      'Submitted',
      'Under Verification',
      'Verified',
      'Action in Progress',
      'Resolved',
      'Recurring',
      'Rejected'
    )
  ),
  safety_advisory_shown BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_civic_issues_anonymous_no_identity CHECK (NOT (is_anonymous AND reporter_id IS NOT NULL)),
  CONSTRAINT public_civic_issues_coords_pair CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_public_civic_issues_state_city_status
  ON public.public_civic_issues (state, city, status);
CREATE INDEX IF NOT EXISTS idx_public_civic_issues_pin_code
  ON public.public_civic_issues (pin_code);
CREATE INDEX IF NOT EXISTS idx_public_civic_issues_created_at
  ON public.public_civic_issues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_civic_issues_reporter_id
  ON public.public_civic_issues (reporter_id)
  WHERE reporter_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.public_issue_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.public_civic_issues(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL CHECK (
    new_status IN (
      'Submitted',
      'Under Verification',
      'Verified',
      'Action in Progress',
      'Resolved',
      'Recurring',
      'Rejected'
    )
  ),
  action_description TEXT NOT NULL CHECK (char_length(trim(action_description)) >= 3),
  changed_by UUID REFERENCES public.public_profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'Citizen Report',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_issue_timeline_issue_created
  ON public.public_issue_timeline (issue_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.public_community_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 5),
  category TEXT NOT NULL CHECK (char_length(trim(category)) >= 2),
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 15),
  country_code CHAR(2) NOT NULL DEFAULT 'IN' CHECK (country_code = 'IN'),
  state TEXT NOT NULL REFERENCES public.india_state_rules(state_name),
  district TEXT NOT NULL CHECK (char_length(trim(district)) >= 2),
  city TEXT NOT NULL CHECK (char_length(trim(city)) >= 2),
  locality TEXT NOT NULL CHECK (char_length(trim(locality)) >= 3),
  pin_code TEXT NOT NULL CHECK (pin_code ~ '^[1-8][0-9]{5}$'),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 5 AND 500),
  coordinator_id UUID REFERENCES public.public_profiles(id) ON DELETE SET NULL,
  organizer_label TEXT NOT NULL DEFAULT 'Civic Coordinator',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Completed', 'Cancelled')),
  cancellation_reason TEXT,
  linked_issue_ids UUID[] NOT NULL DEFAULT '{}',
  highlights TEXT[] NOT NULL DEFAULT '{}',
  cover_image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_community_initiatives_time_order CHECK (end_time > start_time),
  CONSTRAINT public_community_initiatives_coords_pair CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT public_community_initiatives_cancel_reason CHECK (
    status <> 'Cancelled' OR char_length(trim(COALESCE(cancellation_reason, ''))) >= 5
  )
);

CREATE INDEX IF NOT EXISTS idx_public_community_initiatives_state_city_status
  ON public.public_community_initiatives (state, city, status);
CREATE INDEX IF NOT EXISTS idx_public_community_initiatives_event_date
  ON public.public_community_initiatives (event_date ASC);

CREATE TABLE IF NOT EXISTS public.public_volunteer_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES public.public_community_initiatives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.public_profiles(id) ON DELETE CASCADE,
  registration_status TEXT NOT NULL DEFAULT 'Registered' CHECK (
    registration_status IN ('Registered', 'Cancelled')
  ),
  attendance_status TEXT NOT NULL DEFAULT 'Pending' CHECK (
    attendance_status IN ('Pending', 'Attended', 'Absent')
  ),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_volunteer_registrations_unique_user_initiative UNIQUE (initiative_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_public_volunteer_registrations_initiative_status
  ON public.public_volunteer_registrations (initiative_id, registration_status);
CREATE INDEX IF NOT EXISTS idx_public_volunteer_registrations_user
  ON public.public_volunteer_registrations (user_id);

CREATE TABLE IF NOT EXISTS public.public_intervention_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.public_civic_issues(id) ON DELETE CASCADE,
  initiative_id UUID REFERENCES public.public_community_initiatives(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('before', 'after', 'followup')),
  image_path TEXT NOT NULL CHECK (char_length(trim(image_path)) >= 3),
  summary TEXT,
  submitted_by UUID REFERENCES public.public_profiles(id) ON DELETE SET NULL,
  verification_status TEXT NOT NULL DEFAULT 'Pending' CHECK (
    verification_status IN ('Pending', 'Approved', 'Rejected')
  ),
  verified_by UUID REFERENCES public.public_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_intervention_evidence_issue_status
  ON public.public_intervention_evidence (issue_id, verification_status, evidence_type);

CREATE TABLE IF NOT EXISTS public.public_issue_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.public_civic_issues(id) ON DELETE CASCADE,
  checked_by UUID REFERENCES public.public_profiles(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recurrence_detected BOOLEAN NOT NULL DEFAULT false,
  outcome TEXT NOT NULL DEFAULT 'Sustained' CHECK (
    outcome IN ('Sustained', 'Needs Attention', 'Marked Recurring')
  ),
  observations TEXT NOT NULL CHECK (char_length(trim(observations)) >= 3),
  evidence_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_public_issue_followups_issue_checked
  ON public.public_issue_followups (issue_id, checked_at DESC);

-- Idempotent schema alignment if leaner public_* tables already exist
ALTER TABLE public.public_profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.public_issue_timeline
  ADD COLUMN IF NOT EXISTS actor_role TEXT NOT NULL DEFAULT 'Citizen Report';

ALTER TABLE public.public_community_initiatives
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Community Action',
  ADD COLUMN IF NOT EXISTS organizer_label TEXT NOT NULL DEFAULT 'Civic Coordinator',
  ADD COLUMN IF NOT EXISTS highlights TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.public_intervention_evidence
  ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE public.public_issue_followups
  ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'Sustained';

-- ============================================================================
-- 2. Integrity, Auth & Workflow Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_civic_issues_touch_updated_at ON public.public_civic_issues;
CREATE TRIGGER trg_public_civic_issues_touch_updated_at
  BEFORE UPDATE ON public.public_civic_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_public_community_initiatives_touch_updated_at ON public.public_community_initiatives;
CREATE TRIGGER trg_public_community_initiatives_touch_updated_at
  BEFORE UPDATE ON public.public_community_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.trg_validate_public_civic_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.country_code := 'IN';
  PERFORM public.validate_india_location(
    NEW.country_code,
    NEW.state,
    NEW.district,
    NEW.city,
    NEW.locality,
    NEW.pin_code,
    NEW.latitude,
    NEW.longitude
  );

  IF NEW.is_anonymous THEN
    NEW.reporter_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_civic_issues_india_guard ON public.public_civic_issues;
CREATE TRIGGER trg_public_civic_issues_india_guard
  BEFORE INSERT OR UPDATE ON public.public_civic_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_public_civic_issue();

CREATE OR REPLACE FUNCTION public.is_valid_issue_transition(
  p_from TEXT,
  p_to TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_from = p_to THEN TRUE
    WHEN p_from = 'Submitted' AND p_to IN ('Under Verification', 'Verified', 'Rejected') THEN TRUE
    WHEN p_from = 'Under Verification' AND p_to IN ('Verified', 'Rejected') THEN TRUE
    WHEN p_from = 'Verified' AND p_to IN ('Action in Progress', 'Resolved', 'Rejected') THEN TRUE
    WHEN p_from = 'Action in Progress' AND p_to IN ('Resolved', 'Recurring', 'Verified') THEN TRUE
    WHEN p_from = 'Resolved' AND p_to IN ('Recurring') THEN TRUE
    WHEN p_from = 'Recurring' AND p_to IN ('Action in Progress', 'Resolved', 'Verified') THEN TRUE
    WHEN p_from = 'Rejected' AND p_to IN ('Under Verification') THEN TRUE
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_enforce_public_issue_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.is_valid_issue_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid issue status transition from "%" to "%".', OLD.status, NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_civic_issues_status_transition ON public.public_civic_issues;
CREATE TRIGGER trg_public_civic_issues_status_transition
  BEFORE UPDATE ON public.public_civic_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_public_issue_transition();

CREATE OR REPLACE FUNCTION public.trg_validate_public_community_initiative()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_regs INTEGER;
  v_linked_id UUID;
BEGIN
  NEW.country_code := 'IN';
  PERFORM public.validate_india_location(
    NEW.country_code,
    NEW.state,
    NEW.district,
    NEW.city,
    NEW.locality,
    NEW.pin_code,
    NEW.latitude,
    NEW.longitude
  );

  IF TG_OP = 'UPDATE' THEN
    SELECT COUNT(*)
    INTO v_active_regs
    FROM public.public_volunteer_registrations
    WHERE initiative_id = NEW.id
      AND registration_status = 'Registered';

    IF NEW.capacity < v_active_regs THEN
      RAISE EXCEPTION 'Capacity (%) cannot be lower than active volunteer registrations (%).', NEW.capacity, v_active_regs
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.linked_issue_ids IS NOT NULL AND array_length(NEW.linked_issue_ids, 1) IS NOT NULL THEN
    FOREACH v_linked_id IN ARRAY NEW.linked_issue_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.public_civic_issues WHERE id = v_linked_id) THEN
        RAISE EXCEPTION 'Linked civic issue UUID % does not exist.', v_linked_id
          USING ERRCODE = '23503';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_community_initiatives_guard ON public.public_community_initiatives;
CREATE TRIGGER trg_public_community_initiatives_guard
  BEFORE INSERT OR UPDATE ON public.public_community_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_public_community_initiative();

-- Trusted Coordinator role check against public_profiles
CREATE OR REPLACE FUNCTION public.is_coordinator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.public_profiles
    WHERE id = auth.uid()
      AND role = 'Coordinator'
  );
$$;

-- Automatic profile creation on auth.users signup (defaults to Citizen, never Coordinator)
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
  IF v_requested_role IN ('Citizen', 'Volunteer') THEN
    v_safe_role := v_requested_role;
  ELSE
    v_safe_role := 'Citizen';
  END IF;

  v_full_name := trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  IF char_length(v_full_name) < 2 THEN
    v_full_name := split_part(COALESCE(NEW.email, 'Civilense Member'), '@', 1);
  END IF;

  INSERT INTO public.public_profiles (id, full_name, role)
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

DROP TRIGGER IF EXISTS trg_public_profiles_prevent_role_escalation ON public.public_profiles;
CREATE TRIGGER trg_public_profiles_prevent_role_escalation
  BEFORE UPDATE ON public.public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- Prevent volunteers from changing their own attendance_status directly
CREATE OR REPLACE FUNCTION public.prevent_volunteer_attendance_self_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.attendance_status IS DISTINCT FROM OLD.attendance_status THEN
    IF NOT public.is_coordinator()
       AND auth.role() <> 'service_role'
       AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Only authorised Civic Coordinators can mark volunteer attendance.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_volunteer_reg_attendance_guard ON public.public_volunteer_registrations;
CREATE TRIGGER trg_public_volunteer_reg_attendance_guard
  BEFORE UPDATE ON public.public_volunteer_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_volunteer_attendance_self_edit();

-- ============================================================================
-- 3. Row Level Security & Column-Scoped Public Grants
-- ============================================================================

ALTER TABLE public.india_national_boundary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_state_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_civic_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_issue_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_community_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_volunteer_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_intervention_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_issue_followups ENABLE ROW LEVEL SECURITY;

-- Geo reference tables
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

-- public_profiles
DROP POLICY IF EXISTS "Users select own public_profile" ON public.public_profiles;
CREATE POLICY "Users select own public_profile"
  ON public.public_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_coordinator());

DROP POLICY IF EXISTS "Users update own public_profile name" ON public.public_profiles;
CREATE POLICY "Users update own public_profile name"
  ON public.public_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- public_civic_issues (reporter_id revoked from anon/authenticated)
REVOKE SELECT ON public.public_civic_issues FROM anon, authenticated;
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
) ON public.public_civic_issues TO anon, authenticated;

DROP POLICY IF EXISTS "Public read sanitized public_civic_issues" ON public.public_civic_issues;
CREATE POLICY "Public read sanitized public_civic_issues"
  ON public.public_civic_issues FOR SELECT
  TO anon, authenticated
  USING (country_code = 'IN');

DROP POLICY IF EXISTS "Citizens submit public_civic_issues" ON public.public_civic_issues;
CREATE POLICY "Citizens submit public_civic_issues"
  ON public.public_civic_issues FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    country_code = 'IN'
    AND status = 'Submitted'
    AND (
      (is_anonymous = true AND reporter_id IS NULL)
      OR (auth.uid() IS NOT NULL AND is_anonymous = false AND reporter_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Coordinators update public_civic_issues" ON public.public_civic_issues;
CREATE POLICY "Coordinators update public_civic_issues"
  ON public.public_civic_issues FOR UPDATE
  TO authenticated
  USING (public.is_coordinator())
  WITH CHECK (public.is_coordinator());

-- public_issue_timeline (changed_by revoked from anon/authenticated)
REVOKE SELECT ON public.public_issue_timeline FROM anon, authenticated;
GRANT SELECT (
  id,
  issue_id,
  previous_status,
  new_status,
  action_description,
  actor_role,
  created_at
) ON public.public_issue_timeline TO anon, authenticated;

DROP POLICY IF EXISTS "Public read permitted public_issue_timeline" ON public.public_issue_timeline;
CREATE POLICY "Public read permitted public_issue_timeline"
  ON public.public_issue_timeline FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_civic_issues ci
      WHERE ci.id = issue_id
        AND ci.country_code = 'IN'
    )
  );

DROP POLICY IF EXISTS "Insert initial timeline or coordinator update" ON public.public_issue_timeline;
CREATE POLICY "Insert initial timeline or coordinator update"
  ON public.public_issue_timeline FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (new_status = 'Submitted' AND previous_status IS NULL AND changed_by IS NULL)
    OR public.is_coordinator()
  );

-- public_community_initiatives (coordinator_id revoked from anon/authenticated)
REVOKE SELECT ON public.public_community_initiatives FROM anon, authenticated;
GRANT SELECT (
  id,
  title,
  category,
  description,
  country_code,
  state,
  district,
  city,
  locality,
  pin_code,
  latitude,
  longitude,
  event_date,
  start_time,
  end_time,
  capacity,
  organizer_label,
  status,
  cancellation_reason,
  linked_issue_ids,
  highlights,
  cover_image_path,
  created_at,
  updated_at
) ON public.public_community_initiatives TO anon, authenticated;

DROP POLICY IF EXISTS "Public read public_community_initiatives" ON public.public_community_initiatives;
CREATE POLICY "Public read public_community_initiatives"
  ON public.public_community_initiatives FOR SELECT
  TO anon, authenticated
  USING (country_code = 'IN');

DROP POLICY IF EXISTS "Coordinators insert public_community_initiatives" ON public.public_community_initiatives;
CREATE POLICY "Coordinators insert public_community_initiatives"
  ON public.public_community_initiatives FOR INSERT
  TO authenticated
  WITH CHECK (public.is_coordinator());

DROP POLICY IF EXISTS "Coordinators update public_community_initiatives" ON public.public_community_initiatives;
CREATE POLICY "Coordinators update public_community_initiatives"
  ON public.public_community_initiatives FOR UPDATE
  TO authenticated
  USING (public.is_coordinator())
  WITH CHECK (public.is_coordinator());

DROP POLICY IF EXISTS "Coordinators delete public_community_initiatives" ON public.public_community_initiatives;
CREATE POLICY "Coordinators delete public_community_initiatives"
  ON public.public_community_initiatives FOR DELETE
  TO authenticated
  USING (public.is_coordinator());

-- public_volunteer_registrations
DROP POLICY IF EXISTS "Select own or coordinator public_volunteer_registrations" ON public.public_volunteer_registrations;
CREATE POLICY "Select own or coordinator public_volunteer_registrations"
  ON public.public_volunteer_registrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_coordinator());

DROP POLICY IF EXISTS "Insert own public_volunteer_registration" ON public.public_volunteer_registrations;
CREATE POLICY "Insert own public_volunteer_registration"
  ON public.public_volunteer_registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND registration_status = 'Registered'
    AND attendance_status = 'Pending'
  );

DROP POLICY IF EXISTS "Update own or coordinator public_volunteer_registration" ON public.public_volunteer_registrations;
CREATE POLICY "Update own or coordinator public_volunteer_registration"
  ON public.public_volunteer_registrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_coordinator())
  WITH CHECK (
    public.is_coordinator()
    OR (user_id = auth.uid() AND registration_status IN ('Registered', 'Cancelled'))
  );

-- public_intervention_evidence (submitted_by & verified_by revoked from anon/authenticated)
REVOKE SELECT ON public.public_intervention_evidence FROM anon, authenticated;
GRANT SELECT (
  id,
  issue_id,
  initiative_id,
  evidence_type,
  image_path,
  summary,
  verification_status,
  created_at
) ON public.public_intervention_evidence TO anon, authenticated;

DROP POLICY IF EXISTS "Read approved or coordinator public_intervention_evidence" ON public.public_intervention_evidence;
CREATE POLICY "Read approved or coordinator public_intervention_evidence"
  ON public.public_intervention_evidence FOR SELECT
  TO anon, authenticated
  USING (
    verification_status = 'Approved'
    OR public.is_coordinator()
    OR (auth.uid() IS NOT NULL AND submitted_by = auth.uid())
  );

DROP POLICY IF EXISTS "Volunteers insert pending evidence for registered initiatives" ON public.public_intervention_evidence;
CREATE POLICY "Volunteers insert pending evidence for registered initiatives"
  ON public.public_intervention_evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.is_coordinator()
    )
    OR (
      auth.uid() IS NOT NULL
      AND submitted_by = auth.uid()
      AND verification_status = 'Pending'
      AND verified_by IS NULL
      AND initiative_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.public_volunteer_registrations vr
        JOIN public.public_community_initiatives ci ON ci.id = vr.initiative_id
        WHERE vr.initiative_id = initiative_id
          AND vr.user_id = auth.uid()
          AND vr.registration_status = 'Registered'
          AND issue_id = ANY (ci.linked_issue_ids)
      )
    )
  );

DROP POLICY IF EXISTS "Coordinators update public_intervention_evidence" ON public.public_intervention_evidence;
CREATE POLICY "Coordinators update public_intervention_evidence"
  ON public.public_intervention_evidence FOR UPDATE
  TO authenticated
  USING (public.is_coordinator())
  WITH CHECK (public.is_coordinator());

DROP POLICY IF EXISTS "Coordinators delete public_intervention_evidence" ON public.public_intervention_evidence;
CREATE POLICY "Coordinators delete public_intervention_evidence"
  ON public.public_intervention_evidence FOR DELETE
  TO authenticated
  USING (public.is_coordinator());

-- public_issue_followups (checked_by revoked from anon/authenticated)
REVOKE SELECT ON public.public_issue_followups FROM anon, authenticated;
GRANT SELECT (
  id,
  issue_id,
  checked_at,
  recurrence_detected,
  outcome,
  observations,
  evidence_path
) ON public.public_issue_followups TO anon, authenticated;

DROP POLICY IF EXISTS "Public read sanitized public_issue_followups" ON public.public_issue_followups;
CREATE POLICY "Public read sanitized public_issue_followups"
  ON public.public_issue_followups FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_civic_issues ci
      WHERE ci.id = issue_id
        AND ci.country_code = 'IN'
    )
  );

DROP POLICY IF EXISTS "Coordinators insert public_issue_followups" ON public.public_issue_followups;
CREATE POLICY "Coordinators insert public_issue_followups"
  ON public.public_issue_followups FOR INSERT
  TO authenticated
  WITH CHECK (public.is_coordinator());

DROP POLICY IF EXISTS "Coordinators update public_issue_followups" ON public.public_issue_followups;
CREATE POLICY "Coordinators update public_issue_followups"
  ON public.public_issue_followups FOR UPDATE
  TO authenticated
  USING (public.is_coordinator())
  WITH CHECK (public.is_coordinator());

DROP POLICY IF EXISTS "Coordinators delete public_issue_followups" ON public.public_issue_followups;
CREATE POLICY "Coordinators delete public_issue_followups"
  ON public.public_issue_followups FOR DELETE
  TO authenticated
  USING (public.is_coordinator());

-- ============================================================================
-- 4. Trusted Server-Side RPC Functions
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

  IF COALESCE(p_is_anonymous, true) THEN
    v_reporter := NULL;
  ELSE
    v_reporter := auth.uid();
  END IF;

  INSERT INTO public.public_civic_issues (
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
    INSERT INTO public.public_intervention_evidence (
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

  INSERT INTO public.public_issue_timeline (
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
  v_result.reporter_id := NULL;
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
  v_existing public.public_civic_issues%ROWTYPE;
  v_coord_name TEXT;
  v_note TEXT;
  v_result public.public_civic_issues%ROWTYPE;
BEGIN
  IF NOT public.is_coordinator() THEN
    RAISE EXCEPTION 'Only authorised Civic Coordinators can update issue workflows.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM public.public_civic_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Civic issue not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT full_name INTO v_coord_name FROM public.public_profiles WHERE id = auth.uid();
  v_note := COALESCE(NULLIF(trim(p_note), ''), format('Status updated to %s.', p_new_status));

  UPDATE public.public_civic_issues
  SET status = p_new_status
  WHERE id = p_issue_id;

  INSERT INTO public.public_issue_timeline (
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
    INSERT INTO public.public_issue_followups (
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
    INSERT INTO public.public_intervention_evidence (
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
    UPDATE public.public_intervention_evidence
    SET
      verification_status = 'Approved',
      verified_by = auth.uid(),
      summary = COALESCE(NULLIF(trim(p_resolution_summary), ''), summary)
    WHERE issue_id = p_issue_id
      AND evidence_type = 'after';
  END IF;

  SELECT * INTO v_result FROM public.public_civic_issues WHERE id = p_issue_id;
  v_result.reporter_id := NULL;
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
  v_init public.public_community_initiatives%ROWTYPE;
  v_existing public.public_volunteer_registrations%ROWTYPE;
  v_active_count INTEGER;
  v_reg_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Please sign in before registering for a community initiative.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_init
  FROM public.public_community_initiatives
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
  FROM public.public_volunteer_registrations
  WHERE initiative_id = p_initiative_id AND user_id = v_user_id;

  IF FOUND AND v_existing.registration_status = 'Registered' THEN
    RAISE EXCEPTION 'You are already registered for this community initiative.'
      USING ERRCODE = '23505';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.public_volunteer_registrations
  WHERE initiative_id = p_initiative_id AND registration_status = 'Registered';

  IF v_active_count >= v_init.capacity THEN
    RAISE EXCEPTION 'Volunteer capacity for this initiative is currently full.'
      USING ERRCODE = '22023';
  END IF;

  IF FOUND THEN
    UPDATE public.public_volunteer_registrations
    SET registration_status = 'Registered', registered_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_reg_id;
  ELSE
    INSERT INTO public.public_volunteer_registrations (initiative_id, user_id, registration_status)
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

  UPDATE public.public_volunteer_registrations
  SET registration_status = 'Cancelled'
  WHERE initiative_id = p_initiative_id
    AND user_id = v_user_id
    AND registration_status = 'Registered';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active registration found for this activity.' USING ERRCODE = 'P0002';
  END IF;

  SELECT title INTO v_init_title FROM public.public_community_initiatives WHERE id = p_initiative_id;
  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.public_volunteer_registrations
  WHERE initiative_id = p_initiative_id AND registration_status = 'Registered';

  RETURN QUERY
  SELECT v_active_count, format('Registration cancelled for %s.', COALESCE(v_init_title, 'initiative'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_initiative_registration(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_initiative_counts()
RETURNS TABLE (
  initiative_id UUID,
  registered_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ci.id AS initiative_id,
    COUNT(vr.id) FILTER (WHERE vr.registration_status = 'Registered')::INTEGER AS registered_count
  FROM public.public_community_initiatives ci
  LEFT JOIN public.public_volunteer_registrations vr
    ON vr.initiative_id = ci.id
  WHERE ci.country_code = 'IN'
  GROUP BY ci.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_initiative_counts() TO anon, authenticated;

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
  FROM public.public_volunteer_registrations vr
  JOIN public.public_profiles p ON p.id = vr.user_id
  JOIN auth.users u ON u.id = vr.user_id
  WHERE vr.registration_status = 'Registered'
    AND (p_initiative_id IS NULL OR vr.initiative_id = p_initiative_id)
  ORDER BY vr.registered_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coordinator_initiative_roster(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_volunteer_attendance(
  p_registration_id UUID,
  p_attendance_status TEXT
)
RETURNS public.public_volunteer_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated public.public_volunteer_registrations%ROWTYPE;
BEGIN
  IF NOT public.is_coordinator() THEN
    RAISE EXCEPTION 'Only authorised Civic Coordinators can mark volunteer attendance.'
      USING ERRCODE = '42501';
  END IF;

  IF p_attendance_status NOT IN ('Pending', 'Attended', 'Absent') THEN
    RAISE EXCEPTION 'Invalid attendance status "%".', p_attendance_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.public_volunteer_registrations
  SET attendance_status = p_attendance_status
  WHERE id = p_registration_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Volunteer registration record not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_volunteer_attendance(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_volunteer_evidence(
  p_issue_id UUID,
  p_initiative_id UUID,
  p_image_path TEXT,
  p_summary TEXT
)
RETURNS public.public_intervention_evidence
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_allowed BOOLEAN;
  v_inserted public.public_intervention_evidence%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to upload intervention evidence.'
      USING ERRCODE = '42501';
  END IF;

  SELECT (
    public.is_coordinator()
    OR EXISTS (
      SELECT 1
      FROM public.public_volunteer_registrations vr
      JOIN public.public_community_initiatives ci ON ci.id = vr.initiative_id
      WHERE vr.initiative_id = p_initiative_id
        AND vr.user_id = v_user_id
        AND vr.registration_status = 'Registered'
        AND p_issue_id = ANY (ci.linked_issue_ids)
    )
  ) INTO v_is_allowed;

  IF NOT COALESCE(v_is_allowed, false) THEN
    RAISE EXCEPTION 'You must be registered for this linked community initiative to submit field evidence.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.public_intervention_evidence (
    issue_id,
    initiative_id,
    evidence_type,
    image_path,
    summary,
    submitted_by,
    verification_status,
    verified_by
  )
  VALUES (
    p_issue_id,
    p_initiative_id,
    'after',
    trim(p_image_path),
    trim(p_summary),
    v_user_id,
    'Pending',
    NULL
  )
  RETURNING * INTO v_inserted;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_volunteer_evidence(UUID, UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_issue_followup(
  p_issue_id UUID,
  p_outcome TEXT,
  p_observations TEXT,
  p_evidence_path TEXT DEFAULT NULL
)
RETURNS public.public_issue_followups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.public_civic_issues%ROWTYPE;
  v_coord_name TEXT;
  v_inserted public.public_issue_followups%ROWTYPE;
BEGIN
  IF NOT public.is_coordinator() THEN
    RAISE EXCEPTION 'Only authorised Civic Coordinators can log follow-up checks.'
      USING ERRCODE = '42501';
  END IF;

  IF p_outcome NOT IN ('Sustained', 'Needs Attention', 'Marked Recurring') THEN
    RAISE EXCEPTION 'Invalid follow-up outcome "%".', p_outcome USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.public_civic_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Civic issue not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.public_issue_followups (
    issue_id,
    checked_by,
    recurrence_detected,
    outcome,
    observations,
    evidence_path
  )
  VALUES (
    p_issue_id,
    auth.uid(),
    p_outcome = 'Marked Recurring',
    p_outcome,
    trim(p_observations),
    NULLIF(trim(COALESCE(p_evidence_path, '')), '')
  )
  RETURNING * INTO v_inserted;

  IF p_outcome = 'Marked Recurring' AND v_existing.status <> 'Recurring' THEN
    SELECT full_name INTO v_coord_name FROM public.public_profiles WHERE id = auth.uid();

    UPDATE public.public_civic_issues
    SET status = 'Recurring'
    WHERE id = p_issue_id;

    INSERT INTO public.public_issue_timeline (
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
      'Recurring',
      trim(p_observations),
      auth.uid(),
      format('%s (Coordinator)', COALESCE(v_coord_name, 'Civic Coordinator'))
    );
  END IF;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_issue_followup(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_public_civic_issue(p_report_code TEXT)
RETURNS TABLE (
  id UUID,
  report_code TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  state TEXT,
  district TEXT,
  city TEXT,
  locality TEXT,
  pin_code TEXT,
  country_code CHAR(2),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  image_path TEXT,
  is_anonymous BOOLEAN,
  status TEXT,
  safety_advisory_shown BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ci.id,
    ci.report_code,
    ci.title,
    ci.description,
    ci.category,
    ci.state,
    ci.district,
    ci.city,
    ci.locality,
    ci.pin_code,
    ci.country_code,
    ci.latitude,
    ci.longitude,
    ci.image_path,
    ci.is_anonymous,
    ci.status,
    ci.safety_advisory_shown,
    ci.created_at,
    ci.updated_at
  FROM public.public_civic_issues ci
  WHERE ci.country_code = 'IN'
    AND upper(ci.report_code) = upper(trim(p_report_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_public_civic_issue(TEXT) TO anon, authenticated;

-- ============================================================================
-- 5. Storage Policies Synchronised with public_intervention_evidence
-- ============================================================================

DROP POLICY IF EXISTS "Authorized read intervention-evidence" ON storage.objects;
CREATE POLICY "Authorized read intervention-evidence"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'intervention-evidence'
    AND (
      public.is_coordinator()
      OR (auth.uid() IS NOT NULL AND owner = auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.public_intervention_evidence ie
        WHERE ie.image_path = name
          AND ie.verification_status = 'Approved'
      )
    )
  );

DROP POLICY IF EXISTS "Coordinators upload intervention-evidence" ON storage.objects;
DROP POLICY IF EXISTS "Coordinators or registered volunteers upload intervention-evidence" ON storage.objects;
CREATE POLICY "Coordinators or registered volunteers upload intervention-evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'intervention-evidence'
    AND name ~ '^evidence/[0-9]{4}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$'
    AND (
      public.is_coordinator()
      OR EXISTS (
        SELECT 1
        FROM public.public_volunteer_registrations vr
        WHERE vr.user_id = auth.uid()
          AND vr.registration_status = 'Registered'
      )
    )
  );
