import React, { useState } from 'react';
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { PageRoute, UserAccount, UserRole } from '../types/civic';
import { CivilenseLogo } from './CivilenseLogo';

interface NavbarProps {
  currentRoute: PageRoute;
  onNavigate: (route: PageRoute) => void;
  currentUser: UserAccount | null;
  onLogout: () => void;
}

const BASE_NAV_ITEMS: Array<{ route: PageRoute; label: string }> = [
  { route: 'home', label: 'Home' },
  { route: 'report', label: 'Report Issue' },
  { route: 'track', label: 'Track Issues' },
  { route: 'community', label: 'Community' },
  { route: 'impact', label: 'Impact' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  currentUser,
  onLogout,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isCoordinator = currentUser?.role === UserRole.Coordinator;
  const navItems = isCoordinator
    ? [...BASE_NAV_ITEMS, { route: 'coordinator' as PageRoute, label: 'Coordinator' }]
    : BASE_NAV_ITEMS;

  const handleNavClick = (route: PageRoute) => {
    onNavigate(route);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#B5D8C7]/60 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="inline-flex items-center rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#254B33]"
          aria-label="Civilense Home"
        >
          <CivilenseLogo size="md" />
        </button>

        {/* Zone 2: Concise Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden items-center gap-6 md:flex"
        >
          {navItems.map((item) => {
            const active = currentRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNavClick(item.route)}
                aria-current={active ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#254B33] ${
                  active
                    ? 'text-[#06271A] font-semibold'
                    : 'text-[#254B33]/80 hover:text-[#06271A]'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#254B33]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => handleNavClick(isCoordinator ? 'coordinator' : 'auth')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#B5D8C7] bg-[#F5FAF7] px-3 py-2 text-xs font-medium text-[#06271A] transition-colors hover:bg-[#B5D8C7]/35 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254B33]"
              >
                {isCoordinator && (
                  <ShieldCheck className="h-3.5 w-3.5 text-[#254B33]" aria-hidden="true" />
                )}
                <span>{currentUser.fullName.split(' ')[0]}</span>
                <span aria-hidden="true" className="text-[#5E9185]">
                  ·
                </span>
                <span className="text-[#254B33]">{currentUser.role}</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Log out"
                title="Log out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#B5D8C7] text-[#254B33] transition-colors hover:bg-[#F5FAF7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254B33]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleNavClick('auth')}
              className="hidden rounded-lg bg-[#254B33] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#06271A] whitespace-nowrap shrink-0 md:inline-flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254B33]"
            >
              Login / Get Started
            </button>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#B5D8C7] text-[#06271A] transition-colors hover:bg-[#F5FAF7] md:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-[#B5D8C7]/60 bg-white px-4 py-4 md:hidden">
          <nav aria-label="Mobile Navigation" className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => handleNavClick(item.route)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#B5D8C7]/35 text-[#06271A] font-semibold'
                      : 'text-[#254B33] hover:bg-[#F5FAF7]'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-[#B5D8C7]/50 pt-4">
            {currentUser ? (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleNavClick(isCoordinator ? 'coordinator' : 'auth')}
                  className="text-left text-sm font-medium text-[#06271A]"
                >
                  {currentUser.fullName}{' '}
                  <span className="text-[#5E9185]">· {currentUser.role}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    setMobileOpen(false);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#B5D8C7] px-3.5 py-2 text-sm font-medium text-[#254B33]"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>Log out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleNavClick('auth')}
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#254B33] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#06271A]"
              >
                Login / Get Started
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
