import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ImagePlus,
  Link2,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import {
  CommunityInitiative,
  PageRoute,
  UserAccount,
  UserRole,
  VolunteerRegistration,
} from '../types/civic';
import { assertValidIndiaInitiativeRecord, validateImageFile } from '../utils/civicLogic';
import { ResilientImage } from '../components/ResilientImage';
import { ModalDialog } from '../components/ModalDialog';
import { IndiaLocationFilterBar } from '../components/IndiaLocationFilterBar';

interface CommunityPageProps {
  initiatives: CommunityInitiative[];
  registrations: VolunteerRegistration[];
  currentUser: UserAccount | null;
  isSupabaseMode?: boolean;
  activeVolunteerEmail: string;
  selectedInitiativeId: string | null;
  onSelectInitiativeId: (initiativeId: string | null) => void;
  onRegisterVolunteer: (
    initiativeId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  onCancelRegistration: (
    initiativeId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  onSubmitVolunteerEvidence?: (params: {
    issueDbId: string;
    initiativeId: string;
    imageFile: File;
    summary: string;
  }) => Promise<{ ok: boolean; message?: string; error?: string }>;
  onInspectIssue: (issueId: string) => void;
  onNavigate: (route: PageRoute) => void;
}

export const CommunityPage: React.FC<CommunityPageProps> = ({
  initiatives,
  registrations,
  currentUser,
  isSupabaseMode = false,
  activeVolunteerEmail,
  selectedInitiativeId,
  onSelectInitiativeId,
  onRegisterVolunteer,
  onCancelRegistration,
  onSubmitVolunteerEvidence,
  onInspectIssue,
  onNavigate,
}) => {
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [pendingInitId, setPendingInitId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [evIssueDbId, setEvIssueDbId] = useState('');
  const [evSummary, setEvSummary] = useState('');
  const [evFile, setEvFile] = useState<File | null>(null);
  const [evSubmitting, setEvSubmitting] = useState(false);
  const [evStatus, setEvStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const indiaInitiatives = useMemo(
    () => initiatives.filter(assertValidIndiaInitiativeRecord),
    [initiatives],
  );

  const availableStates = useMemo(
    () => Array.from(new Set(indiaInitiatives.map((i) => i.state))).sort(),
    [indiaInitiatives],
  );

  const availableCities = useMemo(() => {
    const scoped =
      stateFilter === 'All'
        ? indiaInitiatives
        : indiaInitiatives.filter((i) => i.state === stateFilter);
    return Array.from(new Set(scoped.map((i) => i.city))).sort();
  }, [indiaInitiatives, stateFilter]);

  const myInitiativeIds = useMemo(() => {
    if (isSupabaseMode) {
      if (!currentUser) return new Set<string>();
      return new Set(
        registrations
          .filter(
            (r) =>
              r.registrationStatus !== 'Cancelled' &&
              (r.userId === currentUser.id ||
                r.volunteerEmail.toLowerCase() ===
                  currentUser.email.toLowerCase()),
          )
          .map((r) => r.initiativeId),
      );
    }

    return new Set(
      registrations
        .filter(
          (r) =>
            r.volunteerEmail.toLowerCase() === activeVolunteerEmail.toLowerCase(),
        )
        .map((r) => r.initiativeId),
    );
  }, [registrations, activeVolunteerEmail, isSupabaseMode, currentUser]);

  const visibleInitiatives = useMemo(() => {
    return indiaInitiatives.filter((item) => {
      if (tab === 'mine' && !myInitiativeIds.has(item.id)) return false;
      if (stateFilter !== 'All' && item.state !== stateFilter) return false;
      if (cityFilter !== 'All' && item.city !== cityFilter) return false;
      return true;
    });
  }, [indiaInitiatives, tab, myInitiativeIds, stateFilter, cityFilter]);

  const activeDetail = useMemo(
    () => indiaInitiatives.find((i) => i.id === selectedInitiativeId) ?? null,
    [indiaInitiatives, selectedInitiativeId],
  );

  const handleRegister = async (initiativeId: string) => {
    setPendingInitId(initiativeId);
    try {
      const result = await onRegisterVolunteer(initiativeId);
      setFeedback(result);
    } finally {
      setPendingInitId(null);
    }
  };

  const handleCancel = async (initiativeId: string) => {
    setPendingInitId(initiativeId);
    try {
      const result = await onCancelRegistration(initiativeId);
      setFeedback(result);
    } finally {
      setPendingInitId(null);
    }
  };

  const closeDetail = () => {
    setEvIssueDbId('');
    setEvSummary('');
    setEvFile(null);
    setEvStatus(null);
    onSelectInitiativeId(null);
  };

  const handleVolunteerEvidenceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validation = validateImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!validation.valid) {
      setEvStatus({ ok: false, text: validation.error ?? 'Invalid photo file.' });
      return;
    }
    setEvFile(file);
    setEvStatus(null);
  };

  const handleVolunteerEvidenceSubmit = async (
    e: React.FormEvent,
    initiative: CommunityInitiative,
  ) => {
    e.preventDefault();
    if (!onSubmitVolunteerEvidence || evSubmitting) return;
    const targetDbId =
      evIssueDbId || initiative.linkedIssueDbIds?.[0] || '';
    if (!targetDbId) {
      setEvStatus({ ok: false, text: 'Select a linked civic issue first.' });
      return;
    }
    if (!evFile) {
      setEvStatus({ ok: false, text: 'Attach a field completion photo.' });
      return;
    }
    setEvSubmitting(true);
    const res = await onSubmitVolunteerEvidence({
      issueDbId: targetDbId,
      initiativeId: initiative.id,
      imageFile: evFile,
      summary: evSummary,
    });
    setEvSubmitting(false);
    if (!res.ok) {
      setEvStatus({
        ok: false,
        text: res.error ?? 'Unable to upload field evidence.',
      });
      return;
    }
    setEvFile(null);
    setEvSummary('');
    setEvStatus({
      ok: true,
      text:
        res.message ??
        'Field evidence submitted for Coordinator approval.',
    });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
            {isSupabaseMode
              ? 'Collective Civic Action · India'
              : 'Collective Civic Action · India Demonstration Data'}
          </p>
          <h1 className="font-display text-3xl font-bold text-[#06271A] sm:text-4xl">
            Community Initiatives
          </h1>
          <p className="max-w-2xl text-sm text-[#254B33]">
            Join local cleanups, park restorations, and waste awareness drives across
            Indian cities.
            {currentUser ? (
              <>
                {' '}
                Registering as{' '}
                <strong className="text-[#06271A]">{currentUser.fullName}</strong>.
              </>
            ) : isSupabaseMode ? (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => onNavigate('auth')}
                  className="font-semibold underline decoration-[#5E9185] underline-offset-4 hover:text-[#06271A]"
                >
                  Sign in or create an account
                </button>{' '}
                to reserve a volunteer spot.
              </>
            ) : (
              <>
                {' '}
                Registering as guest volunteer ({activeVolunteerEmail}) or{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('auth')}
                  className="font-semibold underline decoration-[#5E9185] underline-offset-4 hover:text-[#06271A]"
                >
                  sign in to link your account
                </button>
                .
              </>
            )}
          </p>
        </div>

        {/* Segmented Tabs */}
        <div className="flex items-center gap-1 self-start rounded-lg border border-[#B5D8C7] bg-[#F5FAF7] p-1 md:self-auto">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'all'
                ? 'bg-white text-[#06271A] shadow-xs'
                : 'text-[#254B33] hover:text-[#06271A]'
            }`}
          >
            All Initiatives ({indiaInitiatives.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'mine'
                ? 'bg-white text-[#06271A] shadow-xs'
                : 'text-[#254B33] hover:text-[#06271A]'
            }`}
          >
            My Registered Activities ({myInitiativeIds.size})
          </button>
        </div>
      </div>

