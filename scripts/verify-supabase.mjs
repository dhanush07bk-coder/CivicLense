#!/usr/bin/env node
/**
 * Live Supabase Verification Script for Civilense (Phase 2B).
 *
 * Runs real HTTP checks against a provisioned Supabase project ONLY when
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured (and non-placeholder).
 * Covers all 7 public_* tables using their live columns:
 *   - public_profiles
 *   - public_civic_issues
 *   - public_issue_timeline
 *   - public_community_initiatives
 *   - public_volunteer_registrations
 *   - public_intervention_evidence
 *   - public_issue_followups
 *
 * If optional TEST_CITIZEN_EMAIL / TEST_CITIZEN_PASSWORD env vars are supplied,
 * also tests authenticated RBAC isolation.
 */
import { createClient } from '@supabase/supabase-js';

const url = (process.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isPlaceholder =
  !url ||
  !anonKey ||
  url.includes('your-project-ref.supabase.co') ||
  anonKey.includes('your-supabase-anon-key');

if (isPlaceholder) {
  console.log(
    'SKIPPED: Live Supabase verification skipped because VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured with a provisioned Supabase project.',
  );
  process.exit(0);
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failed = 0;
function pass(label) {
  console.log(`PASS: ${label}`);
}
function fail(label, err) {
  failed += 1;
  console.error(`FAIL: ${label} -> ${err?.message || err}`);
}

async function main() {
  // 1. Public columns on public_civic_issues (reporter_id excluded)
  const { error: publicIssuesErr } = await client
    .from('public_civic_issues')
    .select('id, report_code, title, category, state, district, city, locality, pin_code, country_code, status, created_at')
    .limit(5);
  if (publicIssuesErr) fail('Read public_civic_issues table', publicIssuesErr);
  else pass('Read public_civic_issues table');

  // 2. Public columns on public_issue_timeline (changed_by excluded)
  const { error: timelineErr } = await client
    .from('public_issue_timeline')
    .select('id, issue_id, previous_status, new_status, action_description, created_at')
    .limit(5);
  if (timelineErr) fail('Read public_issue_timeline table', timelineErr);
  else pass('Read public_issue_timeline table');

  // 3. Public columns on public_community_initiatives
  const { error: initiativesErr } = await client
    .from('public_community_initiatives')
    .select('id, title, description, country_code, state, district, city, locality, pin_code, event_date, start_time, end_time, capacity, status, created_at')
    .limit(5);
  if (initiativesErr) fail('Read public_community_initiatives table', initiativesErr);
  else pass('Read public_community_initiatives table');

  // 4. Approved evidence on public_intervention_evidence (submitted_by / verified_by excluded)
  const { error: evidenceErr } = await client
    .from('public_intervention_evidence')
    .select('id, issue_id, initiative_id, evidence_type, image_path, verification_status, created_at')
    .eq('verification_status', 'Approved')
    .limit(5);
  if (evidenceErr) fail('Read public_intervention_evidence table', evidenceErr);
  else pass('Read public_intervention_evidence table');

  // 5. Sanitized follow-ups on public_issue_followups (checked_by excluded)
  const { error: followupsErr } = await client
    .from('public_issue_followups')
    .select('id, issue_id, checked_at, recurrence_detected, observations, evidence_path')
    .limit(5);
  if (followupsErr) fail('Read public_issue_followups table', followupsErr);
  else pass('Read public_issue_followups table');

  // 6. Direct unauthenticated select on public_profiles must be blocked by RLS
  const { data: leakedProfiles, error: profilesErr } = await client
    .from('public_profiles')
    .select('id, full_name, role')
    .limit(5);
  if (!profilesErr && Array.isArray(leakedProfiles) && leakedProfiles.length > 0) {
    fail('RLS blocks anonymous public_profiles read', 'Anonymous query returned profile rows');
  } else {
    pass('RLS blocks anonymous public_profiles read');
  }

  // 7. Direct unauthenticated select on public_volunteer_registrations must not expose user_id
  const { data: leakedRegs, error: regsErr } = await client
    .from('public_volunteer_registrations')
    .select('id, user_id')
    .limit(5);
  if (!regsErr && Array.isArray(leakedRegs) && leakedRegs.length > 0) {
    fail('RLS blocks anonymous user_id exposure in public_volunteer_registrations', 'Returned rows to anon');
  } else {
    pass('RLS blocks anonymous user_id exposure in public_volunteer_registrations');
  }

  // 8. Trusted is_coordinator() check returns false for anon
  const { data: isCoord, error: coordErr } = await client.rpc('is_coordinator');
  if (coordErr || isCoord !== false) {
    fail('is_coordinator() returns false for anonymous visitor', coordErr || `Got ${isCoord}`);
  } else {
    pass('is_coordinator() returns false for anonymous visitor');
  }

  // 9. DB-level India-only constraint rejects non-India country_code
  const { error: geoErr } = await client.from('public_civic_issues').insert({
    report_code: 'CIV-2026-9999',
    title: 'Geo boundary test outside India',
    description: 'Should be rejected by country_code check constraint.',
    category: 'Waste and Sanitation',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    locality: 'Indiranagar',
    pin_code: '560038',
    country_code: 'GB',
    is_anonymous: true,
    status: 'Submitted',
  });
  if (!geoErr) {
    fail('DB rejects non-India country_code', 'Unexpectedly accepted non-India insert');
  } else {
    pass(`DB rejects non-India country_code (${geoErr.message})`);
  }

  // 10. Optional authenticated Citizen RBAC check if credentials provided
  const citizenEmail = process.env.TEST_CITIZEN_EMAIL;
  const citizenPassword = process.env.TEST_CITIZEN_PASSWORD;
  if (citizenEmail && citizenPassword) {
    const { error: loginErr } = await client.auth.signInWithPassword({
      email: citizenEmail,
      password: citizenPassword,
    });
    if (loginErr) {
      fail('Citizen sign in', loginErr);
    } else {
      pass('Citizen sign in');
      const { data: coordFlag } = await client.rpc('is_coordinator');
      if (coordFlag !== false) {
        fail('Citizen is_coordinator() is false', `Got ${coordFlag}`);
      } else {
        pass('Citizen is_coordinator() is false');
      }
      await client.auth.signOut();
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
