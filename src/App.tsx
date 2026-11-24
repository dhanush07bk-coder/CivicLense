import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, X } from 'lucide-react';
import {
  CivicIssue,
  CommunityInitiative,
  IssueStatus,
  PageRoute,
  UserAccount,
  UserRole,
  VolunteerRegistration,
} from './types/civic';
import {
  SEED_INITIATIVES,
  SEED_ISSUES,
  SEED_REGISTRATIONS,
  SEED_USERS,
} from './data/seedData';
import { civicStorage, StorageWriteResult } from './services/storageService';
import { isSupabaseConfigured } from './services/supabaseClient';
import {
  getCurrentAuthSession,
  signOutWithSupabase,
  subscribeToAuthChanges,
} from './services/profileService';
import {
  createIssueFollowupInSupabase,
  fetchPublicReportsFromSupabase,
  reviewPendingEvidenceInSupabase,
  submitReportToSupabase,
  submitVolunteerEvidenceInSupabase,
  updateReportStatusInSupabase,
} from './services/reportService';
import {
  cancelVolunteerInSupabase,
  fetchInitiativesFromSupabase,
  markVolunteerAttendanceInSupabase,
  registerVolunteerInSupabase,
  saveInitiativeInSupabase,
} from './services/initiativeService';
import {
  applyIssueStatusUpdate,
  cancelVolunteerRegistration,
  createCivicIssueRecord,
  IssueSubmissionInput,
  registerVolunteerForInitiative,
  syncInitiativeRegistrationCounts,
} from './utils/civicLogic';
import { buildRouteUrl, parseBrowserLocation } from './utils/router';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ReportIssuePage } from './pages/ReportIssuePage';
import { TrackIssuesPage } from './pages/TrackIssuesPage';
import { CommunityPage } from './pages/CommunityPage';
import { ImpactDashboardPage } from './pages/ImpactDashboardPage';
import { AuthPage } from './pages/AuthPage';
import { CoordinatorDashboardPage } from './pages/CoordinatorDashboardPage';

