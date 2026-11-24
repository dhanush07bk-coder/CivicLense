import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Info,
  KeyRound,
  LogOut,
  MailCheck,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { PageRoute, UserAccount, UserRole } from '../types/civic';
import { DEMO_ACCOUNTS } from '../data/seedData';
import {
  authenticateDemoUser,
  validateLoginForm,
  validateSignupForm,
} from '../utils/civicLogic';
import {
  requestPasswordReset,
  resendVerificationEmail,
  signInWithSupabase,
  signUpWithSupabase,
  updatePasswordWithSupabase,
} from '../services/profileService';
import { CivilenseLogo } from '../components/CivilenseLogo';

interface AuthPageProps {
  currentUser: UserAccount | null;
  users: UserAccount[];
  isSupabaseMode?: boolean;
  passwordRecoveryMode?: boolean;
  onPasswordRecovered?: () => void;
  onLogin: (user: UserAccount) => void;
  onSignup: (user: UserAccount) => void;
  onLogout: () => void | Promise<void>;
  onNavigate: (route: PageRoute) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  currentUser,
  users,
  isSupabaseMode = false,
  passwordRecoveryMode = false,
  onPasswordRecovered,
  onLogin,
  onSignup,
  onLogout,
  onNavigate,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

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
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [updatingRecoveryPassword, setUpdatingRecoveryPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setUnverifiedEmail(null);

    const validation = validateLoginForm({
      email: loginEmail,
      password: loginPassword,
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    if (isSupabaseMode) {
      setSubmitting(true);
      const authResult = await signInWithSupabase({
        email: loginEmail,
        password: loginPassword,
      });
      setSubmitting(false);

      if (authResult.ok && authResult.user) {
        onLogin(authResult.user);
        setErrors({});
        setStatusMessage({
          type: 'success',
          text:
            authResult.message ??
            `Signed in as ${authResult.user.fullName} (${authResult.user.role}).`,
        });
        return;
      }

      const errorText = authResult.error ?? 'Unable to sign in with these credentials.';
      if (/confirm|verif/i.test(errorText)) {
        setUnverifiedEmail(loginEmail.trim().toLowerCase());
      }
      setErrors({});
      setStatusMessage({
        type: 'error',
        text: errorText,
      });
      return;
    }

    const authResult = authenticateDemoUser(users, loginEmail, loginPassword);
    if (authResult.ok && authResult.user) {
      onLogin(authResult.user);
      setErrors({});
      setStatusMessage({
        type: 'success',
        text: `Signed in to local demonstration profile: ${authResult.user.fullName} (${authResult.user.role}).`,
      });
      return;
    }

    setErrors({});
    setStatusMessage({
      type: 'error',
      text:
        authResult.error ??
        'Invalid email or password for local demonstration accounts.',
    });
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setUnverifiedEmail(null);

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

    if (isSupabaseMode) {
      setSubmitting(true);
      const result = await signUpWithSupabase({
        fullName,
        email: signupEmail,
        password: signupPassword,
        confirmPassword,
        role,
      });
      setSubmitting(false);

      if (!result.ok) {
        setStatusMessage({
          type: 'error',
          text: result.error ?? 'Unable to create account.',
        });
        return;
      }

      setErrors({});
      if (result.needsEmailVerification) {
        const normalized = signupEmail.trim().toLowerCase();
        setUnverifiedEmail(normalized);
        setStatusMessage({
          type: 'info',
          text:
            result.message ??
            `Account created for ${normalized}. Check your email inbox to confirm your address before signing in.`,
        });
        return;
      }

      if (result.user) {
        onSignup(result.user);
        setStatusMessage({
          type: 'success',
          text:
            result.message ??
            `Welcome to Civilense, ${result.user.fullName} (${result.user.role}).`,
        });
      }
      return;
    }

    const normalizedEmail = signupEmail.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      setErrors({ email: 'A local demonstration profile with this email already exists.' });
      return;
    }

    const createdUser: UserAccount = {
      id: `usr-${Date.now()}`,
      fullName: fullName.trim(),
      email: normalizedEmail,
      role,
      createdAt: new Date().toISOString(),
      demoPassword: signupPassword,
    };

    onSignup(createdUser);
    setErrors({});
    setStatusMessage({
      type: 'success',
      text: `Local demonstration profile created for ${createdUser.fullName} (${createdUser.role}).`,
    });
  };

  const handlePasswordReset = async () => {
    if (!isSupabaseMode || resettingPassword) return;
    setStatusMessage(null);
    setResettingPassword(true);
    const res = await requestPasswordReset(loginEmail);
    setResettingPassword(false);

    if (!res.ok) {
      setErrors((prev) => ({
        ...prev,
        email: res.error ?? 'Enter a valid email address first.',
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, email: '' }));
    setStatusMessage({
      type: 'info',
      text:
        res.message ??
        'If an account matches this email, a password reset link has been sent.',
    });
  };

  const handleResendVerification = async () => {
    if (!isSupabaseMode || !unverifiedEmail || resendingEmail) return;
    setResendingEmail(true);
    const res = await resendVerificationEmail(unverifiedEmail);
    setResendingEmail(false);

    setStatusMessage({
      type: res.ok ? 'info' : 'error',
      text: res.ok
        ? (res.message ?? `Verification email sent to ${unverifiedEmail}.`)
        : (res.error ?? 'Unable to resend verification email.'),
    });
  };

  const handlePrefillDemoCredentials = (demoEmail: string) => {
    const account = DEMO_ACCOUNTS.find((a) => a.email === demoEmail);
    if (!account) return;
    setMode('login');
    setLoginEmail(account.email);
    setLoginPassword(account.passwordHint);
    setErrors({});
    setStatusMessage({
      type: 'info',
      text: `Prefilled demo credentials for ${account.fullName} (${account.role}). Click "Sign In" to verify and enter.`,
    });
  };

  const handleCompletePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseMode || updatingRecoveryPassword) return;
    setStatusMessage(null);
    if (recoveryPassword !== recoveryConfirm) {
      setStatusMessage({
        type: 'error',
        text: 'Passwords do not match. Re-enter the same password in both fields.',
      });
      return;
    }

    setUpdatingRecoveryPassword(true);
    const res = await updatePasswordWithSupabase(recoveryPassword);
    setUpdatingRecoveryPassword(false);

    if (!res.ok) {
      setStatusMessage({
        type: 'error',
        text: res.error ?? 'Unable to update password.',
      });
      return;
    }

    setRecoveryPassword('');
    setRecoveryConfirm('');
    setStatusMessage({
      type: 'success',
      text: res.message ?? 'Password updated successfully.',
    });
    onPasswordRecovered?.();
  };

