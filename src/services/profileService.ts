import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { UserAccount, UserRole } from '../types/civic';
import { validateLoginForm, validateSignupForm } from '../utils/civicLogic';
import { formatSupabaseError, requireSupabaseClient } from './supabaseClient';

export interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface AuthActionResult {
  ok: boolean;
  user?: UserAccount | null;
  needsEmailVerification?: boolean;
  message?: string;
  error?: string;
}

export function normalizeProfileRole(rawRole?: string | null): UserRole {
  if (rawRole === UserRole.Coordinator) return UserRole.Coordinator;
  if (rawRole === UserRole.Volunteer) return UserRole.Volunteer;
  return UserRole.Citizen;
}

export function mapAuthUserAndProfile(
  authUser: User,
  profile?: ProfileRow | null,
): UserAccount {
  const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const metadataName =
    typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
  const metadataRole =
    typeof metadata.role === 'string' ? metadata.role : undefined;

  // Never elevate to Coordinator from unverified user metadata if profile row is missing
  const safeFallbackRole =
    metadataRole === UserRole.Volunteer ? UserRole.Volunteer : UserRole.Citizen;

  return {
    id: authUser.id,
    fullName:
      profile?.full_name?.trim() ||
      metadataName ||
      authUser.email?.split('@')[0] ||
      'Civilense Member',
    email: authUser.email ?? '',
    role: profile ? normalizeProfileRole(profile.role) : safeFallbackRole,
    createdAt: profile?.created_at ?? authUser.created_at ?? new Date().toISOString(),
    emailVerified: Boolean(authUser.email_confirmed_at),
  };
}

export async function fetchUserProfile(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<ProfileRow | null> {
  const client = requireSupabaseClient(clientOverride);
  const { data, error } = await client
    .from('public_profiles')
    .select('id, full_name, role, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error, 'Unable to load user profile.'));
  }
  return (data as ProfileRow | null) ?? null;
}

export async function getCurrentAuthSession(
  clientOverride?: SupabaseClient | null,
): Promise<{ user: UserAccount | null; error?: string }> {
  try {
    const client = requireSupabaseClient(clientOverride);
    const {
      data: { session },
      error,
    } = await client.auth.getSession();

    if (error) {
      return {
        user: null,
        error: formatSupabaseError(error, 'Unable to verify session.'),
      };
    }

    if (!session?.user) {
      return { user: null };
    }

    const profile = await fetchUserProfile(session.user.id, client).catch(
      () => null,
    );
    return { user: mapAuthUserAndProfile(session.user, profile) };
  } catch (err) {
    return {
      user: null,
      error: formatSupabaseError(err, 'Unable to restore active session.'),
    };
  }
}

export function subscribeToAuthChanges(
  onSessionChange: (user: UserAccount | null, event: AuthChangeEvent) => void,
  clientOverride?: SupabaseClient | null,
): () => void {
  const client = requireSupabaseClient(clientOverride);
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
    if (!session?.user) {
      onSessionChange(null, event);
      return;
    }

    void fetchUserProfile(session.user.id, client)
      .then((profile) => {
        onSessionChange(mapAuthUserAndProfile(session.user, profile), event);
      })
      .catch(() => {
        onSessionChange(mapAuthUserAndProfile(session.user, null), event);
      });
  });

  return () => subscription.unsubscribe();
}

