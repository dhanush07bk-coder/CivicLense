export enum IssueCategory {
  WasteAndSanitation = 'Waste and Sanitation',
  PublicSpaceDamage = 'Public Space Damage',
  InfrastructureHazard = 'Infrastructure / Electrical Hazard',
  PublicObstruction = 'Public Obstruction',
  OtherCivicIssue = 'Other Civic Issue',
}

export enum IssueStatus {
  Submitted = 'Submitted',
  UnderVerification = 'Under Verification',
  Verified = 'Verified',
  ActionInProgress = 'Action in Progress',
  Resolved = 'Resolved',
  Recurring = 'Recurring',
  Rejected = 'Rejected',
}

export enum UserRole {
  Citizen = 'Citizen',
  Volunteer = 'Volunteer',
  Coordinator = 'Coordinator',
}

export type PageRoute =
  | 'home'
  | 'report'
  | 'track'
  | 'community'
  | 'impact'
  | 'auth'
  | 'coordinator';

export type CountryCode = 'IN';

export interface MapCoordinate {
  lat: number;
  lng: number;
  zoneLabel: string;
}

export interface IndiaLocationFields {
  country_code: CountryCode;
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  latitude?: number;
  longitude?: number;
}

export interface StatusTimelineEntry {
  id: string;
  status: IssueStatus;
  timestamp: string;
  note: string;
  actorRole: string;
}

export interface FollowUpCheck {
  id: string;
  checkedAt: string;
  outcome: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
  note: string;
}

export interface ResolutionEvidence {
  summary: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  approvedByCoordinator: boolean;
  completedAt: string;
}

export interface PendingEvidenceItem {
  id: string;
  initiativeId?: string;
  evidenceType: 'before' | 'after' | 'followup';
  imageUrl?: string;
  imagePath: string;
  summary: string;
  submittedAt: string;
}

export interface CivicIssue extends IndiaLocationFields {
  /** Public report code (e.g. CIV-2026-1001) */
  id: string;
  /** Database UUID primary key when backed by Supabase */
  dbId?: string;
  category: IssueCategory;
  title: string;
  description: string;
  /** Formatted full Indian address line for display */
  location: string;
  coordinates?: MapCoordinate;
  imageUrl?: string;
  imagePath?: string;
  isAnonymous: boolean;
  /** Internal only: never exposed in public tracking views */
  reporterEmail?: string;
  status: IssueStatus;
  submittedAt: string;
  updatedAt: string;
  timeline: StatusTimelineEntry[];
  followUpChecks: FollowUpCheck[];
  resolutionEvidence?: ResolutionEvidence;
  pendingEvidence?: PendingEvidenceItem[];
  safetyAdvisoryShown?: boolean;
}

export interface PublicCivicIssue extends IndiaLocationFields {
  id: string;
  dbId?: string;
  category: IssueCategory;
  title: string;
  description: string;
  location: string;
  coordinates?: MapCoordinate;
  imageUrl?: string;
  isAnonymous: boolean;
  status: IssueStatus;
  submittedAt: string;
  updatedAt: string;
  timeline: StatusTimelineEntry[];
  followUpChecks: FollowUpCheck[];
  resolutionEvidence?: ResolutionEvidence;
}

export type InitiativeStatus = 'Open' | 'Completed' | 'Cancelled';

export interface CommunityInitiative extends IndiaLocationFields {
  id: string;
  title: string;
  category: string;
  description: string;
  location: string;
  /** ISO calendar date (YYYY-MM-DD) */
  eventDate?: string;
  /** 24-hour start time (HH:mm) */
  startTime?: string;
  /** 24-hour end time (HH:mm) */
  endTime?: string;
  dateLabel: string;
  timeLabel: string;
  capacity: number;
  registeredCount: number;
  status: InitiativeStatus;
  cancellationReason?: string;
  linkedIssueIds?: string[];
  linkedIssueDbIds?: string[];
  imageUrl?: string;
  coverImagePath?: string;
  organizer: string;
  highlights: string[];
}

export interface VolunteerRegistration {
  id: string;
  initiativeId: string;
  userId?: string;
  volunteerName: string;
  volunteerEmail: string;
  registrationStatus?: 'Registered' | 'Cancelled';
  attendanceStatus?: 'Pending' | 'Attended' | 'Absent';
  registeredAt: string;
}

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  emailVerified?: boolean;
  /** Demonstration-only credential field stored locally; not for production security */
  demoPassword?: string;
}

export interface BeforeAfterCase {
  id: string;
  title: string;
  state: string;
  city: string;
  locality: string;
  pin_code: string;
  issueId: string;
  completedDate: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  summary: string;
  volunteersInvolved: number;
}

export interface LocalitySummary {
  locality: string;
  city: string;
  state: string;
  pin_code: string;
  submittedCount: number;
  verifiedCount: number;
  resolvedCount: number;
  recurringCount: number;
  restorationRate: number;
}

export interface DashboardMetrics {
  totalReports: number;
  unverifiedSubmittedCount: number;
  verifiedReports: number;
  resolvedIssues: number;
  recurringIssues: number;
  completedInitiatives: number;
  activeVolunteers: number;
  publicSpacesRestored: number;
  categoryDistribution: Array<{ category: IssueCategory; count: number; percentage: number }>;
  statusDistribution: Array<{ status: IssueStatus; count: number; percentage: number }>;
  localitySummaries: LocalitySummary[];
}
