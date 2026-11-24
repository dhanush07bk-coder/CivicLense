-- ============================================================================
-- Civilense Phase 2 Migration 0002: Core Relational Tables, Constraints & Triggers
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.civic_report_seq START WITH 1001 INCREMENT BY 1;

-- 1. User Profiles (1-to-1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  role TEXT NOT NULL DEFAULT 'Citizen' CHECK (role IN ('Citizen', 'Volunteer', 'Coordinator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Civic Issues
CREATE TABLE IF NOT EXISTS public.civic_issues (
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
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
  CONSTRAINT civic_issues_anonymous_no_identity CHECK (NOT (is_anonymous AND reporter_id IS NOT NULL)),
  CONSTRAINT civic_issues_coords_pair CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_civic_issues_state_city_status
  ON public.civic_issues (state, city, status);
CREATE INDEX IF NOT EXISTS idx_civic_issues_pin_code
  ON public.civic_issues (pin_code);
CREATE INDEX IF NOT EXISTS idx_civic_issues_created_at
  ON public.civic_issues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_issues_reporter_id
  ON public.civic_issues (reporter_id)
  WHERE reporter_id IS NOT NULL;

-- 3. Issue Status Timeline
CREATE TABLE IF NOT EXISTS public.issue_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.civic_issues(id) ON DELETE CASCADE,
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
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'Citizen Report',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_timeline_issue_created
  ON public.issue_timeline (issue_id, created_at ASC);

-- 4. Community Initiatives
CREATE TABLE IF NOT EXISTS public.community_initiatives (
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
  coordinator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organizer_label TEXT NOT NULL DEFAULT 'Civic Coordinator',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Completed', 'Cancelled')),
  cancellation_reason TEXT,
  linked_issue_ids UUID[] NOT NULL DEFAULT '{}',
  highlights TEXT[] NOT NULL DEFAULT '{}',
  cover_image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT community_initiatives_time_order CHECK (end_time > start_time),
  CONSTRAINT community_initiatives_coords_pair CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT community_initiatives_cancel_reason CHECK (
    status <> 'Cancelled' OR char_length(trim(COALESCE(cancellation_reason, ''))) >= 5
  )
);

CREATE INDEX IF NOT EXISTS idx_community_initiatives_state_city_status
  ON public.community_initiatives (state, city, status);
CREATE INDEX IF NOT EXISTS idx_community_initiatives_event_date
  ON public.community_initiatives (event_date ASC);

-- 5. Volunteer Registrations
CREATE TABLE IF NOT EXISTS public.volunteer_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES public.community_initiatives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_status TEXT NOT NULL DEFAULT 'Registered' CHECK (
    registration_status IN ('Registered', 'Cancelled')
  ),
  attendance_status TEXT NOT NULL DEFAULT 'Pending' CHECK (
    attendance_status IN ('Pending', 'Attended', 'Absent')
  ),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT volunteer_registrations_unique_user_initiative UNIQUE (initiative_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_initiative_status
  ON public.volunteer_registrations (initiative_id, registration_status);
CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_user
  ON public.volunteer_registrations (user_id);

-- 6. Intervention Evidence (Before / After / Follow-Up Photos)
CREATE TABLE IF NOT EXISTS public.intervention_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.civic_issues(id) ON DELETE CASCADE,
  initiative_id UUID REFERENCES public.community_initiatives(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('before', 'after', 'followup')),
  image_path TEXT NOT NULL CHECK (char_length(trim(image_path)) >= 3),
  summary TEXT,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verification_status TEXT NOT NULL DEFAULT 'Pending' CHECK (
    verification_status IN ('Pending', 'Approved', 'Rejected')
  ),
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_evidence_issue_status
  ON public.intervention_evidence (issue_id, verification_status, evidence_type);

-- 7. Post-Resolution Follow-Up Checks
CREATE TABLE IF NOT EXISTS public.issue_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.civic_issues(id) ON DELETE CASCADE,
  checked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recurrence_detected BOOLEAN NOT NULL DEFAULT false,
  outcome TEXT NOT NULL DEFAULT 'Sustained' CHECK (
    outcome IN ('Sustained', 'Needs Attention', 'Marked Recurring')
  ),
  observations TEXT NOT NULL CHECK (char_length(trim(observations)) >= 3),
  evidence_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_issue_followups_issue_checked
  ON public.issue_followups (issue_id, checked_at DESC);

-- ============================================================================
-- Integrity & Workflow Triggers
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

DROP TRIGGER IF EXISTS trg_civic_issues_touch_updated_at ON public.civic_issues;
CREATE TRIGGER trg_civic_issues_touch_updated_at
  BEFORE UPDATE ON public.civic_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_community_initiatives_touch_updated_at ON public.community_initiatives;
CREATE TRIGGER trg_community_initiatives_touch_updated_at
  BEFORE UPDATE ON public.community_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Validate India-only location on civic_issues
CREATE OR REPLACE FUNCTION public.trg_validate_civic_issue()
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

DROP TRIGGER IF EXISTS trg_civic_issues_india_guard ON public.civic_issues;
CREATE TRIGGER trg_civic_issues_india_guard
  BEFORE INSERT OR UPDATE ON public.civic_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_civic_issue();

-- Validate issue status state machine transitions
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

CREATE OR REPLACE FUNCTION public.trg_enforce_issue_transition()
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

DROP TRIGGER IF EXISTS trg_civic_issues_status_transition ON public.civic_issues;
CREATE TRIGGER trg_civic_issues_status_transition
  BEFORE UPDATE ON public.civic_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_issue_transition();

-- Validate India-only location, capacity floor, and linked_issue_ids on community_initiatives
CREATE OR REPLACE FUNCTION public.trg_validate_community_initiative()
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
    FROM public.volunteer_registrations
    WHERE initiative_id = NEW.id
      AND registration_status = 'Registered';

    IF NEW.capacity < v_active_regs THEN
      RAISE EXCEPTION 'Capacity (%) cannot be lower than active volunteer registrations (%).', NEW.capacity, v_active_regs
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.linked_issue_ids IS NOT NULL AND array_length(NEW.linked_issue_ids, 1) IS NOT NULL THEN
    FOREACH v_linked_id IN ARRAY NEW.linked_issue_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.civic_issues WHERE id = v_linked_id) THEN
        RAISE EXCEPTION 'Linked civic issue UUID % does not exist.', v_linked_id
          USING ERRCODE = '23503';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_initiatives_guard ON public.community_initiatives;
CREATE TRIGGER trg_community_initiatives_guard
  BEFORE INSERT OR UPDATE ON public.community_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_community_initiative();
