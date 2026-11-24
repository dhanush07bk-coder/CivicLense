import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  CivicIssue,
  CommunityInitiative,
  IssueCategory,
  IssueStatus,
  UserAccount,
  UserRole,
} from '../types/civic';
import {
  formatSupabaseError,
  getBackendMode,
  hasValidSupabaseEnv,
} from './supabaseClient';
import {
  buildUniqueStoragePath,
  compressImageIfNeeded,
  resolveStorageAssetUrl,
  STORAGE_BUCKETS,
  uploadCivicStorageFile,
} from './storageService';
import {
  mapAuthUserAndProfile,
  requestPasswordReset,
  resendVerificationEmail,
  signInWithSupabase,
  signUpWithSupabase,
  updatePasswordWithSupabase,
} from './profileService';
import {
  createIssueFollowupInSupabase,
  fetchPublicReportsFromSupabase,
  lookupReportByCodeFromSupabase,
  reviewPendingEvidenceInSupabase,
  submitReportToSupabase,
  submitVolunteerEvidenceInSupabase,
  updateReportStatusInSupabase,
} from './reportService';
import {
  cancelVolunteerInSupabase,
  deriveInitiativeCategory,
  fetchInitiativesFromSupabase,
  markVolunteerAttendanceInSupabase,
  registerVolunteerInSupabase,
  saveInitiativeInSupabase,
} from './initiativeService';

function createMockFile(name: string, type: string, sizeBytes: number): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type });
}

test('hasValidSupabaseEnv rejects placeholders and accepts real Supabase project values', () => {
  assert.equal(hasValidSupabaseEnv('', ''), false);
  assert.equal(
    hasValidSupabaseEnv(
      'https://your-project-ref.supabase.co',
      'your-supabase-anon-key',
    ),
    false,
  );
  assert.equal(
    hasValidSupabaseEnv('not-a-url', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123456'),
    false,
  );
  assert.equal(
    hasValidSupabaseEnv(
      'https://abcdefghijklmno.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_mock_anon_key_value',
    ),
    true,
  );
  assert.ok(['demo', 'supabase'].includes(getBackendMode()));
});

test('formatSupabaseError maps RLS, schema column, duplicate, network, and auth errors cleanly', () => {
  assert.match(
    formatSupabaseError({ code: '42501', message: 'new row violates row-level security policy' }, 'Fallback'),
    /row-level security/i,
  );
  assert.match(
    formatSupabaseError({ code: '42703', message: 'column public_civic_issues.foo does not exist' }, 'Fallback'),
    /schema migrations/i,
  );
  assert.match(
    formatSupabaseError({ code: '23505', message: 'Already registered' }, 'Fallback'),
    /Already registered/i,
  );
  assert.match(
    formatSupabaseError(new Error('Failed to fetch'), 'Fallback'),
    /Network error/i,
  );
  assert.match(
    formatSupabaseError(new Error('Invalid login credentials'), 'Fallback'),
    /Invalid email or password/i,
  );
  assert.match(
    formatSupabaseError(new Error('Email not confirmed'), 'Fallback'),
    /verify your email/i,
  );
});

test('buildUniqueStoragePath produces policy-compliant unique paths and compressImageIfNeeded handles non-DOM runtimes', async () => {
  const p = buildUniqueStoragePath(
    'reports',
    'Koramangala Drain Photo!!.png',
    'image/png',
    new Date('2026-11-23T00:00:00Z'),
    'uuid1234',
  );
  assert.equal(p, 'reports/2026/uuid1234-koramangala-drain-photo.png');
  assert.match(
    p,
    /^reports\/[0-9]{4}\/[a-zA-Z0-9_-]+-[a-zA-Z0-9._-]+\.(jpg|png|webp)$/,
  );

  const raw = createMockFile('sample.jpg', 'image/jpeg', 120_000);
  const compressed = await compressImageIfNeeded(raw);
  assert.equal(compressed.size, 120_000);
});

test('uploadCivicStorageFile validates MIME/size and resolveStorageAssetUrl signs private evidence', async () => {
  const badMimeFile = createMockFile('anim.gif', 'image/gif', 1024);
  const badMimeRes = await uploadCivicStorageFile(
    STORAGE_BUCKETS.issues,
    'reports',
    badMimeFile,
  );
  assert.equal(badMimeRes.ok, false);
  assert.match(badMimeRes.error ?? '', /JPEG|PNG|WebP/i);

  const oversizedFile = createMockFile('big.jpg', 'image/jpeg', 2 * 1024 * 1024 + 50);
  const oversizedRes = await uploadCivicStorageFile(
    STORAGE_BUCKETS.issues,
    'reports',
    oversizedFile,
  );
  assert.equal(oversizedRes.ok, false);
  assert.match(oversizedRes.error ?? '', /2\.0?\s*MB/i);

  const uploadedPaths: string[] = [];
  const signedCalls: Array<{ path: string; ttl: number }> = [];

  const mockClient = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          uploadedPaths.push(`${bucket}:${path}`);
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.example.supabase.co/${bucket}/${path}` },
        }),
        createSignedUrl: async (path: string, ttl: number) => {
          signedCalls.push({ path, ttl });
          return {
            data: { signedUrl: `https://signed.example.supabase.co/${bucket}/${path}?token=xyz` },
            error: null,
          };
        },
      }),
    },
  } as unknown as SupabaseClient;

  const okFile = createMockFile('street.webp', 'image/webp', 50_000);
  const uploadOk = await uploadCivicStorageFile(
    STORAGE_BUCKETS.issues,
    'reports',
    okFile,
    mockClient,
  );
  assert.equal(uploadOk.ok, true);
  assert.ok(uploadOk.path?.startsWith('reports/'));
  assert.ok(uploadOk.publicUrl?.includes('civic-issue-images/'));

  const evidenceUpload = await uploadCivicStorageFile(
    STORAGE_BUCKETS.evidence,
    'evidence',
    okFile,
    mockClient,
  );
  assert.equal(evidenceUpload.ok, true);
  assert.equal(evidenceUpload.publicUrl, undefined);

  const signedUrl = await resolveStorageAssetUrl(
    STORAGE_BUCKETS.evidence,
    'evidence/2026/abc-after.jpg',
    mockClient,
  );
  assert.match(signedUrl ?? '', /^https:\/\/signed\.example\.supabase\.co\/intervention-evidence\//);
  assert.equal(signedCalls[0]?.ttl, 3600);
});

