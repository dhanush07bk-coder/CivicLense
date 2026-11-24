import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyIssueStatusUpdate,
  assertValidIndiaInitiativeRecord,
  assertValidIndiaIssueRecord,
  authenticateDemoUser,
  cancelVolunteerRegistration,
  computeDashboardMetrics,
  createCivicIssueRecord,
  deriveVerifiedBeforeAfterCases,
  filterCoordinatorQueue,
  filterIssues,
  generateReportId,
  getAllowedNextStatuses,
  registerVolunteerForInitiative,
  requiresAuthoritySafetyAdvisory,
  resolveActiveQueueIssue,
  syncInitiativeRegistrationCounts,
  toPublicIssueView,
  validateImageFile,
  validateInitiativeSubmission,
  validateIssueStatusTransition,
  validateIssueSubmission,
  validateSignupForm,
} from './civicLogic';
import {
  INDIAN_STATES_AND_UTS,
  isCoordinateWithinIndia,
  validateAndParseNominatimIndiaResult,
  validateCoordinatesMatchIndianState,
  validateIndianPinCode,
  validatePinMatchesIndianState,
} from './indiaGeo';
import { buildRouteUrl, parseBrowserLocation } from './router';
import {
  CommunityInitiative,
  IssueCategory,
  IssueStatus,
  UserAccount,
  UserRole,
  VolunteerRegistration,
} from '../types/civic';

test('INDIAN_STATES_AND_UTS includes all 28 states and 8 union territories (36 total)', () => {
  assert.equal(INDIAN_STATES_AND_UTS.length, 36);
  assert.equal(INDIAN_STATES_AND_UTS.includes('Karnataka'), true);
  assert.equal(INDIAN_STATES_AND_UTS.includes('Delhi'), true);
  assert.equal(INDIAN_STATES_AND_UTS.includes('Ladakh'), true);
  assert.equal(INDIAN_STATES_AND_UTS.includes('Puducherry'), true);
});

test('validateIndianPinCode and State-PIN / State-coordinate consistency work accurately', () => {
  assert.equal(validateIndianPinCode('560038'), true);
  assert.equal(validateIndianPinCode('110003'), true);
  assert.equal(validateIndianPinCode('682001'), true);
  assert.equal(validateIndianPinCode('056001'), false);
  assert.equal(validateIndianPinCode('956001'), false);
  assert.equal(validateIndianPinCode('56003'), false);
  assert.equal(validateIndianPinCode('SW1A1A'), false);

  // State vs PIN mismatch detection
  assert.equal(validatePinMatchesIndianState('Karnataka', '560038'), true);
  assert.equal(validatePinMatchesIndianState('Delhi', '110003'), true);
  assert.equal(validatePinMatchesIndianState('Karnataka', '110003'), false);
  assert.equal(validatePinMatchesIndianState('Maharashtra', '600004'), false);

  // State vs Coordinate mismatch detection
  assert.equal(validateCoordinatesMatchIndianState('Karnataka', 12.9719, 77.6412), true);
  assert.equal(validateCoordinatesMatchIndianState('Delhi', 12.9719, 77.6412), false);
});

test('isCoordinateWithinIndia accepts Indian cities & islands and rejects overseas coordinates', () => {
  assert.equal(isCoordinateWithinIndia(12.9716, 77.5946), true); // Bengaluru
  assert.equal(isCoordinateWithinIndia(12.2958, 76.6394), true); // Mysuru
  assert.equal(isCoordinateWithinIndia(13.0827, 80.2707), true); // Chennai
  assert.equal(isCoordinateWithinIndia(17.385, 78.4867), true); // Hyderabad
  assert.equal(isCoordinateWithinIndia(9.9312, 76.2673), true); // Kochi
  assert.equal(isCoordinateWithinIndia(18.5204, 73.8567), true); // Pune
  assert.equal(isCoordinateWithinIndia(28.6139, 77.209), true); // New Delhi
  assert.equal(isCoordinateWithinIndia(26.1445, 91.7362), true); // Guwahati
  assert.equal(isCoordinateWithinIndia(34.0837, 74.7973), true); // Srinagar
  assert.equal(isCoordinateWithinIndia(11.6234, 92.7265), true); // Port Blair
  assert.equal(isCoordinateWithinIndia(10.5669, 72.6417), true); // Kavaratti

  assert.equal(isCoordinateWithinIndia(51.5072, -0.1276), false); // London
  assert.equal(isCoordinateWithinIndia(40.7128, -74.006), false); // New York
  assert.equal(isCoordinateWithinIndia(25.2048, 55.2708), false); // Dubai
  assert.equal(isCoordinateWithinIndia(24.8607, 67.0011), false); // Karachi
  assert.equal(isCoordinateWithinIndia(31.5204, 74.3587), false); // Lahore
  assert.equal(isCoordinateWithinIndia(27.7172, 85.324), false); // Kathmandu
  assert.equal(isCoordinateWithinIndia(23.8103, 90.4125), false); // Dhaka
  assert.equal(isCoordinateWithinIndia(6.9271, 79.8612), false); // Colombo
  assert.equal(isCoordinateWithinIndia(15.0, 68.0), false); // Arabian Sea
});

