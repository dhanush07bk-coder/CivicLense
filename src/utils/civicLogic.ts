import {
  BeforeAfterCase,
  CivicIssue,
  CommunityInitiative,
  DashboardMetrics,
  InitiativeStatus,
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
  validateCoordinatesMatchIndianState,
  validateIndianPinCode,
  validatePinMatchesIndianState,
} from './indiaGeo';

export const MAX_IMAGE_FILE_BYTES = 2 * 1024 * 1024; // 2 MB limit for browser persistence
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

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
  mapConfirmed?: boolean;
  requireMapSelection?: boolean;
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
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  dateLabel?: string;
  timeLabel?: string;
  capacity: number;
  minCapacity?: number;
  status?: InitiativeStatus;
  cancellationReason?: string;
  linkedIssueIds?: string[];
  latitude?: number;
  longitude?: number;
  allowPastDate?: boolean;
  referenceDate?: string;
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

export const ALLOWED_STATUS_TRANSITIONS: Record<
  IssueStatus,
  readonly IssueStatus[]
> = {
  [IssueStatus.Submitted]: [
    IssueStatus.UnderVerification,
    IssueStatus.Verified,
    IssueStatus.Rejected,
  ],
  [IssueStatus.UnderVerification]: [
    IssueStatus.Verified,
    IssueStatus.Rejected,
  ],
  [IssueStatus.Verified]: [
    IssueStatus.ActionInProgress,
    IssueStatus.Resolved,
    IssueStatus.Rejected,
  ],
  [IssueStatus.ActionInProgress]: [
    IssueStatus.Resolved,
    IssueStatus.Recurring,
    IssueStatus.Verified,
  ],
  [IssueStatus.Resolved]: [IssueStatus.Recurring],
  [IssueStatus.Recurring]: [
    IssueStatus.ActionInProgress,
    IssueStatus.Resolved,
    IssueStatus.Verified,
  ],
  [IssueStatus.Rejected]: [IssueStatus.UnderVerification],
};

export function getAllowedNextStatuses(current: IssueStatus): IssueStatus[] {
  return [current, ...(ALLOWED_STATUS_TRANSITIONS[current] ?? [])];
}

export function validateIssueStatusTransition(
  fromStatus: IssueStatus,
  toStatus: IssueStatus,
): { valid: boolean; error?: string } {
  if (fromStatus === toStatus) {
    return { valid: true };
  }
  const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus] ?? [];
  if (allowed.includes(toStatus)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: `Cannot transition directly from "${fromStatus}" to "${toStatus}". Allowed next statuses: ${
      allowed.length > 0 ? allowed.join(', ') : 'none'
    }.`,
  };
}

