import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
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
  formatIndianAddress,
  validateInitiativeSubmission,
} from '../utils/civicLogic';
import {
  INDIA_COUNTRY_CODE,
  INDIAN_STATES_AND_UTS,
} from '../utils/indiaGeo';
import {
  SEED_AFTER_RESTORED_IMAGE,
  SEED_PARK_RESTORATION_IMAGE,
} from '../data/seedData';
import { StatusBadge } from '../components/StatusBadge';
import { ResilientImage } from '../components/ResilientImage';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';

interface CoordinatorDashboardPageProps {
  currentUser: UserAccount | null;
  issues: CivicIssue[];
  initiatives: CommunityInitiative[];
  registrations: VolunteerRegistration[];
  onUpdateIssueStatus: (
    issueId: string,
    newStatus: IssueStatus,
    note: string,
    options?: {
      approveEvidence?: boolean;
      afterImageUrl?: string;
      resolutionSummary?: string;
      followUpOutcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
    },
  ) => void;
  onCreateInitiative: (initiative: CommunityInitiative) => void;
  onDemoCoordinatorLogin: () => void;
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
  onUpdateIssueStatus,
  onCreateInitiative,
  onDemoCoordinatorLogin,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'initiatives'>('reports');
  const [queueFilter, setQueueFilter] = useState<IssueStatus | 'All'>('All');
  const [selectedIssueId, setSelectedIssueId] = useState<string>(
    issues[0]?.id ?? '',
  );
  const [actionNote, setActionNote] = useState('');
  const [nextStatus, setNextStatus] = useState<IssueStatus>(IssueStatus.Verified);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [attachAfterEvidence, setAttachAfterEvidence] = useState(false);
  const [followUpOutcome, setFollowUpOutcome] = useState<
    '' | 'Sustained' | 'Needs Attention' | 'Marked Recurring'
  >('');
  const [coordFeedback, setCoordFeedback] = useState<string | null>(null);

  // Create Initiative Form state (India-only enforced)
  const [initTitle, setInitTitle] = useState('');
  const [initCategory, setInitCategory] = useState('Waste & Sanitation');
  const [initDescription, setInitDescription] = useState('');
  const [initState, setInitState] = useState('Karnataka');
  const [initDistrict, setInitDistrict] = useState('Bengaluru Urban');
  const [initCity, setInitCity] = useState('Bengaluru');
  const [initLocality, setInitLocality] = useState('');
  const [initPinCode, setInitPinCode] = useState('');
  const [initDate, setInitDate] = useState('Sat, Dec 05, 2026');
  const [initTime, setInitTime] = useState('08:00 AM – 11:00 AM');
  const [initCapacity, setInitCapacity] = useState('25');
  const [initErrors, setInitErrors] = useState<Record<string, string>>({});

  const filteredQueue = useMemo(() => {
    if (queueFilter === 'All') return issues;
    return issues.filter((i) => i.status === queueFilter);
  }, [issues, queueFilter]);

  const activeIssue =
    issues.find((i) => i.id === selectedIssueId) ?? filteredQueue[0] ?? null;

  // Role protection check
  if (!currentUser || currentUser.role !== UserRole.Coordinator) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-[#B5D8C7] bg-white p-8 text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#B5D8C7]/45 text-[#254B33]">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-[#06271A]">
              Coordinator Role Required
            </h1>
            <p className="text-sm text-[#254B33]">
              This workspace is restricted to verified Civic Coordinators for
              reviewing reports, approving before-and-after outcomes, and managing
              Indian community initiatives.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onDemoCoordinatorLogin}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-[#254B33] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#06271A]"
            >
              Sign in as Demo Coordinator
            </button>
            <button
              type="button"
              onClick={() => onNavigate('auth')}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[#5E9185] bg-[#F5FAF7] px-5 py-2.5 text-sm font-semibold text-[#06271A]"
            >
              Go to Login Page
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
    setAttachAfterEvidence(false);
    setFollowUpOutcome('');
    setCoordFeedback(null);
  };

  const handleApplyStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIssue) return;

    onUpdateIssueStatus(activeIssue.id, nextStatus, actionNote, {
      approveEvidence:
        nextStatus === IssueStatus.Resolved || attachAfterEvidence,
      afterImageUrl: attachAfterEvidence
        ? SEED_AFTER_RESTORED_IMAGE
        : activeIssue.resolutionEvidence?.afterImageUrl,
      resolutionSummary: resolutionSummary || undefined,
      followUpOutcome: followUpOutcome || undefined,
    });

