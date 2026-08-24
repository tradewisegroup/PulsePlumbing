/**
 * POST /api/call
 *
 * Webhook the call-tracking provider (AVANSER or Delacon) hits on
 * call completion. Switching provider is a payload-shape difference
 * handled here — not a deploy of new pages.
 *
 * Header: CALL_WEBHOOK_SECRET: <shared secret>
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import type { Attribution } from '../../lib/attribution';
import { persistLeadFromModel } from '../../lib/leads-db';
import { buildLead, leadRef, normalisePhoneE164 } from '../../lib/lead';
import { workerVar } from '../../lib/worker-env';

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function first(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = str(record[key]);
    if (value) return value;
  }
  return '';
}

function secretFrom(request: Request): string {
  return (
    request.headers.get('CALL_WEBHOOK_SECRET') ||
    request.headers.get('call_webhook_secret') ||
    ''
  ).trim();
}

function expectedSecret(): string {
  return (
    workerVar('CALL_WEBHOOK_SECRET') ||
    (typeof process !== 'undefined' ? process.env?.CALL_WEBHOOK_SECRET ?? '' : '') ||
    (import.meta.env.CALL_WEBHOOK_SECRET as string | undefined) ||
    ''
  ).trim();
}

function secretsMatch(provided: string, expected: string): boolean {
  if (!expected || provided.length !== expected.length) return false;
  let out = 0;
  for (let i = 0; i < expected.length; i++) {
    out |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return out === 0;
}

/** Flatten AVANSER / Delacon / generic completion payloads. */
export function normalizeCallPayload(raw: Record<string, unknown>): {
  caller: string;
  duration: string;
  recordingUrl: string;
  numberType: 'office' | 'emergency';
  source: string;
  medium: string;
  campaign: string;
  gclid: string;
  landingPage: string;
  callerName: string;
} {
  const caller = first(raw, [
    'caller', 'caller_number', 'callerNumber', 'CallerNumber',
    'ani', 'cli', 'from', 'from_number',
  ]);
  const duration = first(raw, [
    'duration', 'call_duration', 'callDuration', 'Duration', 'talk_time',
  ]);
  const recordingUrl = first(raw, [
    'recording_url', 'recordingUrl', 'RecordingUrl', 'recording', 'call_recording',
  ]);
  const dest = first(raw, [
    'called', 'called_number', 'calledNumber', 'dnis', 'tracking_number',
    'trackingNumber', 'to', 'number_type', 'numberType', 'pool',
  ]).toLowerCase();
  const numberType: 'office' | 'emergency' =
    dest.includes('office') || dest.includes('0721504175') || dest.includes('21504175')
      ? 'office'
      : 'emergency';

  return {
    caller,
    duration,
    recordingUrl,
    numberType,
    source: first(raw, ['source', 'utm_source', 'utmSource', 'first_source']),
    medium: first(raw, ['medium', 'utm_medium', 'utmMedium', 'first_medium']),
    campaign: first(raw, ['campaign', 'utm_campaign', 'utmCampaign', 'first_campaign']),
    gclid: first(raw, ['gclid', 'Gclid', 'gclid_value']),
    landingPage: first(raw, [
      'landing_page', 'landingPage', 'landing', 'page', 'first_landing_page',
    ]),
    callerName: first(raw, ['caller_name', 'callerName', 'name', 'CallerName']),
  };
}

export const POST: APIRoute = async ({ request }) => {
  const expected = expectedSecret();
  if (!expected || !secretsMatch(secretFrom(request), expected)) {
    return json({ success: false, error: 'Unauthorized.' }, 401);
  }

  let raw: Record<string, unknown>;
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const fd = await request.formData();
      raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : v.name]));
    } else {
      raw = await request.json();
    }
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400);
  }

  const call = normalizeCallPayload(raw);
  if (!call.caller) {
    return json({ success: false, error: 'caller number is required.' }, 400);
  }

  const phone = normalisePhoneE164(call.caller);
  const ref = leadRef('PC');
  const attribution = {
    first_utm_source: call.source,
    first_utm_medium: call.medium,
    first_utm_campaign: call.campaign,
    first_gclid: call.gclid,
    first_landing_page: call.landingPage,
    last_utm_source: call.source,
    last_utm_medium: call.medium,
    last_utm_campaign: call.campaign,
    last_gclid: call.gclid,
    page_path: call.landingPage,
  } as Attribution;

  const message = [
    `Inbound ${call.numberType} call`,
    call.duration ? `Duration: ${call.duration}` : '',
    call.recordingUrl ? `Recording: ${call.recordingUrl}` : '',
  ].filter(Boolean).join('\n');

  const lead = buildLead(
    {
      name: call.callerName || 'Inbound call',
      phone,
      email: '',
      source_form: 'call',
      service_type: call.numberType === 'office' ? 'office-call' : 'emergency-call',
      message,
    },
    attribution,
    ref,
  );

  const ok = await persistLeadFromModel(lead);
  if (!ok) {
    console.error('[call] D1 persist failed', ref);
    return json({ success: false, error: 'Lead not stored.', ref }, 503);
  }

  return json({ success: true, ref });
};
