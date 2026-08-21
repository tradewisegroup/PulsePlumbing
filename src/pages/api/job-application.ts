/**
 * POST /api/job-application
 * OPTIONS /api/job-application  (CORS preflight)
 *
 * Processes job application form submissions.
 *
 * Delivery guarantee
 * ──────────────────
 * Email via Resend is the PRIMARY, guaranteed delivery path.
 * Returns 502 if email fails — the application is never silently discarded.
 *
 * Required env vars
 * ─────────────────
 * RESEND_API_KEY      Resend API key
 *
 * Optional env vars
 * ─────────────────
 * JOBS_NOTIFY_TO      Recipient (default: accounts@pulseqld.com.au)
 * CORS_ORIGIN         Allowed origin (default: https://pulseqld.com.au)
 *
 * Note: Resume files are captured as filename + size metadata.
 *       Full file storage via Cloudflare R2 is a future enhancement.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { sendLeadNotification, leadRef, JOBS_NOTIFY_TO } from '../../lib/notify';

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

// ─── Route handlers ───────────────────────────────────────────────────────────

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const POST: APIRoute = async ({ request }) => {
  // ── Parse (multipart/form-data for resume upload) ──────────────────────────
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

  // ── Extract fields ─────────────────────────────────────────────────────────
  const rawName     = str(fd.get('full_name'));
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

  // ── Validate ───────────────────────────────────────────────────────────────
  const validationError = validate(data);
  if (validationError) {
    return json({ success: false, error: validationError }, 400);
  }

  // ── Context ────────────────────────────────────────────────────────────────
  const ipAddress =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')  ??
    '0.0.0.0';
  const pageUri =
    request.headers.get('referer') ?? 'https://pulseqld.com.au/careers';

  const ref      = leadRef();
  const fullName = [data.firstname, data.lastname].filter(Boolean).join(' ');

  // ── Email notification (PRIMARY — hard failure) ────────────────────────────
  try {
    await sendLeadNotification({
      to:  JOBS_NOTIFY_TO,
      ref,
      subjectSuffix: `Job Application — ${data.role} — ${fullName}`,
      fields: [
        ['Name',    fullName],
        ['Email',   data.email],
        ['Phone',   data.phone],
        ['Role',    data.role],
        ['Cover Note', data.cover_note || '(none)'],
        ['Resume',  data.resume_name
          ? `${data.resume_name} (${data.resume_size})`
          : 'Not uploaded'],
        ['Source',  'Careers Page'],
      ],
      attribution: {
        pageUri,
        ipAddress,
      },
    });
  } catch (err) {
    console.error('[notify] Job application email failed:', err);
    return json(
      { success: false, error: "We couldn't submit your application. Please call 0452 188 420." },
      502,
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  return json({ success: true, message: "Thanks! We'll be in touch within 2 business days.", ref });
};
