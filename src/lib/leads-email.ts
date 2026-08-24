/**
 * Parse Pulse lead-notification emails (.eml or .txt) into LeadRow fields.
 * Looks for the --- ATTRIBUTION --- block plus Name/Email/Phone rows.
 */

import { normalisePhoneE164 } from './lead.ts';
import type { LeadRow } from './leads-db.ts';

function emptyRow(): LeadRow {
  return {
    lead_ref: '', created_at: '', name: '', company: '', email: '',
    phone_e164: '', suburb: '', service_type: '', industry: '', message: '',
    source_form: 'backfill',
    first_source: '', first_medium: '', first_campaign: '',
    first_landing_page: '', first_seen_at: '',
    last_source: '', last_medium: '', last_campaign: '',
    gclid: '', converted_on: '', ga_client_id: '',
  };
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Strip MIME wrappers so field: value lines are readable. */
export function extractEmailBody(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n');
  if (/^Content-Transfer-Encoding:\s*quoted-printable/im.test(text)) {
    text = decodeQuotedPrintable(text);
  }
  const plain = text.match(/Content-Type:\s*text\/plain[\s\S]*?\n\n([\s\S]*?)(?:\n--|\nContent-Type:)/i);
  if (plain?.[1]) return plain[1];
  return text;
}

function fieldMap(body: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_ .()/-]*):\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase().replace(/[\s().]/g, '_');
    map[key] = m[2].trim();
  }
  return map;
}

function splitTouch(value: string): { source: string; medium: string; campaign: string; date: string } {
  const dateMatch = value.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/);
  const date = dateMatch?.[1] ?? '';
  const rest = value.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim();
  if (!rest || rest === '(direct)') {
    return { source: rest === '(direct)' ? 'direct' : '', medium: '', campaign: '', date };
  }
  const [source = '', medium = '', campaign = ''] = rest.split(/\s*\/\s*/);
  return { source, medium, campaign, date };
}

/**
 * Parse one notification email. Returns null if no lead_ref and no email.
 */
export function parseLeadEmail(raw: string): LeadRow | null {
  const body = extractEmailBody(raw);
  const fields = fieldMap(body);
  const row = emptyRow();

  const attr = body.match(/--- ATTRIBUTION ---\n([\s\S]*?)\n--- END ATTRIBUTION ---/);
  if (attr?.[1]) {
    const a = fieldMap(attr[1]);
    row.lead_ref = a.lead_ref ?? row.lead_ref;
    row.first_landing_page = a.landing_page ?? '';
    row.converted_on = a.converted_on ?? '';
    row.gclid = a.gclid ?? '';
    row.ga_client_id = a.ga_client_id ?? '';
    if (a.first_touch) {
      const t = splitTouch(a.first_touch);
      row.first_source = t.source;
      row.first_medium = t.medium;
      row.first_campaign = t.campaign;
      row.first_seen_at = t.date;
    }
    if (a.last_touch) {
      const t = splitTouch(a.last_touch);
      row.last_source = t.source;
      row.last_medium = t.medium;
      row.last_campaign = t.campaign;
    }
  }

  row.name         = fields.name ?? fields.contact ?? row.name;
  row.company      = fields.company ?? row.company;
  row.email        = (fields.email ?? '').toLowerCase();
  row.suburb       = fields.suburb ?? fields.location ?? row.suburb;
  row.service_type = fields.service ?? fields.project_type ?? row.service_type;
  row.industry     = fields.industry ?? row.industry;
  row.message      = fields.message ?? fields.description ?? row.message;

  const e164Field =
    fields.phone_e164 ||
    fields.phone__e_164_ ||
    fields.phone__e164_ ||
    '';
  const phone = e164Field || fields.phone || '';
  row.phone_e164 = phone ? normalisePhoneE164(phone) : '';

  const subjectRef = body.match(/\[(PW-[A-Z2-7]{5})\]/);
  if (!row.lead_ref && subjectRef) row.lead_ref = subjectRef[1];

  const dateHdr = raw.match(/^Date:\s*(.+)$/im);
  if (dateHdr?.[1]) {
    const d = new Date(dateHdr[1]);
    if (!Number.isNaN(d.getTime())) row.created_at = d.toISOString();
  }
  if (!row.created_at) row.created_at = new Date().toISOString();

  if (!row.name) row.name = row.email ? row.email.split('@')[0] : 'Unknown';

  if (!row.lead_ref && !row.email) return null;
  if (!row.lead_ref) {
    row.lead_ref = `BF-${row.email.slice(0, 8)}-${row.created_at.slice(0, 10)}`;
  }
  return row;
}