test('validateAndParseNominatimIndiaResult rejects non-IN country codes and accepts Indian results', () => {
  const ukResult = validateAndParseNominatimIndiaResult({
    place_id: 1,
    display_name: 'London, Greater London, England, United Kingdom',
    lat: '51.5072',
    lon: '-0.1276',
    address: { country_code: 'gb', city: 'London', postcode: 'SW1A 2AA' },
  });
  assert.equal(ukResult, null);

  const blrResult = validateAndParseNominatimIndiaResult({
    place_id: 2,
    display_name: 'Indiranagar, Bengaluru, Karnataka, 560038, India',
    lat: '12.9719',
    lon: '77.6412',
    address: {
      country_code: 'in',
      state: 'Karnataka',
      state_district: 'Bengaluru Urban District',
      city: 'Bengaluru',
      suburb: 'Indiranagar',
      postcode: '560038',
    },
  });
  assert.ok(blrResult);
  assert.equal(blrResult.country_code, 'IN');
  assert.equal(blrResult.state, 'Karnataka');
  assert.equal(blrResult.district, 'Bengaluru Urban');
  assert.equal(blrResult.pin_code, '560038');
});

test('validateIssueSubmission enforces map confirmation, State-PIN match, State-coordinate match, and India-only rules', () => {
  const overseasAttempt = validateIssueSubmission({
    category: IssueCategory.WasteAndSanitation,
    title: 'Overflowing public waste bin',
    description: 'Waste bin near square needs regular pickup.',
    country_code: 'GB',
    state: 'Karnataka',
    district: 'London',
    city: 'London',
    locality: 'Camden High Street',
    pin_code: '12345',
    latitude: 51.5072,
    longitude: -0.1276,
    isAnonymous: true,
  });

  assert.equal(overseasAttempt.valid, false);
  assert.ok(overseasAttempt.errors.country_code);
  assert.ok(overseasAttempt.errors.city);
  assert.ok(overseasAttempt.errors.pin_code);
  assert.ok(overseasAttempt.errors.coordinates);

  // State/PIN & State/Coordinate mismatch + missing map confirmation
  const mismatchAttempt = validateIssueSubmission({
    category: IssueCategory.WasteAndSanitation,
    title: 'Overflowing bin near Delhi station',
    description: 'Dry waste bags piled beside the footpath entrance.',
    country_code: 'IN',
    state: 'Delhi',
    district: 'New Delhi',
    city: 'New Delhi',
    locality: 'Lodhi Colony Block 4',
    pin_code: '560038', // Karnataka PIN with Delhi State
    latitude: 12.9719, // Bengaluru coordinates with Delhi State
    longitude: 77.6412,
    mapConfirmed: false,
    requireMapSelection: true,
    isAnonymous: true,
  });
  assert.equal(mismatchAttempt.valid, false);
  assert.ok(mismatchAttempt.errors.pin_code);
  assert.ok(mismatchAttempt.errors.coordinates);

  // Valid coordinates & PIN without map confirmation clicked
  const unconfirmedPin = validateIssueSubmission({
    category: IssueCategory.WasteAndSanitation,
    title: 'Overflowing sorting bin near Indiranagar',
    description: 'Sorting bin beside metro exit is full and uncollected.',
    country_code: 'IN',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    locality: 'Indiranagar 12th Main',
    pin_code: '560038',
    latitude: 12.9719,
    longitude: 77.6412,
    mapConfirmed: false,
    requireMapSelection: true,
    isAnonymous: true,
  });
  assert.equal(unconfirmedPin.valid, false);
  assert.ok(unconfirmedPin.errors.mapConfirmed);

  assert.equal(
    requiresAuthoritySafetyAdvisory(
      IssueCategory.InfrastructureHazard,
      'Leaning utility pole',
      'Pole wiring seems loose near crosswalk.',
    ),
    true,
  );
});