test('signUpWithSupabase defaults to Citizen, blocks Coordinator self-registration, and handles verification', async () => {
  const escalated = await signUpWithSupabase({
    fullName: 'Test Admin',
    email: 'admin@civilense.in',
    password: 'Password123',
    confirmPassword: 'Password123',
    role: UserRole.Coordinator,
  });
  assert.equal(escalated.ok, false);
  assert.match(escalated.error ?? '', /Coordinator accounts cannot be created/i);

  let capturedMetaRole = '';
  const mockClient = {
    auth: {
      signUp: async (args: { options?: { data?: { role?: string } } }) => {
        capturedMetaRole = args.options?.data?.role ?? '';
        return {
          data: {
            user: {
              id: 'user-111',
              email: 'ananya@civilense.in',
              created_at: '2026-11-23T00:00:00Z',
              user_metadata: { full_name: 'Ananya Rao', role: capturedMetaRole },
              email_confirmed_at: null,
            },
            session: null,
          },
          error: null,
        };
      },
    },
  } as unknown as SupabaseClient;

  const signupRes = await signUpWithSupabase(
    {
      fullName: 'Ananya Rao',
      email: 'ananya@civilense.in',
      password: 'Password123',
      confirmPassword: 'Password123',
    },
    mockClient,
  );
  assert.equal(signupRes.ok, true);
  assert.equal(capturedMetaRole, UserRole.Citizen);
  assert.equal(signupRes.needsEmailVerification, true);
  assert.equal(signupRes.user, null);
  assert.match(signupRes.message ?? '', /verify your email/i);
});

