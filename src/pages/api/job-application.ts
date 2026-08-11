/**
 * POST /api/job-application
 * OPTIONS /api/job-application  (CORS preflight)
 *
 * Processes job application form submissions:
 *  1. Validate required fields server-side
 *  2. Submit to HubSpot Forms API (tagged "job-application")
 *  3. Return { success } | { success: false, error }
 *
 * Accepts multipart/form-data (for resume file upload).
 * The resume file is captured as metadata (filename + size); actual file
 * storage requires Cloudflare R2 or similar — planned future enhancement.
 *
 * Required env vars (same as /api/contact)
 * ─────────────────────────────────────────
 * HUBSPOT_PORTAL_ID
 * HUBSPOT_JOB_FORM_ID   HubSpot form GUID for job applications
 *                        Falls back to HUBSPOT_FORM_ID if not set.
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

interface ApplicationData {
  firstname:   string;
  lastname:    string;
  email:       string;
  phone:       string;
  role:        string;
  cover_note:  string;
  resume_name: string;
  resume_size: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/);
  return { firstname: parts[0] ?? '', lastname: parts.slice(1).join(' ') };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(d: ApplicationData): string | null {
  if (!d.firstname)
    return 'Full name is required.';
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    return 'A valid email address is required.';
  if (!d.phone)
    return 'Phone number is required.';
  if (!d.role)
    return 'Please select a role.';
  return null;
}

// ─── Email notification (Resend) ──────────────────────────────────────────────
// All job applications are emailed to accounts@pulseqld.com.au.
// Set RESEND_API_KEY in Cloudflare Pages environment variables.

const RESEND_API_KEY     = import.meta.env.RESEND_API_KEY ?? '';
const CAREERS_EMAIL      = 'accounts@pulseqld.com.au';
const FROM_EMAIL         = 'Pulse Website <noreply@pulseqld.com.au>';

async function sendApplicationEmail(d: ApplicationData): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY not set — skipping email notification.');
    return;
  }
  const html = `<h2 style="margin:0 0 16px">New Job Application — Pulse Plumbing</h2>
<table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
${[
  ['Name',   [d.firstname, d.lastname].filter(Boolean).join(' ')],
  ['Email',  d.email],
  ['Phone',  d.phone],
  ['Role',   d.role],
  ['Cover',  d.cover_note || '(none)'],
  ['Resume', d.resume_name ? `${d.resume_name} (${d.resume_size})` : 'Not uploaded'],
].map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0">${v}</td></tr>`).join('')}
</table>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from:    FROM_EMAIL,
        to:      [CAREERS_EMAIL],
        subject: `Job Application — ${[d.firstname, d.lastname].filter(Boolean).join(' ')} (${d.role})`,
        html,
      }),
    });
  } catch (err) {
    console.error('[Resend] Application email failed:', err);
  }
}

// ─── HubSpot ──────────────────────────────────────────────────────────────────

const HUBSPOT_PORTAL_ID = import.meta.env.HUBSPOT_PORTAL_ID ?? '';
const HUBSPOT_JOB_FORM_ID =
  import.meta.env.HUBSPOT_JOB_FORM_ID ??
  import.meta.env.HUBSPOT_FORM_ID     ?? '';
const HUBSPOT_API_BASE =
  import.meta.env.HUBSPOT_API_BASE ?? 'https://api-ap1.hsforms.com';

async function submitToHubSpot(
  d: ApplicationData,
  ipAddress: string,
  pageUri: string,
): Promise<void> {
  if (!HUBSPOT_PORTAL_ID || !HUBSPOT_JOB_FORM_ID) {
    console.warn('[HubSpot] Job application credentials not configured — skipping.');
    return;
  }

  const optField = (name: string, value: string) =>
    value ? [{ name, value }] : [];

  // Compose a note that includes the resume filename for the recruiter
  const noteLines = [
    `Role applied for: ${d.role}`,
    d.cover_note  ? `Cover note: ${d.cover_note}` : '',
    d.resume_name ? `Resume uploaded: ${d.resume_name} (${d.resume_size})` : 'No resume uploaded',
  ].filter(Boolean);

  const payload = {
    fields: [
      { name: 'firstname', value: d.firstname },
      { name: 'lastname',  value: d.lastname  },
      { name: 'email',     value: d.email     },
      { name: 'phone',     value: d.phone     },
      { name: 'message',   value: noteLines.join('\n') },
      ...optField('hs_lead_source', 'Careers Page'),
      ...optField('jobtitle',       d.role),
    ],
    context: {
      ipAddress,
      pageUri,
      pageName: 'Careers — Job Application',
    },
    legalConsentOptions: {
      consent: {
        consentToProcess: true,
        text: 'I agree to allow Pulse Plumbing, Gas & Civil to store and process my personal data for recruitment purposes.',
      },
    },
  };

  const res = await fetch(
    `${HUBSPOT_API_BASE}/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_JOB_FORM_ID}`,
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
  // ── Parse (multipart/form-data for file upload support) ───────────────────
  let fd: FormData;
  try {
    const ct = request.headers.get('content-type') ?? '';
    if (!ct.includes('multipart/form-data') && !ct.includes('application/x-www-form-urlencoded')) {
      return json({ success: false, error: 'Unsupported content type.' }, 415);
    }
    fd = await request.formData();
  } catch {
    return json({ success: false, error: 'Could not parse form data.' }, 400);
  }

  // ── Extract fields ────────────────────────────────────────────────────────
  const rawName    = str(fd.get('full_name'));
  const { firstname, lastname } = splitName(rawName);
  const resumeEntry = fd.get('resume');
  const resumeFile  = resumeEntry instanceof File ? resumeEntry : null;

  const data: ApplicationData = {
    firstname,
    lastname,
    email:       str(fd.get('email')).toLowerCase(),
    phone:       str(fd.get('phone')),
    role:        str(fd.get('role')),
    cover_note:  str(fd.get('cover_note')),
    resume_name: resumeFile?.name ?? '',
    resume_size: resumeFile
      ? `${(resumeFile.size / 1024 / 1024).toFixed(1)} MB`
      : '',
  };

  // ── Validate ──────────────────────────────────────────────────────────────
  const validationError = validate(data);
  if (validationError) {
    return json({ success: false, error: validationError }, 400);
  }

  // ── Context ───────────────────────────────────────────────────────────────
  const ipAddress =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')  ??
    '0.0.0.0';
  const pageUri =
    request.headers.get('referer') ?? 'https://pulseqld.com.au/careers';

  // ── Email notification (non-blocking) ────────────────────────────────────
  void sendApplicationEmail(data);

  // ── HubSpot ───────────────────────────────────────────────────────────────
  try {
    await submitToHubSpot(data, ipAddress, pageUri);
  } catch (err) {
    console.error('[HubSpot] Job application error:', err);
    return json(
      {
        success: false,
        error: 'We were unable to submit your application. Please email us directly at admin@pulseqld.com.au.',
      },
      500,
    );
  }

  return json({ success: true, message: "Thanks! We'll be in touch within 2 business days." });
};
