import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CivicIssue,
  CommunityInitiative,
  InitiativeStatus,
  UserAccount,
  UserRole,
  VolunteerRegistration,
} from '../types/civic';
import {
  formatIndianAddress,
  formatIndianInitiativeSchedule,
  validateInitiativeSubmission,
} from '../utils/civicLogic';
import { INDIA_COUNTRY_CODE } from '../utils/indiaGeo';
import {
  removeCivicStorageFile,
  resolveStorageAssetUrl,
  STORAGE_BUCKETS,
  uploadCivicStorageFile,
} from './storageService';
import { formatSupabaseError, requireSupabaseClient } from './supabaseClient';

export interface InitiativeRow {
  id: string;
  title: string;
  category?: string | null;
  description: string;
  country_code: 'IN';
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  latitude: number | null;
  longitude: number | null;
  event_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  organizer_label?: string | null;
  status: InitiativeStatus;
  cancellation_reason: string | null;
  linked_issue_ids: string[] | null;
  highlights?: string[] | null;
  cover_image_path: string | null;
  created_at: string;
}

export const PUBLIC_INITIATIVE_COLUMNS =
  'id, title, description, country_code, state, district, city, locality, pin_code, latitude, longitude, event_date, start_time, end_time, capacity, status, cancellation_reason, linked_issue_ids, cover_image_path, created_at';

export const PUBLIC_VOLUNTEER_REG_COLUMNS =
  'id, initiative_id, user_id, registration_status, attendance_status, registered_at';

interface UserRegRow {
  id: string;
  initiative_id: string;
  user_id: string;
  registration_status: 'Registered' | 'Cancelled';
  attendance_status: 'Pending' | 'Attended' | 'Absent';
  registered_at: string;
}

function normalizeTimeHHmm(dbTime: string): string {
  return dbTime.slice(0, 5);
}

export function deriveInitiativeCategory(title: string, description: string): string {
  const combined = `${title} ${description}`.toLowerCase();
  if (/waste|clean|sanitation|plastic|drain|garbage|litter/.test(combined)) {
    return 'Waste & Sanitation';
  }
  if (/park|tree|sapling|garden|lake|green|plantation/.test(combined)) {
    return 'Green Spaces';
  }
  if (/footpath|road|lamp|light|safety|crossing|traffic|drainage/.test(combined)) {
    return 'Safety & Infrastructure';
  }
  return 'Community Action';
}