export function validateImageFile(file: {
  name: string;
  type: string;
  size: number;
}): { valid: boolean; error?: string } {
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: `Unsupported file format for "${file.name}". Upload a JPEG, PNG, or WebP image.`,
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Selected image file appears empty.',
    };
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Image is ${sizeMb} MB, exceeding the 2.0 MB limit for local browser storage.`,
    };
  }
  return { valid: true };
}

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

export function formatIndianInitiativeSchedule(
  eventDate?: string,
  startTime?: string,
  endTime?: string,
): { dateLabel: string; timeLabel: string } {
  let dateLabel = eventDate?.trim() || 'Upcoming Weekend';
  if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    const [y, m, d] = eventDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (!Number.isNaN(dt.getTime())) {
      dateLabel = dt.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
  }

  const formatTime12h = (hhmm: string): string => {
    const [hhStr, mmStr] = hhmm.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return hhmm;
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const hour12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${String(hour12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${suffix}`;
  };

  const timeLabel =
    startTime && endTime
      ? `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`
      : '08:00 AM – 11:00 AM';

  return { dateLabel, timeLabel };
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

  const hasValidState = Boolean(
    input.state.trim() && isValidIndianState(input.state),
  );
  if (!hasValidState) {
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
  } else if (
    hasValidState &&
    !validatePinMatchesIndianState(input.state, input.pin_code)
  ) {
    errors.pin_code = `PIN code ${input.pin_code.trim()} does not match ${input.state.trim()}. Please verify your State and PIN code.`;
  }

  if (input.latitude !== undefined || input.longitude !== undefined) {
    if (
      input.latitude === undefined ||
      input.longitude === undefined ||
      !isCoordinateWithinIndia(input.latitude, input.longitude)
    ) {
      errors.coordinates =
        'Selected map coordinates lie outside India and cannot be accepted.';
    } else if (
      hasValidState &&
      !validateCoordinatesMatchIndianState(
        input.state,
        input.latitude,
        input.longitude,
      )
    ) {
      errors.coordinates = `Pinned map coordinates do not fall within ${input.state.trim()}. Adjust the map pin or update the selected State.`;
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

  const lat = input.latitude ?? input.coordinates?.lat;
  const lng = input.longitude ?? input.coordinates?.lng;

  const locationErrors = validateIndiaLocationFields({
    country_code: input.country_code ?? INDIA_COUNTRY_CODE,
    state: input.state,
    district: input.district,
    city: input.city,
    locality: input.locality,
    pin_code: input.pin_code,
    latitude: lat,
    longitude: lng,
  });

  Object.assign(errors, locationErrors);

  if (input.requireMapSelection) {
    if (lat === undefined || lng === undefined) {
      errors.coordinates =
        errors.coordinates ||
        'Please select the reporting location inside India on the map.';
    } else if (!input.mapConfirmed && !errors.coordinates) {
      errors.mapConfirmed =
        'Click "Confirm Selected Location" on the map to verify your pin before submitting.';
    }
  }

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

  // Date & time validation when structured fields are used
  const todayIso =
    input.referenceDate || new Date().toISOString().slice(0, 10);

  if (!input.eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) {
    errors.eventDate = 'Please choose a valid initiative date.';
  } else if (
    !input.allowPastDate &&
    (input.status ?? 'Open') === 'Open' &&
    input.eventDate < todayIso
  ) {
    errors.eventDate = 'Initiative date cannot be in the past.';
  }

  if (!input.startTime || !/^\d{2}:\d{2}$/.test(input.startTime)) {
    errors.startTime = 'Please enter a valid start time.';
  }
  if (!input.endTime || !/^\d{2}:\d{2}$/.test(input.endTime)) {
    errors.endTime = 'Please enter a valid end time.';
  } else if (input.startTime && input.endTime <= input.startTime) {
    errors.endTime = 'End time must be later than start time.';
  }

  if (
    !Number.isInteger(input.capacity) ||
    input.capacity < 5 ||
    input.capacity > 500
  ) {
    errors.capacity = 'Volunteer capacity must be a whole number between 5 and 500.';
  } else if (
    input.minCapacity !== undefined &&
    input.capacity < input.minCapacity
  ) {
    errors.capacity = `Capacity cannot be lower than the ${input.minCapacity} already-registered volunteers.`;
  }

  if (
    input.status === 'Cancelled' &&
    input.cancellationReason !== undefined &&
    input.cancellationReason.trim().length < 5
  ) {
    errors.cancellationReason =
      'Please provide a brief reason for cancelling this initiative.';
  }

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
  } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(input.password)) {
    errors.password =
      'Password must include at least one letter and one number.';
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

export function authenticateDemoUser(
  users: UserAccount[],
  email: string,
  password: string,
): { ok: boolean; user?: UserAccount; error?: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const matched = users.find(
    (u) => u.email.toLowerCase() === normalizedEmail,
  );
  if (!matched) {
    return {
      ok: false,
      error:
        'Invalid email or password for local demonstration accounts. Check credentials or create a demo profile.',
    };
  }
  if (!matched.demoPassword || matched.demoPassword !== password) {
    return {
      ok: false,
      error:
        'Invalid password for this local demonstration account. Passwords are verified against the local demo list.',
    };
  }
  const { demoPassword: _ignored, ...safeUser } = matched;
  return { ok: true, user: safeUser };
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
    const firstError =
      Object.values(validation.errors)[0] ?? 'Invalid India issue record.';
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

export function filterCoordinatorQueue(
  issues: CivicIssue[],
  statusFilter: IssueStatus | 'All',
): CivicIssue[] {
  const indiaIssues = issues.filter(assertValidIndiaIssueRecord);
  if (statusFilter === 'All') return indiaIssues;
  return indiaIssues.filter((i) => i.status === statusFilter);
}

export function resolveActiveQueueIssue(
  filteredQueue: CivicIssue[],
  selectedIssueId: string,
): CivicIssue | null {
  if (filteredQueue.length === 0) return null;
  return (
    filteredQueue.find((i) => i.id === selectedIssueId) ?? filteredQueue[0]
  );
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
  const transition = validateIssueStatusTransition(issue.status, newStatus);
  if (!transition.valid) {
    throw new Error(transition.error);
  }

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

export function syncInitiativeRegistrationCounts(
  initiatives: CommunityInitiative[],
  registrations: VolunteerRegistration[],
): CommunityInitiative[] {
  const counts = new Map<string, number>();
  for (const reg of registrations) {
    counts.set(reg.initiativeId, (counts.get(reg.initiativeId) ?? 0) + 1);
  }
  return initiatives.map((init) => ({
    ...init,
    registeredCount: counts.get(init.id) ?? 0,
  }));
}

export function registerVolunteerForInitiative(
  initiatives: CommunityInitiative[],
  registrations: VolunteerRegistration[],
  initiativeId: string,
  user: Pick<UserAccount, 'fullName' | 'email'>,
  now = new Date(),
): VolunteerActionResult {
  const syncedInitiatives = syncInitiativeRegistrationCounts(
    initiatives,
    registrations,
  );
  const target = syncedInitiatives.find((item) => item.id === initiativeId);
  if (!target) {
    return {
      ok: false,
      message: 'Initiative not found.',
      initiatives: syncedInitiatives,
      registrations,
    };
  }

  if (target.status === 'Completed' || target.status === 'Cancelled') {
    return {
      ok: false,
      message:
        target.status === 'Cancelled'
          ? 'This initiative has been cancelled.'
          : 'This initiative has already been completed.',
      initiatives: syncedInitiatives,
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
      initiatives: syncedInitiatives,
      registrations,
    };
  }

  if (target.registeredCount >= target.capacity) {
    return {
      ok: false,
      message: 'Volunteer capacity for this initiative is currently full.',
      initiatives: syncedInitiatives,
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

  const nextRegistrations = [newRegistration, ...registrations];
  return {
    ok: true,
    message: `Registration confirmed for ${target.title}.`,
    initiatives: syncInitiativeRegistrationCounts(
      syncedInitiatives,
      nextRegistrations,
    ),
    registrations: nextRegistrations,
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
      initiatives: syncInitiativeRegistrationCounts(initiatives, registrations),
      registrations,
    };
  }

  const target = initiatives.find((item) => item.id === initiativeId);
  const nextRegistrations = registrations.filter((reg) => reg.id !== existing.id);

  return {
    ok: true,
    message: `Registration cancelled for ${target?.title ?? 'initiative'}.`,
    initiatives: syncInitiativeRegistrationCounts(initiatives, nextRegistrations),
    registrations: nextRegistrations,
  };
}

export function isIssueVerifiedOutcome(status: IssueStatus): boolean {
  return VERIFIED_STATUSES.has(status);
}

export function deriveVerifiedBeforeAfterCases(
  issues: CivicIssue[],
  initiatives: CommunityInitiative[],
  locationFilter?: { state?: string | 'All'; city?: string | 'All' },
): BeforeAfterCase[] {
  const stateFilter = locationFilter?.state ?? 'All';
  const cityFilter = locationFilter?.city ?? 'All';

  return issues
    .filter((issue) => {
      if (!assertValidIndiaIssueRecord(issue)) return false;
      if (stateFilter !== 'All' && issue.state !== stateFilter) return false;
      if (cityFilter !== 'All' && issue.city !== cityFilter) return false;
      return (
        issue.status === IssueStatus.Resolved &&
        Boolean(issue.resolutionEvidence?.approvedByCoordinator) &&
        Boolean(issue.resolutionEvidence?.beforeImageUrl) &&
        Boolean(issue.resolutionEvidence?.afterImageUrl)
      );
    })
    .map((issue) => {
      const linkedInitiativeVolunteers = initiatives
        .filter((init) => init.linkedIssueIds?.includes(issue.id))
        .reduce((sum, init) => sum + init.registeredCount, 0);

      let completedDate = issue.updatedAt.slice(0, 10);
      try {
        completedDate = new Date(
          issue.resolutionEvidence?.completedAt ?? issue.updatedAt,
        ).toLocaleDateString('en-IN', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        });
      } catch {
        // fallback to ISO slice
      }

      return {
        id: `ba-${issue.id}`,
        title: issue.title,
        state: issue.state,
        city: issue.city,
        locality: issue.locality,
        pin_code: issue.pin_code,
        issueId: issue.id,
        completedDate,
        beforeImageUrl: issue.resolutionEvidence!.beforeImageUrl!,
        afterImageUrl: issue.resolutionEvidence!.afterImageUrl!,
        summary: issue.resolutionEvidence!.summary,
        volunteersInvolved: linkedInitiativeVolunteers,
      };
    });
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
