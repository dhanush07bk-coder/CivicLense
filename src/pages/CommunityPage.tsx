import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import {
  CommunityInitiative,
  PageRoute,
  UserAccount,
  VolunteerRegistration,
} from '../types/civic';
import { assertValidIndiaInitiativeRecord } from '../utils/civicLogic';
import { ResilientImage } from '../components/ResilientImage';

interface CommunityPageProps {
  initiatives: CommunityInitiative[];
  registrations: VolunteerRegistration[];
  currentUser: UserAccount | null;
  activeVolunteerEmail: string;
  initialInitiativeId?: string | null;
  onClearInitialInitiative?: () => void;
  onRegisterVolunteer: (initiativeId: string) => { ok: boolean; message: string };
  onCancelRegistration: (initiativeId: string) => { ok: boolean; message: string };
  onNavigate: (route: PageRoute) => void;
}

export const CommunityPage: React.FC<CommunityPageProps> = ({
  initiatives,
  registrations,
  currentUser,
  activeVolunteerEmail,
  initialInitiativeId,
  onClearInitialInitiative,
  onRegisterVolunteer,
  onCancelRegistration,
  onNavigate,
}) => {
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialInitiativeId ?? null,
  );
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

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

  const myInitiativeIds = useMemo(
    () =>
      new Set(
        registrations
          .filter(
            (r) =>
              r.volunteerEmail.toLowerCase() === activeVolunteerEmail.toLowerCase(),
          )
          .map((r) => r.initiativeId),
      ),
    [registrations, activeVolunteerEmail],
  );

  const visibleInitiatives = useMemo(() => {
    return indiaInitiatives.filter((item) => {
      if (tab === 'mine' && !myInitiativeIds.has(item.id)) return false;
      if (stateFilter !== 'All' && item.state !== stateFilter) return false;
      if (cityFilter !== 'All' && item.city !== cityFilter) return false;
      return true;
    });
  }, [indiaInitiatives, tab, myInitiativeIds, stateFilter, cityFilter]);

  const activeDetailId = selectedId ?? initialInitiativeId ?? null;
  const activeDetail = useMemo(
    () => indiaInitiatives.find((i) => i.id === activeDetailId) ?? null,
    [indiaInitiatives, activeDetailId],
  );

  const handleRegister = (initiativeId: string) => {
    const result = onRegisterVolunteer(initiativeId);
    setFeedback(result);
  };

  const handleCancel = (initiativeId: string) => {
    const result = onCancelRegistration(initiativeId);
    setFeedback(result);
  };

  const closeDetail = () => {
    setSelectedId(null);
    onClearInitialInitiative?.();
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
            Collective Civic Action · India Demonstration Data
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
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#B5D8C7] bg-white p-4">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="community-state-filter" className="sr-only">
            Filter initiatives by Indian state
          </label>
          <select
            id="community-state-filter"
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setCityFilter('All');
            }}
            className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A]"
          >
            <option value="All">All Indian States / UTs</option>
            {availableStates.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label htmlFor="community-city-filter" className="sr-only">
            Filter initiatives by Indian city
          </label>
          <select
            id="community-city-filter"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A]"
          >
            <option value="All">All Indian Cities</option>
            {availableCities.map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>
        </div>

        {(stateFilter !== 'All' || cityFilter !== 'All') && (
          <button
            type="button"
            onClick={() => {
              setStateFilter('All');
              setCityFilter('All');
            }}
            className="text-xs font-semibold text-[#254B33] underline decoration-[#5E9185] underline-offset-4"
          >
            Clear filters
          </button>
        )}
      </div>

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
              : 'No initiatives match the selected state or city'}
          </p>
          <p className="text-sm text-[#254B33]">
            {tab === 'mine'
              ? 'Browse open Indian neighbourhood initiatives and reserve a volunteer spot to see them listed here.'
              : 'Reset your state/city filters to inspect all sample activities across India.'}
          </p>
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
            const isCompleted = initiative.status === 'Completed';

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
                          isCompleted ? 'text-[#5E9185]' : 'text-[#254B33]'
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
                        onClick={() => setSelectedId(initiative.id)}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#5E9185] bg-[#F5FAF7] px-4 py-2 text-xs font-semibold text-[#06271A] transition-colors hover:bg-[#B5D8C7]/35"
                      >
                        View Details
                      </button>

                      {!isCompleted &&
                        (isRegistered ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(initiative.id)}
                            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100"
                          >
                            Cancel Registration
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={spotsLeft === 0}
                            onClick={() => handleRegister(initiative.id)}
                            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-[#254B33] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#06271A] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                          >
                            {spotsLeft === 0
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

      {/* Initiative Detail Modal */}
      {activeDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="initiative-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06271A]/55 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#B5D8C7] bg-white p-6 sm:p-8 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-[#B5D8C7]/60 pb-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#5E9185]">
                  {activeDetail.category} · Organized by {activeDetail.organizer}
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

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#B5D8C7]/60 pt-4">
              <button
                type="button"
                onClick={closeDetail}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-[#B5D8C7] px-4 py-2 text-xs font-semibold text-[#254B33] hover:bg-[#F5FAF7]"
              >
                Close
              </button>

              {activeDetail.status === 'Open' &&
                (myInitiativeIds.has(activeDetail.id) ? (
                  <button
                    type="button"
                    onClick={() => handleCancel(activeDetail.id)}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-red-300 bg-red-50 px-5 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
                  >
                    Cancel Registration
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={activeDetail.registeredCount >= activeDetail.capacity}
                    onClick={() => handleRegister(activeDetail.id)}
                    className="inline-flex min-h-[40px] items-center rounded-lg bg-[#254B33] px-5 py-2 text-xs font-semibold text-white hover:bg-[#06271A] disabled:bg-slate-300"
                  >
                    Register as Volunteer
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
