import { useEffect, useState } from 'react';
import {
  CivicIssue,
  CommunityInitiative,
  IssueStatus,
  PageRoute,
  UserAccount,
  VolunteerRegistration,
} from './types/civic';
import { DEMO_ACCOUNTS } from './data/seedData';
import { civicStorage } from './services/storageService';
import {
  applyIssueStatusUpdate,
  cancelVolunteerRegistration,
  registerVolunteerForInitiative,
} from './utils/civicLogic';
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
  const [route, setRoute] = useState<PageRoute>('home');
  const [issues, setIssues] = useState<CivicIssue[]>(() =>
    civicStorage.loadIssues(),
  );
  const [initiatives, setInitiatives] = useState<CommunityInitiative[]>(() =>
    civicStorage.loadInitiatives(),
  );
  const [registrations, setRegistrations] = useState<VolunteerRegistration[]>(() =>
    civicStorage.loadRegistrations(),
  );
  const [users, setUsers] = useState<UserAccount[]>(() =>
    civicStorage.loadUsers(),
  );
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    civicStorage.loadCurrentUser(),
  );

  const [trackedIssueId, setTrackedIssueId] = useState<string | null>(null);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    civicStorage.saveIssues(issues);
  }, [issues]);

  useEffect(() => {
    civicStorage.saveInitiatives(initiatives);
  }, [initiatives]);

  useEffect(() => {
    civicStorage.saveRegistrations(registrations);
  }, [registrations]);

  useEffect(() => {
    civicStorage.saveUsers(users);
  }, [users]);

  useEffect(() => {
    civicStorage.saveCurrentUser(currentUser);
  }, [currentUser]);

  const navigateTo = (nextRoute: PageRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitIssue = (newIssue: CivicIssue) => {
    setIssues((prev) => [newIssue, ...prev]);
  };

  const handleTrackReport = (reportId: string) => {
    setTrackedIssueId(reportId);
    navigateTo('track');
  };

  const handleUpdateIssueStatus = (
    issueId: string,
    newStatus: IssueStatus,
    note: string,
    options?: {
      approveEvidence?: boolean;
      afterImageUrl?: string;
      resolutionSummary?: string;
      followUpOutcome?: 'Sustained' | 'Needs Attention' | 'Marked Recurring';
    },
  ) => {
    setIssues((prev) =>
      prev.map((item) =>
        item.id === issueId
          ? applyIssueStatusUpdate(item, newStatus, note, {
              actorRole: currentUser
                ? `${currentUser.fullName} (Coordinator)`
                : 'Civic Coordinator',
              ...options,
            })
          : item,
      ),
    );
  };

  const activeVolunteerEmail =
    currentUser?.email ?? 'guest.volunteer@civilense.in';
  const activeVolunteerName =
    currentUser?.fullName ?? 'Guest Community Volunteer';

  const handleRegisterVolunteer = (initiativeId: string) => {
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

  const handleCancelRegistration = (initiativeId: string) => {
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

  const handleCreateInitiative = (initiative: CommunityInitiative) => {
    setInitiatives((prev) => [initiative, ...prev]);
  };

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
  };

  const handleSignup = (newUser: UserAccount) => {
    setUsers((prev) => [newUser, ...prev]);
    setCurrentUser(newUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    if (route === 'coordinator') {
      navigateTo('home');
    }
  };

  const handleDemoCoordinatorLogin = () => {
    const coord = DEMO_ACCOUNTS.find(
      (a) => a.email === 'coordinator@civilense.in',
    );
    if (coord) {
      const { passwordHint: _ignored, ...cleanCoord } = coord;
      setCurrentUser(cleanCoord);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FBF9] text-[#06271A]">
      <Navbar
        currentRoute={route}
        onNavigate={navigateTo}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {route === 'home' && (
          <HomePage
            initiatives={initiatives}
            onNavigate={navigateTo}
            onSelectInitiative={(id) => setSelectedInitiativeId(id)}
          />
        )}

        {route === 'report' && (
          <ReportIssuePage
            existingIssues={issues}
            currentUser={currentUser}
            onSubmitIssue={handleSubmitIssue}
            onTrackReport={handleTrackReport}
            onNavigate={navigateTo}
          />
        )}

        {route === 'track' && (
          <TrackIssuesPage
            issues={issues}
            initialSelectedId={trackedIssueId}
            onClearInitialSelected={() => setTrackedIssueId(null)}
            onNavigate={navigateTo}
          />
        )}

        {route === 'community' && (
          <CommunityPage
            initiatives={initiatives}
            registrations={registrations}
            currentUser={currentUser}
            activeVolunteerEmail={activeVolunteerEmail}
            initialInitiativeId={selectedInitiativeId}
            onClearInitialInitiative={() => setSelectedInitiativeId(null)}
            onRegisterVolunteer={handleRegisterVolunteer}
            onCancelRegistration={handleCancelRegistration}
            onNavigate={navigateTo}
          />
        )}

        {route === 'impact' && (
          <ImpactDashboardPage
            issues={issues}
            initiatives={initiatives}
            onNavigate={navigateTo}
            onInspectIssue={handleTrackReport}
          />
        )}

        {route === 'auth' && (
          <AuthPage
            currentUser={currentUser}
            users={users}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={handleLogout}
            onNavigate={navigateTo}
          />
        )}

        {route === 'coordinator' && (
          <CoordinatorDashboardPage
            currentUser={currentUser}
            issues={issues}
            initiatives={initiatives}
            registrations={registrations}
            onUpdateIssueStatus={handleUpdateIssueStatus}
            onCreateInitiative={handleCreateInitiative}
            onDemoCoordinatorLogin={handleDemoCoordinatorLogin}
            onNavigate={navigateTo}
          />
        )}
      </main>

      <Footer onNavigate={navigateTo} />
    </div>
  );
}