test('mapAuthUserAndProfile never elevates role from unverified user_metadata without profile row', () => {
  const spoofedUser = {
    id: 'usr-spoof',
    email: 'spoof@civilense.in',
    user_metadata: { full_name: 'Spoof User', role: 'Coordinator' },
  } as unknown as User;

  const mappedWithoutProfile = mapAuthUserAndProfile(spoofedUser, null);
  assert.equal(mappedWithoutProfile.role, UserRole.Citizen);

  const mappedWithProfile = mapAuthUserAndProfile(spoofedUser, {
    id: 'usr-spoof',
    full_name: 'Verified Coordinator',
    role: 'Coordinator',
    created_at: '2026-11-23T00:00:00Z',
  });
  assert.equal(mappedWithProfile.role, UserRole.Coordinator);
  assert.equal(mappedWithProfile.fullName, 'Verified Coordinator');
});

test('signInWithSupabase reads public_profiles, plus password reset, recovery update, and verification resend', async () => {
  const queriedTables: string[] = [];
  const mockClient = {
    auth: {
      signInWithPassword: async ({ email }: { email: string }) => {
        if (email === 'unverified@civilense.in') {
          return {
            data: { user: null, session: null },
            error: { message: 'Email not confirmed' },
          };
        }
        return {
          data: {
            user: {
              id: 'coord-1',
              email,
              created_at: '2026-11-23T00:00:00Z',
              email_confirmed_at: '2026-11-23T01:00:00Z',
              user_metadata: { full_name: 'Meera Nair' },
            },
            session: { access_token: 'tok' },
          },
          error: null,
        };
      },
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ data: { user: null }, error: null }),
      resend: async () => ({ error: null }),
    },
    from: (table: string) => {
      queriedTables.push(table);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'coord-1',
                full_name: 'Meera Nair',
                role: 'Coordinator',
                created_at: '2026-11-23T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;

  const unverified = await signInWithSupabase(
    { email: 'unverified@civilense.in', password: 'Password123' },
    mockClient,
  );
  assert.equal(unverified.ok, false);
  assert.match(unverified.error ?? '', /verify your email/i);

  const verified = await signInWithSupabase(
    { email: 'meera@civilense.in', password: 'Password123' },
    mockClient,
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.user?.role, UserRole.Coordinator);
  assert.equal(verified.user?.emailVerified, true);
  assert.deepEqual(queriedTables, ['public_profiles']);

  const resetBad = await requestPasswordReset('invalid-email', mockClient);
  assert.equal(resetBad.ok, false);

  const resetOk = await requestPasswordReset('meera@civilense.in', mockClient);
  assert.equal(resetOk.ok, true);

  const weakPw = await updatePasswordWithSupabase('short', mockClient);
  assert.equal(weakPw.ok, false);

  const strongPw = await updatePasswordWithSupabase('StrongPass2026', mockClient);
  assert.equal(strongPw.ok, true);

  const resendOk = await resendVerificationEmail('unverified@civilense.in', mockClient);
  assert.equal(resendOk.ok, true);
});

