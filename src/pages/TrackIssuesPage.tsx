import React, { useMemo, useState } from 'react';
import {
  Calendar,
  LayoutGrid,
  List,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  CivicIssue,
  IssueCategory,
  IssueStatus,
  PageRoute,
  PublicCivicIssue,
} from '../types/civic';
import {
  assertValidIndiaIssueRecord,
  filterIssues,
  isIssueVerifiedOutcome,
} from '../utils/civicLogic';
import { StatusBadge } from '../components/StatusBadge';
import { ResilientImage } from '../components/ResilientImage';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';

interface TrackIssuesPageProps {
  issues: CivicIssue[];
  initialSelectedId?: string | null;
  onClearInitialSelected?: () => void;
  onNavigate: (route: PageRoute) => void;
}

const ALL_CATEGORIES = Object.values(IssueCategory);
const ALL_STATUSES = Object.values(IssueStatus);

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const TrackIssuesPage: React.FC<TrackIssuesPageProps> = ({
  issues,
  initialSelectedId,
  onClearInitialSelected,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'All'>('All');
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    initialSelectedId ?? null,
  );

  const indiaIssues = useMemo(
    () => issues.filter(assertValidIndiaIssueRecord),
    [issues],
  );

  const availableStates = useMemo(
    () => Array.from(new Set(indiaIssues.map((i) => i.state))).sort(),
    [indiaIssues],
  );

  const availableCities = useMemo(() => {
    const scoped =
      stateFilter === 'All'
        ? indiaIssues
        : indiaIssues.filter((i) => i.state === stateFilter);
    return Array.from(new Set(scoped.map((i) => i.city))).sort();
  }, [indiaIssues, stateFilter]);

  const filteredIssues = useMemo(
    () =>
      filterIssues(indiaIssues, {
        query,
        category: categoryFilter,
        status: statusFilter,
        state: stateFilter,
        city: cityFilter,
      }),
    [indiaIssues, query, categoryFilter, statusFilter, stateFilter, cityFilter],
  );

  const activeIssueId = selectedIssueId ?? initialSelectedId ?? null;
  const activeIssue: PublicCivicIssue | null = useMemo(() => {
    if (!activeIssueId) return null;
    const match = filterIssues(indiaIssues, {
      query: '',
      category: 'All',
      status: 'All',
      state: 'All',
      city: 'All',
    }).find((item) => item.id === activeIssueId);
    return match ?? null;
  }, [indiaIssues, activeIssueId]);

  const closeDetailModal = () => {
    setSelectedIssueId(null);
    onClearInitialSelected?.();
  };

  const hasActiveFilters =
    Boolean(query) ||
    categoryFilter !== 'All' ||
    statusFilter !== 'All' ||
    stateFilter !== 'All' ||
    cityFilter !== 'All';

  const resetFilters = () => {
    setQuery('');
    setCategoryFilter('All');
    setStatusFilter('All');
    setStateFilter('All');
    setCityFilter('All');
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
            Public Transparency Log · India
          </p>
          <h1 className="font-display text-3xl font-bold text-[#06271A] sm:text-4xl">
            Track Civic Issues
          </h1>
          <p className="max-w-2xl text-sm text-[#254B33]">
            Search by Report ID, locality, or PIN code, filter across Indian states
            and cities, and inspect verification timelines. Private reporter details
            are never displayed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('report')}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#254B33] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#06271A] whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          Report New Issue
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 rounded-xl border border-[#B5D8C7] bg-white p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <label htmlFor="track-search" className="sr-only">
              Search by report ID, locality, city, or PIN code
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#5E9185]"
              aria-hidden="true"
            />
            <input
              id="track-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Report ID, locality, or 6-digit PIN"
              className="w-full rounded-lg border border-[#9CCCCC] bg-white py-2.5 pr-3.5 pl-10 text-sm text-[#06271A] placeholder:text-[#5E9185]/80 focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="track-state" className="sr-only">
              Filter by Indian state
            </label>
            <select
              id="track-state"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setCityFilter('All');
              }}
              className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
            >
              <option value="All">All Indian States / UTs</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="track-city" className="sr-only">
              Filter by Indian city
            </label>
            <select
              id="track-city"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
            >
              <option value="All">All Cities</option>
              {availableCities.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>

          {/* Cards vs Table Switch */}
          <div className="flex items-center justify-end gap-1 rounded-lg border border-[#B5D8C7] bg-[#F5FAF7] p-1 md:col-span-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-label="Card view"
              aria-pressed={viewMode === 'cards'}
              className={`flex h-8 w-full items-center justify-center rounded transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-[#06271A] shadow-xs'
                  : 'text-[#5E9185] hover:text-[#06271A]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Table view"
              aria-pressed={viewMode === 'table'}
              className={`flex h-8 w-full items-center justify-center rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-[#06271A] shadow-xs'
                  : 'text-[#5E9185] hover:text-[#06271A]'
              }`}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="track-category" className="sr-only">
              Filter by issue category
            </label>
            <select
              id="track-category"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as IssueCategory | 'All')
              }
              className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
            >
              <option value="All">All Categories</option>
              {ALL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="track-status" className="sr-only">
              Filter by issue status
            </label>
            <select
              id="track-status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as IssueStatus | 'All')
              }
              className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
            >
              <option value="All">All Statuses</option>
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#254B33]/80">
          <span className="tabular-nums">
            Showing <strong className="text-[#06271A]">{filteredIssues.length}</strong>{' '}
            of {indiaIssues.length} India-based civic reports
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-[#254B33] underline decoration-[#5E9185] underline-offset-4 hover:text-[#06271A]"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredIssues.length === 0 ? (
        <div className="rounded-2xl border border-[#B5D8C7] bg-white p-12 text-center space-y-3">
          <p className="font-display text-lg font-bold text-[#06271A]">
            No matching Indian civic reports found
          </p>
          <p className="text-sm text-[#254B33]">
            Try clearing your state, city, or status filter, or submit a new
            observation.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-[#5E9185] bg-[#F5FAF7] px-4 py-2 text-sm font-semibold text-[#254B33]"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredIssues.map((issue) => (
            <article
              key={issue.id}
              className="flex flex-col justify-between rounded-xl border border-[#B5D8C7] bg-white p-5 transition-colors hover:border-[#5E9185]"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-[#5E9185]">
                    <span className="font-mono-tabular font-semibold text-[#06271A]">
                      {issue.id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{issue.category}</span>
                  </div>
                  <StatusBadge status={issue.status} compact />
                </div>

                <h2 className="font-display text-lg font-bold text-[#06271A]">
                  {issue.title}
                </h2>

                <p className="line-clamp-2 text-sm leading-relaxed text-[#254B33]/90">
                  {issue.description}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#B5D8C7]/50 pt-4">
                <div className="space-y-1 text-xs text-[#254B33]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#5E9185]" aria-hidden="true" />
                    <span>
                      {issue.locality}, {issue.city}, {issue.state} ·{' '}
                      <span className="font-mono-tabular">{issue.pin_code}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#5E9185]" aria-hidden="true" />
                    <span className="tabular-nums">
                      Submitted {formatShortDate(issue.submittedAt)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isIssueVerifiedOutcome(issue.status)
                        ? 'Coordinator Verified'
                        : 'Pending Verification'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedIssueId(issue.id)}
                  className="inline-flex min-h-[40px] items-center rounded-lg border border-[#254B33] bg-[#F5FAF7] px-3.5 py-1.5 text-xs font-semibold text-[#254B33] transition-colors hover:bg-[#254B33] hover:text-white whitespace-nowrap"
                >
                  View Timeline
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#B5D8C7] bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-[#B5D8C7] bg-[#F5FAF7] text-xs font-semibold text-[#06271A]">
              <tr>
                <th className="px-4 py-3">Report ID</th>
                <th className="px-4 py-3">Issue &amp; Locality</th>
                <th className="px-4 py-3">City &amp; State</th>
                <th className="px-4 py-3">PIN</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#B5D8C7]/50">
              {filteredIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-[#F8FBF9]">
                  <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-[#06271A] whitespace-nowrap">
                    {issue.id}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#06271A]">{issue.title}</p>
                    <p className="text-xs text-[#254B33]/80">{issue.locality}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#254B33]">
                    {issue.city}, {issue.state}
                  </td>
                  <td className="px-4 py-3 font-mono-tabular text-xs text-[#254B33]">
                    {issue.pin_code}
                  </td>
                  <td className="px-4 py-3 font-mono-tabular text-xs text-[#254B33] whitespace-nowrap">
                    {formatShortDate(issue.submittedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={issue.status} compact />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedIssueId(issue.id)}
                      className="rounded-md border border-[#5E9185] px-3 py-1.5 text-xs font-semibold text-[#254B33] hover:bg-[#254B33] hover:text-white whitespace-nowrap"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report Detail Modal */}
      {activeIssue && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="issue-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06271A]/55 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#B5D8C7] bg-white p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-[#B5D8C7]/60 pb-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono-tabular text-xs font-semibold text-[#5E9185]">
                    {activeIssue.id}
                  </span>
                  <span aria-hidden="true" className="text-[#9CCCCC]">
                    ·
                  </span>
                  <span className="text-xs font-medium text-[#254B33]">
                    {activeIssue.category}
                  </span>
                  <StatusBadge status={activeIssue.status} compact />
                </div>
                <h2
                  id="issue-detail-title"
                  className="font-display text-xl font-bold text-[#06271A] sm:text-2xl"
                >
                  {activeIssue.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDetailModal}
                aria-label="Close report details"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#B5D8C7] text-[#06271A] hover:bg-[#F5FAF7]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[#254B33]">
                {activeIssue.description}
              </p>

              <div className="grid gap-2 rounded-xl border border-[#B5D8C7]/70 bg-[#F5FAF7] px-4 py-3 text-xs text-[#254B33] sm:grid-cols-2">
                <span>
                  <strong className="text-[#06271A]">Locality:</strong>{' '}
                  {activeIssue.locality}
                </span>
                <span>
                  <strong className="text-[#06271A]">City &amp; District:</strong>{' '}
                  {activeIssue.city}, {activeIssue.district}
                </span>
                <span>
                  <strong className="text-[#06271A]">State &amp; PIN:</strong>{' '}
                  {activeIssue.state} —{' '}
                  <span className="font-mono-tabular">{activeIssue.pin_code}</span>{' '}
                  (India)
                </span>
                <span className="tabular-nums">
                  <strong className="text-[#06271A]">Submitted:</strong>{' '}
                  {formatShortDate(activeIssue.submittedAt)}
                </span>
              </div>

              {/* Privacy Notice */}
              <div className="flex items-center gap-2 text-xs text-[#5E9185]">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Privacy protection active: reporter identity and personal contact
                  fields are omitted from public tracking records.
                </span>
              </div>
            </div>

            {/* Uploaded Image or Before/After Resolution Evidence */}
            {activeIssue.resolutionEvidence?.beforeImageUrl &&
            activeIssue.resolutionEvidence?.afterImageUrl ? (
              <div className="space-y-2">
                <h3 className="font-display text-sm font-bold text-[#06271A]">
                  Verified Before &amp; After Resolution Evidence
                </h3>
                <BeforeAfterSlider
                  beforeUrl={activeIssue.resolutionEvidence.beforeImageUrl}
                  afterUrl={activeIssue.resolutionEvidence.afterImageUrl}
                  title={activeIssue.title}
                />
                <p className="text-xs text-[#254B33]">
                  {activeIssue.resolutionEvidence.summary}
                </p>
              </div>
            ) : (
              (activeIssue.resolutionEvidence?.afterImageUrl ||
                activeIssue.imageUrl) && (
                <div className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[#06271A]">
                    {activeIssue.resolutionEvidence?.afterImageUrl
                      ? 'Resolution Evidence Photo'
                      : 'Submitted Site Photo'}
                  </h3>
                  <div className="aspect-[16/9] max-h-72 overflow-hidden rounded-xl border border-[#B5D8C7] bg-[#F5FAF7]">
                    <ResilientImage
                      src={
                        activeIssue.resolutionEvidence?.afterImageUrl ||
                        activeIssue.imageUrl
                      }
                      alt={activeIssue.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {activeIssue.resolutionEvidence?.summary && (
                    <p className="text-xs text-[#254B33]">
                      {activeIssue.resolutionEvidence.summary}
                    </p>
                  )}
                </div>
              )
            )}

            {/* Status Timeline */}
            <div className="space-y-3">
              <h3 className="font-display text-sm font-bold text-[#06271A]">
                Verification &amp; Status Timeline
              </h3>
              <ol className="space-y-3 border-l border-[#B5D8C7] pl-5">
                {activeIssue.timeline.map((entry) => (
                  <li key={entry.id} className="relative space-y-1">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border border-[#254B33] bg-[#B5D8C7]"
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-[#06271A]">
                        {entry.status}
                      </span>
                      <span aria-hidden="true" className="text-[#9CCCCC]">
                        ·
                      </span>
                      <span className="text-[#5E9185]">{entry.actorRole}</span>
                      <span aria-hidden="true" className="text-[#9CCCCC]">
                        ·
                      </span>
                      <span className="font-mono-tabular text-[#254B33]/80">
                        {formatShortDate(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-[#254B33]">{entry.note}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Follow-up Checks */}
            {activeIssue.followUpChecks.length > 0 && (
              <div className="space-y-2 rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4">
                <h3 className="font-display text-sm font-bold text-[#06271A]">
                  Sustained Follow-Up Checks
                </h3>
                <ul className="space-y-2 text-xs text-[#254B33]">
                  {activeIssue.followUpChecks.map((check) => (
                    <li key={check.id}>
                      <span className="font-semibold text-[#06271A]">
                        {check.outcome}
                      </span>{' '}
                      <span className="font-mono-tabular text-[#5E9185]">
                        ({formatShortDate(check.checkedAt)})
                      </span>
                      : {check.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
