import React, { useMemo, useState } from 'react';
import { CheckCircle2, Info, RefreshCw } from 'lucide-react';
import {
  CivicIssue,
  CommunityInitiative,
  IssueStatus,
  PageRoute,
} from '../types/civic';
import {
  assertValidIndiaIssueRecord,
  computeDashboardMetrics,
} from '../utils/civicLogic';
import { SEED_BEFORE_AFTER_CASES } from '../data/seedData';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { ResilientImage } from '../components/ResilientImage';
import { StatusBadge } from '../components/StatusBadge';

interface ImpactDashboardPageProps {
  issues: CivicIssue[];
  initiatives: CommunityInitiative[];
  onNavigate: (route: PageRoute) => void;
  onInspectIssue: (issueId: string) => void;
}

const STATUS_BAR_COLORS: Record<IssueStatus, string> = {
  [IssueStatus.Submitted]: '#9CCCCC',
  [IssueStatus.UnderVerification]: '#D97706',
  [IssueStatus.Verified]: '#5E9185',
  [IssueStatus.ActionInProgress]: '#0284C7',
  [IssueStatus.Resolved]: '#254B33',
  [IssueStatus.Recurring]: '#EA580C',
  [IssueStatus.Rejected]: '#64748B',
};

export const ImpactDashboardPage: React.FC<ImpactDashboardPageProps> = ({
  issues,
  initiatives,
  onNavigate,
  onInspectIssue,
}) => {
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [selectedComparisonId, setSelectedComparisonId] = useState(
    SEED_BEFORE_AFTER_CASES[0].id,
  );
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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

  const metrics = useMemo(
    () =>
      computeDashboardMetrics(indiaIssues, initiatives, {
        state: stateFilter,
        city: cityFilter,
      }),
    [indiaIssues, initiatives, stateFilter, cityFilter],
  );

  const activeCase =
    SEED_BEFORE_AFTER_CASES.find((c) => c.id === selectedComparisonId) ??
    SEED_BEFORE_AFTER_CASES[0];

  const recentInterventions = useMemo(
    () =>
      indiaIssues
        .filter((i) => {
          if (stateFilter !== 'All' && i.state !== stateFilter) return false;
          if (cityFilter !== 'All' && i.city !== cityFilter) return false;
          return (
            i.status === IssueStatus.Resolved ||
            i.status === IssueStatus.ActionInProgress ||
            i.status === IssueStatus.Recurring
          );
        })
        .slice(0, 5),
    [indiaIssues, stateFilter, cityFilter],
  );

  const maxCategoryCount = Math.max(
    1,
    ...metrics.categoryDistribution.map((c) => c.count),
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12 space-y-10">
      {/* Header & Demonstration Notice */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
              Measurable Neighbourhood Progress · India
            </p>
            <h1 className="font-display text-3xl font-bold text-[#06271A] sm:text-4xl">
              Community Impact Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-[#254B33]">
              Live summary computed from India-only demonstration records,
              explicitly separating unverified citizen submissions from
              coordinator-verified civic outcomes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('track')}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-[#5E9185] bg-white px-4 py-2 text-xs font-semibold text-[#06271A] hover:bg-[#F5FAF7] whitespace-nowrap self-start sm:self-auto"
          >
            Inspect All Reports
          </button>
        </div>

        {/* Indian State & City Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#B5D8C7] bg-white p-4">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="impact-state-filter"
              className="mb-1 block text-[11px] font-semibold text-[#5E9185]"
            >
              Filter by Indian State / UT
            </label>
            <select
              id="impact-state-filter"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setCityFilter('All');
              }}
              className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A]"
            >
              <option value="All">All India</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="impact-city-filter"
              className="mb-1 block text-[11px] font-semibold text-[#5E9185]"
            >
              Filter by Indian City
            </label>
            <select
              id="impact-city-filter"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3 py-2 text-sm text-[#06271A]"
            >
              <option value="All">All Cities</option>
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
              className="mt-4 text-xs font-semibold text-[#254B33] underline decoration-[#5E9185] underline-offset-4"
            >
              Reset to All India
            </button>
          )}
        </div>

        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-[#9CCCCC] bg-[#F5FAF7] p-4 text-xs leading-relaxed text-[#254B33]"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#254B33]" aria-hidden="true" />
          <p>
            <strong className="text-[#06271A]">
              India Demonstration Data Notice:
            </strong>{' '}
            Figures below combine Indian sample records (Bengaluru, Mysuru, Chennai,
            Hyderabad, Kochi, Pune, New Delhi) with any reports or volunteer
            registrations added in this browser session.{' '}
            <strong className="text-[#06271A]">Submitted Reports</strong> reflect
            raw observations ({metrics.unverifiedSubmittedCount} currently awaiting
            verification), whereas{' '}
            <strong className="text-[#06271A]">Verified Outcomes</strong> reflect
            coordinator-confirmed actions ({metrics.verifiedReports} verified).
          </p>
        </div>
      </div>

      {/* Primary KPI Grid: Submitted vs Verified Distinction */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#B5D8C7] bg-white p-5 space-y-1">
          <p className="text-xs font-medium text-[#5E9185]">
            Total Reports Submitted
          </p>
          <p className="font-display text-3xl font-bold text-[#06271A] tabular-nums">
            {metrics.totalReports}
          </p>
          <p className="text-xs text-[#254B33]/80 tabular-nums">
            Includes {metrics.unverifiedSubmittedCount} unverified{' '}
            {metrics.unverifiedSubmittedCount === 1 ? 'submission' : 'submissions'}
          </p>
        </div>

        <div className="rounded-xl border border-[#5E9185] bg-[#F5FAF7] p-5 space-y-1">
          <p className="text-xs font-medium text-[#254B33]">
            Verified Reports (Confirmed)
          </p>
          <p className="font-display text-3xl font-bold text-[#06271A] tabular-nums">
            {metrics.verifiedReports}
          </p>
          <p className="text-xs text-[#254B33]/85">
            On-site or photographic verification completed
          </p>
        </div>

        <div className="rounded-xl border border-[#254B33] bg-[#254B33] p-5 text-white space-y-1">
          <p className="text-xs font-medium text-[#B5D8C7]">
            Resolved Issues (Verified)
          </p>
          <p className="font-display text-3xl font-bold tabular-nums">
            {metrics.resolvedIssues}
          </p>
          <p className="text-xs text-[#B5D8C7]/90 tabular-nums">
            {metrics.publicSpacesRestored} public spaces approved restored
          </p>
        </div>

        <div className="rounded-xl border border-[#B5D8C7] bg-white p-5 space-y-1">
          <p className="text-xs font-medium text-[#5E9185]">
            Recurring Issues Monitored
          </p>
          <p className="font-display text-3xl font-bold text-[#06271A] tabular-nums">
            {metrics.recurringIssues}
          </p>
          <p className="text-xs text-[#254B33]/80">
            Flagged during post-resolution follow-up checks
          </p>
        </div>
      </div>

      {/* Secondary Community Participation Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#B5D8C7] bg-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#5E9185]">
              Completed Initiatives
            </p>
            <p className="font-display text-2xl font-bold text-[#06271A] tabular-nums">
              {metrics.completedInitiatives}
            </p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-[#254B33]" aria-hidden="true" />
        </div>

        <div className="rounded-xl border border-[#B5D8C7] bg-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#5E9185]">
              Active Volunteer Sign-Ups
            </p>
            <p className="font-display text-2xl font-bold text-[#06271A] tabular-nums">
              {metrics.activeVolunteers}
            </p>
          </div>
          <span className="text-xs font-medium text-[#254B33]">
            Across scoped Indian drives
          </span>
        </div>

        <div className="rounded-xl border border-[#B5D8C7] bg-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#5E9185]">
              Public Spaces Restored
            </p>
            <p className="font-display text-2xl font-bold text-[#06271A] tabular-nums">
              {metrics.publicSpacesRestored}
            </p>
          </div>
          <RefreshCw className="h-5 w-5 text-[#5E9185]" aria-hidden="true" />
        </div>
      </div>

      {/* Distribution Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Distribution Chart */}
        <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-[#06271A]">
              Issue Category Distribution
            </h2>
            <p className="text-xs text-[#254B33]/80">
              Share of submitted Indian civic reports across objective categories
            </p>
          </div>

          <div className="space-y-4">
            {metrics.categoryDistribution.map((row) => {
              const widthPercent = Math.round((row.count / maxCategoryCount) * 100);
              const isHovered = hoveredCategory === row.category;

              return (
                <div
                  key={row.category}
                  onMouseEnter={() => setHoveredCategory(row.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[#06271A]">
                      {row.category}
                    </span>
                    <span className="font-mono-tabular text-[#254B33]">
                      {row.count} ({row.percentage}%)
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded bg-[#F5FAF7] border border-[#B5D8C7]/60">
                    <div
                      className="h-full rounded-r transition-all"
                      style={{
                        width: `${row.count > 0 ? Math.max(8, widthPercent) : 0}%`,
                        backgroundColor: isHovered ? '#06271A' : '#254B33',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-[#06271A]">
              Issue Status Distribution
            </h2>
            <p className="text-xs text-[#254B33]/80">
              Separating pending submissions from verified &amp; resolved outcomes
            </p>
          </div>

          <div
            className="flex h-5 w-full overflow-hidden rounded-lg border border-[#B5D8C7]/70 bg-[#F5FAF7]"
            aria-label="Issue status proportion bar"
          >
            {metrics.statusDistribution
              .filter((s) => s.count > 0)
              .map((item) => (
                <div
                  key={item.status}
                  title={`${item.status}: ${item.count} (${item.percentage}%)`}
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: STATUS_BAR_COLORS[item.status],
                  }}
                />
              ))}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {metrics.statusDistribution.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between rounded-lg border border-[#B5D8C7]/50 bg-[#F8FBF9] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: STATUS_BAR_COLORS[item.status] }}
                  />
                  <span className="font-medium text-[#06271A]">{item.status}</span>
                </div>
                <span className="font-mono-tabular font-semibold text-[#254B33]">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Before-and-After Image Comparison */}
      <div className="rounded-2xl border border-[#B5D8C7] bg-white p-6 sm:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
              Verified Visual Evidence · India
            </p>
            <h2 className="font-display text-2xl font-bold text-[#06271A]">
              Before &amp; After Restoration Comparison
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {SEED_BEFORE_AFTER_CASES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedComparisonId(item.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeCase.id === item.id
                    ? 'border-[#254B33] bg-[#254B33] text-white'
                    : 'border-[#B5D8C7] bg-[#F5FAF7] text-[#254B33] hover:bg-[#B5D8C7]/35'
                }`}
              >
                {item.city}, {item.state}
              </button>
            ))}
          </div>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <BeforeAfterSlider
              beforeUrl={activeCase.beforeImageUrl}
              afterUrl={activeCase.afterImageUrl}
              title={activeCase.title}
              beforeLabel="Before (Reported Condition)"
              afterLabel="After (Verified Restoration)"
            />
          </div>

          <div className="space-y-4 lg:col-span-5">
            <div className="space-y-1">
              <p className="font-mono-tabular text-xs font-semibold text-[#5E9185]">
                {activeCase.issueId} · Completed {activeCase.completedDate}
              </p>
              <h3 className="font-display text-xl font-bold text-[#06271A]">
                {activeCase.title}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-[#254B33]">
              {activeCase.summary}
            </p>
            <div className="rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4 text-xs text-[#254B33] space-y-1">
              <p>
                <strong className="text-[#06271A]">Locality:</strong>{' '}
                {activeCase.locality}, {activeCase.city}, {activeCase.state} —{' '}
                <span className="font-mono-tabular">{activeCase.pin_code}</span>
              </p>
              <p className="tabular-nums">
                <strong className="text-[#06271A]">Volunteers Involved:</strong>{' '}
                {activeCase.volunteersInvolved} community members
              </p>
            </div>
            <button
              type="button"
              onClick={() => onInspectIssue(activeCase.issueId)}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-[#254B33] bg-white px-4 py-2 text-xs font-semibold text-[#254B33] transition-colors hover:bg-[#254B33] hover:text-white"
            >
              Inspect Linked Report Timeline
            </button>
          </div>
        </div>
      </div>

      {/* Locality Summaries & Recent Interventions */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Locality-level summaries */}
        <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-4 lg:col-span-7">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-[#06271A]">
              Indian Locality-Level Improvement Summaries
            </h2>
            <p className="text-xs text-[#254B33]/80">
              Submitted observations vs. verified and resolved rates by locality &amp;
              PIN code
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#B5D8C7] text-[#5E9185]">
                <tr>
                  <th className="py-2.5 pr-3 font-semibold">Locality &amp; City</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Submitted</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Verified</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Resolved</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Recurring</th>
                  <th className="pl-2 py-2.5 text-right font-semibold">
                    Resolution Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B5D8C7]/45">
                {metrics.localitySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#5E9185]">
                      No reports match the selected state/city filter.
                    </td>
                  </tr>
                ) : (
                  metrics.localitySummaries.map((loc) => (
                    <tr
                      key={`${loc.locality}-${loc.pin_code}`}
                      className="text-[#06271A]"
                    >
                      <td className="py-3 pr-3">
                        <span className="block font-medium">{loc.locality}</span>
                        <span className="text-[11px] text-[#5E9185]">
                          {loc.city}, {loc.state} ·{' '}
                          <span className="font-mono-tabular">{loc.pin_code}</span>
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right font-mono-tabular">
                        {loc.submittedCount}
                      </td>
                      <td className="px-2 py-3 text-right font-mono-tabular">
                        {loc.verifiedCount}
                      </td>
                      <td className="px-2 py-3 text-right font-mono-tabular font-semibold text-[#254B33]">
                        {loc.resolvedCount}
                      </td>
                      <td className="px-2 py-3 text-right font-mono-tabular">
                        {loc.recurringCount}
                      </td>
                      <td className="pl-2 py-3 text-right font-mono-tabular font-semibold">
                        {loc.restorationRate}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Interventions */}
        <div className="rounded-xl border border-[#B5D8C7] bg-white p-6 space-y-4 lg:col-span-5">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-[#06271A]">
              Recent Verified Interventions
            </h2>
            <p className="text-xs text-[#254B33]/80">
              Latest Indian reports undergoing action, resolution, or recurrence
              monitoring
            </p>
          </div>

          {recentInterventions.length === 0 ? (
            <p className="text-xs text-[#5E9185]">
              No verified interventions in the selected state/city scope yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#B5D8C7]/50">
              {recentInterventions.map((item) => {
                const thumbUrl =
                  item.resolutionEvidence?.afterImageUrl ?? item.imageUrl;
                return (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {thumbUrl && (
                          <div className="h-11 w-14 shrink-0 overflow-hidden rounded-lg border border-[#B5D8C7] bg-[#F5FAF7]">
                            <ResilientImage
                              src={thumbUrl}
                              alt={`${item.city} civic intervention`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="space-y-1 min-w-0">
                          <p className="font-mono-tabular text-[11px] font-semibold text-[#5E9185]">
                            {item.id} · {item.city}, {item.state}
                          </p>
                          <button
                            type="button"
                            onClick={() => onInspectIssue(item.id)}
                            className="text-left text-sm font-semibold text-[#06271A] hover:underline"
                          >
                            {item.title}
                          </button>
                        </div>
                      </div>
                      <StatusBadge status={item.status} compact />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
