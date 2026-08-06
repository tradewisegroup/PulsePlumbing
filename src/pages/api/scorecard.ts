/**
 * POST /api/scorecard
 * OPTIONS /api/scorecard  (CORS preflight)
 *
 * Processes compliance scorecard lead submissions:
 *  1. Validate email server-side
 *  2. Submit to HubSpot Forms API with compliance_score + scorecard-lead tag
 *  3. Return { success } | { success: false, error }
 *
 * Required env vars (shared with /api/contact)
 * ────────────────────────────────────────────
 * HUBSPOT_PORTAL_ID
 * HUBSPOT_SCORECARD_FORM_ID   HubSpot form GUID for scorecard leads.
 *                              Falls back to HUBSPOT_FORM_ID if not set.
 */

export const prerender = false;

import type { APIRoute } from 'astro';

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

// ─── HubSpot ──────────────────────────────────────────────────────────────────

const HUBSPOT_PORTAL_ID = import.meta.env.HUBSPOT_PORTAL_ID ?? '';
const HUBSPOT_SCORECARD_FORM_ID =
  import.meta.env.HUBSPOT_SCORECARD_FORM_ID ??
  import.meta.env.HUBSPOT_FORM_ID           ?? '';
const HUBSPOT_API_BASE =
  import.meta.env.HUBSPOT_API_BASE ?? 'https://api-ap1.hsforms.com';

async function submitToHubSpot(
  p: ScorecardPayload,
  ipAddress: string,
  pageUri: string,
): Promise<void> {
  if (!HUBSPOT_PORTAL_ID || !HUBSPOT_SCORECARD_FORM_ID) {
    console.warn('[HubSpot] Scorecard credentials not configured — skipping.');
    return;
  }

  // Summarise individual answers as a note for the sales team
  const answerSummary = Object.entries(p.answers)
    .map(([q, pts]) => `${q}: ${pts} pts`)
    .join(' | ');

  const payload = {
    fields: [
      { name: 'email',            value: p.email },
      { name: 'hs_lead_source',   value: 'Strata Scorecard' },
      // compliance_score is a custom HubSpot property — create it in your portal
      { name: 'compliance_score', value: String(p.score) },
      { name: 'message',          value: `Compliance scorecard result: ${p.risk} (${p.score}/10)\n${answerSummary}` },
    ],
    context: {
      ipAddress,
      pageUri,
      pageName: 'Strata Compliance Scorecard',
    },
    legalConsentOptions: {
      consent: {
        consentToProcess: true,
        text: 'I agree to allow Pulse Plumbing, Gas & Civil to store and process my personal data.',
      },
    },
  };

  const res = await fetch(
    `${HUBSPOT_API_BASE}/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_SCORECARD_FORM_ID}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`HubSpot submission failed (${res.status}): ${text}`);
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const POST: APIRoute = async ({ request }) => {
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

  // Normalise email
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

  // ── HubSpot ────────────────────────────────────────────────────────────────
  try {
    await submitToHubSpot(payload, ipAddress, pageUri);
  } catch (err) {
    console.error('[HubSpot] Scorecard submission error:', err);
    // Non-blocking: the user has already seen their results — log but don't block
    return json(
      { success: false, error: 'Score could not be saved. Please call 0452 188 420.' },
      500,
    );
  }

  return json({ success: true });
};
