/**
 * POST /api/contact
 * OPTIONS /api/contact  (CORS preflight)
 *
 * Processes all quote / contact form submissions:
 *  1. Validate required fields server-side
 *  2. Submit to HubSpot Forms API
 *  3. Upsert client + create task in AroFlo
 *  4. Return { success, arofloTaskId } | { success: false, error }
 *
 * Runs on Cloudflare Workers edge (SSR). Never reaches the browser bundle.
 *
 * Required env vars
 * ─────────────────
 * HUBSPOT_PORTAL_ID        HubSpot account portal ID
 * HUBSPOT_FORM_ID          Default form GUID (overridable per-form via body.form_id)
 * AROFLO_USERNAME          AroFlo API username
 * AROFLO_PASSWORD          AroFlo API password
 * AROFLO_SECRET_KEY        AroFlo HMAC signing secret
 * AROFLO_BASE_URL          AroFlo base URL (defaults to https://api.aroflo.com)
 *
 * Optional env vars
 * ─────────────────
 * CORS_ORIGIN              Allowed origin — defaults to https://pulseqld.com.au
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { createLeadFromForm } from '../../lib/aroflo';

// ─── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGIN =
  import.meta.env.CORS_ORIGIN ?? 'https://pulseqld.com.au';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',
};

/** Attach CORS + Content-Type headers to every response. */
function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  firstname:      string;
  lastname:       string;
  email:          string;
  phone:          string;
  company:        string;
  service_type:   string;
  industry:       string;
  suburb:         string;
  message:        string;
  preferred_time: string;
  source:         string;
  page_source:    string;
  utm_source:     string;
  utm_medium:     string;
  utm_campaign:   string;
}

// ─── Field normalisation ──────────────────────────────────────────────────────

/**
 * Split a full name on the first space.
 * "Jane Smith"     → { firstname: 'Jane',  lastname: 'Smith' }
 * "Jane Ann Smith" → { firstname: 'Jane',  lastname: 'Ann Smith' }
 * "Cher"           → { firstname: 'Cher',  lastname: '' }
 */