test('fetchPublicReportsFromSupabase queries live public_* columns without missing or sensitive fields', async () => {
  const requestedColumnsByTable = new Map<string, string>();
  const evidenceEqFilters: Array<[string, string]> = [];

  const mockClient = {
    from: (table: string) => ({
      select: (columns = '*') => {
        requestedColumnsByTable.set(table, columns);
        const makeOrderResult = async () => {
          if (table === 'public_civic_issues') {
            return {
              data: [
                {
                  id: 'uuid-issue-1',
                  report_code: 'CIV-2026-2001',
                  title: 'Overflowing bin near Indiranagar Metro',
                  description: 'Unattended waste pile blocking pedestrian footpath.',
                  category: IssueCategory.WasteAndSanitation,
                  state: 'Karnataka',
                  district: 'Bengaluru Urban',
                  city: 'Bengaluru',
                  locality: 'Indiranagar',
                  pin_code: '560038',
                  country_code: 'IN',
                  latitude: 12.9784,
                  longitude: 77.6408,
                  image_path: 'reports/2026/uuid-bin.jpg',
                  is_anonymous: true,
                  status: IssueStatus.Resolved,
                  safety_advisory_shown: false,
                  created_at: '2026-11-20T09:00:00Z',
                  updated_at: '2026-11-22T14:00:00Z',
                },
              ],
              error: null,
            };
          }
          if (table === 'public_issue_timeline') {
            return {
              data: [
                {
                  id: 'tl-1',
                  issue_id: 'uuid-issue-1',
                  previous_status: null,
                  new_status: IssueStatus.Submitted,
                  action_description: 'Submitted anonymously.',
                  created_at: '2026-11-20T09:00:00Z',
                },
              ],
              error: null,
            };
          }
          if (table === 'public_intervention_evidence') {
            return {
              data: [
                {
                  id: 'ev-1',
                  issue_id: 'uuid-issue-1',
                  initiative_id: null,
                  evidence_type: 'after',
                  image_path: 'evidence/2026/uuid-clean.jpg',
                  verification_status: 'Approved',
                  created_at: '2026-11-22T14:00:00Z',
                },
              ],
              error: null,
            };
          }
          if (table === 'public_issue_followups') {
            return {
              data: [
                {
                  id: 'fu-1',
                  issue_id: 'uuid-issue-1',
                  checked_at: '2026-11-23T09:00:00Z',
                  recurrence_detected: false,
                  observations: '[Needs Attention] Bin handle needs tightening.',
                  evidence_path: null,
                },
              ],
              error: null,
            };
          }
          return { data: [], error: null };
        };

        return {
          eq: (col: string, val: string) => {
            evidenceEqFilters.push([col, val]);
            return { order: makeOrderResult };
          },
          order: makeOrderResult,
        };
      },
    }),
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.example.supabase.co/${bucket}/${path}` },
        }),
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed.example.supabase.co/${bucket}/${path}` },
          error: null,
        }),
      }),
    },
  } as unknown as SupabaseClient;

  const res = await fetchPublicReportsFromSupabase(mockClient);
  assert.equal(res.ok, true);
  assert.equal(res.issues.length, 1);
  assert.equal(res.issues[0].id, 'CIV-2026-2001');
  assert.equal(res.issues[0].dbId, 'uuid-issue-1');
  assert.equal(res.issues[0].isAnonymous, true);
  assert.equal(
    res.issues[0].resolutionEvidence?.afterImageUrl,
    'https://signed.example.supabase.co/intervention-evidence/evidence/2026/uuid-clean.jpg',
  );
  assert.equal(res.issues[0].resolutionEvidence?.approvedByCoordinator, true);
  assert.equal(res.issues[0].timeline[0]?.actorRole, 'Citizen Report');
  assert.equal(res.issues[0].followUpChecks[0]?.outcome, 'Needs Attention');
  assert.equal(res.issues[0].followUpChecks[0]?.note, 'Bin handle needs tightening.');

  // Exact live columns and strict non-sensitive column checks
  const issueCols = requestedColumnsByTable.get('public_civic_issues') ?? '';
  assert.ok(issueCols.includes('report_code'));
  assert.equal(issueCols.includes('reporter_id'), false);

  const timelineCols = requestedColumnsByTable.get('public_issue_timeline') ?? '';
  assert.ok(timelineCols.includes('action_description'));
  assert.equal(timelineCols.includes('changed_by'), false);
  assert.equal(timelineCols.includes('actor_role'), false);

  const evidenceCols = requestedColumnsByTable.get('public_intervention_evidence') ?? '';
  assert.ok(evidenceCols.includes('verification_status'));
  assert.equal(evidenceCols.includes('submitted_by'), false);
  assert.equal(evidenceCols.includes('verified_by'), false);
  assert.equal(evidenceCols.includes('summary'), false);
  assert.deepEqual(evidenceEqFilters, [['verification_status', 'Approved']]);

  const followupCols = requestedColumnsByTable.get('public_issue_followups') ?? '';
  assert.ok(followupCols.includes('observations'));
  assert.equal(followupCols.includes('checked_by'), false);
  assert.equal(followupCols.includes('outcome'), false);
});

