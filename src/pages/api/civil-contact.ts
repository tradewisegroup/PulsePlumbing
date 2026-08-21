/**
 * POST /api/civil-contact
 * OPTIONS /api/civil-contact  (CORS preflight)
 *
 * Handles civil project RFQ submissions.
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
import { createCivilEnquiry } from '../../lib/aroflo';
import { buildLead, leadRef } from '../../lib/lead';
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

interface CivilFormData {
  companyName:     string;
  firstName:       string;
  lastName:        string;
  role:            string;
  email:           string;
  phone:           string;
  projectType:     string;
  projectValue:    string;
  projectLocation: string;
  description:     string;
  timeline:        string;
  howFound:        string;
  source:          string;
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

function normalise(raw: Record<string, string>): CivilFormData {
  const contactName = str(raw.contactName ?? raw.contact_name);
  const { firstName, lastName } = contactName
    ? splitName(contactName)
    : { firstName: str(raw.firstName ?? raw.firstname), lastName: str(raw.lastName ?? raw.lastname) };

  return {
    companyName:     str(raw.companyName   ?? raw.company_name ?? raw.company),
    firstName,
    lastName,
    role:            str(raw.role ?? raw.jobtitle ?? raw.job_title),
    email:           str(raw.email).toLowerCase(),
    phone:           str(raw.phone),
    projectType:     str(raw.projectType   ?? raw.project_type),
    projectValue:    str(raw.projectValue  ?? raw.project_value),
    projectLocation: str(raw.projectLocation ?? raw.project_location ?? raw.location),
    description:     str(raw.description   ?? raw.message),
    timeline:        str(raw.timeline),
    howFound:        str(raw.howFound      ?? raw.how_found),
    source:          str(raw.source) || `Civil — ${str(raw.projectType ?? raw.project_type) || 'general enquiry'}`,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(d: CivilFormData): string | null {
  if (!d.companyName)  return 'Company name is required.';
  if (!d.firstName)    return 'Contact name is required.';
  if (!d.phone)        return 'Phone number is required.';
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    return 'A valid email address is required.';
  if (!d.projectType)  return 'Project type is required.';
  if (!d.description)  return 'Project description is required.';
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
  const ref         = leadRef();
  const contactName = [data.firstName, data.lastName].filter(Boolean).join(' ');
  const lead        = buildLead(
    { ...raw, name: contactName, source_form: 'civil-rfq' },
    attribution,
    ref,
  );

  const subjectSuffix = [
    `Civil RFQ — ${data.projectType || 'General'}`,
    data.companyName,
    data.phone,
  ].filter(Boolean).join(' — ');

  // ── Email notification (PRIMARY — hard failure) ────────────────────────────
  try {
    await sendLeadNotification({
      to:  LEAD_NOTIFY_TO,
      ref,
      subjectSuffix,
      fields: [
        ['Company',         data.companyName],
        ['Contact',         contactName],
        ['Role',            data.role],
        ['Phone',           data.phone],
        ['Phone (E.164)',   lead.phone_e164 !== data.phone ? lead.phone_e164 : undefined],
        ['Email',           data.email],
        ['Project Type',    data.projectType],
        ['Project Value',   data.projectValue],
        ['Location',        data.projectLocation],
        ['Timeline',        data.timeline],
        ['Description',     data.description],
        ['How Found',       data.howFound],
      ],
      attribution,
      ipAddress,
    });
  } catch (err) {
    console.error('[notify] Civil RFQ email failed:', err);
    return json(
      { success: false, error: "We couldn't submit your enquiry. Please call 0452 188 420." },
      502,
    );
  }

  // ── AroFlo (SECONDARY — non-blocking) ─────────────────────────────────────
  let arofloTaskId: string | null = null;
  try {
    const civilResult = await createCivilEnquiry({
      companyName:     data.companyName,
      contactName,
      phone:           lead.phone_e164 || data.phone,
      email:           data.email,
      projectType:     data.projectType,
      projectValue:    data.projectValue || 'Not specified',
      projectLocation: data.projectLocation || undefined,
      description:     data.description,
      timeline:        data.timeline || undefined,
    });
    arofloTaskId = civilResult.taskId ?? null;
  } catch (err) {
    console.warn('[AroFlo] Civil task not created — email notification was delivered:', err);
  }

  return json({
    success: true,
    message: "Enquiry received. We'll be in touch within one business day.",
    ref,
    arofloTaskId,
  });
};
