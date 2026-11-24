import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  ImagePlus,
  Pencil,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import {
  CivicIssue,
  CommunityInitiative,
  IssueStatus,
  PageRoute,
  UserAccount,
  UserRole,
  VolunteerRegistration,
} from '../types/civic';
import {
  filterCoordinatorQueue,
  formatIndianAddress,
  formatIndianInitiativeSchedule,
  getAllowedNextStatuses,
  resolveActiveQueueIssue,
  validateImageFile,
  validateInitiativeSubmission,
  validateIssueStatusTransition,
} from '../utils/civicLogic';
import { INDIA_COUNTRY_CODE } from '../utils/indiaGeo';
import { StatusBadge } from '../components/StatusBadge';
import { ResilientImage } from '../components/ResilientImage';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { IndiaAddressFields } from '../components/IndiaAddressFields';

interface CoordinatorDashboardPageProps {
  currentUser: UserAccount | null;
  issues: CivicIssue[];
  initiatives: CommunityInitiative[];
  registrations: VolunteerRegistration[];
  isSupabaseMode?: boolean;
  onUpdateIssueStatus: (
    issueId: string,
    newStatus: IssueStatus,
    note: string,
    options?: {
      approveEvidence?: boolean;
      afterImageUrl?: string;
      afterImageFile?: File | null;
      resolutionSummary?: string;
      followUpOutcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
    },
  ) => Promise<{ ok: boolean; error?: string }>;
  onCreateInitiative: (
    initiative: CommunityInitiative,
    options?: { coverImageFile?: File | null },
  ) => Promise<{ ok: boolean; error?: string }>;
  onUpdateInitiative: (
    initiative: CommunityInitiative,
    options?: { coverImageFile?: File | null; existingRegisteredCount?: number },
  ) => Promise<{ ok: boolean; error?: string }>;
  onMarkAttendance?: (
    registrationId: string,
    attendanceStatus: 'Pending' | 'Attended' | 'Absent',
  ) => Promise<{ ok: boolean; error?: string }>;
  onRecordFollowup?: (
    issue: CivicIssue,
    outcome: 'Sustained' | 'Needs Attention' | 'Marked Recurring',
    observations: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onReviewPendingEvidence?: (
    evidenceId: string,
    decision: 'Approved' | 'Rejected',
  ) => Promise<{ ok: boolean; error?: string }>;
  onResetDemoData: () => void;
  onNavigate: (route: PageRoute) => void;
}

const ALL_STATUSES = Object.values(IssueStatus);

export const CoordinatorDashboardPage: React.FC<
  CoordinatorDashboardPageProps
> = ({
  currentUser,
  issues,
  initiatives,
  registrations,
  isSupabaseMode = false,
  onUpdateIssueStatus,
  onCreateInitiative,
  onUpdateInitiative,
  onMarkAttendance,
  onRecordFollowup,
  onReviewPendingEvidence,
  onResetDemoData,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'initiatives'>('reports');
  const [queueFilter, setQueueFilter] = useState<IssueStatus | 'All'>('All');
  const [selectedIssueId, setSelectedIssueId] = useState<string>(
    issues[0]?.id ?? '',
  );
  const [actionNote, setActionNote] = useState('');
  const [nextStatus, setNextStatus] = useState<IssueStatus>(
    issues[0]?.status ?? IssueStatus.Verified,
  );
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [afterImageUrl, setAfterImageUrl] = useState<string | undefined>(
    undefined,
  );
  const [afterImageFile, setAfterImageFile] = useState<File | null>(null);
  const [afterImageError, setAfterImageError] = useState('');
  const [approveEvidence, setApproveEvidence] = useState(false);
  const [followUpOutcome, setFollowUpOutcome] = useState<
    '' | 'Sustained' | 'Needs Attention' | 'Marked Recurring'
  >('');
  const [updatingIssue, setUpdatingIssue] = useState(false);
  const [savingInitiative, setSavingInitiative] = useState(false);
  const [coordFeedback, setCoordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Initiative Create / Edit Form state (India-only enforced)
  const [editingInitId, setEditingInitId] = useState<string | null>(null);
  const [initTitle, setInitTitle] = useState('');
  const [initCategory, setInitCategory] = useState('Waste & Sanitation');
  const [initDescription, setInitDescription] = useState('');
  const [initState, setInitState] = useState('Karnataka');
  const [initDistrict, setInitDistrict] = useState('Bengaluru Urban');
  const [initCity, setInitCity] = useState('Bengaluru');
  const [initLocality, setInitLocality] = useState('');
  const [initPinCode, setInitPinCode] = useState('');
  const [initEventDate, setInitEventDate] = useState('2026-12-06');
  const [initStartTime, setInitStartTime] = useState('08:00');
  const [initEndTime, setInitEndTime] = useState('11:00');
  const [initCapacity, setInitCapacity] = useState('20');
  const [initCoverUrl, setInitCoverUrl] = useState<string | undefined>(undefined);
  const [initCoverPath, setInitCoverPath] = useState<string | undefined>(undefined);
  const [initCoverFile, setInitCoverFile] = useState<File | null>(null);
  const [initLinkedIssueIds, setInitLinkedIssueIds] = useState<string[]>([]);
  const [initErrors, setInitErrors] = useState<Record<string, string>>({});

  // Inline cancellation reason prompt
  const [cancellingInitId, setCancellingInitId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const filteredQueue = useMemo(
    () => filterCoordinatorQueue(issues, queueFilter),
    [issues, queueFilter],
  );

  const activeIssue = useMemo(
    () => resolveActiveQueueIssue(filteredQueue, selectedIssueId),
    [filteredQueue, selectedIssueId],
  );

  // Sync workbench controls whenever activeIssue changes (including filter switches)
  useEffect(() => {
    if (!activeIssue) return;
    setSelectedIssueId(activeIssue.id);
    setNextStatus(activeIssue.status);
    setResolutionSummary(activeIssue.resolutionEvidence?.summary ?? '');
    setAfterImageUrl(activeIssue.resolutionEvidence?.afterImageUrl);
    setAfterImageFile(null);
    setApproveEvidence(
      Boolean(activeIssue.resolutionEvidence?.approvedByCoordinator),
    );
    setAfterImageError('');
    setActionNote('');
    setFollowUpOutcome('');
  }, [activeIssue?.id, activeIssue?.status]);

  // Coordinator role protection gate
  if (!currentUser || currentUser.role !== UserRole.Coordinator) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-[#B5D8C7] bg-white p-8 text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#B5D8C7]/45 text-[#254B33]">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-[#06271A]">
              Coordinator Access Restricted
            </h1>
            <p className="text-sm text-[#254B33]">
              This workspace is restricted to Civic Coordinator profiles for
              verifying reports, approving before-and-after outcomes, and managing
              Indian community initiatives.
            </p>
            <p className="text-xs text-[#5E9185]">
              {isSupabaseMode
                ? 'Sign in with an administrator-assigned Coordinator account to access verification and initiative controls.'
                : 'Demo-only local access control: sign in via the Login page with verified Coordinator demo credentials until backend RBAC is enabled.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('auth')}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-[#254B33] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#06271A]"
            >
              {isSupabaseMode ? 'Go to Sign In (/auth)' : 'Go to Demo Login (/auth)'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('track')}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[#5E9185] bg-[#F5FAF7] px-5 py-2.5 text-sm font-semibold text-[#06271A]"
            >
              Back to Public Issue Log
            </button>
          </div>
        </div>
      </section>
    );
  }

  const handleSelectIssue = (issue: CivicIssue) => {
    setSelectedIssueId(issue.id);
    setNextStatus(issue.status);
    setActionNote('');
    setResolutionSummary(issue.resolutionEvidence?.summary ?? '');
    setAfterImageUrl(issue.resolutionEvidence?.afterImageUrl);
    setAfterImageFile(null);
    setApproveEvidence(Boolean(issue.resolutionEvidence?.approvedByCoordinator));
    setAfterImageError('');
    setFollowUpOutcome('');
    setCoordFeedback(null);
  };

  const handleAfterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!validation.valid) {
      setAfterImageError(validation.error ?? 'Invalid after-restoration photo.');
      return;
    }

    setAfterImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAfterImageUrl(reader.result);
        setApproveEvidence(true);
        setAfterImageError('');
      }
    };
    reader.onerror = () => {
      setAfterImageFile(null);
      setAfterImageError('Failed to read selected photo. Please try another file.');
    };
    reader.readAsDataURL(file);
  };

  const handleInitCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!validation.valid) {
      setInitErrors((prev) => ({
        ...prev,
        image: validation.error ?? 'Invalid cover image.',
      }));
      return;
    }

    setInitCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setInitCoverUrl(reader.result);
        setInitErrors((prev) => ({ ...prev, image: '' }));
      }
    };
    reader.onerror = () => {
      setInitCoverFile(null);
      setInitErrors((prev) => ({
        ...prev,
        image: 'Unable to read cover image file.',
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleApplyStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIssue || updatingIssue) return;

    setUpdatingIssue(true);
    const res = await onUpdateIssueStatus(activeIssue.id, nextStatus, actionNote, {
      approveEvidence:
        approveEvidence || nextStatus === IssueStatus.Resolved,
      afterImageUrl,
      afterImageFile,
      resolutionSummary: resolutionSummary || undefined,
      followUpOutcome: followUpOutcome || undefined,
    });
    setUpdatingIssue(false);

    if (!res.ok) {
      setCoordFeedback({
        type: 'error',
        message: res.error ?? 'Status transition rejected.',
      });
      return;
    }

    setCoordFeedback({
      type: 'success',
      message: `Updated ${activeIssue.id} to "${nextStatus}".`,
    });
    setAfterImageFile(null);
    setActionNote('');
    setFollowUpOutcome('');
  };

  const handleQuickAction = async (
    status: IssueStatus,
    defaultNote: string,
    extra?: {
      approveEvidence?: boolean;
      followUpOutcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
    },
  ) => {
    if (!activeIssue || updatingIssue) return;
    const noteToUse = actionNote.trim() || defaultNote;
    setUpdatingIssue(true);
    const res = await onUpdateIssueStatus(activeIssue.id, status, noteToUse, {
      afterImageUrl,
      afterImageFile,
      resolutionSummary: resolutionSummary || undefined,
      ...extra,
    });
    setUpdatingIssue(false);

    if (!res.ok) {
      setCoordFeedback({
        type: 'error',
        message: res.error ?? 'Transition not allowed from current status.',
      });
      return;
    }

    setNextStatus(status);
    setAfterImageFile(null);
    setCoordFeedback({
      type: 'success',
      message: `Applied "${status}" to ${activeIssue.id}.`,
    });
    setActionNote('');
  };

  const resetInitiativeForm = () => {
    setEditingInitId(null);
    setInitTitle('');
    setInitCategory('Waste & Sanitation');
    setInitDescription('');
    setInitState('Karnataka');
    setInitDistrict('Bengaluru Urban');
    setInitCity('Bengaluru');
    setInitLocality('');
    setInitPinCode('');
    setInitEventDate('2026-12-06');
    setInitStartTime('08:00');
    setInitEndTime('11:00');
    setInitCapacity('20');
    setInitCoverUrl(undefined);
    setInitCoverPath(undefined);
    setInitCoverFile(null);
    setInitLinkedIssueIds([]);
    setInitErrors({});
  };

  const handleStartEditInitiative = (init: CommunityInitiative) => {
    setEditingInitId(init.id);
    setInitTitle(init.title);
    setInitCategory(init.category);
    setInitDescription(init.description);
    setInitState(init.state);
    setInitDistrict(init.district);
    setInitCity(init.city);
    setInitLocality(init.locality);
    setInitPinCode(init.pin_code);
    setInitEventDate(init.eventDate ?? '2026-12-06');
    setInitStartTime(init.startTime ?? '08:00');
    setInitEndTime(init.endTime ?? '11:00');
    setInitCapacity(String(init.capacity));
    setInitCoverUrl(init.imageUrl);
    setInitCoverPath(init.coverImagePath);
    setInitCoverFile(null);
    setInitLinkedIssueIds(init.linkedIssueIds ?? []);
    setInitErrors({});
    setCoordFeedback(null);
  };

  const handleInitiativeAddressChange = (
    field: 'state' | 'district' | 'city' | 'locality' | 'pin_code',
    value: string,
  ) => {
    if (field === 'state') setInitState(value);
    if (field === 'district') setInitDistrict(value);
    if (field === 'city') setInitCity(value);
    if (field === 'locality') setInitLocality(value);
    if (field === 'pin_code') setInitPinCode(value);
    setInitErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const toggleLinkedIssue = (issueId: string) => {
    setInitLinkedIssueIds((prev) =>
      prev.includes(issueId)
        ? prev.filter((id) => id !== issueId)
        : [...prev, issueId],
    );
  };

  const handleSaveInitiativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingInitiative) return;

    const editingExisting = editingInitId
      ? initiatives.find((item) => item.id === editingInitId)
      : undefined;

    const capNumber = Number(initCapacity);
    const validation = validateInitiativeSubmission({
      title: initTitle,
      category: initCategory,
      description: initDescription,
      country_code: INDIA_COUNTRY_CODE,
      state: initState,
      district: initDistrict,
      city: initCity,
      locality: initLocality,
      pin_code: initPinCode,
      eventDate: initEventDate,
      startTime: initStartTime,
      endTime: initEndTime,
      capacity: capNumber,
      minCapacity: editingExisting?.registeredCount,
      status: editingExisting?.status ?? 'Open',
      allowPastDate: Boolean(editingExisting && editingExisting.status !== 'Open'),
    });

    if (!validation.valid) {
      setInitErrors(validation.errors);
      return;
    }

    const schedule = formatIndianInitiativeSchedule(
      initEventDate,
      initStartTime,
      initEndTime,
    );

    const formattedLocation = formatIndianAddress({
      locality: initLocality,
      city: initCity,
      district: initDistrict,
      state: initState,
      pin_code: initPinCode,
    });

    setSavingInitiative(true);

    if (editingExisting) {
      const updated: CommunityInitiative = {
        ...editingExisting,
        title: initTitle.trim(),
        category: initCategory,
        description: initDescription.trim(),
        state: initState.trim(),
        district: initDistrict.trim(),
        city: initCity.trim(),
        locality: initLocality.trim(),
        pin_code: initPinCode.trim(),
        location: formattedLocation,
        eventDate: initEventDate,
        startTime: initStartTime,
        endTime: initEndTime,
        dateLabel: schedule.dateLabel,
        timeLabel: schedule.timeLabel,
        capacity: capNumber,
        linkedIssueIds: initLinkedIssueIds,
        imageUrl: initCoverUrl,
        coverImagePath: initCoverPath,
      };
      const res = await onUpdateInitiative(updated, {
        coverImageFile: initCoverFile,
        existingRegisteredCount: editingExisting.registeredCount,
      });
      setSavingInitiative(false);

      if (!res.ok) {
        setCoordFeedback({
          type: 'error',
          message: res.error ?? 'Failed to update initiative.',
        });
        return;
      }

      resetInitiativeForm();
      setCoordFeedback({
        type: 'success',
        message: `Updated initiative "${updated.title}".`,
      });
      return;
    }

    const created: CommunityInitiative = {
      id: `init-${Date.now()}`,
      title: initTitle.trim(),
      category: initCategory,
      description: initDescription.trim(),
      country_code: INDIA_COUNTRY_CODE,
      state: initState.trim(),
      district: initDistrict.trim(),
      city: initCity.trim(),
      locality: initLocality.trim(),
      pin_code: initPinCode.trim(),
      location: formattedLocation,
      eventDate: initEventDate,
      startTime: initStartTime,
      endTime: initEndTime,
      dateLabel: schedule.dateLabel,
      timeLabel: schedule.timeLabel,
      capacity: capNumber,
      registeredCount: 0,
      status: 'Open',
      linkedIssueIds: initLinkedIssueIds,
      imageUrl: initCoverUrl,
      coverImagePath: initCoverPath,
      organizer: `${currentUser.fullName} (Coordinator)`,
      highlights: [
        'Published via Coordinator Dashboard',
        'Tools and orientation provided at meeting point',
      ],
    };

    const res = await onCreateInitiative(created, {
      coverImageFile: initCoverFile,
    });
    setSavingInitiative(false);

    if (!res.ok) {
      setCoordFeedback({
        type: 'error',
        message: res.error ?? 'Failed to publish initiative.',
      });
      return;
    }

    resetInitiativeForm();
    setCoordFeedback({
      type: 'success',
      message: `Published "${created.title}" (${created.city}, ${created.state}) to Community Initiatives.`,
    });
  };

  const handleConfirmCancelInitiative = async (init: CommunityInitiative) => {
    if (savingInitiative) return;
    if (cancelReason.trim().length < 5) {
      setCancelError('Please provide a brief cancellation reason (at least 5 characters).');
      return;
    }
    setSavingInitiative(true);
    const res = await onUpdateInitiative(
      {
        ...init,
        status: 'Cancelled',
        cancellationReason: cancelReason.trim(),
      },
      { existingRegisteredCount: init.registeredCount },
    );
    setSavingInitiative(false);

    if (!res.ok) {
      setCancelError(res.error ?? 'Unable to cancel initiative.');
      return;
    }

    setCancellingInitId(null);
    setCancelReason('');
    setCancelError('');
    setCoordFeedback({
      type: 'success',
      message: `Marked "${init.title}" as Cancelled.`,
    });
  };

  const allowedStatuses = activeIssue
    ? getAllowedNextStatuses(activeIssue.status)
    : [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
            {isSupabaseMode ? 'Coordinator Workspace' : 'Demo Coordinator Workspace'} ·{' '}
            {currentUser.fullName} (India)
          </p>
          <h1 className="font-display text-3xl font-bold text-[#06271A]">
            Coordinator Dashboard
          </h1>
          <p className="text-sm text-[#254B33]">
            Verify incoming Indian reports, enforce status workflows, upload
            completion evidence, and manage community initiatives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1 rounded-lg border border-[#B5D8C7] bg-[#F5FAF7] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'bg-white text-[#06271A] shadow-xs'
                  : 'text-[#254B33] hover:text-[#06271A]'
              }`}
            >
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Report Queue ({issues.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('initiatives')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'initiatives'
                  ? 'bg-white text-[#06271A] shadow-xs'
                  : 'text-[#254B33] hover:text-[#06271A]'
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Initiatives &amp; Volunteers</span>
            </button>
          </div>

          {!isSupabaseMode &&
            (!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#B5D8C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#254B33] hover:bg-[#F5FAF7]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset Demo Data</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-red-900">Reset local data?</span>
                <button
                  type="button"
                  onClick={() => {
                    onResetDemoData();
                    setConfirmReset(false);
                    setCoordFeedback({
                      type: 'success',
                      message: 'Local demonstration data restored to defaults.',
                    });
                  }}
                  className="rounded bg-red-700 px-2 py-0.5 font-semibold text-white hover:bg-red-800"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded border border-red-300 bg-white px-2 py-0.5 font-semibold text-red-900"
                >
                  Cancel
                </button>
              </div>
            ))}
        </div>
      </div>

      {coordFeedback && (
        <div
          role={coordFeedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
            coordFeedback.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900'
              : 'border-[#5E9185] bg-[#B5D8C7]/35 text-[#06271A]'
          }`}
        >
          <span>{coordFeedback.message}</span>
          <button
            type="button"
            onClick={() => setCoordFeedback(null)}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'reports' ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Queue List */}
          <div className="rounded-xl border border-[#B5D8C7] bg-white p-4 space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-[#06271A]">
                Submitted &amp; Active Reports
              </h2>
              <select
                aria-label="Filter coordinator report queue by status"
                value={queueFilter}
                onChange={(e) =>
                  setQueueFilter(e.target.value as IssueStatus | 'All')
                }
                className="rounded-lg border border-[#9CCCCC] bg-white px-2.5 py-1.5 text-xs text-[#06271A]"
              >
                <option value="All">All ({issues.length})</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {filteredQueue.length === 0 ? (
              <div className="rounded-xl border border-[#B5D8C7]/60 bg-[#F8FBF9] p-6 text-center text-xs text-[#254B33]">
                No reports currently have status &ldquo;{queueFilter}&rdquo;.
              </div>
            ) : (
              <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {filteredQueue.map((item) => {
                  const isSelected = activeIssue?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectIssue(item)}
                      className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                        isSelected
                          ? 'border-[#254B33] bg-[#F5FAF7]'
                          : 'border-[#B5D8C7]/70 bg-white hover:border-[#5E9185]'
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="font-mono-tabular text-xs font-semibold text-[#5E9185]">
                          {item.id}
                        </span>
                        <StatusBadge status={item.status} compact />
                      </div>
                      <p className="text-sm font-semibold text-[#06271A]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-[#254B33]/80">
                        {item.locality}, {item.city}, {item.state} · {item.pin_code}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Inspection & Action Workbench */}
          <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-6 lg:col-span-7">
            {activeIssue ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#B5D8C7]/60 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono-tabular font-semibold text-[#5E9185]">
                        {activeIssue.id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#254B33]">{activeIssue.category}</span>
                    </div>
                    <h2 className="font-display text-xl font-bold text-[#06271A]">
                      {activeIssue.title}
                    </h2>
                    <p className="text-xs text-[#254B33]">
                      {activeIssue.locality}, {activeIssue.city},{' '}
                      {activeIssue.district} District, {activeIssue.state} —{' '}
                      <span className="font-mono-tabular">{activeIssue.pin_code}</span>{' '}
                      (India)
                    </p>
                  </div>
                  <StatusBadge status={activeIssue.status} />
                </div>

                <p className="text-sm leading-relaxed text-[#254B33]">
                  {activeIssue.description}
                </p>

                {/* Before/After or Uploaded Evidence Review */}
                {activeIssue.resolutionEvidence?.beforeImageUrl &&
                activeIssue.resolutionEvidence?.afterImageUrl ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#06271A]">
                      Before &amp; After Completion Evidence
                    </p>
                    <BeforeAfterSlider
                      beforeUrl={activeIssue.resolutionEvidence.beforeImageUrl}
                      afterUrl={activeIssue.resolutionEvidence.afterImageUrl}
                      title={activeIssue.title}
                    />
                  </div>
                ) : (
                  activeIssue.imageUrl && (
                    <div className="aspect-[16/9] max-h-56 overflow-hidden rounded-xl border border-[#B5D8C7] bg-[#F5FAF7]">
                      <ResilientImage
                        src={activeIssue.imageUrl}
                        alt={activeIssue.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )
                )}

                {activeIssue.pendingEvidence &&
                  activeIssue.pendingEvidence.length > 0 && (
                    <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-[#06271A]">
                          Pending Volunteer Field Evidence (
                          {activeIssue.pendingEvidence.length})
                        </p>
                        <p className="text-[11px] text-[#254B33]">
                          Private until approved by a Coordinator.
                        </p>
                      </div>
                      <div className="space-y-2.5">
                        {activeIssue.pendingEvidence.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#B5D8C7] bg-white p-2.5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {item.imageUrl && (
                                <div className="h-12 w-16 shrink-0 overflow-hidden rounded border border-[#B5D8C7]">
                                  <ResilientImage
                                    src={item.imageUrl}
                                    alt={item.summary}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[#06271A]">
                                  {item.summary}
                                </p>
                                <p className="text-[11px] text-[#5E9185]">
                                  Submitted{' '}
                                  {new Date(item.submittedAt).toLocaleDateString(
                                    'en-IN',
                                  )}
                                </p>
                              </div>
                            </div>
                            {onReviewPendingEvidence && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={updatingIssue}
                                  onClick={() => {
                                    void (async () => {
                                      setUpdatingIssue(true);
                                      const res = await onReviewPendingEvidence(
                                        item.id,
                                        'Approved',
                                      );
                                      setUpdatingIssue(false);
                                      setCoordFeedback({
                                        type: res.ok ? 'success' : 'error',
                                        message: res.ok
                                          ? 'Volunteer evidence approved for public Before/After showcase.'
                                          : (res.error ??
                                            'Unable to approve volunteer evidence.'),
                                      });
                                    })();
                                  }}
                                  className="rounded bg-[#254B33] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#06271A] disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingIssue}
                                  onClick={() => {
                                    void (async () => {
                                      setUpdatingIssue(true);
                                      const res = await onReviewPendingEvidence(
                                        item.id,
                                        'Rejected',
                                      );
                                      setUpdatingIssue(false);
                                      setCoordFeedback({
                                        type: res.ok ? 'success' : 'error',
                                        message: res.ok
                                          ? 'Volunteer evidence rejected.'
                                          : (res.error ??
                                            'Unable to reject volunteer evidence.'),
                                      });
                                    })();
                                  }}
                                  className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Quick Coordinator Decisions (Workflow-Enforced) */}
                <div className="flex flex-wrap gap-2 rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-3.5">
                  <button
                    type="button"
                    disabled={
                      updatingIssue ||
                      activeIssue.status === IssueStatus.Verified ||
                      !validateIssueStatusTransition(
                        activeIssue.status,
                        IssueStatus.Verified,
                      ).valid
                    }
                    onClick={() =>
                      void handleQuickAction(
                        IssueStatus.Verified,
                        'Report verified on site by Civic Coordinator.',
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#254B33] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#06271A] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Verify Issue</span>
                  </button>

                  <button
                    type="button"
                    disabled={
                      updatingIssue ||
                      activeIssue.status === IssueStatus.Resolved ||
                      !validateIssueStatusTransition(
                        activeIssue.status,
                        IssueStatus.Resolved,
                      ).valid
                    }
                    onClick={() =>
                      void handleQuickAction(
                        IssueStatus.Resolved,
                        'Intervention completed and verified by coordinator.',
                        { approveEvidence: true, followUpOutcome: 'Sustained' },
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#254B33] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#254B33] hover:bg-[#B5D8C7]/35 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Approve Completed Intervention</span>
                  </button>

                  <button
                    type="button"
                    disabled={
                      updatingIssue ||
                      activeIssue.status === IssueStatus.Recurring ||
                      !validateIssueStatusTransition(
                        activeIssue.status,
                        IssueStatus.Recurring,
                      ).valid
                    }
                    onClick={() =>
                      void handleQuickAction(
                        IssueStatus.Recurring,
                        'Follow-up check verified recurring problem at same location.',
                        { followUpOutcome: 'Marked Recurring' },
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3.5 py-1.5 text-xs font-semibold text-orange-900 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Mark Recurring</span>
                  </button>

                  <button
                    type="button"
                    disabled={
                      updatingIssue ||
                      activeIssue.status === IssueStatus.Rejected ||
                      !validateIssueStatusTransition(
                        activeIssue.status,
                        IssueStatus.Rejected,
                      ).valid
                    }
                    onClick={() =>
                      void handleQuickAction(
                        IssueStatus.Rejected,
                        'Site check found issue already cleared or duplicate report.',
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reject</span>
                  </button>
                </div>

                {/* Detailed Status, Action Notes & Validated After-Photo Upload */}
                <form
                  onSubmit={(e) => void handleApplyStatusUpdate(e)}
                  className="space-y-4 border-t border-[#B5D8C7]/60 pt-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="coord-status"
                        className="block text-xs font-semibold text-[#06271A]"
                      >
                        Change Issue Status (Workflow Rules Enforced)
                      </label>
                      <select
                        id="coord-status"
                        value={nextStatus}
                        onChange={(e) =>
                          setNextStatus(e.target.value as IssueStatus)
                        }
                        className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A]"
                      >
                        {allowedStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="coord-followup"
                        className="block text-xs font-semibold text-[#06271A]"
                      >
                        Record Follow-Up Check (Optional)
                      </label>
                      <select
                        id="coord-followup"
                        value={followUpOutcome}
                        onChange={(e) =>
                          setFollowUpOutcome(
                            e.target.value as
                              | ''
                              | 'Sustained'
                              | 'Needs Attention'
                              | 'Marked Recurring',
                          )
                        }
                        className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A]"
                      >
                        <option value="">No follow-up check logged</option>
                        <option value="Sustained">Sustained (Clean / Intact)</option>
                        <option value="Needs Attention">Needs Attention</option>
                        <option value="Marked Recurring">
                          Marked Recurring
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="coord-note"
                      className="block text-xs font-semibold text-[#06271A]"
                    >
                      Action Note / Verification Update
                    </label>
                    <textarea
                      id="coord-note"
                      rows={2}
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Add verification findings, municipal escalation ID, or volunteer assignment note..."
                      className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-sm text-[#06271A]"
                    />
                  </div>

                  {/* Real After-Restoration Photo Upload */}
                  <div className="space-y-3 rounded-xl border border-[#B5D8C7]/70 bg-[#F8FBF9] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="coord-after-photo"
                        className="text-xs font-semibold text-[#06271A]"
                      >
                        Post-Restoration After Photo (JPEG/PNG/WebP · max 2 MB)
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[#254B33]">
                        <input
                          type="checkbox"
                          checked={approveEvidence}
                          onChange={(e) => setApproveEvidence(e.target.checked)}
                          className="h-4 w-4 accent-[#254B33]"
                        />
                        <span>Approve resolution evidence</span>
                      </label>
                    </div>

                    {afterImageUrl ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-[#B5D8C7] bg-white p-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded border border-[#B5D8C7]">
                            <ResilientImage
                              src={afterImageUrl}
                              alt="Uploaded post-restoration preview"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="truncate text-xs text-[#254B33]">
                            After-restoration photo attached
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAfterImageUrl(undefined);
                            setAfterImageFile(null);
                          }}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="coord-after-photo"
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#5E9185] bg-white px-3 py-3 text-xs font-medium text-[#254B33] hover:bg-[#F5FAF7]"
                      >
                        <ImagePlus className="h-4 w-4" aria-hidden="true" />
                        <span>Upload post-restoration photo</span>
                        <input
                          id="coord-after-photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleAfterImageUpload}
                          className="sr-only"
                        />
                      </label>
                    )}

                    {afterImageError && (
                      <p role="alert" className="text-xs font-medium text-red-700">
                        {afterImageError}
                      </p>
                    )}

                    <input
                      type="text"
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Resolution evidence summary (optional)"
                      className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-xs text-[#06271A]"
                    />
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {onRecordFollowup && followUpOutcome && (
                      <button
                        type="button"
                        disabled={updatingIssue}
                        onClick={() => {
                          void (async () => {
                            if (!activeIssue || updatingIssue) return;
                            const obs =
                              actionNote.trim() ||
                              `Follow-up inspection recorded: ${followUpOutcome}.`;
                            setUpdatingIssue(true);
                            const res = await onRecordFollowup(
                              activeIssue,
                              followUpOutcome,
                              obs,
                            );
                            setUpdatingIssue(false);
                            setCoordFeedback({
                              type: res.ok ? 'success' : 'error',
                              message: res.ok
                                ? `Logged "${followUpOutcome}" follow-up check for ${activeIssue.id}.`
                                : (res.error ?? 'Unable to record follow-up check.'),
                            });
                            if (res.ok) {
                              setFollowUpOutcome('');
                              setActionNote('');
                            }
                          })();
                        }}
                        className="inline-flex min-h-[42px] items-center rounded-lg border border-[#254B33] bg-white px-4 py-2 text-xs font-semibold text-[#254B33] hover:bg-[#F5FAF7] disabled:opacity-60"
                      >
                        Log Follow-Up Check Only
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={updatingIssue}
                      className="inline-flex min-h-[42px] items-center rounded-lg bg-[#254B33] px-5 py-2 text-sm font-semibold text-white hover:bg-[#06271A] disabled:opacity-60"
                    >
                      {updatingIssue
                        ? 'Saving Update...'
                        : 'Save Status & Action Note'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="text-sm text-[#254B33]">
                No reports match the current queue filter.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Create / Edit Community Initiative (India Only) */}
          <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-[#254B33]" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-[#06271A]">
                  {editingInitId ? 'Edit Initiative (India)' : 'Create Initiative (India)'}
                </h2>
              </div>
              <span className="rounded border border-[#9CCCCC] bg-[#F5FAF7] px-2 py-0.5 text-[11px] font-semibold text-[#06271A]">
                India (IN)
              </span>
            </div>

            {Object.keys(initErrors).length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
              >
                {Object.values(initErrors)[0]}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveInitiativeSubmit(e)} noValidate className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="init-title"
                  className="block text-xs font-semibold text-[#06271A]"
                >
                  Activity Title <span className="text-red-700">*</span>
                </label>
                <input
                  id="init-title"
                  type="text"
                  value={initTitle}
                  onChange={(e) => {
                    setInitTitle(e.target.value);
                    setInitErrors((prev) => ({ ...prev, title: '' }));
                  }}
                  placeholder="e.g., Koramangala Storm Drain Clearing Drive"
                  className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-sm text-[#06271A]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="init-category"
                  className="block text-xs font-semibold text-[#06271A]"
                >
                  Category
                </label>
                <select
                  id="init-category"
                  value={initCategory}
                  onChange={(e) => setInitCategory(e.target.value)}
                  className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A]"
                >
                  <option value="Waste & Sanitation">Waste &amp; Sanitation</option>
                  <option value="Green Spaces">Green Spaces</option>
                  <option value="Civic Education">Civic Education</option>
                  <option value="Composting & Recycling">
                    Composting &amp; Recycling
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="init-desc"
                  className="block text-xs font-semibold text-[#06271A]"
                >
                  Description <span className="text-red-700">*</span>
                </label>
                <textarea
                  id="init-desc"
                  rows={2}
                  value={initDescription}
                  onChange={(e) => {
                    setInitDescription(e.target.value);
                    setInitErrors((prev) => ({ ...prev, description: '' }));
                  }}
                  placeholder="Describe the goal, tools provided, and meeting point..."
                  className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-sm text-[#06271A]"
                />
              </div>

              <IndiaAddressFields
                compact
                idPrefix="init"
                stateName={initState}
                district={initDistrict}
                city={initCity}
                locality={initLocality}
                pinCode={initPinCode}
                errors={initErrors}
                onChange={handleInitiativeAddressChange}
              />

              {/* Structured Date, Start/End Time, and Capacity */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="init-date"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    Initiative Date <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="init-date"
                    type="date"
                    value={initEventDate}
                    onChange={(e) => {
                      setInitEventDate(e.target.value);
                      setInitErrors((prev) => ({ ...prev, eventDate: '' }));
                    }}
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="init-capacity"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    Volunteer Capacity (5–500)
                  </label>
                  <input
                    id="init-capacity"
                    type="number"
                    min={5}
                    max={500}
                    value={initCapacity}
                    onChange={(e) => {
                      setInitCapacity(e.target.value);
                      setInitErrors((prev) => ({ ...prev, capacity: '' }));
                    }}
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="init-start-time"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    Start Time
                  </label>
                  <input
                    id="init-start-time"
                    type="time"
                    value={initStartTime}
                    onChange={(e) => {
                      setInitStartTime(e.target.value);
                      setInitErrors((prev) => ({ ...prev, startTime: '', endTime: '' }));
                    }}
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="init-end-time"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    End Time
                  </label>
                  <input
                    id="init-end-time"
                    type="time"
                    value={initEndTime}
                    onChange={(e) => {
                      setInitEndTime(e.target.value);
                      setInitErrors((prev) => ({ ...prev, endTime: '' }));
                    }}
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>
              </div>

              {/* Linked Civic Reports */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-[#06271A]">
                  Link Relevant Civic Issues (Optional)
                </span>
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[#B5D8C7] bg-[#F8FBF9] p-2 text-xs">
                  {issues.map((issue) => (
                    <label
                      key={issue.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={initLinkedIssueIds.includes(issue.id)}
                        onChange={() => toggleLinkedIssue(issue.id)}
                        className="h-3.5 w-3.5 accent-[#254B33]"
                      />
                      <span className="font-mono-tabular font-semibold text-[#254B33]">
                        {issue.id}
                      </span>
                      <span className="truncate text-[#06271A]">{issue.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Validated Cover Image Upload */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-[#06271A]">
                  Cover Photo (Optional · JPEG/PNG/WebP, max 2 MB)
                </span>
                {initCoverUrl ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[#B5D8C7] bg-[#F5FAF7] p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-10 w-14 shrink-0 overflow-hidden rounded border border-[#B5D8C7]">
                        <ResilientImage
                          src={initCoverUrl}
                          alt="Initiative cover preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="truncate text-xs text-[#254B33]">
                        Cover image selected
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInitCoverUrl(undefined);
                        setInitCoverPath(undefined);
                        setInitCoverFile(null);
                      }}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="init-cover-upload"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#5E9185] bg-[#F5FAF7] px-3 py-2.5 text-xs font-medium text-[#254B33] hover:bg-[#B5D8C7]/25"
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    <span>Upload initiative photo</span>
                    <input
                      id="init-cover-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleInitCoverUpload}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingInitiative}
                  className="min-h-[42px] flex-1 rounded-lg bg-[#254B33] px-4 py-2 text-sm font-semibold text-white hover:bg-[#06271A] disabled:opacity-60"
                >
                  {savingInitiative
                    ? 'Saving Initiative...'
                    : editingInitId
                      ? 'Save Initiative Changes'
                      : 'Publish Community Initiative'}
                </button>
                {editingInitId && (
                  <button
                    type="button"
                    onClick={resetInitiativeForm}
                    className="min-h-[42px] rounded-lg border border-[#B5D8C7] px-3 py-2 text-xs font-semibold text-[#254B33] hover:bg-[#F5FAF7]"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Managed Initiatives & Registered Volunteers Roster */}
          <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-5 lg:col-span-7">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-[#06271A]">
                Manage Initiatives &amp; Registered Volunteers
              </h2>
              <p className="text-xs text-[#254B33]/80">
                Volunteer counts match actual registration records in real time.
                Edit details, mark completed, or cancel initiatives with a reason.
              </p>
            </div>

            <div className="space-y-4">
              {initiatives.map((init) => {
                const initRegs = registrations.filter(
                  (r) => r.initiativeId === init.id,
                );
                const isCancelling = cancellingInitId === init.id;

                return (
                  <div
                    key={init.id}
                    className="rounded-xl border border-[#B5D8C7]/70 bg-[#F8FBF9] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-[#06271A]">
                            {init.title}
                          </h3>
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                              init.status === 'Cancelled'
                                ? 'bg-red-100 text-red-800'
                                : init.status === 'Completed'
                                  ? 'bg-[#B5D8C7]/60 text-[#06271A]'
                                  : 'bg-[#254B33] text-white'
                            }`}
                          >
                            {init.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#254B33]/80">
                          {init.dateLabel} ({init.timeLabel}) · {init.locality},{' '}
                          {init.city}, {init.state} ({init.pin_code})
                        </p>
                        {init.linkedIssueIds && init.linkedIssueIds.length > 0 && (
                          <p className="mt-0.5 font-mono-tabular text-[11px] text-[#5E9185]">
                            Linked issues: {init.linkedIssueIds.join(', ')}
                          </p>
                        )}
                      </div>
                      <span className="font-mono-tabular text-xs font-semibold text-[#254B33]">
                        {init.registeredCount} / {init.capacity} registered
                      </span>
                    </div>

                    {/* Lifecycle Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEditInitiative(init)}
                        className="inline-flex items-center gap-1 rounded border border-[#5E9185] bg-white px-2.5 py-1 text-xs font-semibold text-[#06271A] hover:bg-[#F5FAF7]"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        <span>Edit</span>
                      </button>

                      {init.status === 'Open' && (
                        <>
                          <button
                            type="button"
                            disabled={savingInitiative}
                            onClick={() => {
                              void (async () => {
                                setSavingInitiative(true);
                                const res = await onUpdateInitiative(
                                  { ...init, status: 'Completed' },
                                  { existingRegisteredCount: init.registeredCount },
                                );
                                setSavingInitiative(false);
                                if (!res.ok) {
                                  setCoordFeedback({
                                    type: 'error',
                                    message:
                                      res.error ??
                                      'Unable to mark initiative completed.',
                                  });
                                  return;
                                }
                                setCoordFeedback({
                                  type: 'success',
                                  message: `Marked "${init.title}" as Completed.`,
                                });
                              })();
                            }}
                            className="inline-flex items-center gap-1 rounded border border-[#254B33] bg-white px-2.5 py-1 text-xs font-semibold text-[#254B33] hover:bg-[#254B33] hover:text-white disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            <span>Mark Completed</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCancellingInitId(init.id);
                              setCancelReason('');
                              setCancelError('');
                            }}
                            className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                          >
                            <XCircle className="h-3 w-3" aria-hidden="true" />
                            <span>Cancel Initiative</span>
                          </button>
                        </>
                      )}
                    </div>

                    {isCancelling && (
                      <div className="rounded-lg border border-red-300 bg-white p-3 space-y-2">
                        <label
                          htmlFor={`cancel-reason-${init.id}`}
                          className="block text-xs font-semibold text-red-900"
                        >
                          Cancellation Reason
                        </label>
                        <input
                          id={`cancel-reason-${init.id}`}
                          type="text"
                          value={cancelReason}
                          onChange={(e) => {
                            setCancelReason(e.target.value);
                            setCancelError('');
                          }}
                          placeholder="e.g., Postponed due to heavy monsoon weather advisory"
                          className="w-full rounded border border-red-300 px-2.5 py-1.5 text-xs text-[#06271A]"
                        />
                        {cancelError && (
                          <p role="alert" className="text-xs font-medium text-red-700">
                            {cancelError}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={savingInitiative}
                            onClick={() => void handleConfirmCancelInitiative(init)}
                            className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                          >
                            {savingInitiative ? 'Cancelling...' : 'Confirm Cancellation'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancellingInitId(null)}
                            className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    {initRegs.length > 0 ? (
                      <ul className="divide-y divide-[#B5D8C7]/50 rounded-lg border border-[#B5D8C7]/60 bg-white px-3">
                        {initRegs.map((reg) => (
                          <li
                            key={reg.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="block font-medium text-[#06271A]">
                                {reg.volunteerName}
                              </span>
                              <span className="block truncate text-[11px] text-[#5E9185]">
                                {reg.volunteerEmail}
                              </span>
                            </div>
                            {onMarkAttendance ? (
                              <select
                                aria-label={`Attendance for ${reg.volunteerName}`}
                                value={reg.attendanceStatus ?? 'Pending'}
                                onChange={(e) => {
                                  const nextAtt = e.target.value as
                                    | 'Pending'
                                    | 'Attended'
                                    | 'Absent';
                                  void (async () => {
                                    const res = await onMarkAttendance(
                                      reg.id,
                                      nextAtt,
                                    );
                                    setCoordFeedback({
                                      type: res.ok ? 'success' : 'error',
                                      message: res.ok
                                        ? `Marked ${reg.volunteerName} as ${nextAtt}.`
                                        : (res.error ??
                                          'Unable to update attendance.'),
                                    });
                                  })();
                                }}
                                className="rounded border border-[#9CCCCC] bg-[#F8FBF9] px-2 py-1 text-[11px] font-semibold text-[#06271A]"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Attended">Attended</option>
                                <option value="Absent">Absent</option>
                              </select>
                            ) : (
                              <span className="rounded bg-[#F5FAF7] px-2 py-0.5 text-[11px] font-medium text-[#254B33]">
                                {reg.attendanceStatus ?? 'Pending'}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#5E9185]">
                        No volunteers registered yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
