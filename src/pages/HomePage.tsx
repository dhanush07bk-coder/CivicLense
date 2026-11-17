import React from 'react';
import {
  ArrowRight,
  Calendar,
  MapPin,
  Users,
} from 'lucide-react';
import {
  HOME_DEMO_STATS,
  SEED_HERO_IMAGE,
} from '../data/seedData';
import { CommunityInitiative, PageRoute } from '../types/civic';
import { ResilientImage } from '../components/ResilientImage';

interface HomePageProps {
  initiatives: CommunityInitiative[];
  onNavigate: (route: PageRoute) => void;
  onSelectInitiative: (initiativeId: string) => void;
}

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Identify',
    summary:
      'Notice a civic issue in your street, park, or shared public space—from overflowing bins to damaged walkways.',
  },
  {
    number: '02',
    title: 'Report',
    summary:
      'Submit objective details, a location pin, and an optional photo with full privacy or anonymous reporting.',
  },
  {
    number: '03',
    title: 'Act',
    summary:
      'Connect with neighbours and local coordinators to organize cleanups, repairs, or qualified utility escalations.',
  },
  {
    number: '04',
    title: 'Sustain',
    summary:
      'Verify completed work with before-and-after evidence and run follow-up checks to catch recurring issues early.',
  },
];

export const HomePage: React.FC<HomePageProps> = ({
  initiatives,
  onNavigate,
  onSelectInitiative,
}) => {
  const featuredInitiatives = initiatives.filter((i) => i.status === 'Open').slice(0, 3);

  return (
    <div>
      {/* Hero Section */}
      <section className="border-b border-[#B5D8C7]/60 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center space-y-6 lg:col-span-6">
              <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
                Community-Driven Civic Improvement
              </p>

              <h1 className="font-display text-4xl font-bold tracking-tight text-[#06271A] text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
                Better Communities Begin With Us.
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-[#254B33] sm:text-lg">
                Identify civic issues, take collective action and help build
                cleaner, safer and more responsible neighbourhoods.
              </p>

              <p className="text-sm font-medium text-[#06271A]">
                &ldquo;Don&apos;t just report problems. Be part of the solution.&rdquo;
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('report')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#254B33] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06271A] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254B33]"
                >
                  <span>Report an Issue</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('community')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#5E9185] bg-[#F5FAF7] px-5 py-2.5 text-sm font-semibold text-[#254B33] transition-colors hover:bg-[#B5D8C7]/35 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254B33]"
                >
                  <span>Explore Community</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] overflow-hidden rounded-2xl border border-[#B5D8C7] bg-[#F5FAF7] shadow-xs">
                <ResilientImage
                  src={SEED_HERO_IMAGE}
                  alt="Indian residents watering saplings and tending planter beds along a clean, tree-lined Bengaluru residential street"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Demo Impact Statistics Strip */}
          <div className="mt-12 rounded-2xl border border-[#B5D8C7] bg-[#F5FAF7] p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#B5D8C7]/70 pb-3">
              <h2 className="font-display text-sm font-semibold text-[#06271A]">
                Neighbourhood Demonstration Snapshot
              </h2>
              <span className="text-xs text-[#254B33]/80">
                Sample Prototype Data · Updated for Version 0 Preview
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {HOME_DEMO_STATS.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <p className="font-display text-3xl font-bold text-[#06271A] tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-sm font-semibold text-[#254B33]">{stat.label}</p>
                  <p className="text-xs text-[#254B33]/80">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How Civilense Works */}
      <section className="bg-[#9CCCCC]/20 border-b border-[#B5D8C7]/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
              From Observation to Lasting Care
            </p>
            <h2 className="font-display text-2xl font-bold text-[#06271A] sm:text-3xl">
              How Civilense Works
            </h2>
            <p className="text-sm leading-relaxed text-[#254B33] sm:text-base">
              A transparent, four-stage civic workflow that pairs citizen reporting
              with verified community follow-through.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div
                key={step.number}
                className="flex flex-col justify-between rounded-xl border border-[#B5D8C7] bg-white p-6"
              >
                <div className="space-y-3">
                  <span className="font-mono-tabular text-xs font-semibold text-[#5E9185]">
                    {step.number}.
                  </span>
                  <h3 className="font-display text-lg font-bold text-[#06271A]">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#254B33]/90">
                    {step.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Community Activities */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wider text-[#5E9185] uppercase">
                Local Participation
              </p>
              <h2 className="font-display text-2xl font-bold text-[#06271A] sm:text-3xl">
                Recent Community Activities
              </h2>
              <p className="max-w-xl text-sm text-[#254B33]">
                Upcoming neighbourhood cleanups, park restorations, and outreach
                drives open for local volunteers.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('community')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#254B33] underline decoration-[#5E9185] underline-offset-4 transition-colors hover:text-[#06271A] whitespace-nowrap self-start sm:self-auto"
            >
              <span>View all initiatives</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {featuredInitiatives.map((activity) => (
              <article
                key={activity.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[#B5D8C7] bg-[#F8FBF9] transition-colors hover:border-[#5E9185]"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-[#B5D8C7]/60 bg-[#B5D8C7]/25">
                  <ResilientImage
                    src={activity.imageUrl}
                    alt={activity.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[#5E9185]">
                      {activity.category} · {activity.locality}
                    </p>
                    <h3 className="font-display text-lg font-bold text-[#06271A]">
                      {activity.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-[#254B33]/90">
                      {activity.description}
                    </p>
                  </div>

                  <div className="space-y-3 border-t border-[#B5D8C7]/60 pt-4">
                    <div className="space-y-1.5 text-xs text-[#254B33]">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[#5E9185] shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {activity.locality}, {activity.city}, {activity.state} ·{' '}
                          {activity.pin_code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-[#5E9185] shrink-0" aria-hidden="true" />
                        <span>{activity.dateLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-[#5E9185] shrink-0" aria-hidden="true" />
                        <span className="tabular-nums">
                          {activity.registeredCount} of {activity.capacity} volunteers registered
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectInitiative(activity.id);
                        onNavigate('community');
                      }}
                      className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-[#254B33] bg-white px-4 py-2 text-sm font-semibold text-[#254B33] transition-colors hover:bg-[#254B33] hover:text-white"
                    >
                      Join or View Details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Action Strip */}
      <section className="border-t border-[#B5D8C7]/70 bg-[#B5D8C7]/35">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold text-[#06271A]">
              Track Verified Progress Across Wards
            </h2>
            <p className="max-w-xl text-sm text-[#254B33]">
              Follow open civic reports from submission through verification,
              collective action, and post-resolution checks.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('track')}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-[#254B33] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06271A]"
            >
              Track Issues
            </button>
            <button
              type="button"
              onClick={() => onNavigate('impact')}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[#5E9185] bg-white px-5 py-2.5 text-sm font-semibold text-[#06271A] transition-colors hover:bg-[#F5FAF7]"
            >
              View Impact Dashboard
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