export default function App() {
  const [initialLoc] = useState(() =>
    typeof window !== 'undefined'
      ? parseBrowserLocation(window.location.pathname, window.location.search)
      : { route: 'home' as PageRoute, trackIssueId: null, initiativeId: null },
  );

  const [route, setRoute] = useState<PageRoute>(initialLoc.route);
  const [trackedIssueId, setTrackedIssueId] = useState<string | null>(
    initialLoc.trackIssueId,
  );
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(
    initialLoc.initiativeId,
  );

  // In Supabase mode we load strictly from PostgreSQL; in unconfigured preview we use localStorage demo fallback
  const [registrations, setRegistrations] = useState<VolunteerRegistration[]>(() =>
    isSupabaseConfigured ? [] : civicStorage.loadRegistrations(),
  );
  const [issues, setIssues] = useState<CivicIssue[]>(() =>
    isSupabaseConfigured ? [] : civicStorage.loadIssues(),
  );
  const [initiatives, setInitiatives] = useState<CommunityInitiative[]>(() =>
    isSupabaseConfigured ? [] : civicStorage.loadInitiatives(),
  );
  const [users, setUsers] = useState<UserAccount[]>(() =>
    isSupabaseConfigured ? [] : civicStorage.loadUsers(),
  );
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    isSupabaseConfigured ? null : civicStorage.loadCurrentUser(),
  );

  const [backendLoading, setBackendLoading] = useState<boolean>(
    isSupabaseConfigured,
  );
  const [backendError, setBackendError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);

  const checkStorageWrite = useCallback((result: StorageWriteResult) => {
    if (!result.ok && result.error) {
      setStorageError(result.error);
    }
  }, []);

  // Persist localStorage ONLY in Demo fallback mode (never overwrite or migrate when Supabase is active)
  useEffect(() => {
    if (isSupabaseConfigured) return;
    checkStorageWrite(civicStorage.saveIssues(issues));
  }, [issues, checkStorageWrite]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    checkStorageWrite(civicStorage.saveInitiatives(initiatives));
  }, [initiatives, checkStorageWrite]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    checkStorageWrite(civicStorage.saveRegistrations(registrations));
  }, [registrations, checkStorageWrite]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    checkStorageWrite(civicStorage.saveUsers(users));
  }, [users, checkStorageWrite]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    checkStorageWrite(civicStorage.saveCurrentUser(currentUser));
  }, [currentUser, checkStorageWrite]);

  const refreshSupabaseData = useCallback(
    async (userOverride?: UserAccount | null) => {
      if (!isSupabaseConfigured) return;
      setBackendLoading(true);
      setBackendError(null);

      try {
        const activeUser =
          userOverride !== undefined ? userOverride : currentUser;
        const reportsRes = await fetchPublicReportsFromSupabase(undefined, {
          includePendingEvidence: activeUser?.role === UserRole.Coordinator,
        });
        if (!reportsRes.ok) {
          setBackendError(
            reportsRes.error ?? 'Unable to load civic reports from Supabase.',
          );
          setBackendLoading(false);
          return;
        }
        setIssues(reportsRes.issues);

        const initRes = await fetchInitiativesFromSupabase(
          activeUser,
          reportsRes.issues,
        );
        if (!initRes.ok) {
          setBackendError(
            initRes.error ?? 'Unable to load community initiatives from Supabase.',
          );
        } else {
          setInitiatives(initRes.initiatives);
          setRegistrations(initRes.registrations);
        }
      } finally {
        setBackendLoading(false);
      }
    },
    [currentUser],
  );

  // Hydrate Supabase Auth session and live data on boot
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;
    void (async () => {
      const sessionRes = await getCurrentAuthSession();
      if (!mounted) return;
      if (sessionRes.error) {
        setBackendError(sessionRes.error);
      }
      setCurrentUser(sessionRes.user);
      await refreshSupabaseData(sessionRes.user);
    })();

    const unsubscribe = subscribeToAuthChanges((nextUser, event) => {
      if (!mounted) return;
      setCurrentUser(nextUser);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryMode(true);
        setRoute('auth');
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/auth');
        }
      }
      void refreshSupabaseData(nextUser);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Keep browser Back / Forward buttons in sync with active route & modal query params
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseBrowserLocation(
        window.location.pathname,
        window.location.search,
      );
      setRoute(parsed.route);
      setTrackedIssueId(parsed.trackIssueId);
      setSelectedInitiativeId(parsed.initiativeId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback(
    (
      nextRoute: PageRoute,
      options?: { id?: string | null; replace?: boolean; preserveScroll?: boolean },
    ) => {
      const nextUrl = buildRouteUrl(nextRoute, { id: options?.id });
      if (typeof window !== 'undefined') {
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== nextUrl) {
          if (options?.replace) {
            window.history.replaceState(null, '', nextUrl);
          } else {
            window.history.pushState(null, '', nextUrl);
          }
        }
      }

      setRoute(nextRoute);
      setTrackedIssueId(nextRoute === 'track' ? (options?.id ?? null) : null);
      setSelectedInitiativeId(
        nextRoute === 'community' ? (options?.id ?? null) : null,
      );

      if (!options?.preserveScroll && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [],
  );

  const handleSubmitIssue = async (
    input: IssueSubmissionInput,
    options?: { imageFile?: File | null },
  ): Promise<{ ok: boolean; issue?: CivicIssue; error?: string }> => {
    if (isSupabaseConfigured) {
      const res = await submitReportToSupabase(input, options?.imageFile);
      if (res.ok && res.issue) {
        setIssues((prev) => [res.issue!, ...prev]);
      }
      return res;
    }

    try {
      const newRecord = createCivicIssueRecord(
        input,
        issues.map((i) => i.id),
      );
      setIssues((prev) => [newRecord, ...prev]);
      return { ok: true, issue: newRecord };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to validate India location details.',
      };
    }
  };

  const handleTrackReport = (reportId: string) => {
    navigateTo('track', { id: reportId });
  };

  const handleSelectTrackIssueId = (issueId: string | null) => {
    navigateTo('track', { id: issueId, preserveScroll: true });
  };

  const handleSelectCommunityInitiativeId = (initiativeId: string | null) => {
    navigateTo('community', { id: initiativeId, preserveScroll: true });
  };

  const handleUpdateIssueStatus = async (
    issueId: string,
    newStatus: IssueStatus,
    note: string,
    options?: {
      approveEvidence?: boolean;
      afterImageUrl?: string;
      afterImageFile?: File | null;
      resolutionSummary?: string;
      followUpOutcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
    },
  ): Promise<{ ok: boolean; error?: string }> => {
    const target = issues.find((item) => item.id === issueId);
    if (!target) {
      return { ok: false, error: 'Selected issue could not be found.' };
    }

    if (isSupabaseConfigured) {
      const res = await updateReportStatusInSupabase({
        issue: target,
        newStatus,
        note,
        approveEvidence: options?.approveEvidence,
        afterImageFile: options?.afterImageFile,
        resolutionSummary: options?.resolutionSummary,
        followUpOutcome: options?.followUpOutcome,
      });
      if (res.ok && res.issue) {
        setIssues((prev) =>
          prev.map((item) => (item.id === issueId ? res.issue! : item)),
        );
      }
      return { ok: res.ok, error: res.error };
    }

    try {
      const updated = applyIssueStatusUpdate(target, newStatus, note, {
        actorRole: currentUser
          ? `${currentUser.fullName} (Coordinator)`
          : 'Civic Coordinator',
        approveEvidence: options?.approveEvidence,
        afterImageUrl: options?.afterImageUrl,
        resolutionSummary: options?.resolutionSummary,
        followUpOutcome: options?.followUpOutcome,
      });
      setIssues((prev) =>
        prev.map((item) => (item.id === issueId ? updated : item)),
      );
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : 'Unable to apply status update.',
      };
    }
  };

  const activeVolunteerEmail = isSupabaseConfigured
    ? (currentUser?.email ?? '')
    : (currentUser?.email ?? 'guest.volunteer@civilense.in');
  const activeVolunteerName = isSupabaseConfigured
    ? (currentUser?.fullName ?? '')
    : (currentUser?.fullName ?? 'Guest Community Volunteer');

  const handleRegisterVolunteer = async (
    initiativeId: string,
  ): Promise<{ ok: boolean; message: string }> => {
    if (isSupabaseConfigured) {
      if (!currentUser) {
        return {
          ok: false,
          message: 'Please sign in before registering as a volunteer.',
        };
      }
      const res = await registerVolunteerInSupabase(initiativeId);
      if (res.ok) {
        await refreshSupabaseData(currentUser);
      }
      return { ok: res.ok, message: res.message };
    }

    const result = registerVolunteerForInitiative(
      initiatives,
      registrations,
      initiativeId,
      {
        fullName: activeVolunteerName,
        email: activeVolunteerEmail,
      },
    );
    if (result.ok) {
      setInitiatives(result.initiatives);
      setRegistrations(result.registrations);
    }
    return { ok: result.ok, message: result.message };
  };

  const handleCancelRegistration = async (
    initiativeId: string,
  ): Promise<{ ok: boolean; message: string }> => {
    if (isSupabaseConfigured) {
      if (!currentUser) {
        return { ok: false, message: 'Authentication required.' };
      }
      const res = await cancelVolunteerInSupabase(initiativeId);
      if (res.ok) {
        await refreshSupabaseData(currentUser);
      }
      return { ok: res.ok, message: res.message };
    }

    const result = cancelVolunteerRegistration(
      initiatives,
      registrations,
      initiativeId,
      activeVolunteerEmail,
    );
    if (result.ok) {
      setInitiatives(result.initiatives);
      setRegistrations(result.registrations);
    }
    return { ok: result.ok, message: result.message };
  };

  const handleCreateInitiative = async (
    initiative: CommunityInitiative,
    options?: { coverImageFile?: File | null },
  ): Promise<{ ok: boolean; error?: string }> => {
    if (isSupabaseConfigured) {
      if (!currentUser) {
        return { ok: false, error: 'Coordinator session required.' };
      }
      const res = await saveInitiativeInSupabase({
        initiative,
        coverImageFile: options?.coverImageFile,
        issues,
        coordinator: currentUser,
      });
      if (res.ok) {
        await refreshSupabaseData(currentUser);
      }
      return res;
    }

    setInitiatives((prev) =>
      syncInitiativeRegistrationCounts([initiative, ...prev], registrations),
    );
    return { ok: true };
  };

  const handleUpdateInitiative = async (
    updated: CommunityInitiative,
    options?: { coverImageFile?: File | null; existingRegisteredCount?: number },
  ): Promise<{ ok: boolean; error?: string }> => {
    if (isSupabaseConfigured) {
      if (!currentUser) {
        return { ok: false, error: 'Coordinator session required.' };
      }
      const res = await saveInitiativeInSupabase({
        editingId: updated.id,
        initiative: updated,
        coverImageFile: options?.coverImageFile,
        issues,
        coordinator: currentUser,
        existingRegisteredCount: options?.existingRegisteredCount,
      });
      if (res.ok) {
        await refreshSupabaseData(currentUser);
      }
      return res;
    }

    setInitiatives((prev) =>
      syncInitiativeRegistrationCounts(
        prev.map((item) => (item.id === updated.id ? updated : item)),
        registrations,
      ),
    );
    return { ok: true };
  };

  const handleMarkAttendance = async (
    registrationId: string,
    attendanceStatus: 'Pending' | 'Attended' | 'Absent',
  ): Promise<{ ok: boolean; error?: string }> => {
    if (isSupabaseConfigured) {
      const res = await markVolunteerAttendanceInSupabase(
        registrationId,
        attendanceStatus,
      );
      if (res.ok) {
        setRegistrations((prev) =>
          prev.map((reg) =>
            reg.id === registrationId ? { ...reg, attendanceStatus } : reg,
          ),
        );
      }
      return res;
    }

    setRegistrations((prev) =>
      prev.map((reg) =>
        reg.id === registrationId ? { ...reg, attendanceStatus } : reg,
      ),
    );
    return { ok: true };
  };

  const handleSubmitVolunteerEvidence = async (params: {
    issueDbId: string;
    initiativeId: string;
    imageFile: File;
    summary: string;
  }): Promise<{ ok: boolean; message?: string; error?: string }> => {
    if (!isSupabaseConfigured) {
      return {
        ok: false,
        error: 'Volunteer evidence upload requires Supabase Storage.',
      };
    }
    const res = await submitVolunteerEvidenceInSupabase(params);
    if (res.ok && currentUser?.role === UserRole.Coordinator) {
      await refreshSupabaseData(currentUser);
    }
    return res;
  };

  const handleRecordFollowup = async (
    issue: CivicIssue,
    outcome: 'Sustained' | 'Needs Attention' | 'Marked Recurring',
    observations: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (isSupabaseConfigured) {
      const res = await createIssueFollowupInSupabase({
        issue,
        outcome,
        observations,
      });
      if (res.ok) {
        await refreshSupabaseData(currentUser);
      }
      return res;
    }

    const nextStatus =
      outcome === 'Marked Recurring' ? IssueStatus.Recurring : issue.status;
    return handleUpdateIssueStatus(issue.id, nextStatus, observations, {
      followUpOutcome: outcome,
    });
  };

  const handleReviewPendingEvidence = async (
    evidenceId: string,
    decision: 'Approved' | 'Rejected',
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, error: 'Evidence approval requires Supabase.' };
    }
    const res = await reviewPendingEvidenceInSupabase({ evidenceId, decision });
    if (res.ok) {
      await refreshSupabaseData(currentUser);
    }
    return res;
  };

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    if (isSupabaseConfigured) {
      void refreshSupabaseData(user);
    }
  };

  const handleSignup = (newUser: UserAccount) => {
    if (isSupabaseConfigured) {
      setCurrentUser(newUser);
      void refreshSupabaseData(newUser);
      return;
    }
    const { demoPassword: _ignored, ...safeSessionUser } = newUser;
    setUsers((prev) => [newUser, ...prev]);
    setCurrentUser(safeSessionUser);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await signOutWithSupabase();
    }
    setPasswordRecoveryMode(false);
    setCurrentUser(null);
    if (route === 'coordinator') {
      navigateTo('home');
    }
  };

  const handleResetDemoData = () => {
    if (isSupabaseConfigured) return;
    civicStorage.resetDemoData();
    setIssues(SEED_ISSUES);
    setRegistrations(SEED_REGISTRATIONS);
    setInitiatives(
      syncInitiativeRegistrationCounts(SEED_INITIATIVES, SEED_REGISTRATIONS),
    );
    setUsers(SEED_USERS);
    setStorageError(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FBF9] text-[#06271A]">
      <Navbar
        currentRoute={route}
        onNavigate={(next) => navigateTo(next)}
        currentUser={currentUser}
        onLogout={() => void handleLogout()}
      />

      {backendError && (
        <div
          role="alert"
          className="border-b border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <span className="font-medium">{backendError}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshSupabaseData()}
                className="inline-flex items-center gap-1 rounded border border-red-400 bg-white px-2.5 py-1 text-xs font-semibold text-red-900 hover:bg-red-100"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={() => setBackendError(null)}
                aria-label="Dismiss backend error"
                className="rounded p-1 text-red-800 hover:bg-red-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {storageError && !isSupabaseConfigured && (
        <div
          role="alert"
          className="border-b border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <span className="font-medium">{storageError}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDemoData}
                className="inline-flex items-center gap-1 rounded border border-red-400 bg-white px-2.5 py-1 text-xs font-semibold text-red-900 hover:bg-red-100"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset Demo Data</span>
              </button>
              <button
                type="button"
                onClick={() => setStorageError(null)}
                aria-label="Dismiss storage warning"
                className="rounded p-1 text-red-800 hover:bg-red-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {route === 'home' && (
          <HomePage
            issues={issues}
            initiatives={initiatives}
            registrations={registrations}
            isSupabaseMode={isSupabaseConfigured}
            loading={backendLoading}
            onNavigate={(next) => navigateTo(next)}
            onSelectInitiative={(id) => navigateTo('community', { id })}
          />
        )}

        {route === 'report' && (
          <ReportIssuePage
            currentUser={currentUser}
            isSupabaseMode={isSupabaseConfigured}
            onSubmitIssue={handleSubmitIssue}
            onTrackReport={handleTrackReport}
            onNavigate={(next) => navigateTo(next)}
          />
        )}

        {route === 'track' && (
          <TrackIssuesPage
            issues={issues}
            initiatives={initiatives}
            selectedIssueId={trackedIssueId}
            onSelectIssueId={handleSelectTrackIssueId}
            onSelectInitiative={(id) => navigateTo('community', { id })}
            onNavigate={(next) => navigateTo(next)}
          />
        )}

        {route === 'community' && (
          <CommunityPage
            initiatives={initiatives}
            registrations={registrations}
            currentUser={currentUser}
            isSupabaseMode={isSupabaseConfigured}
            activeVolunteerEmail={activeVolunteerEmail}
            selectedInitiativeId={selectedInitiativeId}
            onSelectInitiativeId={handleSelectCommunityInitiativeId}
            onRegisterVolunteer={handleRegisterVolunteer}
            onCancelRegistration={handleCancelRegistration}
            onSubmitVolunteerEvidence={handleSubmitVolunteerEvidence}
            onInspectIssue={handleTrackReport}
            onNavigate={(next) => navigateTo(next)}
          />
        )}

        {route === 'impact' && (
          <ImpactDashboardPage
            issues={issues}
            initiatives={initiatives}
            isSupabaseMode={isSupabaseConfigured}
            onNavigate={(next) => navigateTo(next)}
            onInspectIssue={handleTrackReport}
          />
        )}

        {route === 'auth' && (
          <AuthPage
            currentUser={currentUser}
            users={users}
            isSupabaseMode={isSupabaseConfigured}
            passwordRecoveryMode={passwordRecoveryMode}
            onPasswordRecovered={() => setPasswordRecoveryMode(false)}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={() => void handleLogout()}
            onNavigate={(next) => navigateTo(next)}
          />
        )}

        {route === 'coordinator' && (
          <CoordinatorDashboardPage
            currentUser={currentUser}
            issues={issues}
            initiatives={initiatives}
            registrations={registrations}
            isSupabaseMode={isSupabaseConfigured}
            onUpdateIssueStatus={handleUpdateIssueStatus}
            onCreateInitiative={handleCreateInitiative}
            onUpdateInitiative={handleUpdateInitiative}
            onMarkAttendance={handleMarkAttendance}
            onRecordFollowup={handleRecordFollowup}
            onReviewPendingEvidence={handleReviewPendingEvidence}
            onResetDemoData={handleResetDemoData}
            onNavigate={(next) => navigateTo(next)}
          />
        )}
      </main>

      <Footer
        onNavigate={(next) => navigateTo(next)}
        isSupabaseMode={isSupabaseConfigured}
      />
    </div>
  );
}
