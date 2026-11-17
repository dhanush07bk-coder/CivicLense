import {
  CommunityInitiative,
  CivicIssue,
  DashboardMetrics,
  IssueCategory,
  IssueStatus,
  LocalitySummary,
  MapCoordinate,
  PublicCivicIssue,
  UserAccount,
  UserRole,
  VolunteerRegistration,
} from '../types/civic';
import {
  containsOverseasLocationText,
  INDIA_COUNTRY_CODE,
  isCoordinateWithinIndia,
  isValidIndianState,
  validateIndianPinCode,
} from './indiaGeo';

export interface IssueSubmissionInput {
  category: IssueCategory | '';
  title: string;
  description: string;
  country_code?: 'IN' | string;
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  latitude?: number;
  longitude?: number;
  coordinates?: MapCoordinate;
  imageUrl?: string;
  isAnonymous: boolean;
  reporterEmail?: string;
}

export interface InitiativeSubmissionInput {
  title: string;
  category: string;
  description: string;
  country_code?: 'IN' | string;
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  dateLabel: string;
  timeLabel: string;
  capacity: number;
  latitude?: number;
  longitude?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole.Citizen | UserRole.Volunteer;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface IssueFilterCriteria {
  query: string;
  category: IssueCategory | 'All';
  status: IssueStatus | 'All';
  state: string | 'All';
  city: string | 'All';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VERIFIED_STATUSES = new Set<IssueStatus>([
  IssueStatus.Verified,
  IssueStatus.ActionInProgress,
  IssueStatus.Resolved,
  IssueStatus.Recurring,
]);

export function generateReportId(existingIds: string[], now = new Date()): string {
  const year = now.getFullYear();
  const existingSet = new Set(existingIds.map((id) => id.toUpperCase()));
  let attempt = 1000 + existingIds.length + 1;

  for (let i = 0; i < 500; i += 1) {
    const candidate = `CIV-${year}-${attempt + i}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }
  return `CIV-${year}-${Date.now().toString().slice(-4)}`;
}

export function requiresAuthoritySafetyAdvisory(
  category: IssueCategory | '',
  title: string,
  description: string,
): boolean {
  if (category === IssueCategory.InfrastructureHazard) {
    return true;
  }
  const combined = `${title} ${description}`.toLowerCase();
  return /(live wire|electrical|transformer|sparking|exposed cable|gas leak|collapsed|sinkhole)/.test(
    combined,
  );
}

export function formatIndianAddress(fields: {
  locality: string;
  city: string;
  district?: string;
  state: string;
  pin_code: string;
}): string {
  const parts = [
    fields.locality.trim(),
    fields.city.trim(),
    fields.district &&
    fields.district.trim() &&
    fields.district.trim().toLowerCase() !== fields.city.trim().toLowerCase()
      ? `${fields.district.trim()} District`
      : '',
    `${fields.state.trim()} - ${fields.pin_code.trim()}`,
    'India',
  ].filter(Boolean);
  return parts.join(', ');
}

export function validateIndiaLocationFields(input: {
  country_code?: string;
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  latitude?: number;
  longitude?: number;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (input.country_code && input.country_code !== INDIA_COUNTRY_CODE) {
    errors.country_code = 'Civilense operates exclusively within India (IN).';
  }

  if (!input.state.trim() || !isValidIndianState(input.state)) {
    errors.state = 'Please select a valid Indian State or Union Territory.';
  }

  const trimmedDistrict = input.district.trim();
  if (!trimmedDistrict || trimmedDistrict.length < 2) {
    errors.district = 'Please enter the Indian district name.';
  } else if (containsOverseasLocationText(trimmedDistrict)) {
    errors.district =
      'Overseas locations are not permitted. Civilense operates only in India.';
  }

  const trimmedCity = input.city.trim();
  if (!trimmedCity || trimmedCity.length < 2) {
    errors.city = 'Please enter the Indian city or town.';
  } else if (containsOverseasLocationText(trimmedCity)) {
    errors.city =
      'Overseas cities cannot be submitted. Civilense operates only in India.';
  }

  const trimmedLocality = input.locality.trim();
  if (!trimmedLocality || trimmedLocality.length < 3) {
    errors.locality = 'Please enter the locality, ward, or street area.';
  } else if (containsOverseasLocationText(trimmedLocality)) {
    errors.locality =
      'Overseas locations cannot be submitted. Enter an Indian locality.';
  }

  if (!validateIndianPinCode(input.pin_code)) {
    errors.pin_code =
      'Enter a valid 6-digit Indian PIN code (starting with digits 1–8).';
  }

  if (input.latitude !== undefined || input.longitude !== undefined) {
    if (
      input.latitude === undefined ||
      input.longitude === undefined ||
      !isCoordinateWithinIndia(input.latitude, input.longitude)
    ) {
      errors.coordinates =
        'Selected map coordinates lie outside India and cannot be accepted.';
    }
  }

  return errors;
}

export function validateIssueSubmission(input: IssueSubmissionInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.category) {
    errors.category = 'Please select an objective issue category.';
  }

  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    errors.title = 'Please enter a concise issue title.';
  } else if (trimmedTitle.length < 5) {
    errors.title = 'Issue title must be at least 5 characters.';
  }

  const trimmedDescription = input.description.trim();
  if (!trimmedDescription) {
    errors.description = 'Please describe the issue location and observed condition.';
  } else if (trimmedDescription.length < 15) {
    errors.description = 'Please provide at least 15 characters of neutral description.';
  }

  const locationErrors = validateIndiaLocationFields({
    country_code: input.country_code ?? INDIA_COUNTRY_CODE,
    state: input.state,
    district: input.district,
    city: input.city,
    locality: input.locality,
    pin_code: input.pin_code,
    latitude: input.latitude ?? input.coordinates?.lat,
    longitude: input.longitude ?? input.coordinates?.lng,
  });

  Object.assign(errors, locationErrors);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateInitiativeSubmission(
  input: InitiativeSubmissionInput,
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.title.trim() || input.title.trim().length < 5) {
    errors.title = 'Activity title must be at least 5 characters.';
  }
  if (!input.description.trim() || input.description.trim().length < 15) {
    errors.description = 'Description must be at least 15 characters.';
  }

  const locationErrors = validateIndiaLocationFields({
    country_code: input.country_code ?? INDIA_COUNTRY_CODE,
    state: input.state,
    district: input.district,
    city: input.city,
    locality: input.locality,
    pin_code: input.pin_code,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  Object.assign(errors, locationErrors);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateSignupForm(input: SignupInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.fullName.trim() || input.fullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name.';
  }
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  }
  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  if (input.role !== UserRole.Citizen && input.role !== UserRole.Volunteer) {
    errors.role = 'Please choose Citizen or Volunteer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateLoginForm(input: LoginInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!input.password.trim()) {
    errors.password = 'Please enter your password.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function assertValidIndiaIssueRecord(issue: CivicIssue): boolean {
  if (issue.country_code !== INDIA_COUNTRY_CODE) return false;
  if (!isValidIndianState(issue.state)) return false;
  if (!validateIndianPinCode(issue.pin_code)) return false;
  if (containsOverseasLocationText(`${issue.city} ${issue.locality} ${issue.district}`)) {
    return false;
  }
  if (issue.latitude !== undefined || issue.longitude !== undefined) {
    if (
      issue.latitude === undefined ||
      issue.longitude === undefined ||
      !isCoordinateWithinIndia(issue.latitude, issue.longitude)
    ) {
      return false;
    }
  }
  return true;
}

export function assertValidIndiaInitiativeRecord(
  initiative: CommunityInitiative,
): boolean {
  if (initiative.country_code !== INDIA_COUNTRY_CODE) return false;
  if (!isValidIndianState(initiative.state)) return false;
  if (!validateIndianPinCode(initiative.pin_code)) return false;
  if (
    containsOverseasLocationText(
      `${initiative.city} ${initiative.locality} ${initiative.district}`,
    )
  ) {
    return false;
  }
  if (initiative.latitude !== undefined || initiative.longitude !== undefined) {
    if (
      initiative.latitude === undefined ||
      initiative.longitude === undefined ||
      !isCoordinateWithinIndia(initiative.latitude, initiative.longitude)
    ) {
      return false;
    }
  }
  return true;
}

export function createCivicIssueRecord(
  input: IssueSubmissionInput,
  existingIds: string[],
  now = new Date(),
): CivicIssue {
  const validation = validateIssueSubmission(input);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] ?? 'Invalid India issue record.';
    throw new Error(firstError);
  }

  const id = generateReportId(existingIds, now);
  const iso = now.toISOString();
  const category = input.category as IssueCategory;
  const lat = input.latitude ?? input.coordinates?.lat;
  const lng = input.longitude ?? input.coordinates?.lng;
  const formattedLocation = formatIndianAddress({
    locality: input.locality,
    city: input.city,
    district: input.district,
    state: input.state,
    pin_code: input.pin_code,
  });

  return {
    id,
    category,
    title: input.title.trim(),
    description: input.description.trim(),
    country_code: INDIA_COUNTRY_CODE,
    state: input.state.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    locality: input.locality.trim(),
    pin_code: input.pin_code.trim(),
    latitude: lat,
    longitude: lng,
    location: formattedLocation,
    coordinates:
      lat !== undefined && lng !== undefined
        ? {
            lat,
            lng,
            zoneLabel:
              input.coordinates?.zoneLabel ||
              `${input.locality.trim()}, ${input.city.trim()}`,
          }
        : undefined,
    imageUrl: input.imageUrl,
    isAnonymous: input.isAnonymous,
    reporterEmail: input.isAnonymous ? undefined : input.reporterEmail,
    status: IssueStatus.Submitted,
    submittedAt: iso,
    updatedAt: iso,
    safetyAdvisoryShown: requiresAuthoritySafetyAdvisory(
      category,
      input.title,
      input.description,
    ),
    timeline: [
      {
        id: `${id}-tl-1`,
        status: IssueStatus.Submitted,
        timestamp: iso,
        note: input.isAnonymous
          ? 'Report submitted anonymously for coordinator verification.'
          : 'Report submitted for coordinator verification.',
        actorRole: 'Citizen Report',
      },
    ],
    followUpChecks: [],
  };
}

/** Strips private reporter fields before displaying any issue publicly */
export function toPublicIssueView(issue: CivicIssue): PublicCivicIssue {
  return {
    id: issue.id,
    category: issue.category,
    title: issue.title,
    description: issue.description,
    country_code: issue.country_code,
    state: issue.state,
    district: issue.district,
    city: issue.city,
    locality: issue.locality,
    pin_code: issue.pin_code,
    latitude: issue.latitude,
    longitude: issue.longitude,
    location: issue.location,
    coordinates: issue.coordinates,
    imageUrl: issue.imageUrl,
    isAnonymous: issue.isAnonymous,
    status: issue.status,
    submittedAt: issue.submittedAt,
    updatedAt: issue.updatedAt,
    timeline: issue.timeline,
    followUpChecks: issue.followUpChecks,
    resolutionEvidence: issue.resolutionEvidence,
  };
}

export function filterIssues(
  issues: CivicIssue[],
  criteria: IssueFilterCriteria,
): PublicCivicIssue[] {
  const q = criteria.query.trim().toLowerCase();

  return issues
    .filter((issue) => {
      if (!assertValidIndiaIssueRecord(issue)) return false;

      const matchesQuery =
        !q ||
        issue.id.toLowerCase().includes(q) ||
        issue.title.toLowerCase().includes(q) ||
        issue.location.toLowerCase().includes(q) ||
        issue.locality.toLowerCase().includes(q) ||
        issue.city.toLowerCase().includes(q) ||
        issue.state.toLowerCase().includes(q) ||
        issue.pin_code.includes(q);

      const matchesCategory =
        criteria.category === 'All' || issue.category === criteria.category;

      const matchesStatus =
        criteria.status === 'All' || issue.status === criteria.status;

      const matchesState =
        criteria.state === 'All' ||
        issue.state.toLowerCase() === criteria.state.toLowerCase();

      const matchesCity =
        criteria.city === 'All' ||
        issue.city.toLowerCase() === criteria.city.toLowerCase();

      return (
        matchesQuery &&
        matchesCategory &&
        matchesStatus &&
        matchesState &&
        matchesCity
      );
    })
    .map(toPublicIssueView);
}

export function applyIssueStatusUpdate(
  issue: CivicIssue,
  newStatus: IssueStatus,
  note: string,
  options?: {
    actorRole?: string;
    afterImageUrl?: string;
    resolutionSummary?: string;
    approveEvidence?: boolean;
    followUpOutcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
  },
  now = new Date(),
): CivicIssue {
  const iso = now.toISOString();
  const trimmedNote = note.trim() || `Status updated to ${newStatus}.`;
  const actorRole = options?.actorRole ?? 'Civic Coordinator';

  const nextTimeline = [
    ...issue.timeline,
    {
      id: `${issue.id}-tl-${issue.timeline.length + 1}`,
      status: newStatus,
      timestamp: iso,
      note: trimmedNote,
      actorRole,
    },
  ];

  const nextFollowUps = options?.followUpOutcome
    ? [
        ...issue.followUpChecks,
        {
          id: `${issue.id}-fu-${issue.followUpChecks.length + 1}`,
          checkedAt: iso,
          outcome: options.followUpOutcome,
          note: trimmedNote,
        },
      ]
    : issue.followUpChecks;

  let nextEvidence = issue.resolutionEvidence;
  if (
    newStatus === IssueStatus.Resolved ||
    options?.approveEvidence ||
    options?.afterImageUrl ||
    options?.resolutionSummary
  ) {
    nextEvidence = {
      summary:
        options?.resolutionSummary?.trim() ||
        issue.resolutionEvidence?.summary ||
        trimmedNote,
      beforeImageUrl: issue.resolutionEvidence?.beforeImageUrl ?? issue.imageUrl,
      afterImageUrl:
        options?.afterImageUrl ?? issue.resolutionEvidence?.afterImageUrl,
      approvedByCoordinator:
        options?.approveEvidence ??
        issue.resolutionEvidence?.approvedByCoordinator ??
        newStatus === IssueStatus.Resolved,
      completedAt: issue.resolutionEvidence?.completedAt ?? iso,
    };
  }

  return {
    ...issue,
    status: newStatus,
    updatedAt: iso,
    timeline: nextTimeline,
    followUpChecks: nextFollowUps,
    resolutionEvidence: nextEvidence,
  };
}

export interface VolunteerActionResult {
  ok: boolean;
  message: string;
  initiatives: CommunityInitiative[];
  registrations: VolunteerRegistration[];
}

export function registerVolunteerForInitiative(
  initiatives: CommunityInitiative[],
  registrations: VolunteerRegistration[],
  initiativeId: string,
  user: Pick<UserAccount, 'fullName' | 'email'>,
  now = new Date(),
): VolunteerActionResult {
  const target = initiatives.find((item) => item.id === initiativeId);
  if (!target) {
    return {
      ok: false,
      message: 'Initiative not found.',
      initiatives,
      registrations,
    };
  }

  if (target.status === 'Completed') {
    return {
      ok: false,
      message: 'This initiative has already been completed.',
      initiatives,
      registrations,
    };
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const alreadyRegistered = registrations.some(
    (reg) =>
      reg.initiativeId === initiativeId &&
      reg.volunteerEmail.toLowerCase() === normalizedEmail,
  );

  if (alreadyRegistered) {
    return {
      ok: false,
      message: 'You are already registered for this community initiative.',
      initiatives,
      registrations,
    };
  }

  if (target.registeredCount >= target.capacity) {
    return {
      ok: false,
      message: 'Volunteer capacity for this initiative is currently full.',
      initiatives,
      registrations,
    };
  }

  const newRegistration: VolunteerRegistration = {
    id: `reg-${initiativeId}-${Date.now()}`,
    initiativeId,
    volunteerName: user.fullName.trim() || 'Community Volunteer',
    volunteerEmail: normalizedEmail,
    registeredAt: now.toISOString(),
  };

  return {
    ok: true,
    message: `Registration confirmed for ${target.title}.`,
    initiatives: initiatives.map((item) =>
      item.id === initiativeId
        ? { ...item, registeredCount: item.registeredCount + 1 }
        : item,
    ),
    registrations: [newRegistration, ...registrations],
  };
}

export function cancelVolunteerRegistration(
  initiatives: CommunityInitiative[],
  registrations: VolunteerRegistration[],
  initiativeId: string,
  volunteerEmail: string,
): VolunteerActionResult {
  const normalizedEmail = volunteerEmail.trim().toLowerCase();
  const existing = registrations.find(
    (reg) =>
      reg.initiativeId === initiativeId &&
      reg.volunteerEmail.toLowerCase() === normalizedEmail,
  );

  if (!existing) {
    return {
      ok: false,
      message: 'No active registration found for this activity.',
      initiatives,
      registrations,
    };
  }

  const target = initiatives.find((item) => item.id === initiativeId);

  return {
    ok: true,
    message: `Registration cancelled for ${target?.title ?? 'initiative'}.`,
    initiatives: initiatives.map((item) =>
      item.id === initiativeId
        ? { ...item, registeredCount: Math.max(0, item.registeredCount - 1) }
        : item,
    ),
    registrations: registrations.filter((reg) => reg.id !== existing.id),
  };
}

export function isIssueVerifiedOutcome(status: IssueStatus): boolean {
  return VERIFIED_STATUSES.has(status);
}

export function computeDashboardMetrics(
  issues: CivicIssue[],
  initiatives: CommunityInitiative[],
  locationFilter?: { state?: string | 'All'; city?: string | 'All' },
): DashboardMetrics {
  const stateFilter = locationFilter?.state ?? 'All';
  const cityFilter = locationFilter?.city ?? 'All';

  const indiaIssues = issues.filter((i) => {
    if (!assertValidIndiaIssueRecord(i)) return false;
    if (stateFilter !== 'All' && i.state !== stateFilter) return false;
    if (cityFilter !== 'All' && i.city !== cityFilter) return false;
    return true;
  });

  const indiaInitiatives = initiatives.filter((a) => {
    if (!assertValidIndiaInitiativeRecord(a)) return false;
    if (stateFilter !== 'All' && a.state !== stateFilter) return false;
    if (cityFilter !== 'All' && a.city !== cityFilter) return false;
    return true;
  });

  const totalReports = indiaIssues.length;
  const verifiedReports = indiaIssues.filter((i) =>
    VERIFIED_STATUSES.has(i.status),
  ).length;
  const unverifiedSubmittedCount = indiaIssues.filter(
    (i) =>
      i.status === IssueStatus.Submitted ||
      i.status === IssueStatus.UnderVerification,
  ).length;
  const resolvedIssues = indiaIssues.filter(
    (i) => i.status === IssueStatus.Resolved,
  ).length;
  const recurringIssues = indiaIssues.filter(
    (i) => i.status === IssueStatus.Recurring,
  ).length;
  const completedInitiatives = indiaInitiatives.filter(
    (a) => a.status === 'Completed',
  ).length;
  const activeVolunteers = indiaInitiatives.reduce(
    (sum, a) => sum + a.registeredCount,
    0,
  );
  const publicSpacesRestored = indiaIssues.filter(
    (i) =>
      i.status === IssueStatus.Resolved &&
      Boolean(i.resolutionEvidence?.approvedByCoordinator),
  ).length;

  const categories = Object.values(IssueCategory);
  const categoryDistribution = categories.map((category) => {
    const count = indiaIssues.filter((i) => i.category === category).length;
    const percentage =
      totalReports > 0 ? Math.round((count / totalReports) * 100) : 0;
    return { category, count, percentage };
  });

  const statuses = Object.values(IssueStatus);
  const statusDistribution = statuses.map((status) => {
    const count = indiaIssues.filter((i) => i.status === status).length;
    const percentage =
      totalReports > 0 ? Math.round((count / totalReports) * 100) : 0;
    return { status, count, percentage };
  });

  const localityMap = new Map<string, LocalitySummary>();
  for (const issue of indiaIssues) {
    const key = `${issue.locality}|${issue.city}|${issue.state}`;
    const current = localityMap.get(key) ?? {
      locality: issue.locality,
      city: issue.city,
      state: issue.state,
      pin_code: issue.pin_code,
      submittedCount: 0,
      verifiedCount: 0,
      resolvedCount: 0,
      recurringCount: 0,
      restorationRate: 0,
    };
    current.submittedCount += 1;
    if (VERIFIED_STATUSES.has(issue.status)) current.verifiedCount += 1;
    if (issue.status === IssueStatus.Resolved) current.resolvedCount += 1;
    if (issue.status === IssueStatus.Recurring) current.recurringCount += 1;
    localityMap.set(key, current);
  }

  const localitySummaries = Array.from(localityMap.values())
    .map((entry) => ({
      ...entry,
      restorationRate:
        entry.verifiedCount > 0
          ? Math.round((entry.resolvedCount / entry.verifiedCount) * 100)
          : 0,
    }))
    .sort((a, b) => b.submittedCount - a.submittedCount);

  return {
    totalReports,
    unverifiedSubmittedCount,
    verifiedReports,
    resolvedIssues,
    recurringIssues,
    completedInitiatives,
    activeVolunteers,
    publicSpacesRestored,
    categoryDistribution,
    statusDistribution,
    localitySummaries,
  };
}
