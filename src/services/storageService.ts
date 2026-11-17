import {
  CivicIssue,
  CommunityInitiative,
  UserAccount,
  VolunteerRegistration,
} from '../types/civic';
import {
  DEMO_ACCOUNTS,
  SEED_AFTER_RESTORED_IMAGE,
  SEED_BEFORE_WASTE_IMAGE,
  SEED_HERO_IMAGE,
  SEED_INITIATIVES,
  SEED_ISSUES,
  SEED_PARK_RESTORATION_IMAGE,
  SEED_PATHWAY_REPAIR_IMAGE,
  SEED_REGISTRATIONS,
} from '../data/seedData';
import {
  assertValidIndiaInitiativeRecord,
  assertValidIndiaIssueRecord,
} from '../utils/civicLogic';

const LEGACY_IMAGE_MIGRATION: Record<string, string> = {
  '/src/assets/images/hero_civic_park_1794909383948.jpg': SEED_HERO_IMAGE,
  '/src/assets/images/civic_before_waste_1794909384248.jpg': SEED_BEFORE_WASTE_IMAGE,
  '/src/assets/images/civic_after_restored_1794909384763.jpg': SEED_AFTER_RESTORED_IMAGE,
  '/src/assets/images/civic_park_restoration_1794909386627.jpg': SEED_PARK_RESTORATION_IMAGE,
  '/src/assets/images/civic_pathway_repair_1794909385590.jpg': SEED_PATHWAY_REPAIR_IMAGE,
};

function migrateImageUrl(url?: string): string | undefined {
  if (!url) return url;
  return LEGACY_IMAGE_MIGRATION[url] ?? url;
}

const STORAGE_KEYS = {
  issues: 'civilense_v0_in_issues',
  initiatives: 'civilense_v0_in_initiatives',
  registrations: 'civilense_v0_in_registrations',
  currentUser: 'civilense_v0_in_current_user',
  users: 'civilense_v0_in_users',
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota failures gracefully in prototype mode
  }
}

/**
 * LocalStorage persistence layer for Version 0 (India-only enforced).
 * Structured for future Supabase PostgreSQL + PostGIS/check-constraint integration
 * where country_code = 'IN' and Indian PIN/coordinate validation run server-side.
 */
export const civicStorage = {
  loadIssues(): CivicIssue[] {
    const loaded = readJson<CivicIssue[]>(STORAGE_KEYS.issues, SEED_ISSUES);
    const validIndiaOnly = loaded
      .filter(assertValidIndiaIssueRecord)
      .map((issue) => ({
        ...issue,
        imageUrl: migrateImageUrl(issue.imageUrl),
        resolutionEvidence: issue.resolutionEvidence
          ? {
              ...issue.resolutionEvidence,
              beforeImageUrl: migrateImageUrl(issue.resolutionEvidence.beforeImageUrl),
              afterImageUrl: migrateImageUrl(issue.resolutionEvidence.afterImageUrl),
            }
          : undefined,
      }));
    return validIndiaOnly.length > 0 ? validIndiaOnly : SEED_ISSUES;
  },
  saveIssues(issues: CivicIssue[]): void {
    const validated = issues.filter(assertValidIndiaIssueRecord);
    writeJson(STORAGE_KEYS.issues, validated);
  },

  loadInitiatives(): CommunityInitiative[] {
    const loaded = readJson<CommunityInitiative[]>(
      STORAGE_KEYS.initiatives,
      SEED_INITIATIVES,
    );
    const validIndiaOnly = loaded
      .filter(assertValidIndiaInitiativeRecord)
      .map((init) => ({
        ...init,
        imageUrl: migrateImageUrl(init.imageUrl),
      }));
    return validIndiaOnly.length > 0 ? validIndiaOnly : SEED_INITIATIVES;
  },
  saveInitiatives(initiatives: CommunityInitiative[]): void {
    const validated = initiatives.filter(assertValidIndiaInitiativeRecord);
    writeJson(STORAGE_KEYS.initiatives, validated);
  },

  loadRegistrations(): VolunteerRegistration[] {
    return readJson<VolunteerRegistration[]>(
      STORAGE_KEYS.registrations,
      SEED_REGISTRATIONS,
    );
  },
  saveRegistrations(registrations: VolunteerRegistration[]): void {
    writeJson(STORAGE_KEYS.registrations, registrations);
  },

  loadUsers(): UserAccount[] {
    const defaultUsers: UserAccount[] = DEMO_ACCOUNTS.map(
      ({ passwordHint: _ignored, ...account }) => account,
    );
    return readJson<UserAccount[]>(STORAGE_KEYS.users, defaultUsers);
  },
  saveUsers(users: UserAccount[]): void {
    writeJson(STORAGE_KEYS.users, users);
  },

  loadCurrentUser(): UserAccount | null {
    return readJson<UserAccount | null>(STORAGE_KEYS.currentUser, null);
  },
  saveCurrentUser(user: UserAccount | null): void {
    writeJson(STORAGE_KEYS.currentUser, user);
  },

  resetDemoData(): void {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });
  },
};