    setCoordFeedback(`Updated ${activeIssue.id} to "${nextStatus}".`);
    setActionNote('');
    setFollowUpOutcome('');
  };

  const handleQuickAction = (
    status: IssueStatus,
    defaultNote: string,
    extra?: {
      approveEvidence?: boolean;
      followUpOutcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
    },
  ) => {
    if (!activeIssue) return;
    const noteToUse = actionNote.trim() || defaultNote;
    onUpdateIssueStatus(activeIssue.id, status, noteToUse, extra);
    setNextStatus(status);
    setCoordFeedback(`Applied "${status}" to ${activeIssue.id}.`);
    setActionNote('');
  };

  const handleCreateInitiativeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const capNumber = Math.max(5, Number(initCapacity) || 20);
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
      dateLabel: initDate,
      timeLabel: initTime,
      capacity: capNumber,
    });

    if (!validation.valid) {
      setInitErrors(validation.errors);
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
      location: formatIndianAddress({
        locality: initLocality,
        city: initCity,
        district: initDistrict,
        state: initState,
        pin_code: initPinCode,
      }),
      dateLabel: initDate.trim() || 'Upcoming Weekend',
      timeLabel: initTime.trim() || '08:00 AM – 11:00 AM',
      capacity: capNumber,
      registeredCount: 0,
      status: 'Open',
      imageUrl: SEED_PARK_RESTORATION_IMAGE,
      organizer: `${currentUser.fullName} (Coordinator)`,
      highlights: [
        'Published via Coordinator Dashboard',
        'Tools and orientation provided at meeting point',
      ],
    };

    onCreateInitiative(created);
    setInitTitle('');
    setInitDescription('');
    setInitLocality('');
    setInitPinCode('');
    setInitErrors({});
    setCoordFeedback(
      `Published "${created.title}" (${created.city}, ${created.state}) to the Community Initiatives page.`,
    );
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
            Role-Protected Operations · {currentUser.fullName} (India)
          </p>
          <h1 className="font-display text-3xl font-bold text-[#06271A]">
            Coordinator Dashboard
          </h1>
          <p className="text-sm text-[#254B33]">
            Verify incoming Indian reports, manage status timelines, approve
            completion evidence, and organize community initiatives.
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg border border-[#B5D8C7] bg-[#F5FAF7] p-1 md:self-auto">
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
      </div>

      {coordFeedback && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-[#5E9185] bg-[#B5D8C7]/35 px-4 py-3 text-sm font-medium text-[#06271A]"
        >
          <span>{coordFeedback}</span>
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

                {/* Quick Coordinator Decisions */}
                <div className="flex flex-wrap gap-2 rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAction(
                        IssueStatus.Verified,
                        'Report verified on site by Civic Coordinator.',
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#254B33] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#06271A]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Verify Issue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAction(
                        IssueStatus.Resolved,
                        'Intervention completed and before/after evidence approved.',
                        { approveEvidence: true, followUpOutcome: 'Sustained' },
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#254B33] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#254B33] hover:bg-[#B5D8C7]/35"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Approve Completed Intervention</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAction(
                        IssueStatus.Recurring,
                        'Follow-up check verified recurring problem at same location.',
                        { followUpOutcome: 'Marked Recurring' },
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3.5 py-1.5 text-xs font-semibold text-orange-900 hover:bg-orange-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Mark Recurring</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAction(
                        IssueStatus.Rejected,
                        'Site check found issue already cleared or duplicate report.',
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reject</span>
                  </button>
                </div>

                {/* Detailed Status, Action Notes & Follow-Up Form */}
                <form
                  onSubmit={handleApplyStatusUpdate}
                  className="space-y-4 border-t border-[#B5D8C7]/60 pt-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="coord-status"
                        className="block text-xs font-semibold text-[#06271A]"
                      >
                        Change Issue Status
                      </label>
                      <select
                        id="coord-status"
                        value={nextStatus}
                        onChange={(e) =>
                          setNextStatus(e.target.value as IssueStatus)
                        }
                        className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A]"
                      >
                        {ALL_STATUSES.map((status) => (
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

                  <div className="space-y-2 rounded-xl border border-[#B5D8C7]/70 bg-[#F8FBF9] p-3.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#06271A]">
                      <input
                        type="checkbox"
                        checked={attachAfterEvidence}
                        onChange={(e) => setAttachAfterEvidence(e.target.checked)}
                        className="h-4 w-4 accent-[#254B33]"
                      />
                      <span>
                        Attach &amp; approve sample post-restoration after photo
                      </span>
                    </label>
                    <input
                      type="text"
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Resolution evidence summary (optional)"
                      className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-xs text-[#06271A]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex min-h-[42px] items-center rounded-lg bg-[#254B33] px-5 py-2 text-sm font-semibold text-white hover:bg-[#06271A]"
                    >
                      Save Status &amp; Action Note
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="text-sm text-[#254B33]">
                Select a report from the queue to review details.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Create Community Initiative (India Only) */}
          <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-[#254B33]" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-[#06271A]">
                  Create Initiative (India)
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

            <form onSubmit={handleCreateInitiativeSubmit} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="init-title"
                  className="block text-xs font-semibold text-[#06271A]"
                >
                  Activity Title
                </label>
                <input
                  id="init-title"
                  type="text"
                  value={initTitle}
                  onChange={(e) => setInitTitle(e.target.value)}
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
                  Description
                </label>
                <textarea
                  id="init-desc"
                  rows={2}
                  value={initDescription}
                  onChange={(e) => setInitDescription(e.target.value)}
                  placeholder="Describe the goal, tools provided, and meeting point..."
                  className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-sm text-[#06271A]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="init-state"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    State / UT
                  </label>
                  <select
                    id="init-state"
                    value={initState}
                    onChange={(e) => setInitState(e.target.value)}
                    className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-xs text-[#06271A]"
                  >
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="init-district"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    District
                  </label>
                  <input
                    id="init-district"
                    type="text"
                    value={initDistrict}
                    onChange={(e) => setInitDistrict(e.target.value)}
                    placeholder="e.g., Bengaluru Urban"
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="init-city"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    City / Town
                  </label>
                  <input
                    id="init-city"
                    type="text"
                    value={initCity}
                    onChange={(e) => setInitCity(e.target.value)}
                    placeholder="e.g., Bengaluru"
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="init-pin"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    PIN Code (6 digits)
                  </label>
                  <input
                    id="init-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={initPinCode}
                    onChange={(e) =>
                      setInitPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="e.g., 560034"
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 font-mono-tabular text-xs text-[#06271A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="init-locality"
                  className="block text-xs font-semibold text-[#06271A]"
                >
                  Locality / Area
                </label>
                <input
                  id="init-locality"
                  type="text"
                  value={initLocality}
                  onChange={(e) => setInitLocality(e.target.value)}
                  placeholder="e.g., Koramangala 4th Block Park"
                  className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label
                    htmlFor="init-date"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    Date
                  </label>
                  <input
                    id="init-date"
                    type="text"
                    value={initDate}
                    onChange={(e) => setInitDate(e.target.value)}
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="init-time"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    Time
                  </label>
                  <input
                    id="init-time"
                    type="text"
                    value={initTime}
                    onChange={(e) => setInitTime(e.target.value)}
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="init-capacity"
                    className="block text-xs font-semibold text-[#06271A]"
                  >
                    Capacity
                  </label>
                  <input
                    id="init-capacity"
                    type="number"
                    min={5}
                    max={200}
                    value={initCapacity}
                    onChange={(e) => setInitCapacity(e.target.value)}
                    className="w-full rounded-lg border border-[#9CCCCC] px-3 py-2 text-xs text-[#06271A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[42px] w-full rounded-lg bg-[#254B33] px-4 py-2 text-sm font-semibold text-white hover:bg-[#06271A]"
              >
                Publish Community Initiative
              </button>
            </form>
          </div>

          {/* Registered Volunteers Roster */}
          <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-5 lg:col-span-7">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-[#06271A]">
                Registered Volunteers by Initiative
              </h2>
              <p className="text-xs text-[#254B33]/80">
                Coordinator-only roster showing active sign-ups across Indian
                community initiatives
              </p>
            </div>

            <div className="space-y-4">
              {initiatives.map((init) => {
                const initRegs = registrations.filter(
                  (r) => r.initiativeId === init.id,
                );
                return (
                  <div
                    key={init.id}
                    className="rounded-xl border border-[#B5D8C7]/70 bg-[#F8FBF9] p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#06271A]">
                          {init.title}
                        </h3>
                        <p className="text-xs text-[#254B33]/80">
                          {init.dateLabel} · {init.locality}, {init.city},{' '}
                          {init.state} ({init.pin_code})
                        </p>
                      </div>
                      <span className="font-mono-tabular text-xs font-semibold text-[#254B33]">
                        {init.registeredCount} / {init.capacity} registered
                      </span>
                    </div>

                    {initRegs.length > 0 ? (
                      <ul className="divide-y divide-[#B5D8C7]/50 rounded-lg border border-[#B5D8C7]/60 bg-white px-3">
                        {initRegs.map((reg) => (
                          <li
                            key={reg.id}
                            className="flex items-center justify-between py-2 text-xs"
                          >
                            <span className="font-medium text-[#06271A]">
                              {reg.volunteerName}
                            </span>
                            <span className="text-[#5E9185]">
                              {reg.volunteerEmail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#5E9185]">
                        Seeded baseline volunteers included in total count; no new
                        local browser sign-ups yet.
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
