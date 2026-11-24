import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CivicIssue,
  CommunityInitiative,
  UserAccount,
  VolunteerRegistration,
} from '../types/civic';
import {
  SEED_AFTER_RESTORED_IMAGE,
  SEED_BEFORE_WASTE_IMAGE,
  SEED_HERO_IMAGE,
  SEED_INITIATIVES,
  SEED_ISSUES,
  SEED_PARK_RESTORATION_IMAGE,
  SEED_PATHWAY_REPAIR_IMAGE,
  SEED_REGISTRATIONS,
  SEED_USERS,
} from '../data/seedData';
import {
  assertValidIndiaInitiativeRecord,
  assertValidIndiaIssueRecord,
  syncInitiativeRegistrationCounts,
  validateImageFile,
} from '../utils/civicLogic';
import { formatSupabaseError, requireSupabaseClient } from './supabaseClient';

export interface StorageWriteResult {
  ok: boolean;
  error?: string;
}

export const STORAGE_BUCKETS = {
  issues: 'civic-issue-images',
  initiatives: 'initiative-images',
  evidence: 'intervention-evidence',
} as const;

export type CivicStorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export type CivicStorageFolder = 'reports' | 'initiatives' | 'evidence';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Builds a collision-free, policy-compliant storage path:
 * e.g. reports/2026/a1b2c3d4-1732419-photo.jpg
 */
export function buildUniqueStoragePath(
  folder: CivicStorageFolder,
  fileName: string,
  mimeType: string,
  now = new Date(),
  uniqueId?: string,
): string {
  const year = now.getUTCFullYear();
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const safeSlug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'image';

  const ext = MIME_TO_EXT[mimeType] ?? 'jpg';
  const idToken =
    uniqueId ||
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

  return `${folder}/${year}/${idToken}-${safeSlug}.${ext}`;
}

export interface StorageUploadResult {
  ok: boolean;
  path?: string;
  publicUrl?: string;
  error?: string;
}

export async function compressImageIfNeeded(
  file: File,
  options?: { maxDimension?: number; quality?: number; compressThresholdBytes?: number },
): Promise<File> {
  const maxDimension = options?.maxDimension ?? 1600;
  const quality = options?.quality ?? 0.82;
  const compressThresholdBytes = options?.compressThresholdBytes ?? 450 * 1024;

  if (
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function' ||
    file.size <= 0
  ) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const needsResize = width > maxDimension || height > maxDimension;
    const needsSizeReduction = file.size > compressThresholdBytes;

    if (!needsResize && !needsSizeReduction) {
      return file;
    }

    const scale = needsResize
      ? Math.min(maxDimension / width, maxDimension / height)
      : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const outputType =
      file.type === 'image/png' && !needsSizeReduction
        ? 'image/png'
        : file.type === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, quality);
    });

    if (!blob || blob.size <= 0 || (blob.size >= file.size && !needsResize)) {
      return file;
    }

    const ext = MIME_TO_EXT[outputType] ?? 'jpg';
    const nextName = file.name.replace(/\.[^.]+$/, '') + `.${ext}`;
    return new File([blob], nextName, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

export async function uploadCivicStorageFile(
  bucket: CivicStorageBucket,
  folder: CivicStorageFolder,
  file: File,
  clientOverride?: SupabaseClient | null,
): Promise<StorageUploadResult> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size <= 0
  ) {
    const initialValidation = validateImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    return {
      ok: false,
      error: initialValidation.error ?? 'Invalid image upload.',
    };
  }

  const preparedFile = await compressImageIfNeeded(file);

  const validation = validateImageFile({
    name: preparedFile.name,
    type: preparedFile.type,
    size: preparedFile.size,
  });
  if (!validation.valid) {
    return { ok: false, error: validation.error ?? 'Invalid image upload.' };
  }

  try {
    const client = requireSupabaseClient(clientOverride);
    const storagePath = buildUniqueStoragePath(
      folder,
      preparedFile.name,
      preparedFile.type,
    );

    const { error } = await client.storage
      .from(bucket)
      .upload(storagePath, preparedFile, {
        contentType: preparedFile.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(
          error,
          'Image upload failed. Verify permissions and file limits.',
        ),
      };
    }

    let publicUrl: string | undefined;
    if (bucket !== STORAGE_BUCKETS.evidence) {
      const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
      publicUrl = data.publicUrl;
    }

    return { ok: true, path: storagePath, publicUrl };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to upload image to Supabase Storage.'),
    };
  }
}

export async function resolveStorageAssetUrl(
  bucket: CivicStorageBucket,
  pathOrUrl?: string | null,
  clientOverride?: SupabaseClient | null,
): Promise<string | undefined> {
  if (!pathOrUrl) return undefined;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/src/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  try {
    const client = requireSupabaseClient(clientOverride);
    if (bucket === STORAGE_BUCKETS.evidence) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(trimmed, 3600);
      if (error) return undefined;
      return data?.signedUrl;
    }

    const { data } = client.storage.from(bucket).getPublicUrl(trimmed);
    return data.publicUrl;
  } catch {
    return undefined;
  }
}

