/**
 * Acceptance checks for call tracking / DNI.
 * 1. Real numbers stay in CallLink and footer NAP (no data-dni on NAP)
 * 2. JSON-LD telephone fields stay static
 * 3. Provider payload → PC- D1 row
 * 4. Bad webhook secret → 401
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { normalizeCallPayload, POST } from '../src/pages/api/call.ts';
import { leadRef } from '../src/lib/lead.ts';
import { telHref, displayNumber, callLinkAttrs } from '../src/lib/call-numbers.ts';
import { setWorkerEnv } from '../src/lib/worker-env.ts';

const SECRET = 'test-call-webhook-secret';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testStaticNumbers() {
  assert(telHref('office') === 'tel:0721504175', `office href ${telHref('office')}`);
  assert(telHref('emergency') === 'tel:0452188420', `emergency href ${telHref('emergency')}`);
  assert(displayNumber('office') === '07 2150 4175', 'office display');
  assert(displayNumber('emergency') === '0452 188 420', 'emergency display');

  const dni = callLinkAttrs('hero', 'office');
  assert(dni['data-dni'] === 'true', 'CTA attrs include data-dni');
  assert(dni.href === 'tel:0721504175', 'CTA href is the real number');

  const nap = callLinkAttrs('footer', 'office', { staticNumber: true });
  assert(nap['data-dni'] === undefined, 'NAP attrs must not set data-dni');
  assert(nap.href === 'tel:0721504175', 'NAP href is the real number');
  console.log('ok  CallLink attrs: real number always; data-dni only on CTAs');
}

function testSourceGuards() {
  const callLink = readFileSync('src/components/CallLink.astro', 'utf8');
  assert(callLink.includes('staticNumber'), 'CallLink supports staticNumber');
  assert(callLink.includes('data-dni'), 'CallLink emits data-dni on CTAs');

  const footer = readFileSync('src/components/Footer.astro', 'utf8');
  assert(footer.includes('staticNumber'), 'footer NAP uses staticNumber');

  const schema = readFileSync('src/components/seo/Schema.astro', 'utf8');
  assert(!schema.includes('data-dni'), 'Schema.astro must not carry data-dni');
  assert(schema.includes('EMERGENCY_PHONE_TEL') || schema.includes('telephone'), 'schema has telephone');

  const base = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
  assert(base.includes('telephone: [EMERGENCY_PHONE_TEL, OFFICE_PHONE_TEL]'), 'BaseLayout schema uses real numbers');
  assert(!base.includes('data-dni'), 'BaseLayout schema has no data-dni');

  const dni = readFileSync('src/lib/dni.ts', 'utf8');
  assert(dni.includes("PUBLIC_CALL_TRACKING_ENABLED !== 'true'"), 'DNI no-ops when tracking is off');
  assert(dni.includes('leave real numbers'), 'DNI fails silent');
  console.log('ok  NAP + JSON-LD stay static; DNI is opt-in');
}

function testPayloadShapes() {
  const avanser = normalizeCallPayload({
    CallerNumber: '0412 345 678',
    Duration: '93',
    RecordingUrl: 'https://example.com/rec.mp3',
    dnis: '0721504175',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'brand',
    gclid: 'Cj0TESTCALL',
    landing_page: '/plumber-loganholme?gclid=Cj0TESTCALL',
    CallerName: 'Test Caller',
  });
  assert(avanser.caller.includes('0412'), `caller ${avanser.caller}`);
  assert(avanser.numberType === 'office', `numberType ${avanser.numberType}`);
  assert(avanser.gclid === 'Cj0TESTCALL', 'gclid pass-through');
  assert(avanser.source === 'google', 'utm_source pass-through');

  const delacon = normalizeCallPayload({
    ani: '0412987654',
    talk_time: '45',
    recording: 'https://example.com/d.wav',
    tracking_number: '0452188420',
    source: 'bing',
    medium: 'cpc',
    campaign: 'emergency',
    gclid: '',
    landingPage: '/contact',
  });
  assert(delacon.numberType === 'emergency', 'delacon emergency pool');
  assert(delacon.source === 'bing', 'delacon source');
  assert(leadRef('PC').startsWith('PC-'), 'call refs use PC- prefix');
  console.log('ok  AVANSER / Delacon payloads flatten to attribution fields');
}

async function testWebhookAuthAndPersist() {
  execSync('npx wrangler d1 migrations apply pulse-leads --local', { stdio: 'inherit' });
  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy({ persist: true });
  const db = (proxy.env as { DB?: D1Database }).DB;
  assert(db, 'local D1 binding DB missing');

  setWorkerEnv({ DB: db, CALL_WEBHOOK_SECRET: SECRET });

  const denied = await POST({
    request: new Request('https://pulseqld.com.au/api/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', CALL_WEBHOOK_SECRET: 'wrong' },
      body: JSON.stringify({ caller: '0412345678' }),
    }),
  } as Parameters<typeof POST>[0]);
  assert(denied.status === 401, `bad secret status ${denied.status}`);
  console.log('ok  webhook rejects a bad CALL_WEBHOOK_SECRET');

  const accepted = await POST({
    request: new Request('https://pulseqld.com.au/api/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', CALL_WEBHOOK_SECRET: SECRET },
      body: JSON.stringify({
        caller_number: '0412 345 678',
        duration: '120',
        recording_url: 'https://example.com/rec.mp3',
        number_type: 'office',
        source: 'google',
        medium: 'cpc',
        campaign: 'brand',
        gclid: 'Cj0TESTCALL',
        landing_page: '/plumber-loganholme?gclid=Cj0TESTCALL',
        caller_name: 'Acceptance Call',
      }),
    }),
  } as Parameters<typeof POST>[0]);

  const body = await accepted.json() as { success?: boolean; ref?: string; error?: string };
  assert(accepted.status === 200, `webhook status ${accepted.status} ${body.error ?? ''}`);
  assert(body.success === true, 'webhook success');
  assert(typeof body.ref === 'string' && body.ref.startsWith('PC-'), `ref ${body.ref}`);

  const found = await db
    .prepare('SELECT * FROM leads WHERE lead_ref = ?')
    .bind(body.ref)
    .first<{
      lead_ref: string;
      source_form: string;
      gclid: string;
      first_source: string;
      message: string;
      phone_e164: string;
    }>();
  assert(found?.lead_ref === body.ref, 'PC- row missing');
  assert(found.source_form === 'call', `source_form ${found.source_form}`);
  assert(found.gclid === 'Cj0TESTCALL', `gclid ${found.gclid}`);
  assert(found.first_source === 'google', `first_source ${found.first_source}`);
  assert(found.phone_e164 === '+61412345678', `phone ${found.phone_e164}`);
  assert(found.message.includes('Duration: 120'), 'duration stored');
  assert(found.message.includes('https://example.com/rec.mp3'), 'recording URL stored');
  console.log(`ok  POST /api/call created ${found.lead_ref}`);

  await proxy.dispose?.();
}

await testStaticNumbers();
await testSourceGuards();
await testPayloadShapes();
await testWebhookAuthAndPersist();
console.log('All call-tracking acceptance checks passed.');
