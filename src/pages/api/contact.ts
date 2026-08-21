/**
 * POST /api/contact
 * OPTIONS /api/contact  (CORS preflight)
 *
 * Processes all quote / contact form submissions.
 *
 * Delivery guarantee
 * ──────────────────
 * 1. Validate — 400 on bad input.
 * 2. Send notification email via Resend (PRIMARY path).
 *    Returns 502 if email fails — the lead is never silently discarded.
 * 3. Push to AroFlo (SECONDARY, non-blocking).
 *
 * Required env vars
 * ─────────────────
 * RESEND_API_KEY      Resend API key
 *
 * Optional env vars
 * ─────────────────
 * LEAD_NOTIFY_TO      Notification recipient (default: admin@pulseqld.com.au)
 * CORS_ORIGIN         Allowed origin (default: https://pulseqld.com.au)
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import type { Attribution } from '../../lib/attribution';
import { createLeadFromForm } from '../../lib/aroflo';
import { buildLead, leadRef, normalisePhoneE164 } from '../../lib/lead';
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

interface FormData {
  firstname:    string;
  lastname:     string;
  email:        string;
  phone:        string;
  company:      string;
  service_type: string;
  industry:     string;
  suburb:       string;
  message:      string;
  preferred_time: string;
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/);
  return { firstname: parts[0] ?? '', lastname: parts.slice(1).join(' ') };
}

function normalise(raw: Record<string, string>): FormData {
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
    service_type:   str(raw.service_type ?? raw.service),
    industry:       str(raw.industry),
    suburb:         str(raw.suburb ?? raw.location),
    message:        str(raw.message),
    preferred_time: str(raw.preferred_time),
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

// ─── Request body parsing ─────────────────────────────────────────────────────

async function parseBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return request.json();
  }
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
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

  // ── Attribution ────────────────────────────────────────────────────────────
  let attribution: Attribution;
  try {
    attribution = raw.attribution ? JSON.parse(raw.attribution) : ({} as Attribution);
  } catch {
    attribution = {} as Attribution;
  }

  // ── Lead ───────────────────────────────────────────────────────────────────
  const ref  = leadRef();
  const lead = buildLead(
    { ...raw, source_form: 'quote' },
    attribution,
    ref,
  );

  const fullName      = [data.firstname, data.lastname].filter(Boolean).join(' ');
  const subjectSuffix = [data.service_type || 'General Enquiry', data.suburb, data.phone]
    .filter(Boolean)
    .join(' — ');

  // ── Email notification (PRIMARY — hard failure) ────────────────────────────
  try {
    await sendLeadNotification({
      to:  LEAD_NOTIFY_TO,
      ref,
      subjectSuffix,
      fields: [
        ['Name',           fullName],
        ['Phone',          data.phone],
        ['Phone (E.164)',  lead.phone_e164 !== data.phone ? lead.phone_e164 : undefined],
        ['Email',          data.email],
        ['Company',        data.company],
        ['Service',        data.service_type],
        ['Industry',       data.industry],
        ['Suburb',         data.suburb],
        ['Message',        data.message],
        ['Preferred Time', data.preferred_time],
      ],
      attribution,
      ipAddress,
    });
  } catch (err) {
    console.error('[notify] Contact email failed:', err);
    return json(
      { success: false, error: "We couldn't submit your enquiry. Please call 0452 188 420." },
      502,
    );
  }

  // ── AroFlo (SECONDARY — non-blocking) ─────────────────────────────────────
  const arofloResult = await createLeadFromForm({
    name:        fullName,
    company:     data.company    || undefined,
    phone:       lead.phone_e164 || data.phone,
    email:       data.email,
    serviceType: data.service_type,
    industry:    data.industry   || undefined,
    suburb:      data.suburb     || undefined,
    message:     data.message,
  });
  if (arofloResult.arofloError) {
    console.warn('[AroFlo] Lead not created — email notification was delivered.');
  }

  return json({
    success: true,
    message: "Thanks! We'll call you within 2 hours.",
    ref,
    arofloTaskId: arofloResult.taskId,
  });
};
