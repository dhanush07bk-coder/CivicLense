import React, { useState } from 'react';
import { Eye, EyeOff, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { PageRoute, UserAccount, UserRole } from '../types/civic';
import { DEMO_ACCOUNTS } from '../data/seedData';
import { validateLoginForm, validateSignupForm } from '../utils/civicLogic';
import { CivilenseLogo } from '../components/CivilenseLogo';

interface AuthPageProps {
  currentUser: UserAccount | null;
  users: UserAccount[];
  onLogin: (user: UserAccount) => void;
  onSignup: (user: UserAccount) => void;
  onLogout: () => void;
  onNavigate: (route: PageRoute) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  currentUser,
  users,
  onLogin,
  onSignup,
  onLogout,
  onNavigate,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole.Citizen | UserRole.Volunteer>(
    UserRole.Citizen,
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const validation = validateLoginForm({
      email: loginEmail,
      password: loginPassword,
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const normalizedEmail = loginEmail.trim().toLowerCase();
    const matchedUser = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail,
    );

    if (matchedUser) {
      onLogin(matchedUser);
      setErrors({});
      setStatusMessage({
        type: 'success',
        text: `Signed in as ${matchedUser.fullName} (${matchedUser.role}).`,
      });
      return;
    }

    // Prototype fallback: allow demo sign-in notice if unregistered email
    setErrors({});
    setStatusMessage({
      type: 'error',
      text: 'No local demo account found for that email. Create an account on the Sign Up tab or use one of the Demo Access buttons below.',
    });
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const validation = validateSignupForm({
      fullName,
      email: signupEmail,
      password: signupPassword,
      confirmPassword,
      role,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const normalizedEmail = signupEmail.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      setErrors({ email: 'An account with this email already exists.' });
      return;
    }

    const createdUser: UserAccount = {
      id: `usr-${Date.now()}`,
      fullName: fullName.trim(),
      email: normalizedEmail,
      role,
      createdAt: new Date().toISOString(),
    };

    onSignup(createdUser);
    setErrors({});
    setStatusMessage({
      type: 'success',
      text: `Account created for ${createdUser.fullName} (${createdUser.role}).`,
    });
  };

  const handleQuickDemoLogin = (demoEmail: string) => {
    const account = DEMO_ACCOUNTS.find((a) => a.email === demoEmail);
    if (!account) return;
    const { passwordHint: _ignored, ...cleanUser } = account;
    onLogin(cleanUser);
    setErrors({});
    setStatusMessage({
      type: 'success',
      text: `Signed in with demo ${cleanUser.role} account.`,
    });
  };

  if (currentUser) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-[#B5D8C7] bg-white p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-[#B5D8C7]/60 pb-4">
            <CivilenseLogo size="md" />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#5E9185] bg-[#F5FAF7] px-3 py-1 text-xs font-semibold text-[#06271A]">
              {currentUser.role === UserRole.Coordinator ? (
                <ShieldCheck className="h-3.5 w-3.5 text-[#254B33]" aria-hidden="true" />
              ) : (
                <UserCheck className="h-3.5 w-3.5 text-[#254B33]" aria-hidden="true" />
              )}
              <span>{currentUser.role}</span>
            </span>
          </div>

          {statusMessage && (
            <div
              role="status"
              className="rounded-xl border border-[#5E9185] bg-[#B5D8C7]/30 px-4 py-3 text-sm font-medium text-[#06271A]"
            >
              {statusMessage.text}
            </div>
          )}

          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-[#06271A]">
              Welcome, {currentUser.fullName}
            </h1>
            <p className="text-sm text-[#254B33]">{currentUser.email}</p>
          </div>

          <div className="rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4 text-xs leading-relaxed text-[#254B33]">
            Signed in locally for Version 0 demonstration. Session state persists in
            browser storage and is structured for drop-in{' '}
            <strong className="text-[#06271A]">Supabase Auth</strong> integration.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentUser.role === UserRole.Coordinator && (
              <button
                type="button"
                onClick={() => onNavigate('coordinator')}
                className="inline-flex min-h-[44px] items-center rounded-lg bg-[#254B33] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#06271A]"
              >
                Open Coordinator Dashboard
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('community')}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[#5E9185] bg-white px-5 py-2.5 text-sm font-semibold text-[#06271A] hover:bg-[#F5FAF7]"
            >
              Explore Community
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-[#B5D8C7] bg-white p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <CivilenseLogo size="lg" />
          <p className="text-sm text-[#254B33]">
            Participate in community cleanups, track local improvements, or verify
            civic reports.
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrors({});
              setStatusMessage(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === 'login'
                ? 'bg-white text-[#06271A] shadow-xs'
                : 'text-[#254B33] hover:text-[#06271A]'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrors({});
              setStatusMessage(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === 'signup'
                ? 'bg-white text-[#06271A] shadow-xs'
                : 'text-[#254B33] hover:text-[#06271A]'
            }`}
          >
            Sign Up
          </button>
        </div>

        {statusMessage && (
          <div
            role="alert"
            className={`rounded-xl border px-4 py-3 text-xs font-medium ${
              statusMessage.type === 'success'
                ? 'border-[#5E9185] bg-[#B5D8C7]/35 text-[#06271A]'
                : 'border-red-300 bg-red-50 text-red-900'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="you@example.org"
                aria-invalid={Boolean(errors.email)}
                className="w-full rounded-lg border border-[#9CCCCC] px-3.5 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
              />
              {errors.email && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  placeholder="Enter your password"
                  aria-invalid={Boolean(errors.password)}
                  className="w-full rounded-lg border border-[#9CCCCC] py-2.5 pr-11 pl-3.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1.5 text-[#5E9185] hover:text-[#06271A]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="min-h-[44px] w-full rounded-lg bg-[#254B33] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06271A]"
            >
              Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="signup-name"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                placeholder="e.g., Maya Lin"
                aria-invalid={Boolean(errors.fullName)}
                className="w-full rounded-lg border border-[#9CCCCC] px-3.5 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
              />
              {errors.fullName && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-email"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={signupEmail}
                onChange={(e) => {
                  setSignupEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="maya@example.org"
                aria-invalid={Boolean(errors.email)}
                className="w-full rounded-lg border border-[#9CCCCC] px-3.5 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
              />
              {errors.email && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-role"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Role
              </label>
              <select
                id="signup-role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as UserRole.Citizen | UserRole.Volunteer)
                }
                className="w-full rounded-lg border border-[#9CCCCC] bg-white px-3.5 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
              >
                <option value={UserRole.Citizen}>Citizen</option>
                <option value={UserRole.Volunteer}>Volunteer</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-password"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={signupPassword}
                  onChange={(e) => {
                    setSignupPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  placeholder="Minimum 8 characters"
                  aria-invalid={Boolean(errors.password)}
                  className="w-full rounded-lg border border-[#9CCCCC] py-2.5 pr-11 pl-3.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1.5 text-[#5E9185] hover:text-[#06271A]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-confirm"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Confirm Password
              </label>
              <input
                id="signup-confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder="Re-enter your password"
                aria-invalid={Boolean(errors.confirmPassword)}
                className="w-full rounded-lg border border-[#9CCCCC] px-3.5 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
              />
              {errors.confirmPassword && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="min-h-[44px] w-full rounded-lg bg-[#254B33] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06271A]"
            >
              Create Account
            </button>
          </form>
        )}

        {/* Quick Demo Roles */}
        <div className="border-t border-[#B5D8C7]/70 pt-5 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#06271A]">
              Version 0 Prototype Quick Access
            </p>
            <p className="text-xs text-[#254B33]/80">
              Local mock authentication (ready for Supabase Auth). Select a demo role
              to test workflows immediately:
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => handleQuickDemoLogin(demo.email)}
                className="rounded-lg border border-[#9CCCCC] bg-[#F5FAF7] px-3 py-2 text-left transition-colors hover:border-[#254B33] hover:bg-[#B5D8C7]/35"
              >
                <span className="block text-xs font-bold text-[#06271A]">
                  Demo {demo.role}
                </span>
                <span className="block truncate text-[11px] text-[#254B33]">
                  {demo.fullName}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
