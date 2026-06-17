/**
 * POST /api/civil-contact
 * OPTIONS /api/civil-contact  (CORS preflight)
 *
 * Handles civil project enquiry form submissions:
 *  1. Validate required fields server-side
 *  2. Submit to HubSpot Forms API using HUBSPOT_CIVIL_FORM_ID
 *  3. Upsert client + create Civil Enquiry task in AroFlo
 *  4. Send internal notification email to admin@pulseqld.com.au
 *  5. Return { success: true, message } | { success: false, error }
 *
 * Runs on Cloudflare Workers edge (SSR). Never reaches the browser bundle.
 *
 * Required env vars
 * ─────────────────
 * HUBSPOT_PORTAL_ID          HubSpot account portal ID
 * HUBSPOT_CIVIL_FORM_ID      Civil-pipeline HubSpot form GUID
 * AROFLO_BASE_URL            AroFlo base URL (defaults to https://api.aroflo.com)
 * AROFLO_UENCODED            AroFlo uEncoded value
 * AROFLO_PENCODED            AroFlo pEncoded / API Key
 * AROFLO_ORGENCODED          AroFlo orgEncoded value
 * AROFLO_SECRET_KEY          AroFlo HMAC-SHA512 signing secret
 *
 * Optional env vars
 * ─────────────────
 * CORS_ORIGIN                Allowed origin — defaults to https://pulseqld.com.au
 * SENDGRID_API_KEY           If set, sends real email notifications via SendGrid
 *                            If unset, logs notification details and no-ops (TODO)
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { createCivilEnquiry } from '../../lib/aroflo';

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

interface CivilFormData {
  companyName:     string;
  contactName:     string;
  firstName:       string;
  lastName:        string;
  /** Contact's job title / role — maps to HubSpot jobtitle property */
  role:            string;
  email:           string;
  phone:           string;
  projectType:     string;
  /** e.g. "$500k – $1M" | "1m-plus" | "tbd" */
  projectValue:    string;
  projectLocation: string;
  description:     string;
  timeline:        string;
  howFound:        string;
  formId:          string;
  source:          string;
  utm_source:      string;
  utm_medium:      string;
  utm_campaign:    string;
}

// ─── Field helpers ─────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Split a contact name on the first space.
 * "Jane Smith"     → { firstName: 'Jane', lastName: 'Smith' }
 * "Jane Ann Smith" → { firstName: 'Jane', lastName: 'Ann Smith' }
 * "Cher"           → { firstName: 'Cher', lastName: '' }
 */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName:  parts.slice(1).join(' '),
  };
}

