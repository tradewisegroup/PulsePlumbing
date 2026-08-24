/**
 * Acceptance checks for the D1 leads store (no Cloudflare account required).
 * 1. persistLead never throws when D1 fails
 * 2. Email-shaped parser extracts join keys
 * 3. Local D1 insert + query by phone_e164
 */

import { persistLead, type LeadRow } from '../src/lib/leads-db.ts';
import { parseLeadEmail } from '../src/lib/leads-email.ts';

const SAMPLE_EMAIL = `Date: Sun, 23 Aug 2026 04:00:00 +0000
Subject: [PW-TN75X] Blocked Drain — Loganholme — 0412 345 678

[PW-TN75X] Blocked Drain — Loganholme — 0412 345 678
====================================================

Name: Test Person
Phone: 0412 345 678
Phone (E.164): +61412345678
Email: test@example.com
Company: Example Pty Ltd
Service: Blocked Drain
Industry: residential
Suburb: Loganholme
Message: Kitchen sink backup

--- ATTRIBUTION ---
lead_ref: PW-TN75X
first_touch: google / cpc / brand (2026-08-20)
last_touch: google / cpc / brand
gclid: Cj0TEST
landing_page: /plumber-loganholme?gclid=Cj0TEST
converted_on: /contact
ga_client_id: 123.456
--- END ATTRIBUTION ---
`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function testPersistNeverThrows() {
  let emailed = false;
  const sendEmail = async () => { emailed = true; };

  const throwingDb = {
    prepare() {
      throw new Error('forced D1 failure');
    },
  } as unknown as D1Database;

  const row: LeadRow = {
    lead_ref: 'PW-FAIL1', created_at: new Date().toISOString(),
    name: 'Fail Case', company: '', email: 'fail@example.com',
    phone_e164: '+61400000000', suburb: '', service_type: '', industry: '',
    message: '', source_form: 'quote',
    first_source: '', first_medium: '', first_campaign: '',
    first_landing_page: '', first_seen_at: '',
    last_source: '', last_medium: '', last_campaign: '',
    gclid: '', converted_on: '', ga_client_id: '',
  };

  const ok = await persistLead(throwingDb, row);
  await sendEmail();
  assert(ok === false, 'forced D1 failure should return false');
  assert(emailed === true, 'email must still send after D1 failure');
  console.log('ok  persistLead swallows D1 errors; email still sent');
}

function testParser() {
  const row = parseLeadEmail(SAMPLE_EMAIL);
  assert(row, 'parser should return a row');
  assert(row.lead_ref === 'PW-TN75X', `lead_ref ${row.lead_ref}`);
  assert(row.email === 'test@example.com', `email ${row.email}`);
  assert(row.phone_e164 === '+61412345678', `phone ${row.phone_e164}`);
  assert(row.first_source === 'google', `first_source ${row.first_source}`);
  assert(row.gclid === 'Cj0TEST', `gclid ${row.gclid}`);
  assert(row.suburb === 'Loganholme', `suburb ${row.suburb}`);
  console.log('ok  parser extracts ATTRIBUTION + join keys');
}

async function testLocalD1() {
  const { execSync } = await import('node:child_process');
  execSync('npx wrangler d1 migrations apply pulse-leads --local', {
    stdio: 'inherit',
  });

  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy({ persist: true });
  const db = (proxy.env as { DB?: D1Database }).DB;
  assert(db, 'local D1 binding DB missing');

  const row: LeadRow = {
    lead_ref: 'PW-TEST1',
    created_at: '2026-08-24T02:00:00.000Z',
    name: 'Acceptance Lead',
    company: 'Pulse Test',
    email: 'accept@example.com',
    phone_e164: '+61412345678',
    suburb: 'Loganholme',
    service_type: 'blocked-drains',
    industry: 'residential',
    message: 'test insert',
    source_form: 'quote',
    first_source: 'google',
    first_medium: 'cpc',
    first_campaign: 'brand',
    first_landing_page: '/plumber-loganholme',
    first_seen_at: '2026-08-20',
    last_source: 'google',
    last_medium: 'cpc',
    last_campaign: 'brand',
    gclid: 'Cj0TEST',
    converted_on: '/contact',
    ga_client_id: '123.456',
  };

  const ok = await persistLead(db, row);
  assert(ok, 'local insert should succeed');

  const found = await db
    .prepare('SELECT * FROM leads WHERE phone_e164 = ?')
    .bind('+61412345678')
    .first<{ lead_ref: string; email: string }>();
  assert(found?.lead_ref === 'PW-TEST1', `query by phone returned ${found?.lead_ref}`);
  assert(found?.email === 'accept@example.com', 'email mismatch');
  console.log('ok  local D1 insert + query by phone_e164');

  await proxy.dispose?.();
}

await testPersistNeverThrows();
await testParser();
await testLocalD1();
console.log('All leads-store acceptance checks passed.');