test('createCivicIssueRecord enforces country_code IN and toPublicIssueView strips reporterEmail', () => {
  const record = createCivicIssueRecord(
    {
      category: IssueCategory.WasteAndSanitation,
      title: 'Overflowing sorting bin near Indiranagar 12th Main',
      description: 'Sorting bins near the metro footbridge have been overflowing since Monday.',
      country_code: 'IN',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      locality: 'Indiranagar 12th Main',
      pin_code: '560038',
      latitude: 12.9719,
      longitude: 77.6412,
      mapConfirmed: true,
      requireMapSelection: true,
      isAnonymous: false,
      reporterEmail: 'citizen@civilense.in',
    },
    [],
    new Date('2026-11-17T10:00:00Z'),
  );

  assert.equal(record.country_code, 'IN');
  assert.equal(assertValidIndiaIssueRecord(record), true);
  assert.equal(record.reporterEmail, 'citizen@civilense.in');

  const publicView = toPublicIssueView(record);
  assert.equal('reporterEmail' in publicView, false);
  assert.equal(publicView.state, 'Karnataka');
  assert.equal(publicView.pin_code, '560038');
});

test('status transition rules block invalid jumps and allow valid coordinator workflow', () => {
  const submitted = createCivicIssueRecord(
    {
      category: IssueCategory.WasteAndSanitation,
      title: 'Blocked storm drain grate in Mylapore',
      description: 'Leaves and plastic packaging blocking curbside drainage.',
      state: 'Tamil Nadu',
      district: 'Chennai',
      city: 'Chennai',
      locality: 'Mylapore Tank Square',
      pin_code: '600004',
      latitude: 13.0339,
      longitude: 80.2676,
      isAnonymous: true,
    },
    [],
  );

  // Direct Submitted -> Resolved must be rejected
  const invalidJump = validateIssueStatusTransition(
    IssueStatus.Submitted,
    IssueStatus.Resolved,
  );
  assert.equal(invalidJump.valid, false);
  assert.throws(
    () =>
      applyIssueStatusUpdate(
        submitted,
        IssueStatus.Resolved,
        'Skipping verification',
      ),
    /Cannot transition directly/,
  );

  const allowedFromSubmitted = getAllowedNextStatuses(IssueStatus.Submitted);
  assert.equal(allowedFromSubmitted.includes(IssueStatus.Verified), true);
  assert.equal(allowedFromSubmitted.includes(IssueStatus.Resolved), false);

  // Valid path: Submitted -> Verified -> Resolved
  const verified = applyIssueStatusUpdate(
    submitted,
    IssueStatus.Verified,
    'Verified on site.',
  );
  const resolved = applyIssueStatusUpdate(
    verified,
    IssueStatus.Resolved,
    'Drain cleared and grate fixed.',
    {
      approveEvidence: true,
      afterImageUrl: '/after.jpg',
    },
  );
  assert.equal(resolved.status, IssueStatus.Resolved);
  assert.equal(resolved.resolutionEvidence?.approvedByCoordinator, true);

  // Resolved -> Submitted is disallowed, while Resolved -> Recurring is allowed
  assert.equal(
    validateIssueStatusTransition(IssueStatus.Resolved, IssueStatus.Submitted).valid,
    false,
  );
  assert.equal(
    validateIssueStatusTransition(IssueStatus.Resolved, IssueStatus.Recurring).valid,
    true,
  );
});

