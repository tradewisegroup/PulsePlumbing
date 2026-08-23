/**
 * src/lib/notify.ts
 *
 * Primary, guaranteed lead-delivery path via the Resend email API.
 *
 * Design contract
 * ───────────────
 * • sendLeadNotification() THROWS on any failure.
 * • Callers must catch and return HTTP 502 — never swallow errors.
 * • Email is the ONLY guaranteed delivery path; every downstream integration
 *   is a secondary concern and must never be able to lose a lead.
 *
 * Required env var
 * ────────────────
 * RESEND_API_KEY      Resend API key (resend.com → API Keys)
 *
 * Optional env vars
 * ─────────────────
 * LEAD_NOTIFY_TO      Primary recipient (default: admin@pulseqld.com.au)
 * JOBS_NOTIFY_TO      Careers/jobs recipient (default: accounts@pulseqld.com.au)
 */

import type { Attribution } from './attribution';

const FROM_EMAIL = 'Pulse Website <noreply@pulseqld.com.au>';

function runtimeEnv(name: string, fallback = ''): string {
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name];
  if (fromVite) return fromVite;
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return fromProcess || fallback;
}

export const LEAD_NOTIFY_TO =
  runtimeEnv('LEAD_NOTIFY_TO', 'admin@pulseqld.com.au');

export const JOBS_NOTIFY_TO =
  runtimeEnv('JOBS_NOTIFY_TO', 'accounts@pulseqld.com.au');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadNotification {
  /** Recipient address. Defaults to LEAD_NOTIFY_TO. */
  to?:  string;
  /** Lead reference, e.g. "PW-8F3K2". */
  ref:  string;
  /**
   * Subject suffix appended after the reference, e.g.
   *   "Blocked Drain — Loganholme — 0412 345 678"
   * Full subject: "[PW-8F3K2] Blocked Drain — Loganholme — 0412 345 678"
   */
  subjectSuffix: string;
  /** Ordered lead-data rows. Empty/undefined values are omitted. */
  fields: Array<[label: string, value: string | undefined]>;
  /** Full attribution object from the client. Rendered as a fixed block. */
  attribution?: Attribution;
  /** Request IP address, added to the attribution block. */
  ipAddress?: string;
}

// ─── Attribution block ────────────────────────────────────────────────────────

function touchLine(
  source: string, medium: string, campaign: string, ts: string,
  includeDate: boolean,
): string {
  const parts = [source, medium, campaign].filter(Boolean);
  const base  = parts.length ? parts.join(' / ') : '(direct)';
  if (includeDate && ts) {
    const date = ts.slice(0, 10); // YYYY-MM-DD
    return `${base} (${date})`;
  }
  return base;
}

function buildAttributionBlock(
  ref:        string,
  attr:       Attribution,
  ipAddress?: string,
): { text: string; html: string } {
  const gclid      = attr.last_gclid  || attr.first_gclid  || '';
  const gbraid     = attr.last_gbraid || attr.first_gbraid || '';
  const wbraid     = attr.last_wbraid || attr.first_wbraid || '';
  const msclkid    = attr.last_msclkid || attr.first_msclkid || '';
  const anyClickId = gclid || gbraid || wbraid || msclkid;

  const firstTouch = touchLine(
    attr.first_utm_source, attr.first_utm_medium, attr.first_utm_campaign,
    attr.first_ts, true,
  );
  const lastTouch = touchLine(
    attr.last_utm_source, attr.last_utm_medium, attr.last_utm_campaign,
    attr.last_ts, false,
  );

  const rows: Array<[string, string]> = [
    ['lead_ref',      ref],
    ['first_touch',   firstTouch],
    ['last_touch',    lastTouch],
    ...(gclid      ? [['gclid',    gclid]   as [string, string]] : []),
    ...(gbraid     ? [['gbraid',   gbraid]  as [string, string]] : []),
    ...(wbraid     ? [['wbraid',   wbraid]  as [string, string]] : []),
    ...(msclkid    ? [['msclkid',  msclkid] as [string, string]] : []),
    ['landing_page',  attr.first_landing_page || ''],
    ['converted_on',  attr.page_path          || ''],
    ...(attr.ga_client_id ? [['ga_client_id', attr.ga_client_id] as [string, string]] : []),
    ...(attr.ga_session_id ? [['ga_session_id', attr.ga_session_id] as [string, string]] : []),
    ...(ipAddress ? [['ip', ipAddress] as [string, string]] : []),
  ].filter(([, v]) => v) as Array<[string, string]>;

  const text =
    '--- ATTRIBUTION ---\n' +
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    '\n--- END ATTRIBUTION ---';

  const html =
    `<pre style="margin:24px 0 0;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;` +
    `border-radius:6px;font-family:monospace;font-size:12px;color:#475569;white-space:pre-wrap">` +
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;') +
    `</pre>`;

  return { text, html };
}

// ─── sendLeadNotification ─────────────────────────────────────────────────────

/**
 * Send a lead notification email via the Resend API.
 *
 * Throws if RESEND_API_KEY is unset or Resend returns a non-2xx response.
 * The caller MUST catch and return HTTP 502.
 */
export async function sendLeadNotification(n: LeadNotification): Promise<void> {
  const RESEND_API_KEY = runtimeEnv('RESEND_API_KEY');
  const RESEND_API_URL = runtimeEnv('RESEND_API_URL', 'https://api.resend.com/emails');
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured — email delivery is unavailable.');
  }

  const to      = n.to ?? LEAD_NOTIFY_TO;
  const subject = `[${n.ref}] ${n.subjectSuffix}`;

  const dataRows = n.fields.filter(
    (row): row is [string, string] => Boolean(row[1]?.trim()),
  );

  const attrBlock = n.attribution
    ? buildAttributionBlock(n.ref, n.attribution, n.ipAddress)
    : null;

  // ── Plain text ─────────────────────────────────────────────────────────────
  const text = [
    subject,
    '='.repeat(subject.length),
    '',
    ...dataRows.map(([k, v]) => `${k}: ${v}`),
    ...(attrBlock ? ['', attrBlock.text] : []),
  ].join('\n');

  // ── HTML ───────────────────────────────────────────────────────────────────
  const cellK =
    `style="padding:5px 16px 5px 0;font-weight:600;white-space:nowrap;` +
    `vertical-align:top;color:#1a1a1a;font-family:sans-serif;font-size:13px"`;
  const cellV =
    `style="padding:5px 0;color:#334155;font-family:sans-serif;font-size:13px"`;

  const tableRows = dataRows
    .map(([k, v]) => `<tr><td ${cellK}>${k}</td><td ${cellV}>${v}</td></tr>`)
    .join('\n');

  const html = `
<div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#1a1a1a">
  <h2 style="margin:0 0 4px;font-size:18px;color:#0172ae">${subject}</h2>
  <p style="margin:0 0 20px;font-size:12px;color:#94a3b8">
    Pulse Plumbing, Gas &amp; Civil — Lead Notification
  </p>
  <table style="border-collapse:collapse;width:100%">
    ${tableRows}
  </table>
  ${attrBlock ? attrBlock.html : ''}
</div>`;

  // ── Send ───────────────────────────────────────────────────────────────────
  const res = await fetch(RESEND_API_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => String(res.status));
    throw new Error(`Resend rejected the notification (${res.status}): ${detail}`);
  }
}