function normalise(raw: Record<string, string>): CivilFormData {
  const contactName = str(raw.contactName ?? raw.contact_name);
  const { firstName, lastName } = contactName
    ? splitName(contactName)
    : { firstName: str(raw.firstName ?? raw.firstname), lastName: str(raw.lastName ?? raw.lastname) };

  return {
    companyName:     str(raw.companyName   ?? raw.company_name ?? raw.company),
    contactName,
    firstName,
    lastName,
    role:            str(raw.role ?? raw.jobtitle ?? raw.job_title),
    email:           str(raw.email).toLowerCase(),
    phone:           str(raw.phone),
    projectType:     str(raw.projectType   ?? raw.project_type),
    projectValue:    str(raw.projectValue  ?? raw.project_value),
    projectLocation: str(raw.projectLocation ?? raw.project_location ?? raw.location),
    // Accept "description" (API callers) or "message" (form field name)
    description:     str(raw.description   ?? raw.message),
    timeline:        str(raw.timeline),
    howFound:        str(raw.howFound      ?? raw.how_found),
    formId:          str(raw.form_id),
    source:          str(raw.source) || `Civil — ${str(raw.projectType ?? raw.project_type) || 'general enquiry'}`,
    utm_source:      str(raw.utm_source),
    utm_medium:      str(raw.utm_medium),
    utm_campaign:    str(raw.utm_campaign),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(d: CivilFormData): string | null {
  if (!d.companyName)
    return 'Company name is required.';
  if (!d.firstName)
    return 'Contact name is required.';
  if (!d.phone)
    return 'Phone number is required.';
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    return 'A valid email address is required.';
  if (!d.projectType)
    return 'Project type is required.';
  if (!d.description)
    return 'Project description is required.';
  return null;
}

// ─── HubSpot ──────────────────────────────────────────────────────────────────

const HUBSPOT_PORTAL_ID     = import.meta.env.HUBSPOT_PORTAL_ID     ?? '';
const HUBSPOT_CIVIL_FORM_ID = import.meta.env.HUBSPOT_CIVIL_FORM_ID ?? '';
const HUBSPOT_API_BASE      = import.meta.env.HUBSPOT_API_BASE      ?? 'https://api-ap1.hsforms.com';

/**
 * Submit a civil enquiry to HubSpot Forms v3.
 *
 * Field mapping:
 *   company            → HubSpot company name
 *   firstname/lastname → HubSpot contact name split
 *   phone              → HubSpot phone
 *   email              → HubSpot email (used as contact identity)
 *   project_type       → Custom contact property
 *   project_value      → Custom contact property
 *   project_location   → Custom contact property (maps to suburb/city)
 *   project_description → Custom contact property (maps to message/description)
 *   start_date         → Maps to timeline field
 *   lead_source        → hs_lead_source
 *   industry           → HubSpot "industry" contact property = "Civil"
 *
 * Deal stage note:
 *   HubSpot Forms API does not create deals directly. Configure a HubSpot
 *   workflow triggered by "industry = Civil" to automatically create a deal
 *   in the Civil pipeline at stage "Qualified Lead". Alternatively, use the
 *   HubSpot CRM Deals API in a separate call once the form submits successfully.
 *
 * Skips gracefully (logs warning, does not throw) when credentials are not set.
 */
async function submitToHubSpot(
  d: CivilFormData,
  ipAddress: string,
  pageUri: string,
): Promise<void> {
  const formId = d.formId || HUBSPOT_CIVIL_FORM_ID;

  if (!HUBSPOT_PORTAL_ID || !formId) {
    console.warn('[HubSpot Civil] Credentials not configured — skipping CRM submission.');
    return;
  }

  const optField = (name: string, value: string) =>
    value ? [{ name, value }] : [];

  const payload = {
    fields: [
      { name: 'company',    value: d.companyName },
      { name: 'firstname',  value: d.firstName   },
      { name: 'lastname',   value: d.lastName     },
      { name: 'email',      value: d.email        },
      { name: 'phone',      value: d.phone        },
      // HubSpot contact property "industry" — drives the Civil pipeline workflow
      { name: 'industry',   value: 'Civil'        },
      ...optField('jobtitle', d.role),
      ...optField('project_type',        d.projectType),
      ...optField('project_value',       d.projectValue),
      ...optField('project_location',    d.projectLocation),
      // "message" is the standard HubSpot Forms long-text field name
      ...optField('message',             d.description),
      // "start_date" maps to project timeline
      ...optField('start_date',          d.timeline),
      ...optField('hs_lead_source',      d.source),
      ...optField('utm_source',          d.utm_source),
      ...optField('utm_medium',          d.utm_medium),
      ...optField('utm_campaign',        d.utm_campaign),
    ],
    context: {
      ipAddress,
      pageUri,
      pageName: 'Civil Enquiry',
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
    throw new Error(`HubSpot civil submission failed (${res.status}): ${text}`);
  }
}

// ─── Internal notification ─────────────────────────────────────────────────────

/**
 * Send an internal notification email to admin@pulseqld.com.au with full
 * project enquiry details.
 *
 * TODO: implement real email delivery.
 *   Option A — SendGrid:
 *     Set SENDGRID_API_KEY env var and call:
 *       POST https://api.sendgrid.com/v3/mail/send
 *       Authorization: Bearer ${SENDGRID_API_KEY}
 *   Option B — Resend (simpler, Cloudflare Workers compatible):
 *       POST https://api.resend.com/emails
 *       Authorization: Bearer ${RESEND_API_KEY}
 *   Option C — Forward to an email address via Cloudflare Email Workers.
 *
 * For now, logs the notification body so it is visible in Cloudflare Workers
 * logs and does not block the response.
 */
async function sendInternalNotification(d: CivilFormData): Promise<void> {
  const body = [
    '=== NEW CIVIL PROJECT ENQUIRY ===',
    '',
    `Company:          ${d.companyName}`,
    `Contact:          ${d.firstName} ${d.lastName}`.trim(),
    `Email:            ${d.email}`,
    `Phone:            ${d.phone}`,
    '',
    `Project Type:     ${d.projectType}`,
    `Project Value:    ${d.projectValue  || 'Not specified'}`,
    `Location:         ${d.projectLocation || 'Not specified'}`,
    `Timeline:         ${d.timeline       || 'Not specified'}`,
    '',
    'Project Description:',
    d.description,
    '',
    `How Found:        ${d.howFound    || 'Not specified'}`,
    `Source:           ${d.source}`,
    `UTM Source:       ${d.utm_source  || '—'}`,
    `UTM Medium:       ${d.utm_medium  || '—'}`,
    `UTM Campaign:     ${d.utm_campaign|| '—'}`,
  ].join('\n');

  // TODO: replace this log with real email delivery (see options above)
  console.info('[Civil Notification] New civil enquiry received:\n' + body);

  /*
  // ── SendGrid example (uncomment and set SENDGRID_API_KEY when ready) ─────────
  const SENDGRID_API_KEY = import.meta.env.SENDGRID_API_KEY;
  if (!SENDGRID_API_KEY) return;

  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: 'admin@pulseqld.com.au' }] }],
      from:    { email: 'noreply@pulseqld.com.au', name: 'Pulse Plumbing Civil' },
      subject: `New Civil Enquiry — ${d.projectType} — ${d.companyName}`,
      content: [{ type: 'text/plain', value: body }],
    }),
  });
  */
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
  const pageUri = request.headers.get('referer') ?? 'https://pulseqld.com.au/civil';

  // ── HubSpot ────────────────────────────────────────────────────────────────
  // Hard failure — if HubSpot rejects the submission the lead is not captured,
  // so we return a 500 to the user rather than silently dropping the enquiry.
  try {
    await submitToHubSpot(data, ipAddress, pageUri);
  } catch (err) {
    console.error('[HubSpot Civil] Submission error:', err);
    return json(
      {
        success: false,
        error:   'We were unable to submit your enquiry. Please email us directly at admin@pulseqld.com.au.',
      },
      500,
    );
  }

  // ── AroFlo ─────────────────────────────────────────────────────────────────
  // Soft failure — HubSpot already captured the lead. AroFlo outage should
  // not block the user response or cause them to resubmit.
  let arofloTaskId: string | null = null;
  try {
    const civilResult = await createCivilEnquiry({
      companyName:     data.companyName,
      contactName:     `${data.firstName} ${data.lastName}`.trim(),
      phone:           data.phone,
      email:           data.email,
      projectType:     data.projectType,
      projectValue:    data.projectValue || 'Not specified',
      projectLocation: data.projectLocation || undefined,
      description:     data.description,
      timeline:        data.timeline || undefined,
    });
    arofloTaskId = civilResult.taskId ?? null;
  } catch (err) {
    console.error('[AroFlo Civil] Task creation failed (lead captured in HubSpot):', err);
  }

  // ── Internal notification ──────────────────────────────────────────────────
  // Fire-and-forget — notification failure must never block the user response.
  sendInternalNotification(data).catch((err) => {
    console.error('[Civil Notification] Failed to send internal email:', err);
  });

  // ── Success ────────────────────────────────────────────────────────────────
  return json({
    success: true,
    message: "Enquiry received. We'll be in touch within one business day.",
    arofloTaskId,
  });
};