async function getAuthenticatedUserId(
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

async function mapInitiativeRow(
  row: InitiativeRow,
  countMap: Map<string, number>,
  issueCodeByDbId: Map<string, string>,
  client: SupabaseClient,
): Promise<CommunityInitiative> {
  const startTime = normalizeTimeHHmm(row.start_time);
  const endTime = normalizeTimeHHmm(row.end_time);
  const schedule = formatIndianInitiativeSchedule(
    row.event_date,
    startTime,
    endTime,
  );
  const resolvedCoverUrl = await resolveStorageAssetUrl(
    STORAGE_BUCKETS.initiatives,
    row.cover_image_path,
    client,
  );

  const dbLinkedIds = row.linked_issue_ids ?? [];
  const linkedReportCodes = dbLinkedIds
    .map((uuid) => issueCodeByDbId.get(uuid))
    .filter((code): code is string => Boolean(code));

  return {
    id: row.id,
    title: row.title,
    category:
      row.category?.trim() ||
      deriveInitiativeCategory(row.title, row.description),
    description: row.description,
    country_code: 'IN',
    state: row.state,
    district: row.district,
    city: row.city,
    locality: row.locality,
    pin_code: row.pin_code,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    location: formatIndianAddress({
      locality: row.locality,
      city: row.city,
      district: row.district,
      state: row.state,
      pin_code: row.pin_code,
    }),
    eventDate: row.event_date,
    startTime,
    endTime,
    dateLabel: schedule.dateLabel,
    timeLabel: schedule.timeLabel,
    capacity: row.capacity,
    registeredCount: countMap.get(row.id) ?? 0,
    status: row.status,
    cancellationReason: row.cancellation_reason ?? undefined,
    linkedIssueIds: linkedReportCodes,
    linkedIssueDbIds: dbLinkedIds,
    imageUrl: resolvedCoverUrl,
    coverImagePath: row.cover_image_path ?? undefined,
    organizer: row.organizer_label?.trim() || 'Civilense Coordinator',
    highlights: row.highlights ?? [],
  };
}

export async function fetchInitiativesFromSupabase(
  currentUser: UserAccount | null,
  issues: CivicIssue[],
  clientOverride?: SupabaseClient | null,
): Promise<{
  ok: boolean;
  initiatives: CommunityInitiative[];
  registrations: VolunteerRegistration[];
  error?: string;
}> {
  try {
    const client = requireSupabaseClient(clientOverride);
    const [initRes, activeRegsRes] = await Promise.all([
      client
        .from('public_community_initiatives')
        .select(PUBLIC_INITIATIVE_COLUMNS)
        .order('event_date', { ascending: true }),
      client
        .from('public_volunteer_registrations')
        .select('initiative_id')
        .eq('registration_status', 'Registered'),
    ]);

    if (initRes.error) {
      return {
        ok: false,
        initiatives: [],
        registrations: [],
        error: formatSupabaseError(
          initRes.error,
          'Unable to load community initiatives.',
        ),
      };
    }

    const countMap = new Map<string, number>();
    if (!activeRegsRes.error && Array.isArray(activeRegsRes.data)) {
      for (const reg of activeRegsRes.data as Array<{ initiative_id: string }>) {
        countMap.set(
          reg.initiative_id,
          (countMap.get(reg.initiative_id) ?? 0) + 1,
        );
      }
    }

    const issueCodeByDbId = new Map<string, string>();
    for (const issue of issues) {
      if (issue.dbId) {
        issueCodeByDbId.set(issue.dbId, issue.id);
      }
    }

    const mappedInitiatives = await Promise.all(
      ((initRes.data ?? []) as InitiativeRow[]).map((row) =>
        mapInitiativeRow(row, countMap, issueCodeByDbId, client),
      ),
    );

    let registrations: VolunteerRegistration[] = [];
    if (currentUser?.role === UserRole.Coordinator) {
      const rosterRes = await client
        .from('public_volunteer_registrations')
        .select(PUBLIC_VOLUNTEER_REG_COLUMNS)
        .eq('registration_status', 'Registered')
        .order('registered_at', { ascending: false });

      if (!rosterRes.error && Array.isArray(rosterRes.data)) {
        const rows = rosterRes.data as UserRegRow[];
        const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
        const nameByUserId = new Map<string, string>();

        if (userIds.length > 0) {
          const profilesRes = await client
            .from('public_profiles')
            .select('id, full_name')
            .in('id', userIds);

          if (!profilesRes.error && Array.isArray(profilesRes.data)) {
            for (const p of profilesRes.data as Array<{
              id: string;
              full_name: string;
            }>) {
              nameByUserId.set(p.id, p.full_name);
            }
          }
        }

        registrations = rows.map((r) => ({
          id: r.id,
          initiativeId: r.initiative_id,
          userId: r.user_id,
          volunteerName:
            nameByUserId.get(r.user_id) ||
            (r.user_id === currentUser.id
              ? currentUser.fullName
              : 'Registered Volunteer'),
          volunteerEmail:
            r.user_id === currentUser.id ? currentUser.email : 'Verified Member',
          registrationStatus: r.registration_status,
          attendanceStatus: r.attendance_status,
          registeredAt: r.registered_at,
        }));
      }
    } else if (currentUser) {
      const ownRegsRes = await client
        .from('public_volunteer_registrations')
        .select(PUBLIC_VOLUNTEER_REG_COLUMNS)
        .eq('user_id', currentUser.id)
        .eq('registration_status', 'Registered');

      if (!ownRegsRes.error && Array.isArray(ownRegsRes.data)) {
        registrations = (ownRegsRes.data as UserRegRow[]).map((r) => ({
          id: r.id,
          initiativeId: r.initiative_id,
          userId: r.user_id,
          volunteerName: currentUser.fullName,
          volunteerEmail: currentUser.email,
          registrationStatus: r.registration_status,
          attendanceStatus: r.attendance_status,
          registeredAt: r.registered_at,
        }));
      }
    }

    return {
      ok: true,
      initiatives: mappedInitiatives,
      registrations,
    };
  } catch (err) {
    return {
      ok: false,
      initiatives: [],
      registrations: [],
      error: formatSupabaseError(err, 'Unable to load community initiatives.'),
    };
  }
}

export async function registerVolunteerInSupabase(
  initiativeId: string,
  clientOverride?: SupabaseClient | null,
): Promise<{
  ok: boolean;
  registeredCount?: number;
  message: string;
}> {
  try {
    const client = requireSupabaseClient(clientOverride);
    const userId = await getAuthenticatedUserId(client);
    if (!userId) {
      return {
        ok: false,
        message: 'Please sign in before registering for a community initiative.',
      };
    }

    const { data: initRow, error: initErr } = await client
      .from('public_community_initiatives')
      .select('id, title, status, capacity')
      .eq('id', initiativeId)
      .maybeSingle();

    if (initErr || !initRow) {
      return {
        ok: false,
        message: formatSupabaseError(
          initErr,
          'Community initiative could not be found.',
        ),
      };
    }

    const typedInit = initRow as {
      id: string;
      title: string;
      status: InitiativeStatus;
      capacity: number;
    };

    if (typedInit.status !== 'Open') {
      return {
        ok: false,
        message: `Cannot register: initiative status is ${typedInit.status}.`,
      };
    }

    const [{ data: existingRow }, { count: activeCount }] = await Promise.all([
      client
        .from('public_volunteer_registrations')
        .select('id, registration_status')
        .eq('initiative_id', initiativeId)
        .eq('user_id', userId)
        .maybeSingle(),
      client
        .from('public_volunteer_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('initiative_id', initiativeId)
        .eq('registration_status', 'Registered'),
    ]);

    const typedExisting = existingRow as {
      id: string;
      registration_status: 'Registered' | 'Cancelled';
    } | null;

    if (typedExisting?.registration_status === 'Registered') {
      return {
        ok: false,
        message: 'You are already registered for this community initiative.',
      };
    }

    const currentCount = activeCount ?? 0;
    if (currentCount >= typedInit.capacity) {
      return {
        ok: false,
        message: 'Volunteer capacity for this initiative is currently full.',
      };
    }

    const { error: writeErr } = typedExisting
      ? await client
          .from('public_volunteer_registrations')
          .update({
            registration_status: 'Registered',
            registered_at: new Date().toISOString(),
          })
          .eq('id', typedExisting.id)
      : await client.from('public_volunteer_registrations').insert({
          initiative_id: initiativeId,
          user_id: userId,
          registration_status: 'Registered',
          attendance_status: 'Pending',
        });

    if (writeErr) {
      return {
        ok: false,
        message: formatSupabaseError(
          writeErr,
          'Unable to complete volunteer registration.',
        ),
      };
    }

    return {
      ok: true,
      registeredCount: currentCount + 1,
      message: `Registration confirmed for ${typedInit.title}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: formatSupabaseError(
        err,
        'Unable to complete volunteer registration.',
      ),
    };
  }
}

export async function cancelVolunteerInSupabase(
  initiativeId: string,
  clientOverride?: SupabaseClient | null,
): Promise<{
  ok: boolean;
  registeredCount?: number;
  message: string;
}> {
  try {
    const client = requireSupabaseClient(clientOverride);
    const userId = await getAuthenticatedUserId(client);
    if (!userId) {
      return {
        ok: false,
        message: 'Authentication required.',
      };
    }

    const { data, error } = await client
      .from('public_volunteer_registrations')
      .update({ registration_status: 'Cancelled' })
      .eq('initiative_id', initiativeId)
      .eq('user_id', userId)
      .eq('registration_status', 'Registered')
      .select('id');

    if (error) {
      return {
        ok: false,
        message: formatSupabaseError(
          error,
          'Unable to cancel volunteer registration.',
        ),
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        ok: false,
        message: 'No active registration found for this activity.',
      };
    }

    const { count: activeCount } = await client
      .from('public_volunteer_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('initiative_id', initiativeId)
      .eq('registration_status', 'Registered');

    return {
      ok: true,
      registeredCount: activeCount ?? 0,
      message: 'Volunteer registration cancelled.',
    };
  } catch (err) {
    return {
      ok: false,
      message: formatSupabaseError(
        err,
        'Unable to cancel volunteer registration.',
      ),
    };
  }
}

export async function markVolunteerAttendanceInSupabase(
  registrationId: string,
  attendanceStatus: 'Pending' | 'Attended' | 'Absent',
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = requireSupabaseClient(clientOverride);
    const { error } = await client
      .from('public_volunteer_registrations')
      .update({ attendance_status: attendanceStatus })
      .eq('id', registrationId);

    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(
          error,
          'Unable to update volunteer attendance status.',
        ),
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(
        err,
        'Unable to update volunteer attendance status.',
      ),
    };
  }
}

export async function saveInitiativeInSupabase(
  params: {
    editingId?: string | null;
    initiative: CommunityInitiative;
    coverImageFile?: File | null;
    issues: CivicIssue[];
    coordinator: UserAccount;
    existingRegisteredCount?: number;
  },
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; error?: string }> {
  const { initiative } = params;

  const validation = validateInitiativeSubmission({
    title: initiative.title,
    category: initiative.category,
    description: initiative.description,
    country_code: INDIA_COUNTRY_CODE,
    state: initiative.state,
    district: initiative.district,
    city: initiative.city,
    locality: initiative.locality,
    pin_code: initiative.pin_code,
    eventDate: initiative.eventDate,
    startTime: initiative.startTime,
    endTime: initiative.endTime,
    capacity: initiative.capacity,
    minCapacity: params.existingRegisteredCount,
    status: initiative.status,
    cancellationReason: initiative.cancellationReason,
    allowPastDate: initiative.status !== 'Open' || Boolean(params.editingId),
  });

  if (!validation.valid) {
    return {
      ok: false,
      error: Object.values(validation.errors)[0] ?? 'Invalid initiative details.',
    };
  }

  let uploadedCoverPath: string | null = null;

  try {
    const client = requireSupabaseClient(clientOverride);

    if (params.coverImageFile) {
      const uploadRes = await uploadCivicStorageFile(
        STORAGE_BUCKETS.initiatives,
        'initiatives',
        params.coverImageFile,
        client,
      );
      if (!uploadRes.ok || !uploadRes.path) {
        return {
          ok: false,
          error: uploadRes.error ?? 'Failed to upload initiative cover photo.',
        };
      }
      uploadedCoverPath = uploadRes.path;
    }

    const dbIdByReportCode = new Map<string, string>();
    for (const issue of params.issues) {
      if (issue.dbId) {
        dbIdByReportCode.set(issue.id, issue.dbId);
      }
    }

    const linkedIssueDbIds = (initiative.linkedIssueIds ?? [])
      .map((code) => dbIdByReportCode.get(code))
      .filter((uuid): uuid is string => Boolean(uuid));

    const payload = {
      title: initiative.title.trim(),
      description: initiative.description.trim(),
      country_code: INDIA_COUNTRY_CODE,
      state: initiative.state.trim(),
      district: initiative.district.trim(),
      city: initiative.city.trim(),
      locality: initiative.locality.trim(),
      pin_code: initiative.pin_code.trim(),
      latitude: initiative.latitude ?? null,
      longitude: initiative.longitude ?? null,
      event_date: initiative.eventDate!,
      start_time: initiative.startTime!,
      end_time: initiative.endTime!,
      capacity: initiative.capacity,
      coordinator_id: params.coordinator.id,
      status: initiative.status,
      cancellation_reason: initiative.cancellationReason ?? null,
      linked_issue_ids: linkedIssueDbIds,
      cover_image_path: uploadedCoverPath ?? initiative.coverImagePath ?? null,
    };

    const { error } = params.editingId
      ? await client
          .from('public_community_initiatives')
          .update(payload)
          .eq('id', params.editingId)
      : await client.from('public_community_initiatives').insert(payload);

    if (error) {
      if (uploadedCoverPath) {
        await removeCivicStorageFile(
          STORAGE_BUCKETS.initiatives,
          uploadedCoverPath,
          client,
        );
      }
      return {
        ok: false,
        error: formatSupabaseError(error, 'Unable to save community initiative.'),
      };
    }

    return { ok: true };
  } catch (err) {
    if (uploadedCoverPath) {
      await removeCivicStorageFile(
        STORAGE_BUCKETS.initiatives,
        uploadedCoverPath,
        clientOverride,
      );
    }
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to save community initiative.'),
    };
  }
}