test('generateReportId and state/city/PIN filtering work accurately for India records', () => {
  const one = createCivicIssueRecord(
    {
      category: IssueCategory.WasteAndSanitation,
      title: 'Blocked storm drain grate in Mylapore',
      description: 'Leaves and plastic packaging blocking curbside drainage.',
      state: 'Tamil Nadu',
      district: 'Chennai',
      city: 'Chennai',
      locality: 'Mylapore Tank Square',
      pin_code: '600004',
      latitude: 13.0339,
      longitude: 80.2676,
      isAnonymous: true,
    },
    [],
  );

  const nextId = generateReportId([one.id], new Date('2026-11-17T10:00:00Z'));
  assert.equal(nextId.startsWith('CIV-2026-'), true);

  const two = applyIssueStatusUpdate(
    createCivicIssueRecord(
      {
        category: IssueCategory.PublicObstruction,
        title: 'Fallen tree limb on cycle path in Gokulam',
        description: 'Large branch blocking half of the shared neighbourhood lane.',
        state: 'Karnataka',
        district: 'Mysuru',
        city: 'Mysuru',
        locality: 'Gokulam 3rd Stage',
        pin_code: '570002',
        latitude: 12.3264,
        longitude: 76.6256,
        isAnonymous: false,
        reporterEmail: 'alex@civilense.in',
      },
      [one.id],
    ),
    IssueStatus.Verified,
    'Verified on site by coordinator.',
  );

  const filteredByState = filterIssues([one, two], {
    query: '',
    category: 'All',
    status: 'All',
    state: 'Tamil Nadu',
    city: 'All',
  });
  assert.equal(filteredByState.length, 1);
  assert.equal(filteredByState[0].city, 'Chennai');

  const filteredByPin = filterIssues([one, two], {
    query: '570002',
    category: 'All',
    status: 'All',
    state: 'All',
    city: 'All',
  });
  assert.equal(filteredByPin.length, 1);
  assert.equal(filteredByPin[0].city, 'Mysuru');
});

test('validateImageFile enforces JPEG/PNG/WebP MIME types and 2 MB size cap', () => {
  assert.equal(
    validateImageFile({
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 500_000,
    }).valid,
    true,
  );
  assert.equal(
    validateImageFile({
      name: 'photo.png',
      type: 'image/png',
      size: 1_500_000,
    }).valid,
    true,
  );
  assert.equal(
    validateImageFile({
      name: 'script.svg',
      type: 'image/svg+xml',
      size: 10_000,
    }).valid,
    false,
  );
  assert.equal(
    validateImageFile({
      name: 'huge.jpg',
      type: 'image/jpeg',
      size: 3 * 1024 * 1024,
    }).valid,
    false,
  );
  assert.equal(
    validateImageFile({
      name: 'empty.webp',
      type: 'image/webp',
      size: 0,
    }).valid,
    false,
  );
});

