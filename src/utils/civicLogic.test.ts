import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyIssueStatusUpdate,
  assertValidIndiaInitiativeRecord,
  assertValidIndiaIssueRecord,
  cancelVolunteerRegistration,
  computeDashboardMetrics,
  createCivicIssueRecord,
  filterIssues,
  generateReportId,
  registerVolunteerForInitiative,
  requiresAuthoritySafetyAdvisory,
  toPublicIssueView,
  validateInitiativeSubmission,
  validateIssueSubmission,
  validateSignupForm,
} from './civicLogic';
import {
  INDIAN_STATES_AND_UTS,
  isCoordinateWithinIndia,
  validateAndParseNominatimIndiaResult,
  validateIndianPinCode,
} from './indiaGeo';
import {
  CommunityInitiative,
  IssueCategory,
  IssueStatus,
  UserRole,
} from '../types/civic';

test('INDIAN_STATES_AND_UTS includes all 28 states and 8 union territories (36 total)', () => {
  assert.equal(INDIAN_STATES_AND_UTS.length, 36);
  assert.equal(INDIAN_STATES_AND_UTS.includes('Karnataka'), true);
  assert.equal(INDIAN_STATES_AND_UTS.includes('Delhi'), true);
  assert.equal(INDIAN_STATES_AND_UTS.includes('Ladakh'), true);
  assert.equal(INDIAN_STATES_AND_UTS.includes('Puducherry'), true);
});

test('validateIndianPinCode validates 6-digit Indian PIN codes accurately', () => {
  assert.equal(validateIndianPinCode('560038'), true);
  assert.equal(validateIndianPinCode('110003'), true);
  assert.equal(validateIndianPinCode('682001'), true);
  assert.equal(validateIndianPinCode('056001'), false);
  assert.equal(validateIndianPinCode('956001'), false);
  assert.equal(validateIndianPinCode('56003'), false);
  assert.equal(validateIndianPinCode('SW1A1A'), false);
});

test('isCoordinateWithinIndia accepts Indian cities & islands and rejects overseas coordinates', () => {
  // Indian cities & territories
  assert.equal(isCoordinateWithinIndia(12.9716, 77.5946), true); // Bengaluru
  assert.equal(isCoordinateWithinIndia(12.2958, 76.6394), true); // Mysuru
  assert.equal(isCoordinateWithinIndia(13.0827, 80.2707), true); // Chennai
  assert.equal(isCoordinateWithinIndia(17.385, 78.4867), true); // Hyderabad
  assert.equal(isCoordinateWithinIndia(9.9312, 76.2673), true); // Kochi
  assert.equal(isCoordinateWithinIndia(18.5204, 73.8567), true); // Pune
  assert.equal(isCoordinateWithinIndia(28.6139, 77.209), true); // New Delhi
  assert.equal(isCoordinateWithinIndia(26.1445, 91.7362), true); // Guwahati
  assert.equal(isCoordinateWithinIndia(34.0837, 74.7973), true); // Srinagar
  assert.equal(isCoordinateWithinIndia(11.6234, 92.7265), true); // Port Blair (Andaman)
  assert.equal(isCoordinateWithinIndia(10.5669, 72.6417), true); // Kavaratti (Lakshadweep)

  // Overseas coordinates rejected
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

test('validateIssueSubmission rejects overseas locations, invalid PIN codes, and non-IN country codes', () => {
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

test('generateReportId, status updates, and state/city filtering work accurately for India records', () => {
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

test('initiative validation, volunteer capacity, and state-filtered dashboard metrics work cleanly', () => {
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
    dateLabel: 'Sat, Nov 28, 2026',
    timeLabel: '08:00 AM - 11:00 AM',
    capacity: 20,
  });
  assert.equal(invalidInit.valid, false);
  assert.ok(invalidInit.errors.country_code);
  assert.ok(invalidInit.errors.pin_code);

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
      dateLabel: 'Sat, Nov 21, 2026',
      timeLabel: '08:00 AM - 11:00 AM',
      capacity: 2,
      registeredCount: 1,
      status: 'Open',
      organizer: 'Bengaluru Ward Civic Circle',
      highlights: ['Gloves and sorting bags provided'],
    },
  ];
  assert.equal(assertValidIndiaInitiativeRecord(initiatives[0]), true);

  const reg1 = registerVolunteerForInitiative(initiatives, [], 'init-blr-1', {
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
      isAnonymous: true,
    },
    [],
  );
  const issueDel = applyIssueStatusUpdate(
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
        isAnonymous: true,
      },
      [issueBlr.id],
    ),
    IssueStatus.Resolved,
    'Repaired by local volunteers.',
    { approveEvidence: true },
  );

  const delhiMetrics = computeDashboardMetrics([issueBlr, issueDel], initiatives, {
    state: 'Delhi',
    city: 'All',
  });
  assert.equal(delhiMetrics.totalReports, 1);
  assert.equal(delhiMetrics.resolvedIssues, 1);

  const badSignup = validateSignupForm({
    fullName: 'A',
    email: 'invalid-email',
    password: '123',
    confirmPassword: '456',
    role: UserRole.Volunteer,
  });
  assert.equal(badSignup.valid, false);
});