test('lookupReportByCodeFromSupabase queries public_civic_issues directly and hydrates child tables', async () => {
  const mockClient = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'uuid-issue-1',
              report_code: 'CIV-2026-2001',
              title: 'Overflowing bin near Indiranagar Metro',
              description: 'Unattended waste pile blocking pedestrian footpath.',
              category: IssueCategory.WasteAndSanitation,
              state: 'Karnataka',
              district: 'Bengaluru Urban',
              city: 'Bengaluru',
              locality: 'Indiranagar',
              pin_code: '560038',
              country_code: 'IN',
              latitude: 12.9784,
              longitude: 77.6408,
              image_path: null,
              is_anonymous: true,
              status: IssueStatus.Verified,
              safety_advisory_shown: false,
              created_at: '2026-11-20T09:00:00Z',
              updated_at: '2026-11-21T09:00:00Z',
            },
            error: null,
          }),
          eq: () => ({
            order: async () => ({ data: [], error: null }),
          }),
          order: async () => {
            if (table === 'public_issue_timeline') {
              return {
                data: [
                  {
                    id: 'tl-1',
                    issue_id: 'uuid-issue-1',
                    previous_status: null,
                    new_status: IssueStatus.Submitted,
                    action_description: 'Submitted anonymously.',
                    created_at: '2026-11-20T09:00:00Z',
                  },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const badCode = await lookupReportByCodeFromSupabase('INVALID', mockClient);
  assert.equal(badCode.ok, false);

  const found = await lookupReportByCodeFromSupabase('civ-2026-2001', mockClient);
  assert.equal(found.ok, true);
  assert.equal(found.issue?.id, 'CIV-2026-2001');
  assert.equal(found.issue?.timeline.length, 1);
});

test('submitReportToSupabase rejects overseas input, inserts public_civic_issues, and rolls back photo on DB failure', async () => {
  const overseasRes = await submitReportToSupabase({
    category: IssueCategory.WasteAndSanitation,
    title: 'Garbage pile in London street',
    description: 'Blocked sidewalk near station exit in London UK.',
    country_code: 'IN',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'London',
    locality: 'Camden',
    pin_code: '560038',
    isAnonymous: true,
  });
  assert.equal(overseasRes.ok, false);
  assert.match(overseasRes.error ?? '', /India|outside/i);

  const removedFiles: string[] = [];
  const failingInsertClient = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
        remove: async (paths: string[]) => {
          removedFiles.push(`${bucket}:${paths[0]}`);
          return { data: null, error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        like: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: null,
            error: { code: '22023', message: 'Selected coordinates are outside India.' },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const photo = createMockFile('pothole.jpg', 'image/jpeg', 12_000);
  const failRes = await submitReportToSupabase(
    {
      category: IssueCategory.PublicSpaceDamage,
      title: 'Broken footpath slab near Koramangala BDA',
      description: 'Uneven concrete slab creating tripping risk for seniors.',
      country_code: 'IN',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      locality: 'Koramangala 4th Block',
      pin_code: '560034',
      latitude: 12.9352,
      longitude: 77.6245,
      isAnonymous: false,
    },
    photo,
    failingInsertClient,
  );
  assert.equal(failRes.ok, false);
  assert.match(failRes.error ?? '', /outside India/i);
  assert.equal(removedFiles.length, 1);
  assert.match(removedFiles[0], /^civic-issue-images:reports\//);
});

test('updateReportStatusInSupabase enforces workflow transitions and writes live columns only', async () => {
  const sampleIssue: CivicIssue = {
    id: 'CIV-2026-2002',
    dbId: 'uuid-issue-2',
    category: IssueCategory.WasteAndSanitation,
    title: 'Blocked storm drain in Adyar',
    description: 'Plastic debris blocking stormwater inlet.',
    country_code: 'IN',
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
    locality: 'Adyar',
    pin_code: '600020',
    location: 'Adyar, Chennai, Chennai District, Tamil Nadu - 600020, India',
    isAnonymous: false,
    status: IssueStatus.Submitted,
    submittedAt: '2026-11-20T09:00:00Z',
    updatedAt: '2026-11-20T09:00:00Z',
    timeline: [],
    followUpChecks: [],
  };

  const invalidJump = await updateReportStatusInSupabase({
    issue: sampleIssue,
    newStatus: IssueStatus.Resolved,
    note: 'Attempting skip',
  });
  assert.equal(invalidJump.ok, false);
  assert.match(
    invalidJump.error ?? '',
    /Cannot transition directly|Invalid status transition/i,
  );

  const validVerifiedIssue: CivicIssue = {
    ...sampleIssue,
    status: IssueStatus.ActionInProgress,
  };

  const insertedPayloads: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const mockClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'coord-1' } }, error: null }),
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed.example.supabase.co/${bucket}/${path}` },
          error: null,
        }),
      }),
    },
    from: (table: string) => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: {
                id: 'uuid-issue-2',
                report_code: 'CIV-2026-2002',
                title: sampleIssue.title,
                description: sampleIssue.description,
                category: sampleIssue.category,
                state: sampleIssue.state,
                district: sampleIssue.district,
                city: sampleIssue.city,
                locality: sampleIssue.locality,
                pin_code: sampleIssue.pin_code,
                country_code: 'IN',
                latitude: 13.0012,
                longitude: 80.2565,
                image_path: null,
                is_anonymous: false,
                status: IssueStatus.Resolved,
                safety_advisory_shown: false,
                created_at: sampleIssue.submittedAt,
                updated_at: '2026-11-23T10:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      }),
      insert: async (payload: Record<string, unknown>) => {
        insertedPayloads.push({ table, payload });
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          order: async () => {
            if (table === 'public_issue_timeline') {
              return {
                data: [
                  {
                    id: 'tl-coord-1',
                    issue_id: 'uuid-issue-2',
                    previous_status: IssueStatus.ActionInProgress,
                    new_status: IssueStatus.Resolved,
                    action_description: 'Cleared and verified.',
                    created_at: '2026-11-23T10:00:00Z',
                  },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const afterPhoto = createMockFile('after-clean.png', 'image/png', 8_000);
  const res = await updateReportStatusInSupabase(
    {
      issue: validVerifiedIssue,
      newStatus: IssueStatus.Resolved,
      note: 'Cleared and verified.',
      afterImageFile: afterPhoto,
      resolutionSummary: 'Drain grating cleared before monsoon.',
    },
    mockClient,
  );
  assert.equal(res.ok, true);
  assert.equal(res.issue?.status, IssueStatus.Resolved);
  assert.equal(res.issue?.timeline[0]?.note, 'Cleared and verified.');

  const tlInsert = insertedPayloads.find((x) => x.table === 'public_issue_timeline');
  assert.ok(tlInsert);
  assert.equal('actor_role' in tlInsert.payload, false);

  const evInsert = insertedPayloads.find((x) => x.table === 'public_intervention_evidence');
  assert.ok(evInsert);
  assert.equal(evInsert.payload.verification_status, 'Approved');
  assert.equal('summary' in evInsert.payload, false);
});

test('Volunteer evidence upload, Coordinator evidence approval, and follow-up checks work against public_* tables', async () => {
  const insertedRows: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const updatedRows: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const mockClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-123' } }, error: null }),
    },
    storage: {
      from: () => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
    from: (table: string) => ({
      insert: async (payload: Record<string, unknown>) => {
        insertedRows.push({ table, payload });
        return { error: null };
      },
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          updatedRows.push({ table, payload });
          return { error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;

  const photo = createMockFile('drive-after.jpg', 'image/jpeg', 15_000);
  const volRes = await submitVolunteerEvidenceInSupabase(
    {
      issueDbId: 'uuid-issue-1',
      initiativeId: 'init-uuid-1',
      imageFile: photo,
      summary: 'Volunteers cleared plastic waste and swept footpath.',
    },
    mockClient,
  );
  assert.equal(volRes.ok, true);
  assert.equal(insertedRows[0]?.table, 'public_intervention_evidence');
  assert.equal(insertedRows[0]?.payload.verification_status, 'Pending');
  assert.equal('summary' in (insertedRows[0]?.payload ?? {}), false);

  const reviewRes = await reviewPendingEvidenceInSupabase(
    { evidenceId: 'ev-pending-1', decision: 'Approved' },
    mockClient,
  );
  assert.equal(reviewRes.ok, true);
  assert.equal(updatedRows[0]?.table, 'public_intervention_evidence');
  assert.equal(updatedRows[0]?.payload.verification_status, 'Approved');

  const followupRes = await createIssueFollowupInSupabase(
    {
      issue: {
        id: 'CIV-2026-2001',
        dbId: 'uuid-issue-1',
        category: IssueCategory.WasteAndSanitation,
        title: 'Overflowing bin near Indiranagar Metro',
        description: 'Unattended waste pile blocking footpath.',
        country_code: 'IN',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        city: 'Bengaluru',
        locality: 'Indiranagar',
        pin_code: '560038',
        location: 'Indiranagar, Bengaluru',
        isAnonymous: true,
        status: IssueStatus.Resolved,
        submittedAt: '2026-11-20T09:00:00Z',
        updatedAt: '2026-11-22T14:00:00Z',
        timeline: [],
        followUpChecks: [],
      },
      outcome: 'Marked Recurring',
      observations: 'Dumping resumed near metro pillar.',
    },
    mockClient,
  );
  assert.equal(followupRes.ok, true);
  const fuInsert = insertedRows.find((r) => r.table === 'public_issue_followups');
  assert.ok(fuInsert);
  assert.equal(fuInsert.payload.recurrence_detected, true);
  assert.equal('outcome' in fuInsert.payload, false);
  assert.ok(updatedRows.some((u) => u.table === 'public_civic_issues' && u.payload.status === IssueStatus.Recurring));
});

test('initiativeService reads public_* tables cleanly, updates attendance/registrations, and validates India-only payload', async () => {
  assert.equal(
    deriveInitiativeCategory('Indiranagar Clean Park Drive', 'Morning park cleanup'),
    'Waste & Sanitation',
  );
  assert.equal(
    deriveInitiativeCategory('Cubbon Tree Plantation', 'Planting native saplings'),
    'Green Spaces',
  );

  const coordUser: UserAccount = {
    id: 'coord-uuid',
    fullName: 'Meera Nair',
    email: 'meera@civilense.in',
    role: UserRole.Coordinator,
    createdAt: '2026-11-01T00:00:00Z',
  };

  const queriedTables: string[] = [];
  const updatedRows: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const insertedInitiativePayloads: Array<Record<string, unknown>> = [];

  const fetchMockClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'vol-uuid' } }, error: null }),
    },
    from: (table: string) => {
      queriedTables.push(table);
      return {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: () => ({
                eq: async () => ({ count: 1, error: null }),
              }),
            };
          }
          if (table === 'public_community_initiatives') {
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'init-uuid-1',
                    title: 'Indiranagar Clean Park Drive',
                    status: 'Open',
                    capacity: 25,
                  },
                  error: null,
                }),
              }),
              order: async () => ({
                data: [
                  {
                    id: 'init-uuid-1',
                    title: 'Indiranagar Clean Park Drive',
                    description: 'Morning park cleanup in Indiranagar.',
                    country_code: 'IN',
                    state: 'Karnataka',
                    district: 'Bengaluru Urban',
                    city: 'Bengaluru',
                    locality: 'Indiranagar',
                    pin_code: '560038',
                    latitude: 12.9784,
                    longitude: 77.6408,
                    event_date: '2026-12-10',
                    start_time: '07:30:00',
                    end_time: '10:30:00',
                    capacity: 25,
                    status: 'Open',
                    cancellation_reason: null,
                    linked_issue_ids: ['uuid-issue-1'],
                    cover_image_path: null,
                    created_at: '2026-11-20T00:00:00Z',
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === 'public_volunteer_registrations') {
            return {
              eq: (_col: string, val: string) => {
                if (val === 'init-uuid-1') {
                  return {
                    eq: () => ({
                      maybeSingle: async () => ({
                        data: { id: 'reg-1', registration_status: 'Registered' },
                        error: null,
                      }),
                    }),
                  };
                }
                return {
                  order: async () => ({
                    data: [
                      {
                        id: 'reg-1',
                        initiative_id: 'init-uuid-1',
                        user_id: 'vol-uuid',
                        registration_status: 'Registered',
                        attendance_status: 'Pending',
                        registered_at: '2026-11-21T08:00:00Z',
                      },
                    ],
                    error: null,
                  }),
                  then: undefined,
                  // Direct promise resolution for activeRegsRes count query
                  data: [{ initiative_id: 'init-uuid-1' }],
                  error: null,
                };
              },
            };
          }
          if (table === 'public_profiles') {
            return {
              in: async () => ({
                data: [{ id: 'vol-uuid', full_name: 'Rohan Sharma' }],
                error: null,
              }),
            };
          }
          return { data: [], error: null };
        },
        update: (payload: Record<string, unknown>) => ({
          eq: () => {
            updatedRows.push({ table, payload });
            return {
              eq: () => ({
                eq: () => ({
                  select: async () => ({ data: [{ id: 'reg-1' }], error: null }),
                }),
              }),
              error: null,
            };
          },
        }),
        insert: async (payload: Record<string, unknown>) => {
          insertedInitiativePayloads.push(payload);
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;

  const issuesList: CivicIssue[] = [
    {
      id: 'CIV-2026-2001',
      dbId: 'uuid-issue-1',
      category: IssueCategory.WasteAndSanitation,
      title: 'Test',
      description: 'Test description here',
      country_code: 'IN',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      locality: 'Indiranagar',
      pin_code: '560038',
      location: 'Indiranagar, Bengaluru, India',
      isAnonymous: false,
      status: IssueStatus.Verified,
      submittedAt: '2026-11-20T00:00:00Z',
      updatedAt: '2026-11-20T00:00:00Z',
      timeline: [],
      followUpChecks: [],
    },
  ];

  const fetched = await fetchInitiativesFromSupabase(
    coordUser,
    issuesList,
    fetchMockClient,
  );
  assert.equal(fetched.ok, true);
  assert.ok(queriedTables.includes('public_community_initiatives'));
  assert.ok(queriedTables.includes('public_volunteer_registrations'));
  assert.ok(queriedTables.includes('public_profiles'));
  assert.equal(fetched.initiatives[0]?.category, 'Waste & Sanitation');
  assert.equal(fetched.initiatives[0]?.registeredCount, 1);
  assert.deepEqual(fetched.initiatives[0]?.linkedIssueIds, ['CIV-2026-2001']);
  assert.equal(fetched.registrations[0]?.volunteerName, 'Rohan Sharma');

  const dupReg = await registerVolunteerInSupabase('init-uuid-1', fetchMockClient);
  assert.equal(dupReg.ok, false);
  assert.match(dupReg.message, /already registered/i);

  const cancelRes = await cancelVolunteerInSupabase('init-uuid-1', fetchMockClient);
  assert.equal(cancelRes.ok, true);

  const attRes = await markVolunteerAttendanceInSupabase(
    'reg-1',
    'Attended',
    fetchMockClient,
  );
  assert.equal(attRes.ok, true);
  assert.ok(
    updatedRows.some(
      (u) =>
        u.table === 'public_volunteer_registrations' &&
        u.payload.attendance_status === 'Attended',
    ),
  );

  const goodInitiative: CommunityInitiative = {
    id: 'init-new',
    title: 'Indiranagar Footpath Cleanup',
    category: 'Waste & Sanitation',
    description: 'Community sweeping and waste sorting drive in Indiranagar.',
    country_code: 'IN',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    locality: 'Indiranagar',
    pin_code: '560038',
    location: 'Indiranagar, Bengaluru',
    eventDate: '2026-12-20',
    startTime: '08:00',
    endTime: '11:00',
    dateLabel: 'Sun, 20 Dec 2026',
    timeLabel: '8:00 AM - 11:00 AM IST',
    capacity: 20,
    registeredCount: 0,
    status: 'Open',
    organizer: 'Meera Nair',
    highlights: ['Gloves provided'],
    linkedIssueIds: ['CIV-2026-2001'],
  };

  const savedOk = await saveInitiativeInSupabase(
    {
      initiative: goodInitiative,
      issues: issuesList,
      coordinator: coordUser,
    },
    fetchMockClient,
  );
  assert.equal(savedOk.ok, true);
  assert.equal('category' in (insertedInitiativePayloads[0] ?? {}), false);
  assert.equal('organizer_label' in (insertedInitiativePayloads[0] ?? {}), false);
  assert.equal('highlights' in (insertedInitiativePayloads[0] ?? {}), false);

  const badInitiative: CommunityInitiative = {
    ...goodInitiative,
    id: 'init-bad',
    title: 'Toronto Park Cleanup Drive',
    city: 'Toronto',
    location: 'Toronto, Canada',
  };

  const blockedSave = await saveInitiativeInSupabase({
    initiative: badInitiative,
    issues: issuesList,
    coordinator: coordUser,
  });
  assert.equal(blockedSave.ok, false);
  assert.match(blockedSave.error ?? '', /India|outside/i);
});