  if (isSupabaseMode && passwordRecoveryMode) {
    return (
      <section className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-[#B5D8C7] bg-white p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <CivilenseLogo size="md" />
            <h1 className="font-display text-2xl font-bold text-[#06271A]">
              Set Your New Password
            </h1>
            <p className="text-xs text-[#254B33]">
              Complete your password recovery by choosing a strong new password (at
              least 8 characters with letters and numbers).
            </p>
          </div>

          {statusMessage && (
            <div
              role={statusMessage.type === 'error' ? 'alert' : 'status'}
              className={`rounded-xl border px-4 py-3 text-xs font-medium ${
                statusMessage.type === 'error'
                  ? 'border-red-300 bg-red-50 text-red-900'
                  : 'border-[#5E9185] bg-[#B5D8C7]/35 text-[#06271A]'
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          <form
            onSubmit={(e) => void handleCompletePasswordRecovery(e)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="recovery-password"
                className="block text-sm font-semibold text-[#06271A]"
              >
                New Password
              </label>
              <input
                id="recovery-password"
                type="password"
                value={recoveryPassword}
                onChange={(e) => setRecoveryPassword(e.target.value)}
                placeholder="Min 8 characters (letters + numbers)"
                className="w-full rounded-lg border border-[#9CCCCC] px-3.5 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="recovery-confirm"
                className="block text-sm font-semibold text-[#06271A]"
              >
                Confirm New Password
              </label>
              <input
                id="recovery-confirm"
                type="password"
                value={recoveryConfirm}
                onChange={(e) => setRecoveryConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full rounded-lg border border-[#9CCCCC] px-3.5 py-2.5 text-sm text-[#06271A] focus:border-[#254B33] focus:outline-none focus:ring-2 focus:ring-[#B5D8C7]"
              />
            </div>

            <button
              type="submit"
              disabled={updatingRecoveryPassword}
              className="min-h-[44px] w-full rounded-lg bg-[#254B33] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#06271A] disabled:opacity-60"
            >
              {updatingRecoveryPassword ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </section>
    );
  }

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
              <span>
                {isSupabaseMode
                  ? currentUser.role
                  : `${currentUser.role} (Demo)`}
              </span>
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

          {isSupabaseMode ? (
            <div className="rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4 text-xs leading-relaxed text-[#254B33] space-y-1">
              <p>
                <strong className="text-[#06271A]">Authenticated Account:</strong>{' '}
                Your session is verified with role{' '}
                <strong className="text-[#06271A]">{currentUser.role}</strong>.
              </p>
              <p>
                Email status:{' '}
                <strong className="text-[#06271A]">
                  {currentUser.emailVerified
                    ? 'Verified'
                    : 'Verification pending'}
                </strong>
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4 text-xs leading-relaxed text-[#254B33]">
              <strong className="text-[#06271A]">Demonstration-Only Session:</strong>{' '}
              You are signed into a local browser-storage demo profile. This is not
              production authentication; configure Supabase environment variables
              to enable server-verified{' '}
              <strong className="text-[#06271A]">Supabase Auth</strong>.
            </div>
          )}

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
              onClick={() => void onLogout()}
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
            {isSupabaseMode
              ? 'Sign in or create a Citizen or Volunteer account to submit civic reports, join local initiatives, and track verified improvements.'
              : 'Local demonstration access to test citizen reporting, volunteer registration, and coordinator verification workflows.'}
          </p>
        </div>

        {!isSupabaseMode && (
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-xl border border-[#9CCCCC] bg-[#F5FAF7] p-3.5 text-xs leading-relaxed text-[#254B33]"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#254B33]" aria-hidden="true" />
            <p>
              <strong className="text-[#06271A]">
                Demonstration-Only Local Authentication:
              </strong>{' '}
              Supabase environment variables are not configured in this preview, so
              accounts here use browser <code>localStorage</code> for prototype
              testing. Do not reuse real passwords.
            </p>
          </div>
        )}

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
            {isSupabaseMode ? 'Sign In' : 'Demo Login'}
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
            {isSupabaseMode ? 'Create Account' : 'Create Demo Profile'}
          </button>
        </div>

        {statusMessage && (
          <div
            role={statusMessage.type === 'error' ? 'alert' : 'status'}
            className={`rounded-xl border px-4 py-3 text-xs font-medium space-y-2 ${
              statusMessage.type === 'success'
                ? 'border-[#5E9185] bg-[#B5D8C7]/35 text-[#06271A]'
                : statusMessage.type === 'info'
                  ? 'border-[#9CCCCC] bg-[#F5FAF7] text-[#254B33]'
                  : 'border-red-300 bg-red-50 text-red-900'
            }`}
          >
            <p>{statusMessage.text}</p>
            {isSupabaseMode && unverifiedEmail && (
              <button
                type="button"
                disabled={resendingEmail}
                onClick={() => void handleResendVerification()}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#5E9185] bg-white px-2.5 py-1 text-xs font-semibold text-[#06271A] hover:bg-[#F5FAF7] disabled:opacity-60"
              >
                <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {resendingEmail
                    ? 'Sending verification email...'
                    : 'Resend verification email'}
                </span>
              </button>
            )}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={(e) => void handleLoginSubmit(e)} noValidate className="space-y-4">
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
                placeholder="citizen@civilense.in"
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
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-semibold text-[#06271A]"
                >
                  Password
                </label>
                {isSupabaseMode && (
                  <button
                    type="button"
                    disabled={resettingPassword}
                    onClick={() => void handlePasswordReset()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#254B33] hover:text-[#06271A] hover:underline disabled:opacity-60"
                  >
                    <KeyRound className="h-3 w-3" aria-hidden="true" />
                    <span>
                      {resettingPassword ? 'Sending reset...' : 'Forgot password?'}
                    </span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  placeholder={
                    isSupabaseMode
                      ? 'Enter your password'
                      : 'Enter your demo password'
                  }
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
              disabled={submitting}
              className="min-h-[44px] w-full rounded-lg bg-[#254B33] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06271A] disabled:opacity-60"
            >
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleSignupSubmit(e)} noValidate className="space-y-4">
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
                placeholder="e.g., Ananya Rao"
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
                placeholder="ananya@civilense.in"
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
              {isSupabaseMode && (
                <p className="text-[11px] text-[#5E9185]">
                  Coordinator roles are assigned only by platform administrators
                  for verification integrity.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-password"
                className="block text-sm font-semibold text-[#06271A]"
              >
                {isSupabaseMode ? 'Password' : 'Demo Password'}
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
                  placeholder="Min 8 characters (letters + numbers)"
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
                {isSupabaseMode ? 'Confirm Password' : 'Confirm Demo Password'}
              </label>
              <input
                id="signup-confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder={
                  isSupabaseMode
                    ? 'Re-enter your password'
                    : 'Re-enter your demo password'
                }
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
              disabled={submitting}
              className="min-h-[44px] w-full rounded-lg bg-[#254B33] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06271A] disabled:opacity-60"
            >
              {submitting
                ? 'Creating Account...'
                : isSupabaseMode
                  ? 'Create Account'
                  : 'Create Local Demo Profile'}
            </button>
          </form>
        )}

        {/* Quick Demo Credentials Prefill (Only shown in Local Prototype Mode) */}
        {!isSupabaseMode && (
          <div className="border-t border-[#B5D8C7]/70 pt-5 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#06271A]">
                Demo Account Credentials (Local Prototype Only)
              </p>
              <p className="text-xs text-[#254B33]/80">
                Click a demo role to fill its test email and password into the login
                form, then submit &ldquo;Sign In&rdquo; to verify:
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => handlePrefillDemoCredentials(demo.email)}
                  className="rounded-lg border border-[#9CCCCC] bg-[#F5FAF7] px-3 py-2 text-left transition-colors hover:border-[#254B33] hover:bg-[#B5D8C7]/35"
                >
                  <span className="block text-xs font-bold text-[#06271A]">
                    Fill {demo.role}
                  </span>
                  <span className="block truncate text-[11px] text-[#254B33]">
                    {demo.fullName}
                  </span>
                  <span className="font-mono-tabular block truncate text-[10px] text-[#5E9185]">
                    pw: {demo.passwordHint}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