export async function signUpWithSupabase(
  input: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    role?: UserRole;
  },
  clientOverride?: SupabaseClient | null,
): Promise<AuthActionResult> {
  const requestedRole = input.role ?? UserRole.Citizen;
  if (
    requestedRole !== UserRole.Citizen &&
    requestedRole !== UserRole.Volunteer
  ) {
    return {
      ok: false,
      error:
        'Coordinator accounts cannot be created via public sign up. Choose Citizen or Volunteer.',
    };
  }

  const validation = validateSignupForm({
    fullName: input.fullName,
    email: input.email,
    password: input.password,
    confirmPassword: input.confirmPassword,
    role: requestedRole,
  });
  if (!validation.valid) {
    return {
      ok: false,
      error: Object.values(validation.errors)[0] ?? 'Check signup details.',
    };
  }

  try {
    const client = requireSupabaseClient(clientOverride);
    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;

    const { data, error } = await client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: input.fullName.trim(),
          role: requestedRole,
        },
      },
    });

    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(error, 'Account creation failed.'),
      };
    }

    if (!data.user) {
      return {
        ok: false,
        error: 'Account signup did not return a user record.',
      };
    }

    const needsEmailVerification = !data.session;
    const profile = data.session
      ? await fetchUserProfile(data.user.id, client).catch(() => null)
      : null;

    const mappedUser = mapAuthUserAndProfile(data.user, profile);

    return {
      ok: true,
      user: data.session ? mappedUser : null,
      needsEmailVerification,
      message: needsEmailVerification
        ? `Account created for ${mappedUser.email}. Check your inbox to verify your email before signing in.`
        : `Welcome to Civilense, ${mappedUser.fullName} (${mappedUser.role}).`,
    };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to complete sign up.'),
    };
  }
}

export async function signInWithSupabase(
  input: { email: string; password: string },
  clientOverride?: SupabaseClient | null,
): Promise<AuthActionResult> {
  const validation = validateLoginForm(input);
  if (!validation.valid) {
    return {
      ok: false,
      error: Object.values(validation.errors)[0] ?? 'Enter email and password.',
    };
  }

  try {
    const client = requireSupabaseClient(clientOverride);
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });

    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(error, 'Unable to sign in.'),
      };
    }

    if (!data.user) {
      return { ok: false, error: 'Sign in failed: missing user session.' };
    }

    const profile = await fetchUserProfile(data.user.id, client).catch(
      () => null,
    );
    const mappedUser = mapAuthUserAndProfile(data.user, profile);

    return {
      ok: true,
      user: mappedUser,
      message: `Signed in as ${mappedUser.fullName} (${mappedUser.role}).`,
    };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to sign in.'),
    };
  }
}

export async function signOutWithSupabase(
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = requireSupabaseClient(clientOverride);
    const { error } = await client.auth.signOut();
    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(error, 'Unable to sign out cleanly.'),
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to sign out cleanly.'),
    };
  }
}

export async function requestPasswordReset(
  email: string,
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Enter a valid email address first.' };
  }

  try {
    const client = requireSupabaseClient(clientOverride);
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
    const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(error, 'Unable to send password reset email.'),
      };
    }

    return {
      ok: true,
      message: `If an account exists for ${cleanEmail}, a password reset link has been sent.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to send password reset email.'),
    };
  }
}

export async function updatePasswordWithSupabase(
  newPassword: string,
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const trimmed = newPassword;
  if (
    trimmed.length < 8 ||
    !/[A-Za-z]/.test(trimmed) ||
    !/[0-9]/.test(trimmed)
  ) {
    return {
      ok: false,
      error:
        'New password must be at least 8 characters and include both letters and numbers.',
    };
  }

  try {
    const client = requireSupabaseClient(clientOverride);
    const { error } = await client.auth.updateUser({
      password: trimmed,
    });
    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(error, 'Unable to update password.'),
      };
    }

    return {
      ok: true,
      message: 'Your password has been updated. You are now signed in.',
    };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to update password.'),
    };
  }
}

export async function resendVerificationEmail(
  email: string,
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Enter a valid email address first.' };
  }

  try {
    const client = requireSupabaseClient(clientOverride);
    const { error } = await client.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });

    if (error) {
      return {
        ok: false,
        error: formatSupabaseError(
          error,
          'Unable to resend verification email.',
        ),
      };
    }

    return {
      ok: true,
      message: `Verification email requested for ${cleanEmail}. Check your inbox and spam folder.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: formatSupabaseError(err, 'Unable to resend verification email.'),
    };
  }
}