function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/);
  return {
    firstname: parts[0] ?? '',
    lastname:  parts.slice(1).join(' '),
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalise(raw: Record<string, string>): FormData {
  // Accept full_name (QuoteForm) OR firstname + lastname (inline page forms)
  let firstname = str(raw.firstname);
  let lastname  = str(raw.lastname);
  if (!firstname && raw.full_name) {
    ({ firstname, lastname } = splitName(raw.full_name));
  }

  return {
    firstname,
    lastname,
    email:          str(raw.email).toLowerCase(),
    phone:          str(raw.phone),
    company:        str(raw.company_name ?? raw.company),
    // Accept service_type (QuoteForm) or service (legacy inline forms)
    service_type:   str(raw.service_type ?? raw.service),
    industry:       str(raw.industry),
    // Accept suburb (QuoteForm) or location (legacy inline forms)
    suburb:         str(raw.suburb ?? raw.location),
    message:        str(raw.message),
    preferred_time: str(raw.preferred_time),
    source:         str(raw.source ?? raw.page_source) || 'Website',
    page_source:    str(raw.page_source),
    utm_source:     str(raw.utm_source),
    utm_medium:     str(raw.utm_medium),
    utm_campaign:   str(raw.utm_campaign),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(d: FormData): string | null {
  if (!d.firstname)
    return 'Name is required.';
  if (!d.phone)
    return 'Phone number is required.';
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    return 'A valid email address is required.';
  return null;
}

// ─── HubSpot ──────────────────────────────────────────────────────────────────

const HUBSPOT_PORTAL_ID = import.meta.env.HUBSPOT_PORTAL_ID ?? '';
const HUBSPOT_FORM_ID   = import.meta.env.HUBSPOT_FORM_ID   ?? '';
// ap1 = Asia Pacific region; change to api.hsforms.com for US-hosted accounts
const HUBSPOT_API_BASE  = import.meta.env.HUBSPOT_API_BASE  ?? 'https://api-ap1.hsforms.com';

/**
 * POST to the HubSpot Forms v3 submission endpoint.
 * Returns true on success, throws on hard failure.
 * Logs a warning and returns true when credentials are not yet configured
 * (so the user is never blocked during development / pre-launch setup).
 */
async function submitToHubSpot(
  d: FormData,
  formId: string,
  ipAddress: string,
  pageUri: string,
): Promise<void> {
  if (!HUBSPOT_PORTAL_ID || !formId) {
    console.warn('[HubSpot] Credentials not configured — skipping CRM submission.');
    return;
  }

  const optField = (name: string, value: string) =>
    value ? [{ name, value }] : [];

  const payload = {
    fields: [
      { name: 'firstname', value: d.firstname },
      { name: 'lastname',  value: d.lastname  },
      { name: 'email',     value: d.email     },
      { name: 'phone',     value: d.phone     },
      ...optField('company',        d.company),
      ...optField('service_type',   d.service_type),
      ...optField('industry',       d.industry),
      ...optField('suburb',         d.suburb),
      ...optField('message',        d.message),
      ...optField('preferred_time', d.preferred_time),
      ...optField('hs_lead_source', d.source),
      ...optField('utm_source',     d.utm_source),
      ...optField('utm_medium',     d.utm_medium),
      ...optField('utm_campaign',   d.utm_campaign),
    ],
    context: {
      ipAddress,
      pageUri,
      pageName: d.page_source || 'Website',
    },
    legalConsentOptions: {
      consent: {
        consentToProcess: true,
        text: 'I agree to allow Pulse Plumbing & Gas to store and process my personal data.',
        communications: [
          {
            value: true,
            subscriptionTypeId: 999,
            text: 'I agree to receive communications from Pulse Plumbing & Gas.',
          },
        ],
      },
    },
  };

  const res = await fetch(
    `${HUBSPOT_API_BASE}/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${formId}`,
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

// ─── Request body parsing ─────────────────────────────────────────────────────

async function parseBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') ?? '';

  if (ct.includes('application/json')) {
    return request.json();
  }

  if (
    ct.includes('application/x-www-form-urlencoded') ||
    ct.includes('multipart/form-data')
  ) {
    const fd = await request.formData();
    const out: Record<string, string> = {};
    fd.forEach((value, key) => { out[key] = value.toString(); });
    return out;
  }

  throw Object.assign(new Error('Unsupported content type.'), { status: 415 });
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** Handle CORS preflight. */
export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const POST: APIRoute = async ({ request }) => {
  // ── Parse ──────────────────────────────────────────────────────────────────
  let raw: Record<string, string>;
  try {
    raw = await parseBody(request);
  } catch (err: any) {
    return json({ success: false, error: err.message ?? 'Bad request.' }, err.status ?? 400);
  }

  // ── Normalise + validate ───────────────────────────────────────────────────
  const data = normalise(raw);
  const validationError = validate(data);
  if (validationError) {
    return json({ success: false, error: validationError }, 400);
  }

  // ── Context ────────────────────────────────────────────────────────────────
  const ipAddress =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')  ??
    '0.0.0.0';
  const pageUri = request.headers.get('referer') ?? 'https://pulseqld.com.au/contact';

  // Allow each form to route to a specific HubSpot form via a hidden form_id field
  const formId = str(raw.form_id) || HUBSPOT_FORM_ID;

  // ── HubSpot ────────────────────────────────────────────────────────────────
  try {
    await submitToHubSpot(data, formId, ipAddress, pageUri);
  } catch (err) {
    console.error('[HubSpot] Submission error:', err);
    // HubSpot failure is user-facing — we can't confirm the lead was captured
    return json(
      {
        success: false,
        error:
          'We were unable to submit your enquiry. Please call us directly on 0452 188 420.',
      },
      500,
    );
  }

  // ── AroFlo ─────────────────────────────────────────────────────────────────
  // AroFlo failure is non-blocking — HubSpot already captured the lead.
  // createLeadFromForm never throws; soft failures set arofloError: true.
  const arofloResult = await createLeadFromForm({
    name:        [data.firstname, data.lastname].filter(Boolean).join(' '),
    company:     data.company   || undefined,
    phone:       data.phone,
    email:       data.email,
    serviceType: data.service_type,
    industry:    data.industry  || undefined,
    suburb:      data.suburb    || undefined,
    message:     data.message,
  });
  const arofloTaskId = arofloResult.taskId;
  if (arofloResult.arofloError) {
    console.warn('[AroFlo] Lead not created in AroFlo (captured in HubSpot).');
  }

  // ── Success ────────────────────────────────────────────────────────────────
  return json({
    success: true,
    message: "Thanks! We'll call you within 2 hours.",
    arofloTaskId,
  });
};