      {/* State & City Filter Bar */}
      <IndiaLocationFilterBar
        stateFilter={stateFilter}
        cityFilter={cityFilter}
        availableStates={availableStates}
        availableCities={availableCities}
        onStateChange={setStateFilter}
        onCityChange={setCityFilter}
        onReset={() => {
          setStateFilter('All');
          setCityFilter('All');
        }}
        stateId="community-state-filter"
        cityId="community-city-filter"
      />

      {/* Confirmation Banner */}
      {feedback && (
        <div
          role="status"
          className={`mb-6 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
            feedback.ok
              ? 'border-[#5E9185] bg-[#B5D8C7]/35 text-[#06271A]'
              : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#254B33]" aria-hidden="true" />
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            className="rounded p-1 text-[#254B33] hover:bg-white/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Empty State */}
      {visibleInitiatives.length === 0 ? (
        <div className="rounded-2xl border border-[#B5D8C7] bg-white p-12 text-center space-y-3">
          <p className="font-display text-lg font-bold text-[#06271A]">
            {tab === 'mine'
              ? 'You have not registered for any community activities yet'
              : indiaInitiatives.length === 0
                ? 'No community initiatives scheduled yet'
                : 'No initiatives match the selected state or city'}
          </p>
          <p className="text-sm text-[#254B33]">
            {tab === 'mine'
              ? 'Browse open Indian neighbourhood initiatives and reserve a volunteer spot to see them listed here.'
              : indiaInitiatives.length === 0
                ? 'Local cleanups, park restorations, and volunteer drives will appear here once published by a Coordinator.'
                : 'Reset your state/city filters to inspect all open initiatives across India.'}
          </p>
          {(tab === 'mine' || indiaInitiatives.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setTab('all');
                setStateFilter('All');
                setCityFilter('All');
              }}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-[#254B33] px-4 py-2 text-sm font-semibold text-white"
            >
              Browse All Initiatives
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {visibleInitiatives.map((initiative) => {
            const isRegistered = myInitiativeIds.has(initiative.id);
            const spotsLeft = Math.max(
              0,
              initiative.capacity - initiative.registeredCount,
            );
            const fillPercent = Math.min(
              100,
              Math.round((initiative.registeredCount / initiative.capacity) * 100),
            );
            const isClosed =
              initiative.status === 'Completed' || initiative.status === 'Cancelled';

            return (
              <article
                key={initiative.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[#B5D8C7] bg-white"
              >
                <div className="aspect-[16/9] w-full overflow-hidden border-b border-[#B5D8C7]/60 bg-[#F5FAF7]">
                  <ResilientImage
                    src={initiative.imageUrl}
                    alt={initiative.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-6 space-y-5">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[#5E9185]">
                        {initiative.category} · {initiative.city}, {initiative.state}
                      </span>
                      <span
                        className={`font-semibold ${
                          initiative.status === 'Cancelled'
                            ? 'text-red-700'
                            : initiative.status === 'Completed'
                              ? 'text-[#5E9185]'
                              : 'text-[#254B33]'
                        }`}
                      >
                        {initiative.status}
                      </span>
                    </div>

                    <h2 className="font-display text-xl font-bold text-[#06271A]">
                      {initiative.title}
                    </h2>

                    <p className="text-sm leading-relaxed text-[#254B33]">
                      {initiative.description}
                    </p>

                    {initiative.status === 'Cancelled' &&
                      initiative.cancellationReason && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                          <AlertTriangle
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700"
                            aria-hidden="true"
                          />
                          <span>
                            Cancelled: {initiative.cancellationReason}
                          </span>
                        </div>
                      )}

                    {initiative.linkedIssueIds &&
                      initiative.linkedIssueIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                          <Link2
                            className="h-3.5 w-3.5 text-[#5E9185]"
                            aria-hidden="true"
                          />
                          <span className="text-[#5E9185]">Linked reports:</span>
                          {initiative.linkedIssueIds.map((issueId) => (
                            <button
                              key={issueId}
                              type="button"
                              onClick={() => onInspectIssue(issueId)}
                              className="font-mono-tabular rounded border border-[#B5D8C7] bg-[#F5FAF7] px-2 py-0.5 text-[11px] font-semibold text-[#254B33] hover:border-[#254B33] hover:text-[#06271A]"
                            >
                              {issueId}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-2 text-xs text-[#254B33] sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[#5E9185] shrink-0" aria-hidden="true" />
                        <span>
                          {initiative.locality}, {initiative.city}, {initiative.state}{' '}
                          ·{' '}
                          <span className="font-mono-tabular">
                            {initiative.pin_code}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-[#5E9185] shrink-0" aria-hidden="true" />
                        <span>{initiative.dateLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-[#5E9185] shrink-0" aria-hidden="true" />
                        <span>{initiative.timeLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-[#5E9185] shrink-0" aria-hidden="true" />
                        <span className="tabular-nums">
                          {initiative.registeredCount} registered · {spotsLeft} spots
                          left
                        </span>
                      </div>
                    </div>

                    {/* Capacity Bar */}
                    <div className="space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F5FAF7] border border-[#B5D8C7]/60">
                        <div
                          className="h-full bg-[#254B33] transition-all"
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectInitiativeId(initiative.id)}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#5E9185] bg-[#F5FAF7] px-4 py-2 text-xs font-semibold text-[#06271A] transition-colors hover:bg-[#B5D8C7]/35"
                      >
                        View Details
                      </button>

                      {!isClosed &&
                        (isSupabaseMode && !currentUser ? (
                          <button
                            type="button"
                            onClick={() => onNavigate('auth')}
                            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-[#254B33] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#06271A]"
                          >
                            Sign In to Register
                          </button>
                        ) : isRegistered ? (
                          <button
                            type="button"
                            disabled={pendingInitId === initiative.id}
                            onClick={() => void handleCancel(initiative.id)}
                            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60"
                          >
                            {pendingInitId === initiative.id
                              ? 'Cancelling...'
                              : 'Cancel Registration'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              spotsLeft === 0 || pendingInitId === initiative.id
                            }
                            onClick={() => void handleRegister(initiative.id)}
                            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-[#254B33] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#06271A] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                          >
                            {pendingInitId === initiative.id
                              ? 'Registering...'
                              : spotsLeft === 0
                                ? 'Capacity Full'
                                : 'Register as Volunteer'}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Accessible Initiative Detail Modal */}
      {activeDetail && (
        <ModalDialog
          onClose={closeDetail}
          labelledBy="initiative-modal-title"
          maxWidthClass="max-w-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#B5D8C7]/60 pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#5E9185]">
                {activeDetail.category} · Organized by {activeDetail.organizer} ·{' '}
                <strong
                  className={
                    activeDetail.status === 'Cancelled'
                      ? 'text-red-700'
                      : 'text-[#06271A]'
                  }
                >
                  {activeDetail.status}
                </strong>
              </p>
              <h2
                id="initiative-modal-title"
                className="font-display text-xl font-bold text-[#06271A] sm:text-2xl"
              >
                {activeDetail.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeDetail}
              aria-label="Close initiative details"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#B5D8C7] text-[#06271A] hover:bg-[#F5FAF7]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="aspect-[16/9] overflow-hidden rounded-xl border border-[#B5D8C7] bg-[#F5FAF7]">
            <ResilientImage
              src={activeDetail.imageUrl}
              alt={activeDetail.title}
              className="h-full w-full object-cover"
            />
          </div>

          <p className="text-sm leading-relaxed text-[#254B33]">
            {activeDetail.description}
          </p>

          {activeDetail.status === 'Cancelled' &&
            activeDetail.cancellationReason && (
              <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                <span>
                  <strong>Cancellation notice:</strong>{' '}
                  {activeDetail.cancellationReason}
                </span>
              </div>
            )}

          <div className="grid gap-3 rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4 text-xs text-[#254B33] sm:grid-cols-2">
            <p>
              <strong className="text-[#06271A]">Locality:</strong>{' '}
              {activeDetail.locality}
            </p>
            <p>
              <strong className="text-[#06271A]">City &amp; State:</strong>{' '}
              {activeDetail.city}, {activeDetail.state}
            </p>
            <p>
              <strong className="text-[#06271A]">PIN Code:</strong>{' '}
              <span className="font-mono-tabular">{activeDetail.pin_code}</span>{' '}
              (India)
            </p>
            <p>
              <strong className="text-[#06271A]">Date &amp; Time:</strong>{' '}
              {activeDetail.dateLabel} · {activeDetail.timeLabel}
            </p>
            <p className="tabular-nums sm:col-span-2">
              <strong className="text-[#06271A]">Volunteer Capacity:</strong>{' '}
              {activeDetail.registeredCount} / {activeDetail.capacity} registered
            </p>
          </div>

          {activeDetail.linkedIssueIds &&
            activeDetail.linkedIssueIds.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-sm font-bold text-[#06271A]">
                  Linked Civic Issues
                </h3>
                <div className="flex flex-wrap gap-2">
                  {activeDetail.linkedIssueIds.map((issueId) => (
                    <button
                      key={issueId}
                      type="button"
                      onClick={() => onInspectIssue(issueId)}
                      className="font-mono-tabular inline-flex items-center gap-1.5 rounded-lg border border-[#5E9185] bg-[#F5FAF7] px-3 py-1.5 text-xs font-semibold text-[#06271A] hover:bg-[#B5D8C7]/35"
                    >
                      <Link2 className="h-3.5 w-3.5 text-[#254B33]" aria-hidden="true" />
                      <span>Track {issueId}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {activeDetail.highlights.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-display text-sm font-bold text-[#06271A]">
                What to Expect
              </h3>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#254B33]">
                {activeDetail.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </div>
          )}

          {isSupabaseMode &&
            onSubmitVolunteerEvidence &&
            activeDetail.linkedIssueDbIds &&
            activeDetail.linkedIssueDbIds.length > 0 &&
            (myInitiativeIds.has(activeDetail.id) ||
              currentUser?.role === UserRole.Coordinator) && (
              <form
                onSubmit={(e) => void handleVolunteerEvidenceSubmit(e, activeDetail)}
                className="space-y-3 rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4"
              >
                <div className="space-y-0.5">
                  <h3 className="font-display text-sm font-bold text-[#06271A]">
                    Submit Volunteer Field Evidence
                  </h3>
                  <p className="text-xs text-[#254B33]">
                    Upload post-drive completion photos for a linked issue. Submissions
                    stay private until verified and approved by a Coordinator.
                  </p>
                </div>

                {evStatus && (
                  <p
                    role={evStatus.ok ? 'status' : 'alert'}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                      evStatus.ok
                        ? 'border-[#5E9185] bg-white text-[#06271A]'
                        : 'border-red-300 bg-red-50 text-red-900'
                    }`}
                  >
                    {evStatus.text}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="vol-ev-issue"
                      className="block text-xs font-semibold text-[#06271A]"
                    >
                      Linked Civic Issue
                    </label>
                    <select
                      id="vol-ev-issue"
                      value={evIssueDbId || activeDetail.linkedIssueDbIds[0]}
                      onChange={(e) => setEvIssueDbId(e.target.value)}
                      className="w-full rounded-lg border border-[#9CCCCC] bg-white px-2.5 py-2 text-xs text-[#06271A]"
                    >
                      {activeDetail.linkedIssueDbIds.map((dbId, idx) => (
                        <option key={dbId} value={dbId}>
                          {activeDetail.linkedIssueIds?.[idx] ?? dbId}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="vol-ev-photo"
                      className="block text-xs font-semibold text-[#06271A]"
                    >
                      Field Photo (JPEG/PNG/WebP · max 2 MB)
                    </label>
                    <label
                      htmlFor="vol-ev-photo"
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#5E9185] bg-white px-3 py-2 text-xs font-medium text-[#254B33] hover:bg-[#F8FBF9]"
                    >
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="truncate">
                        {evFile ? evFile.name : 'Choose photo'}
                      </span>
                      <input
                        id="vol-ev-photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleVolunteerEvidenceFile}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <input
                  type="text"
                  value={evSummary}
                  onChange={(e) => setEvSummary(e.target.value)}
                  placeholder="Describe work completed on site (min 5 chars)..."
                  className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-xs text-[#06271A]"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={evSubmitting}
                    className="inline-flex min-h-[36px] items-center rounded-lg bg-[#254B33] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#06271A] disabled:opacity-60"
                  >
                    {evSubmitting ? 'Uploading...' : 'Submit for Coordinator Review'}
                  </button>
                </div>
              </form>
            )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#B5D8C7]/60 pt-4">
            <button
              type="button"
              onClick={closeDetail}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-[#B5D8C7] px-4 py-2 text-xs font-semibold text-[#254B33] hover:bg-[#F5FAF7]"
            >
              Close
            </button>

            {activeDetail.status === 'Open' &&
              (isSupabaseMode && !currentUser ? (
                <button
                  type="button"
                  onClick={() => onNavigate('auth')}
                  className="inline-flex min-h-[40px] items-center rounded-lg bg-[#254B33] px-5 py-2 text-xs font-semibold text-white hover:bg-[#06271A]"
                >
                  Sign In to Register
                </button>
              ) : myInitiativeIds.has(activeDetail.id) ? (
                <button
                  type="button"
                  disabled={pendingInitId === activeDetail.id}
                  onClick={() => void handleCancel(activeDetail.id)}
                  className="inline-flex min-h-[40px] items-center rounded-lg border border-red-300 bg-red-50 px-5 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
                >
                  {pendingInitId === activeDetail.id
                    ? 'Cancelling...'
                    : 'Cancel Registration'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    activeDetail.registeredCount >= activeDetail.capacity ||
                    pendingInitId === activeDetail.id
                  }
                  onClick={() => void handleRegister(activeDetail.id)}
                  className="inline-flex min-h-[40px] items-center rounded-lg bg-[#254B33] px-5 py-2 text-xs font-semibold text-white hover:bg-[#06271A] disabled:bg-slate-300"
                >
                  {pendingInitId === activeDetail.id
                    ? 'Registering...'
                    : 'Register as Volunteer'}
                </button>
              ))}
          </div>
        </ModalDialog>
      )}
    </section>
  );
};
