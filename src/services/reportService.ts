import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CivicIssue,
  FollowUpCheck,
  IssueCategory,
  IssueStatus,
  PendingEvidenceItem,
  ResolutionEvidence,
  StatusTimelineEntry,
} from '../types/civic';
import {
  formatIndianAddress,
  IssueSubmissionInput,
  requiresAuthoritySafetyAdvisory,
  validateIssueStatusTransition,
  validateIssueSubmission,
} from '../utils/civicLogic';
import {
  removeCivicStorageFile,
  resolveStorageAssetUrl,
  STORAGE_BUCKETS,
  uploadCivicStorageFile,
} from './storageService';
import { formatSupabaseError, requireSupabaseClient } from './supabaseClient';

export interface PublicIssueRow {
  id: string;
  report_code: string;
  title: string;
  description: string;
  category: IssueCategory;
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  country_code: 'IN';
  latitude: number | null;
  longitude: number | null;
  image_path: string | null;
  is_anonymous: boolean;
  status: IssueStatus;
  safety_advisory_shown: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicTimelineRow {
  id: string;
  issue_id: string;
  previous_status: IssueStatus | null;
  new_status: IssueStatus;
  action_description: string;
  actor_role?: string | null;
  created_at: string;
}

export interface PublicEvidenceRow {
  id: string;
  issue_id: string;
  initiative_id: string | null;
  evidence_type: 'before' | 'after' | 'followup';
  image_path: string;
  summary?: string | null;
  verification_status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export interface PublicFollowupRow {
  id: string;
  issue_id: string;
  checked_at: string;
  recurrence_detected: boolean;
  outcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring' | null;
  observations: string;
  evidence_path: string | null;
}

export const PUBLIC_CIVIC_ISSUE_COLUMNS =
  'id, report_code, title, description, category, state, district, city, locality, pin_code, country_code, latitude, longitude, image_path, is_anonymous, status, safety_advisory_shown, created_at, updated_at';

export const PUBLIC_ISSUE_TIMELINE_COLUMNS =
  'id, issue_id, previous_status, new_status, action_description, created_at';

export const PUBLIC_EVIDENCE_COLUMNS =
  'id, issue_id, initiative_id, evidence_type, image_path, verification_status, created_at';

export const PUBLIC_FOLLOWUP_COLUMNS =
  'id, issue_id, checked_at, recurrence_detected, observations, evidence_path';

async function getOptionalAuthUserId(
  client: SupabaseClient,
): Promise<string | null> {
  try {
    if (!client.auth || typeof client.auth.getUser !== 'function') {
      return null;
    }
    const { data } = await client.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

function deriveTimelineActorRole(row: PublicTimelineRow): string {
  if (row.actor_role && row.actor_role.trim()) {
    return row.actor_role;
  }
  if (!row.previous_status && row.new_status === IssueStatus.Submitted) {
    return 'Citizen Report';
  }
  return 'Coordinator Update';
}

function deriveFollowupOutcome(
  row: PublicFollowupRow,
): FollowUpCheck['outcome'] {
  if (row.outcome) {
    return row.outcome;
  }
  if (row.recurrence_detected) {
    return 'Marked Recurring';
  }
  if (/^\[Needs Attention\]/i.test(row.observations) || /needs attention/i.test(row.observations)) {
    return 'Needs Attention';
  }
  return 'Sustained';
}

function cleanFollowupObservationText(observations: string): string {
  return observations.replace(/^\[(Sustained|Needs Attention|Marked Recurring)\]\s*/i, '').trim();
}

async function generateNextReportCode(client: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CIV-${year}-`;
  let nextNum = 1001;

  try {
    const { data } = await client
      .from('public_civic_issues')
      .select('report_code')
      .like('report_code', `${prefix}%`)
      .order('report_code', { ascending: false })
      .limit(20);

    if (Array.isArray(data)) {
      let maxNum = 1000;
      for (const item of data as Array<{ report_code?: string }>) {
        const suffix = item.report_code?.slice(prefix.length) ?? '';
        const parsed = Number.parseInt(suffix, 10);
        if (Number.isFinite(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
      nextNum = maxNum + 1;
    }
  } catch {
    nextNum = 1001 + Math.floor(Math.random() * 8000);
  }

  return `${prefix}${nextNum}`;
}

async function hydrateIssueRows(
  rows: PublicIssueRow[],
  timelineRows: PublicTimelineRow[],
  evidenceRows: PublicEvidenceRow[],
  followupRows: PublicFollowupRow[],
  client: SupabaseClient,
): Promise<CivicIssue[]> {
  const timelineByIssue = new Map<string, StatusTimelineEntry[]>();
  for (const tl of timelineRows) {
    const list = timelineByIssue.get(tl.issue_id) ?? [];
    list.push({
      id: tl.id,
      status: tl.new_status,
      timestamp: tl.created_at,
      note: tl.action_description,
      actorRole: deriveTimelineActorRole(tl),
    });
    timelineByIssue.set(tl.issue_id, list);
  }

  const followupByIssue = new Map<string, FollowUpCheck[]>();
  for (const fu of followupRows) {
    const list = followupByIssue.get(fu.issue_id) ?? [];
    list.push({
      id: fu.id,
      checkedAt: fu.checked_at,
      outcome: deriveFollowupOutcome(fu),
      note: cleanFollowupObservationText(fu.observations),
    });
    followupByIssue.set(fu.issue_id, list);
  }

  const evidenceByIssue = new Map<string, PublicEvidenceRow[]>();
  for (const ev of evidenceRows) {
    const list = evidenceByIssue.get(ev.issue_id) ?? [];
    list.push(ev);
    evidenceByIssue.set(ev.issue_id, list);
  }

  return Promise.all(
    rows.map(async (row) => {
      const resolvedImageUrl = await resolveStorageAssetUrl(
        STORAGE_BUCKETS.issues,
        row.image_path,
        client,
      );

      const issueEvList = evidenceByIssue.get(row.id) ?? [];
      const approvedAfterEv = issueEvList.find(
        (e) => e.evidence_type === 'after' && e.verification_status === 'Approved',
      );
      const approvedBeforeEv = issueEvList.find(
        (e) => e.evidence_type === 'before' && e.verification_status === 'Approved',
      );

      let resolutionEvidence: ResolutionEvidence | undefined;
      if (approvedAfterEv) {
        const afterUrl = await resolveStorageAssetUrl(
          STORAGE_BUCKETS.evidence,
          approvedAfterEv.image_path,
          client,
        );
        const beforeUrl = approvedBeforeEv
          ? await resolveStorageAssetUrl(
              STORAGE_BUCKETS.issues,
              approvedBeforeEv.image_path,
              client,
            )
          : resolvedImageUrl;

        resolutionEvidence = {
          summary:
            approvedAfterEv.summary || 'Verified resolution evidence uploaded.',
          beforeImageUrl: beforeUrl,
          afterImageUrl: afterUrl,
          approvedByCoordinator: true,
          completedAt: approvedAfterEv.created_at,
        };
      }

      const pendingRows = issueEvList.filter(
        (e) => e.verification_status === 'Pending',
      );
      const pendingEvidence: PendingEvidenceItem[] = await Promise.all(
        pendingRows.map(async (ev) => ({
          id: ev.id,
          initiativeId: ev.initiative_id ?? undefined,
          evidenceType: ev.evidence_type,
          imagePath: ev.image_path,
          imageUrl: await resolveStorageAssetUrl(
            STORAGE_BUCKETS.evidence,
            ev.image_path,
            client,
          ),
          summary: ev.summary || 'Volunteer intervention photo awaiting review.',
          submittedAt: ev.created_at,
        })),
      );

      const lat = row.latitude ?? undefined;
      const lng = row.longitude ?? undefined;

      return {
        id: row.report_code,
        dbId: row.id,
        category: row.category,
        title: row.title,
        description: row.description,
        country_code: 'IN',
        state: row.state,
        district: row.district,
        city: row.city,
        locality: row.locality,
        pin_code: row.pin_code,
        latitude: lat,
        longitude: lng,
        location: formatIndianAddress({
          locality: row.locality,
          city: row.city,
          district: row.district,
          state: row.state,
          pin_code: row.pin_code,
        }),
        coordinates:
          lat !== undefined && lng !== undefined
            ? {
                lat,
                lng,
                zoneLabel: `${row.locality}, ${row.city} (${row.pin_code})`,
              }
            : undefined,
        imageUrl: resolvedImageUrl,
        imagePath: row.image_path ?? undefined,
        isAnonymous: row.is_anonymous,
        status: row.status,
        submittedAt: row.created_at,
        updatedAt: row.updated_at,
        safetyAdvisoryShown: row.safety_advisory_shown,
        timeline: timelineByIssue.get(row.id) ?? [],
        followUpChecks: followupByIssue.get(row.id) ?? [],
        resolutionEvidence,
        pendingEvidence: pendingEvidence.length > 0 ? pendingEvidence : undefined,
      };
    }),
  );
}

async function fetchHydratedIssueByDbId(
  row: PublicIssueRow,
  client: SupabaseClient,
  includePendingEvidence = false,
): Promise<CivicIssue> {
  const evidenceBase = client
    .from('public_intervention_evidence')
    .select(PUBLIC_EVIDENCE_COLUMNS)
    .eq('issue_id', row.id);

  const evidenceQuery = (
    includePendingEvidence
      ? evidenceBase
      : evidenceBase.eq('verification_status', 'Approved')
  ).order('created_at', { ascending: false });

  const [timelineRes, evidenceRes, followupsRes] = await Promise.all([
    client
      .from('public_issue_timeline')
      .select(PUBLIC_ISSUE_TIMELINE_COLUMNS)
      .eq('issue_id', row.id)
      .order('created_at', { ascending: true }),
    evidenceQuery,
    client
      .from('public_issue_followups')
      .select(PUBLIC_FOLLOWUP_COLUMNS)
      .eq('issue_id', row.id)
      .order('checked_at', { ascending: true }),
  ]);

  const [hydrated] = await hydrateIssueRows(
    [row],
    (timelineRes.data ?? []) as PublicTimelineRow[],
    (evidenceRes.data ?? []) as PublicEvidenceRow[],
    (followupsRes.data ?? []) as PublicFollowupRow[],
    client,
  );
  return hydrated;
}

export async function fetchPublicReportsFromSupabase(
  clientOverride?: SupabaseClient | null,
  options?: { includePendingEvidence?: boolean },
): Promise<{ ok: boolean; issues: CivicIssue[]; error?: string }> {
  try {
    const client = requireSupabaseClient(clientOverride);

    const evidenceBase = client
      .from('public_intervention_evidence')
      .select(PUBLIC_EVIDENCE_COLUMNS);

    const evidenceFiltered = options?.includePendingEvidence
      ? evidenceBase
      : evidenceBase.eq('verification_status', 'Approved');

    const [issuesRes, timelineRes, evidenceRes, followupsRes] = await Promise.all([
      client
        .from('public_civic_issues')
        .select(PUBLIC_CIVIC_ISSUE_COLUMNS)
        .order('created_at', { ascending: false }),
      client
        .from('public_issue_timeline')
        .select(PUBLIC_ISSUE_TIMELINE_COLUMNS)
        .order('created_at', { ascending: true }),
      evidenceFiltered.order('created_at', { ascending: false }),
      client
        .from('public_issue_followups')
        .select(PUBLIC_FOLLOWUP_COLUMNS)
        .order('checked_at', { ascending: true }),
    ]);

    const firstErr =
      issuesRes.error ||
      timelineRes.error ||
      evidenceRes.error ||
      followupsRes.error;
    if (firstErr) {
      return {
        ok: false,
        issues: [],
        error: formatSupabaseError(firstErr, 'Unable to load civic reports.'),
      };
    }

    const hydrated = await hydrateIssueRows(
      (issuesRes.data ?? []) as PublicIssueRow[],
      (timelineRes.data ?? []) as PublicTimelineRow[],
      (evidenceRes.data ?? []) as PublicEvidenceRow[],
      (followupsRes.data ?? []) as PublicFollowupRow[],
      client,
    );

    return { ok: true, issues: hydrated };
  } catch (err) {
    return {
      ok: false,
      issues: [],
      error: formatSupabaseError(err, 'Unable to load civic reports.'),
    };
  }
}

export async function lookupReportByCodeFromSupabase(
  reportCode: string,
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; issue: CivicIssue | null; error?: string }> {
  const cleanCode = reportCode.trim().toUpperCase();
  if (!/^CIV-[0-9]{4}-[0-9]{4,}$/.test(cleanCode)) {
    return {
      ok: false,
      issue: null,
      error: 'Enter a valid Civilense report ID (e.g., CIV-2026-1001).',
    };
  }

  try {
    const client = requireSupabaseClient(clientOverride);
    const directRes = await client
      .from('public_civic_issues')
      .select(PUBLIC_CIVIC_ISSUE_COLUMNS)
      .eq('report_code', cleanCode)
      .maybeSingle();

    if (directRes.error) {
      return {
        ok: false,
        issue: null,
        error: formatSupabaseError(directRes.error, 'Unable to look up civic report.'),
      };
    }

    const row = (directRes.data as PublicIssueRow | null) ?? null;
    if (!row) {
      return { ok: true, issue: null };
    }

    const hydrated = await fetchHydratedIssueByDbId(row, client, false);
    return { ok: true, issue: hydrated };
  } catch (err) {
    return {
      ok: false,
      issue: null,
      error: formatSupabaseError(err, 'Unable to look up civic report.'),
    };
  }
}

export async function submitReportToSupabase(
  input: IssueSubmissionInput,
  imageFile?: File | null,
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; issue?: CivicIssue; error?: string }> {
  const validation = validateIssueSubmission(input);
  if (!validation.valid) {
    return {
      ok: false,
      error: Object.values(validation.errors)[0] ?? 'Invalid India report fields.',
    };
  }

  let uploadedImagePath: string | null = null;

  try {
    const client = requireSupabaseClient(clientOverride);

    if (imageFile) {
      const uploadRes = await uploadCivicStorageFile(
        STORAGE_BUCKETS.issues,
        'reports',
        imageFile,
        client,
      );
      if (!uploadRes.ok || !uploadRes.path) {
        return {
          ok: false,
          error: uploadRes.error ?? 'Failed to upload report photo.',
        };
      }
      uploadedImagePath = uploadRes.path;
    }

    const safetyShown = requiresAuthoritySafetyAdvisory(
      input.category,
      input.title,
      input.description,
    );

    const authUserId = await getOptionalAuthUserId(client);
    const effectiveIsAnonymous = input.isAnonymous || !authUserId;
    const reporterId = effectiveIsAnonymous ? null : authUserId;

    let insertedRow: PublicIssueRow | null = null;
    let insertError: unknown = null;

    const category = input.category as IssueCategory;
    let candidateCode = await generateNextReportCode(client);
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await client
        .from('public_civic_issues')
        .insert({
          report_code: candidateCode,
          title: input.title.trim(),
          description: input.description.trim(),
          category,
          state: input.state.trim(),
          district: input.district.trim(),
          city: input.city.trim(),
          locality: input.locality.trim(),
          pin_code: input.pin_code.trim(),
          country_code: 'IN',
          latitude: input.latitude ?? input.coordinates?.lat ?? null,
          longitude: input.longitude ?? input.coordinates?.lng ?? null,
          image_path: uploadedImagePath,
          reporter_id: reporterId,
          is_anonymous: effectiveIsAnonymous,
          status: IssueStatus.Submitted,
          safety_advisory_shown: safetyShown,
        })
        .select(PUBLIC_CIVIC_ISSUE_COLUMNS)
        .single();

      if (!error && data) {
        insertedRow = data as PublicIssueRow;
        insertError = null;
        break;
      }

      insertError = error;
      const errCode = (error as { code?: string } | null)?.code;
      if (errCode === '23505') {
        const year = new Date().getFullYear();
        candidateCode = `CIV-${year}-${1001 + Math.floor(Math.random() * 89000)}`;
        continue;
      }
      break;
    }

    if (!insertedRow) {
      if (uploadedImagePath) {
        await removeCivicStorageFile(
          STORAGE_BUCKETS.issues,
          uploadedImagePath,
          client,
        );
      }
      return {
        ok: false,
        error: formatSupabaseError(insertError, 'Unable to submit civic report.'),
      };
    }

    const initialDescription = effectiveIsAnonymous
      ? 'Report submitted anonymously for coordinator verification.'
      : 'Report submitted for coordinator verification.';

    await client.from('public_issue_timeline').insert({
      issue_id: insertedRow.id,
      previous_status: null,
      new_status: IssueStatus.Submitted,
      action_description: initialDescription,
      changed_by: null,
    });

    if (uploadedImagePath) {
      await client
        .from('public_intervention_evidence')
        .insert({
          issue_id: insertedRow.id,
          evidence_type: 'before',
          image_path: uploadedImagePath,
          submitted_by: reporterId,
          verification_status: 'Approved',
        })
        .then(undefined, () => undefined);
    }

    const hydrated = await fetchHydratedIssueByDbId(insertedRow, client, false);
    return { ok: true, issue: hydrated };
  } catch (err) {
    if (uploadedImagePath) {
      await removeCivicStorageFile(
        STORAGE_BUCKETS.issues,
        uploadedImagePath,
        clientOverride,
      );
    }
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to submit civic report.'),
    };
  }
}

export async function updateReportStatusInSupabase(
  params: {
    issue: CivicIssue;
    newStatus: IssueStatus;
    note: string;
    approveEvidence?: boolean;
    afterImageFile?: File | null;
    resolutionSummary?: string;
    followUpOutcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
  },
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; issue?: CivicIssue; error?: string }> {
  const transition = validateIssueStatusTransition(
    params.issue.status,
    params.newStatus,
  );
  if (!transition.valid) {
    return { ok: false, error: transition.error };
  }

  if (!params.issue.dbId) {
    return {
      ok: false,
      error: 'Report database UUID is missing. Reload reports and try again.',
    };
  }

  let uploadedAfterPath: string | null = null;

  try {
    const client = requireSupabaseClient(clientOverride);

    if (params.afterImageFile) {
      const uploadRes = await uploadCivicStorageFile(
        STORAGE_BUCKETS.evidence,
        'evidence',
        params.afterImageFile,
        client,
      );
      if (!uploadRes.ok || !uploadRes.path) {
        return {
          ok: false,
          error: uploadRes.error ?? 'Failed to upload resolution evidence photo.',
        };
      }
      uploadedAfterPath = uploadRes.path;
    }

    const authUserId = await getOptionalAuthUserId(client);
    const cleanNote =
      params.note.trim() || `Status updated to ${params.newStatus}.`;
    const cleanSummary = params.resolutionSummary?.trim();
    const timelineNote =
      cleanSummary && cleanSummary !== cleanNote
        ? `${cleanNote} — ${cleanSummary}`
        : cleanNote;

    const { data, error } = await client
      .from('public_civic_issues')
      .update({ status: params.newStatus })
      .eq('id', params.issue.dbId)
      .select(PUBLIC_CIVIC_ISSUE_COLUMNS)
      .single();

    if (error || !data) {
      if (uploadedAfterPath) {
        await removeCivicStorageFile(
          STORAGE_BUCKETS.evidence,
          uploadedAfterPath,
          client,
        );
      }
      return {
        ok: false,
        error: formatSupabaseError(error, 'Failed to update civic report status.'),
      };
    }

    const { error: timelineErr } = await client
      .from('public_issue_timeline')
      .insert({
        issue_id: params.issue.dbId,
        previous_status: params.issue.status,
        new_status: params.newStatus,
        action_description: timelineNote,
        changed_by: authUserId,
      });

    if (timelineErr) {
      return {
        ok: false,
        error: formatSupabaseError(
          timelineErr,
          'Status updated, but timeline audit entry failed.',
        ),
      };
    }

    if (params.followUpOutcome) {
      const taggedObservation =
        params.followUpOutcome === 'Needs Attention' &&
        !/needs attention/i.test(cleanNote)
          ? `[Needs Attention] ${cleanNote}`
          : cleanNote;

      await client.from('public_issue_followups').insert({
        issue_id: params.issue.dbId,
        checked_by: authUserId,
        recurrence_detected: params.followUpOutcome === 'Marked Recurring',
        observations: taggedObservation,
      });
    }

    const shouldApprove =
      Boolean(params.approveEvidence) ||
      params.newStatus === IssueStatus.Resolved;

    if (uploadedAfterPath) {
      await client.from('public_intervention_evidence').insert({
        issue_id: params.issue.dbId,
        evidence_type: 'after',
        image_path: uploadedAfterPath,
        submitted_by: authUserId,
        verification_status: shouldApprove ? 'Approved' : 'Pending',
        verified_by: shouldApprove ? authUserId : null,
      });
    } else if (shouldApprove) {
      await client
        .from('public_intervention_evidence')
        .update({
          verification_status: 'Approved',
          verified_by: authUserId,
        })
        .eq('issue_id', params.issue.dbId)
        .eq('evidence_type', 'after');
    }

    const hydrated = await fetchHydratedIssueByDbId(
      data as PublicIssueRow,
      client,
      true,
    );

    return { ok: true, issue: hydrated };
  } catch (err) {
    if (uploadedAfterPath) {
      await removeCivicStorageFile(
        STORAGE_BUCKETS.evidence,
        uploadedAfterPath,
        clientOverride,
      );
    }
    return {
      ok: false,
      error: formatSupabaseError(err, 'Failed to update civic report status.'),
    };
  }
}

export async function submitVolunteerEvidenceInSupabase(
  params: {
    issueDbId: string;
    initiativeId: string;
    imageFile: File;
    summary: string;
  },
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const cleanSummary = params.summary.trim();
  if (cleanSummary.length < 5) {
    return {
      ok: false,
      error:
        'Please enter a short observation (at least 5 characters) describing the work completed.',
    };
  }

  let uploadedPath: string | null = null;
  try {
    const client = requireSupabaseClient(clientOverride);
    const authUserId = await getOptionalAuthUserId(client);
    const uploadRes = await uploadCivicStorageFile(
      STORAGE_BUCKETS.evidence,
      'evidence',
      params.imageFile,
      client,
    );

    if (!uploadRes.ok || !uploadRes.path) {
      return {
        ok: false,
        error: uploadRes.error ?? 'Failed to upload volunteer evidence photo.',
      };
    }
    uploadedPath = uploadRes.path;

    const { error } = await client.from('public_intervention_evidence').insert({
      issue_id: params.issueDbId,
      initiative_id: params.initiativeId,
      evidence_type: 'after',
      image_path: uploadedPath,
      submitted_by: authUserId,
      verification_status: 'Pending',
    });

    if (error) {
      await removeCivicStorageFile(STORAGE_BUCKETS.evidence, uploadedPath, client);
      return {
        ok: false,
        error: formatSupabaseError(
          error,
          'Unable to submit volunteer intervention evidence.',
        ),
      };
    }

    return {
      ok: true,
      message:
        'Evidence uploaded for Coordinator verification. It will appear publicly only after approval.',
    };
  } catch (err) {
    if (uploadedPath) {
      await removeCivicStorageFile(
        STORAGE_BUCKETS.evidence,
        uploadedPath,
        clientOverride,
      );
    }
    return {
      ok: false,
      error: formatSupabaseError(
        err,
        'Unable to submit volunteer intervention evidence.',
      ),
    };
  }
}

export async function reviewPendingEvidenceInSupabase(
  params: {
    evidenceId: string;
    decision: 'Approved' | 'Rejected';
  },
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = requireSupabaseClient(clientOverride);
    const authUserId = await getOptionalAuthUserId(client);
    const payload: {
      verification_status: 'Approved' | 'Rejected';
      verified_by?: string;
    } = {
      verification_status: params.decision,
    };
    if (authUserId) {
      payload.verified_by = authUserId;
    }

    const { error } = await client
      .from('public_intervention_evidence')
      .update(payload)
      .eq('id', params.evidenceId);

    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(
          error,
          'Unable to update volunteer evidence verification status.',
        ),
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(
        err,
        'Unable to update volunteer evidence verification status.',
      ),
    };
  }
}

export async function createIssueFollowupInSupabase(
  params: {
    issue: CivicIssue;
    outcome: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
    observations: string;
    evidenceFile?: File | null;
  },
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!params.issue.dbId) {
    return {
      ok: false,
      error: 'Report database UUID is missing.',
    };
  }
  const cleanObs = params.observations.trim();
  if (cleanObs.length < 3) {
    return {
      ok: false,
      error: 'Please enter brief follow-up observations (at least 3 characters).',
    };
  }

  let uploadedPath: string | null = null;
  try {
    const client = requireSupabaseClient(clientOverride);
    const authUserId = await getOptionalAuthUserId(client);

    if (params.evidenceFile) {
      const uploadRes = await uploadCivicStorageFile(
        STORAGE_BUCKETS.evidence,
        'evidence',
        params.evidenceFile,
        client,
      );
      if (!uploadRes.ok || !uploadRes.path) {
        return {
          ok: false,
          error: uploadRes.error ?? 'Failed to upload follow-up photo.',
        };
      }
      uploadedPath = uploadRes.path;
    }

    const taggedObs =
      params.outcome === 'Needs Attention' && !/needs attention/i.test(cleanObs)
        ? `[Needs Attention] ${cleanObs}`
        : cleanObs;

    const { error } = await client.from('public_issue_followups').insert({
      issue_id: params.issue.dbId,
      checked_by: authUserId,
      recurrence_detected: params.outcome === 'Marked Recurring',
      observations: taggedObs,
      evidence_path: uploadedPath,
    });

    if (error) {
      if (uploadedPath) {
        await removeCivicStorageFile(STORAGE_BUCKETS.evidence, uploadedPath, client);
      }
      return {
        ok: false,
        error: formatSupabaseError(error, 'Unable to record follow-up check.'),
      };
    }

    if (
      params.outcome === 'Marked Recurring' &&
      params.issue.status !== IssueStatus.Recurring
    ) {
      await client
        .from('public_civic_issues')
        .update({ status: IssueStatus.Recurring })
        .eq('id', params.issue.dbId);

      await client.from('public_issue_timeline').insert({
        issue_id: params.issue.dbId,
        previous_status: params.issue.status,
        new_status: IssueStatus.Recurring,
        action_description: cleanObs,
        changed_by: authUserId,
      });
    }

    return { ok: true };
  } catch (err) {
    if (uploadedPath) {
      await removeCivicStorageFile(
        STORAGE_BUCKETS.evidence,
        uploadedPath,
        clientOverride,
      );
    }
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to record follow-up check.'),
    };
  }
}