test('initiative validation, volunteer count synchronization, and Before/After derivation work accurately', () => {
  const invalidInit = validateInitiativeSubmission({
    title: 'Overseas cleanup',
    category: 'Waste & Sanitation',
    description: 'Attempt to create a cleanup drive outside India.',
    country_code: 'US',
    state: 'Karnataka',
    district: 'Seattle',
    city: 'Seattle',
    locality: 'Downtown',
    pin_code: '98101',
    eventDate: '2026-10-01',
    startTime: '11:00',
    endTime: '09:00',
    capacity: 2,
    referenceDate: '2026-11-23',
  });
  assert.equal(invalidInit.valid, false);
  assert.ok(invalidInit.errors.country_code);
  assert.ok(invalidInit.errors.pin_code);
  assert.ok(invalidInit.errors.eventDate);
  assert.ok(invalidInit.errors.endTime);
  assert.ok(invalidInit.errors.capacity);

  const initiatives: CommunityInitiative[] = [
    {
      id: 'init-blr-1',
      title: 'Indiranagar Neighbourhood Cleanup Drive',
      category: 'Waste & Sanitation',
      description: 'Sweep pathways and sort dry waste.',
      country_code: 'IN',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      locality: 'Indiranagar 12th Main',
      pin_code: '560038',
      latitude: 12.9719,
      longitude: 77.6412,
      location: 'Indiranagar 12th Main, Bengaluru, Karnataka - 560038, India',
      eventDate: '2026-12-05',
      startTime: '08:00',
      endTime: '11:00',
      dateLabel: 'Sat, 05 Dec 2026',
      timeLabel: '08:00 AM – 11:00 AM',
      capacity: 2,
      registeredCount: 99, // intentionally stale count to verify sync
      status: 'Open',
      linkedIssueIds: ['CIV-2026-1001'],
      organizer: 'Bengaluru Ward Civic Circle',
      highlights: ['Gloves and sorting bags provided'],
    },
  ];
  assert.equal(assertValidIndiaInitiativeRecord(initiatives[0]), true);

  const existingRegs: VolunteerRegistration[] = [
    {
      id: 'reg-1',
      initiativeId: 'init-blr-1',
      volunteerName: 'Karthik Nair',
      volunteerEmail: 'karthik@civilense.in',
      registeredAt: '2026-11-20T09:00:00Z',
    },
  ];

  const synced = syncInitiativeRegistrationCounts(initiatives, existingRegs);
  assert.equal(synced[0].registeredCount, 1);

  const reg1 = registerVolunteerForInitiative(synced, existingRegs, 'init-blr-1', {
    fullName: 'Asha Menon',
    email: 'asha@civilense.in',
  });
  assert.equal(reg1.ok, true);
  assert.equal(reg1.initiatives[0].registeredCount, 2);

  const regFull = registerVolunteerForInitiative(
    reg1.initiatives,
    reg1.registrations,
    'init-blr-1',
    { fullName: 'Rohan Kulkarni', email: 'rohan@civilense.in' },
  );
  assert.equal(regFull.ok, false);

  const cancelled = cancelVolunteerRegistration(
    reg1.initiatives,
    reg1.registrations,
    'init-blr-1',
    'asha@civilense.in',
  );
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.initiatives[0].registeredCount, 1);

  // Dashboard metrics & Before/After derivation
  const issueBlr = createCivicIssueRecord(
    {
      category: IssueCategory.WasteAndSanitation,
      title: 'Overflowing bin in Indiranagar',
      description: 'Dry waste sorting bin is overflowing near metro gate.',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      locality: 'Indiranagar 12th Main',
      pin_code: '560038',
      imageUrl: '/before.jpg',
      isAnonymous: true,
    },
    [],
  );
  const issueDelVerified = applyIssueStatusUpdate(
    createCivicIssueRecord(
      {
        category: IssueCategory.PublicSpaceDamage,
        title: 'Damaged park bench in Lodhi Colony',
        description: 'Two wooden slats cracked along main walkway.',
        state: 'Delhi',
        district: 'New Delhi',
        city: 'New Delhi',
        locality: 'Lodhi Colony Block 4',
        pin_code: '110003',
        imageUrl: '/before-del.jpg',
        isAnonymous: true,
      },
      [issueBlr.id],
    ),
    IssueStatus.Verified,
    'Confirmed bench damage on site.',
  );
  const issueDelResolved = applyIssueStatusUpdate(
    issueDelVerified,
    IssueStatus.Resolved,
    'Repaired by local volunteers.',
    { approveEvidence: true, afterImageUrl: '/after-del.jpg' },
  );

  const delhiMetrics = computeDashboardMetrics(
    [issueBlr, issueDelResolved],
    cancelled.initiatives,
    { state: 'Delhi', city: 'All' },
  );
  assert.equal(delhiMetrics.totalReports, 1);
  assert.equal(delhiMetrics.resolvedIssues, 1);

  const cases = deriveVerifiedBeforeAfterCases(
    [issueBlr, issueDelResolved],
    cancelled.initiatives,
    { state: 'Delhi', city: 'All' },
  );
  assert.equal(cases.length, 1);
  assert.equal(cases[0].city, 'New Delhi');
});