export async function removeCivicStorageFile(
  bucket: CivicStorageBucket,
  path: string,
  clientOverride?: SupabaseClient | null,
): Promise<void> {
  if (!path) return;
  try {
    const client = requireSupabaseClient(clientOverride);
    await client.storage.from(bucket).remove([path]);
  } catch {
    // Best-effort cleanup
  }
}

// ============================================================================
// Local Demonstration Fallback Storage (only active when Supabase is unconfigured)
// Existing browser data is never silently deleted or migrated automatically.
// ============================================================================

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

function writeJson<T>(key: string, value: T): StorageWriteResult {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return {
      ok: false,
      error: isQuota
        ? 'Browser storage quota exceeded—your latest change could not be saved locally. Remove large uploaded photos or reset demo data.'
        : 'Unable to save data to browser storage. Ensure local storage is enabled in this browser.',
    };
  }
}

const SEED_INITIATIVE_BY_ID = new Map(
  SEED_INITIATIVES.map((item) => [item.id, item]),
);
const SEED_USER_BY_EMAIL = new Map(
  SEED_USERS.map((u) => [u.email.toLowerCase(), u]),
);

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
              beforeImageUrl: migrateImageUrl(
                issue.resolutionEvidence.beforeImageUrl,
              ),
              afterImageUrl: migrateImageUrl(
                issue.resolutionEvidence.afterImageUrl,
              ),
            }
          : undefined,
      }));
    return validIndiaOnly.length > 0 ? validIndiaOnly : SEED_ISSUES;
  },
  saveIssues(issues: CivicIssue[]): StorageWriteResult {
    const validated = issues.filter(assertValidIndiaIssueRecord);
    return writeJson(STORAGE_KEYS.issues, validated);
  },

  loadRegistrations(): VolunteerRegistration[] {
    return readJson<VolunteerRegistration[]>(
      STORAGE_KEYS.registrations,
      SEED_REGISTRATIONS,
    );
  },
  saveRegistrations(registrations: VolunteerRegistration[]): StorageWriteResult {
    return writeJson(STORAGE_KEYS.registrations, registrations);
  },

  loadInitiatives(
    registrationsOverride?: VolunteerRegistration[],
  ): CommunityInitiative[] {
    const loaded = readJson<CommunityInitiative[]>(
      STORAGE_KEYS.initiatives,
      SEED_INITIATIVES,
    );
    const registrations =
      registrationsOverride ?? civicStorage.loadRegistrations();
    const validIndiaOnly = loaded
      .filter(assertValidIndiaInitiativeRecord)
      .map((init) => {
        const seedMatch = SEED_INITIATIVE_BY_ID.get(init.id);
        return {
          ...init,
          eventDate: init.eventDate ?? seedMatch?.eventDate,
          startTime: init.startTime ?? seedMatch?.startTime,
          endTime: init.endTime ?? seedMatch?.endTime,
          linkedIssueIds: init.linkedIssueIds ?? seedMatch?.linkedIssueIds,
          imageUrl: migrateImageUrl(init.imageUrl),
        };
      });
    const baseList = validIndiaOnly.length > 0 ? validIndiaOnly : SEED_INITIATIVES;
    return syncInitiativeRegistrationCounts(baseList, registrations);
  },
  saveInitiatives(initiatives: CommunityInitiative[]): StorageWriteResult {
    const validated = initiatives.filter(assertValidIndiaInitiativeRecord);
    return writeJson(STORAGE_KEYS.initiatives, validated);
  },

  loadUsers(): UserAccount[] {
    const loaded = readJson<UserAccount[]>(STORAGE_KEYS.users, SEED_USERS);
    return loaded.map((u) => {
      if (u.demoPassword) return u;
      const seedUser = SEED_USER_BY_EMAIL.get(u.email.toLowerCase());
      return seedUser ? { ...u, demoPassword: seedUser.demoPassword } : u;
    });
  },
  saveUsers(users: UserAccount[]): StorageWriteResult {
    return writeJson(STORAGE_KEYS.users, users);
  },

  loadCurrentUser(): UserAccount | null {
    const user = readJson<UserAccount | null>(STORAGE_KEYS.currentUser, null);
    if (!user) return null;
    const { demoPassword: _ignored, ...safeUser } = user;
    return safeUser;
  },
  saveCurrentUser(user: UserAccount | null): StorageWriteResult {
    if (!user) {
      return writeJson(STORAGE_KEYS.currentUser, null);
    }
    const { demoPassword: _ignored, ...safeUser } = user;
    return writeJson(STORAGE_KEYS.currentUser, safeUser);
  },

  resetDemoData(): void {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });
  },
};
