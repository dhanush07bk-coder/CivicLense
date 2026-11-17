import React from 'react';
import { PageRoute } from '../types/civic';
import { CivilenseLogo } from './CivilenseLogo';

interface FooterProps {
  onNavigate: (route: PageRoute) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-[#B5D8C7]/70 bg-[#06271A] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5 space-y-4">
            <CivilenseLogo size="md" inverted />
            <p className="max-w-sm text-sm leading-relaxed text-[#B5D8C7]">
              &ldquo;Don&apos;t just report problems. Be part of the solution.&rdquo;
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-[#9CCCCC]/80">
              Civilense is a community-driven civic improvement platform built to keep
              public spaces clean, accessible, and responsibly maintained without
              surveillance.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-[#9CCCCC] uppercase">
              Platform
            </h3>
            <ul className="space-y-2 text-sm text-[#B5D8C7]">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="transition-colors hover:text-white"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('report')}
                  className="transition-colors hover:text-white"
                >
                  Report an Issue
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('track')}
                  className="transition-colors hover:text-white"
                >
                  Track Issues
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('community')}
                  className="transition-colors hover:text-white"
                >
                  Community Initiatives
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('impact')}
                  className="transition-colors hover:text-white"
                >
                  Impact Dashboard
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-[#9CCCCC] uppercase">
              Civic Standards &amp; Privacy
            </h3>
            <ul className="space-y-2 text-xs leading-relaxed text-[#B5D8C7]/90">
              <li>Reporter identities are never exposed in public tracking views.</li>
              <li>
                Objective, neutral issue categories with verified coordinator follow-up.
              </li>
              <li>
                Electrical and structural hazards are directed to qualified municipal
                authorities.
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('coordinator')}
                  className="underline decoration-[#5E9185] underline-offset-4 transition-colors hover:text-white"
                >
                  Coordinator Portal
                </button>{' '}
                ·{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('auth')}
                  className="underline decoration-[#5E9185] underline-offset-4 transition-colors hover:text-white"
                >
                  Account Access
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[#254B33] pt-6 text-xs text-[#9CCCCC]/80 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Civilense. Version 0 Interactive Prototype.</p>
          <p>
            Sample data stored locally in browser storage · Architecture ready for
            Supabase &amp; OpenStreetMap.
          </p>
        </div>
      </div>
    </footer>
  );
};