test('demo authentication verifies passwords and rejects wrong/empty passwords', () => {
  const badSignup = validateSignupForm({
    fullName: 'A',
    email: 'invalid-email',
    password: '123',
    confirmPassword: '456',
    role: UserRole.Volunteer,
  });
  assert.equal(badSignup.valid, false);
  assert.ok(badSignup.errors.password);

  const users: UserAccount[] = [
    {
      id: 'usr-1',
      fullName: 'Priya Deshmukh',
      email: 'coordinator@civilense.in',
      role: UserRole.Coordinator,
      createdAt: '2026-08-05T09:00:00Z',
      demoPassword: 'coord1234',
    },
  ];

  const wrongPassword = authenticateDemoUser(
    users,
    'coordinator@civilense.in',
    'wrongpass',
  );
  assert.equal(wrongPassword.ok, false);

  const emptyPassword = authenticateDemoUser(
    users,
    'coordinator@civilense.in',
    '',
  );
  assert.equal(emptyPassword.ok, false);

  const validLogin = authenticateDemoUser(
    users,
    'COORDINATOR@civilense.in',
    'coord1234',
  );
  assert.equal(validLogin.ok, true);
  assert.equal(validLogin.user?.role, UserRole.Coordinator);
  assert.equal('demoPassword' in (validLogin.user ?? {}), false);
});

test('browser URL routing parses routes, query params, and builds canonical paths', () => {
  assert.deepEqual(parseBrowserLocation('/', ''), {
    route: 'home',
    trackIssueId: null,
    initiativeId: null,
  });
  assert.deepEqual(parseBrowserLocation('/report/', ''), {
    route: 'report',
    trackIssueId: null,
    initiativeId: null,
  });
  assert.deepEqual(parseBrowserLocation('/track', '?id=CIV-2026-1001'), {
    route: 'track',
    trackIssueId: 'CIV-2026-1001',
    initiativeId: null,
  });
  assert.deepEqual(
    parseBrowserLocation('/community', '?id=init-cleanup-drive'),
    {
      route: 'community',
      trackIssueId: null,
      initiativeId: 'init-cleanup-drive',
    },
  );
  assert.equal(parseBrowserLocation('/coordinator', '').route, 'coordinator');
  assert.equal(parseBrowserLocation('/auth', '').route, 'auth');
  assert.equal(parseBrowserLocation('/unknown-path', '').route, 'home');

  assert.equal(
    buildRouteUrl('track', { id: 'CIV-2026-1001' }),
    '/track?id=CIV-2026-1001',
  );
  assert.equal(buildRouteUrl('track', { id: null }), '/track');
  assert.equal(buildRouteUrl('coordinator'), '/coordinator');
});

test('coordinator queue filtering updates active issue selection cleanly when filters change', () => {
  const baseIssue = createCivicIssueRecord(
    {
      category: IssueCategory.WasteAndSanitation,
      title: 'Overflowing bin in Indiranagar',
      description: 'Dry waste sorting bin is overflowing near metro gate.',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      locality: 'Indiranagar 12th Main',
      pin_code: '560038',
      isAnonymous: true,
    },
    [],
  );
  const verifiedIssue = applyIssueStatusUpdate(
    createCivicIssueRecord(
      {
        category: IssueCategory.PublicSpaceDamage,
        title: 'Damaged footpath curb in Mylapore',
        description: 'Concrete curb slab cracked along pedestrian corner.',
        state: 'Tamil Nadu',
        district: 'Chennai',
        city: 'Chennai',
        locality: 'Mylapore Tank Square',
        pin_code: '600004',
        isAnonymous: true,
      },
      [baseIssue.id],
    ),
    IssueStatus.Verified,
    'Verified on site.',
  );

  const verifiedQueue = filterCoordinatorQueue(
    [baseIssue, verifiedIssue],
    IssueStatus.Verified,
  );
  assert.equal(verifiedQueue.length, 1);
  assert.equal(verifiedQueue[0].id, verifiedIssue.id);

  // Even if previous selectedIssueId pointed to Submitted baseIssue, selection switches to verifiedQueue[0]
  const resolvedActive = resolveActiveQueueIssue(verifiedQueue, baseIssue.id);
  assert.equal(resolvedActive?.id, verifiedIssue.id);

  const emptyQueue = filterCoordinatorQueue(
    [baseIssue, verifiedIssue],
    IssueStatus.Recurring,
  );
  assert.equal(resolveActiveQueueIssue(emptyQueue, baseIssue.id), null);
});
