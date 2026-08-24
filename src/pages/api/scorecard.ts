/**
 * POST /api/scorecard
 * OPTIONS /api/scorecard  (CORS preflight)
 *
 * Processes compliance scorecard lead submissions.
 *
 * Delivery guarantee
 * ──────────────────
 * Email via Resend is the PRIMARY path.
 * Returns 502 if email fails — the lead is never silently discarded.
 *
 * Required env vars
 * ─────────────────
 * RESEND_API_KEY      Resend API key
 *
 * Optional env vars
 * ─────────────────
 * LEAD_NOTIFY_TO      Recipient (default: admin@pulseqld.com.au)
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import type { Attribution } from '../../lib/attribution';
import { leadRef } from '../../lib/lead';
import { getLeadsDb, persistLead } from '../../lib/leads-db';
import { sendLeadNotification, LEAD_NOTIFY_TO } from '../../lib/notify';

// ─── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGIN =
  import.meta.env.CORS_ORIGIN ?? 'https://pulseqld.com.au';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',
};

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScorecardPayload {
  email:   string;
  score:   number;
  risk:    string;
  answers: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function validate(p: ScorecardPayload): string | null {
  if (!p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
    return 'A valid email address is required.';
  if (typeof p.score !== 'number' || p.score < 0 || p.score > 10)
    return 'Invalid score value.';
  return null;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const POST: APIRoute = async ({ request, locals }) => {
  // ── Parse ──────────────────────────────────────────────────────────────────
  let payload: ScorecardPayload;
  try {
    const ct = request.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      return json({ success: false, error: 'Expected application/json.' }, 415);
    }
    payload = await request.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400);
  }

  payload.email = str(payload.email).toLowerCase();

  // ── Validate ───────────────────────────────────────────────────────────────
  const validationError = validate(payload);
  if (validationError) {
    return json({ success: false, error: validationError }, 400);
  }

  // ── Context ────────────────────────────────────────────────────────────────
  const ipAddress =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')  ??
    '0.0.0.0';
  const pageUri =
    request.headers.get('referer') ?? 'https://pulseqld.com.au/strata-scorecard';

  const ref     = leadRef();
  const answers = Object.entries(payload.answers)
    .map(([q, pts]) => `${q}: ${pts} pts`)
    .join(' | ');

  // ── D1 (queryable record — never blocks the email) ─────────────────────────
  await persistLead(getLeadsDb(locals), {
    lead_ref:           ref,
    created_at:         new Date().toISOString(),
    name:               'Scorecard lead',
    company:            '',
    email:              payload.email,
    phone_e164:         '',
    suburb:             '',
    service_type:       'compliance-scorecard',
    industry:           '',
    message:            `Score ${payload.score}/10 — ${payload.risk}`,
    source_form:        'compliance-scorecard',
    first_source:       '',
    first_medium:       '',
    first_campaign:     '',
    first_landing_page: pageUri,
    first_seen_at:      '',
    last_source:        '',
    last_medium:        '',
    last_campaign:      '',
    gclid:              '',
    converted_on:       pageUri,
    ga_client_id:       '',
  });

  // ── Email notification (PRIMARY — hard failure) ────────────────────────────
  try {
    await sendLeadNotification({
      to:  LEAD_NOTIFY_TO,
      ref,
      subjectSuffix: `Scorecard Lead — ${payload.risk} (${payload.score}/10) — ${payload.email}`,
      fields: [
        ['Email',        payload.email],
        ['Score',        `${payload.score} / 10`],
        ['Risk Level',   payload.risk],
        ['Answers',      answers],
        ['Source',       'Strata Compliance Scorecard'],
      ],
      attribution: { pageUri, ipAddress },
    });
  } catch (err) {
    console.error('[notify] Scorecard email failed:', err);
    return json(
      { success: false, error: "We couldn't submit your enquiry. Please call 0452 188 420." },
      502,
    );
  }

  return json({ success: true, ref });
};
