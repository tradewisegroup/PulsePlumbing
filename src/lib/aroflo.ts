// src/lib/aroflo.ts
// AroFlo REST API client — server-side only.
//
// Auth & request model verified against the official Postman collection
// (https://apidocs.aroflo.com, fetched 2026-06). Key facts:
//   • Single endpoint: GET/POST https://api.aroflo.com/?<varString>
//   • varString for GET = "zone=...&where=...&order=...&join=...&page=N"
//     (each value URI-encoded, NO leading "?"). The request URL is
//     BASE_URL + "/?" + varString, and the SAME varString is what gets signed.
//   • Auth = HMAC-SHA512 (hex) of  payload.join('+')  with the API Secret Key,
//     where payload = [METHOD, (HostIP?), urlPath='', accept, authorization,
//     isoTimestamp, varString].
//   • Required headers: Authentication: HMAC <sig>, Authorization: <authz>,
//     Accept: text/json, afdatetimeutc: <isoTimestamp> (+ HostIP if used).
//   • Response shape: { status:"0", statusmessage, zoneresponse:{ <zone>:[…],
//     pagenumber, maxpageresults, currentpageresults } }.  status "0" == OK.
//   • ⚠️ EVERY zone applies a "last 30 days" default filter when NO where
//     clause is supplied. A full export MUST pass an explicit where to override
//     it (see scripts/aroflo-export/entities.ts).

import { createHmac } from 'node:crypto';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

// In dev the SSR worker doesn't inherit Vite's env loading; load .env.local
// directly. In production the file won't exist and dotenv silently no-ops.
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

function env(key: string): string {
  const viteEnv = (import.meta as { env?: Record<string, string> }).env;
  return (process.env[key] ?? viteEnv?.[key] ?? '') as string;
}

const BASE_URL = (env('AROFLO_BASE_URL') || 'https://api.aroflo.com').replace(/\/+$/, '');
const UENCODED = env('AROFLO_UENCODED');
const PENCODED = env('AROFLO_PENCODED');
const ORGENCODED = env('AROFLO_ORGENCODED');
const SECRET = env('AROFLO_SECRET_KEY');
const HOSTIP = env('AROFLO_HOSTIP'); // optional; omit in cloud/serverless
const ACCEPT = 'text/json';

// ──────────────────────────────────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────────────────────────────────

// The Authorization header value (also one field of the signed payload).
function authorizationValue(): string {
  return (
    `uencoded=${encodeURIComponent(UENCODED)}` +
    `&pencoded=${encodeURIComponent(PENCODED)}` +
    `&orgEncoded=${encodeURIComponent(ORGENCODED)}`
  );
}

// HMAC-SHA512 (hex) over the '+'-joined payload, keyed with the secret.
function signPayload(method: string, authz: string, iso: string, varString: string): string {
  const urlPath = ''; // documented constant — do not change
  const payload: string[] = [method];
  if (HOSTIP) payload.push(HOSTIP);
  payload.push(urlPath, ACCEPT, authz, iso, varString);
  return createHmac('sha512', SECRET).update(payload.join('+')).digest('hex');
}

function authHeaders(method: string, varString: string): Record<string, string> {
  const iso = new Date().toISOString();
  const authz = authorizationValue();
  const sig = signPayload(method, authz, iso, varString);
  const headers: Record<string, string> = {
    Authentication: `HMAC ${sig}`,
    Authorization: authz,
    Accept: ACCEPT,
    afdatetimeutc: iso,
  };
  if (HOSTIP) headers.HostIP = HOSTIP;
  return headers;
}

export function arofloConfigured(): boolean {
  return Boolean(UENCODED && PENCODED && ORGENCODED && SECRET);
}

// ──────────────────────────────────────────────────────────────────────────
// Core request helpers
// ──────────────────────────────────────────────────────────────────────────

// Build the varString (query string without leading "?"). Order is preserved.
function buildVarString(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.join('&');
}

export interface GetParams {
  zone: string;
  where?: string; // AroFlo pipe format, e.g. "and|createddate|>|2000/01/01"
  order?: string; // e.g. "createddate|asc"
  join?: string; // comma-separated, e.g. "lineitems,task"
  page?: string | number;
}

// Signed GET. Returns parsed JSON (or null on network/parse failure).
export async function arofloGet(p: GetParams): Promise<any | null> {
  const varString = buildVarString({
    zone: p.zone,
    where: p.where,
    order: p.order,
    join: p.join,
    page: p.page === undefined ? undefined : String(p.page),
  });
  const headers = authHeaders('GET', varString);
  try {
    const res = await fetch(`${BASE_URL}/?${varString}`, { headers });
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[AroFlo] GET zone=${p.zone} → non-JSON (${res.status}): ${text.slice(0, 200)}`);
      return null;
    }
    if (String(data?.status) !== '0') {
      console.error(`[AroFlo] GET zone=${p.zone} → status ${data?.status}: ${data?.statusmessage}`);
    }
    return data;
  } catch (err) {
    console.error(`[AroFlo] GET zone=${p.zone} error:`, err);
    return null;
  }
}

// Signed POST (zone + postxml form body). Used by the lead-creation helpers.
export async function arofloPost(zone: string, postxml: string): Promise<any | null> {
  const varString = buildVarString({ zone, postxml });
  const headers = {
    ...authHeaders('POST', varString),
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  try {
    const res = await fetch(`${BASE_URL}/`, { method: 'POST', headers, body: varString });
    const data = await res.json();
    if (String(data?.status) !== '0') {
      console.error(`[AroFlo] POST zone=${zone} → status ${data?.status}: ${data?.statusmessage}`);
    }
    return data;
  } catch (err) {
    console.error(`[AroFlo] POST zone=${zone} error:`, err);
    return null;
  }
}

// Pull the data array out of zoneresponse (auto-detecting the zone key,
// e.g. zone "inventory" → key "items", "taskmaterials" → "materials").
const META_KEYS = new Set(['pagenumber', 'maxpageresults', 'currentpageresults', 'queryresponsetimes']);
function extractRows(data: any): any[] {
  const zr = data?.zoneresponse;
  if (!zr || typeof zr !== 'object') return [];
  for (const [k, v] of Object.entries(zr)) {
    if (META_KEYS.has(k)) continue;
    if (Array.isArray(v)) return v as any[];
  }
  for (const [k, v] of Object.entries(zr)) {
    if (!META_KEYS.has(k) && v && typeof v === 'object') return [v];
  }
  return [];
}

// Fetch all pages of a zone. Stops when a page returns fewer than
// maxpageresults rows (or zero).
export async function fetchZone(
  zone: string,
  opts: { where?: string; order?: string; join?: string } = {}
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let page = 1; ; page++) {
    const data = await arofloGet({ zone, where: opts.where, order: opts.order, join: opts.join, page });
    if (!data) break;
    const rows = extractRows(data);
    if (rows.length === 0) break;
    out.push(...rows);
    const max = Number(data?.zoneresponse?.maxpageresults) || 500;
    const cur = Number(data?.zoneresponse?.currentpageresults) || rows.length;
    if (cur < max) break; // last page
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Small value helpers (shared with the migration extractor)
// ──────────────────────────────────────────────────────────────────────────

export function pick(obj: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

export function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

// Coerce AroFlo's "array OR single object OR missing" shapes into an array.
export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Read a sub-field from a nested object field, e.g. record.client.clientname.
export function sub(obj: Record<string, unknown>, container: string, keys: readonly string[]): string {
  const c = obj?.[container];
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    return str(pick(c as Record<string, unknown>, keys));
  }
  return '';
}

// Unwrap a joined nested list which AroFlo may give as an array, a single
// object, or a single-key wrapper like { material: [...] }.
export function unwrapList(v: unknown): Record<string, unknown>[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (typeof v === 'object') {
    const vals = Object.values(v as Record<string, unknown>);
    const arr = vals.find((x) => Array.isArray(x));
    if (arr) return arr as Record<string, unknown>[];
    return [v as Record<string, unknown>];
  }
  return [];
}

// ──────────────────────────────────────────────────────────────────────────
// QUOTE EXPORT  →  Captain (pipeline / forecast / won-loss)
//
// The native AroFlo→Xero integration does NOT push quotes (only invoices, POs,
// contacts, payments, credit notes, timesheets). So quote data — with line-item
// cost / sell — has to be pulled from the AroFlo API. We fetch the `quotes`
// zone with join=lineitems so each quote arrives with its line items inline
// (no N+1), and pass an explicit where to defeat the 30-day default filter.
// ──────────────────────────────────────────────────────────────────────────

export type QuoteOutcome = 'won' | 'lost' | 'open' | 'other';

// Quotes carry both a free-text `status` and an `acceptancestatus`
// ('Not Sent' | 'Awaiting Decision' | 'Accepted' | 'Declined' |
//  'Need More Information'). Prefer acceptancestatus for win/loss.
function toOutcome(acceptanceStatus: string, status: string): QuoteOutcome {
  const a = acceptanceStatus.toLowerCase();
  if (/accept/.test(a)) return 'won';
  if (/declin|reject/.test(a)) return 'lost';
  if (/awaiting|not sent|more information|sent|pending/.test(a)) return 'open';
  const s = status.toLowerCase();
  if (/(won|accept|approv|success)/.test(s)) return 'won';
  if (/(lost|declin|reject|unsuccess)/.test(s)) return 'lost';
  if (/(expir|cancel|void|withdrawn)/.test(s)) return 'other';
  if (/(pending|draft|sent|open|new|review|progress)/.test(s)) return 'open';
  return 'other';
}

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitCost: number;
  unitSell: number;
  markupPct: number | null;
  lineCost: number; // ex-tax line cost (unitCost × qty if not supplied)
  lineSell: number; // ex-tax line sell (= totalex when present)
}

export interface QuoteRecord {
  quoteId: string;
  quoteNumber: string; // AroFlo jobnumber
  quoteName: string;
  clientId: string;
  clientName: string;
  status: string;
  acceptanceStatus: string;
  outcome: QuoteOutcome;
  totalCost: number; // ex-tax cost (totalEx − totalProfit)
  totalSell: number; // ex-tax sell (totalEx)
  totalInc: number;
  totalTax: number;
  marginPct: number | null;
  dateCreated: string;
  dateModified: string;
  lineItems: QuoteLineItem[];
}

const QLI = {
  desc: ['item', 'description', 'partno', 'takeoffname'],
  qty: ['qty', 'quantity'],
  unitCost: ['cost'],
  unitSell: ['sell'],
  lineEx: ['totalex'],
  lineTax: ['totaltax'],
  markup: ['markup'],
} as const;

function parseQuoteLines(quote: Record<string, unknown>): QuoteLineItem[] {
  // With join=lineitems the items arrive under `lines` (zone key would be
  // `quotelineitems` if fetched standalone).
  const raw = (quote as any).lines ?? (quote as any).quotelineitems ?? (quote as any).lineitems;
  return unwrapList(raw).map((li) => {
    const quantity = num(pick(li, QLI.qty)) || 1;
    const unitCost = num(pick(li, QLI.unitCost));
    const unitSell = num(pick(li, QLI.unitSell));
    const lineSell = num(pick(li, QLI.lineEx)) || unitSell * quantity;
    const markupRaw = pick(li, QLI.markup);
    // `item` can be a string or an object {itemid, name/description}.
    const itemVal = (li as any).item;
    const description =
      typeof itemVal === 'object' && itemVal
        ? str(pick(itemVal, ['name', 'description', 'partno']))
        : str(pick(li, QLI.desc));
    return {
      description,
      quantity,
      unitCost,
      unitSell,
      markupPct: markupRaw === undefined ? null : num(markupRaw),
      lineCost: unitCost * quantity,
      lineSell,
    };
  });
}

export async function exportAllQuotes(opts: {
  where?: string;
  includeLineItems?: boolean;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<QuoteRecord[]> {
  const includeLineItems = opts.includeLineItems ?? true;
  // Default where defeats the 30-day filter and pulls full history.
  const where = opts.where ?? 'and|createddate|>|2000/01/01';
  const join = includeLineItems ? 'lineitems' : undefined;

  const rows = await fetchZone('quotes', { where, join, order: 'createddate|asc' });

  return rows.map((q, i) => {
    const totalEx = num(pick(q, ['totalex', 'subtotal']));
    const totalProfit = num(pick(q, ['totalprofit']));
    const status = str(pick(q, ['status']));
    const acceptanceStatus = str(pick(q, ['acceptancestatus']));
    opts.onProgress?.(i + 1, rows.length);
    return {
      quoteId: str(pick(q, ['quoteid'])),
      quoteNumber: str(pick(q, ['jobnumber', 'refno'])),
      quoteName: str(pick(q, ['quotename'])),
      clientId: sub(q, 'client', ['clientid']),
      clientName: sub(q, 'client', ['clientname']) || str(pick(q, ['contactname'])),
      status,
      acceptanceStatus,
      outcome: toOutcome(acceptanceStatus, status),
      totalCost: totalEx - totalProfit,
      totalSell: totalEx,
      totalInc: num(pick(q, ['totalinc'])),
      totalTax: num(pick(q, ['totaltax'])),
      marginPct: num(pick(q, ['totalprofitmarginpercent'])) || (totalEx > 0 ? (totalProfit / totalEx) * 100 : null),
      dateCreated: str(pick(q, ['createddatetime', 'createddate'])),
      dateModified: str(pick(q, ['createddatetime', 'createddate'])),
      lineItems: includeLineItems ? parseQuoteLines(q) : [],
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────
// CONTACT-FORM LEAD SYNC  (separate feature from the migration export)
//
// ⚠️ NOTE: these POST helpers now sign correctly against the real API, but the
// postxml field names and the client-lookup filter still need validating in a
// live AroFlo zone before relying on them for the website contact form. The
// migration EXPORT path above does not depend on these.
// ──────────────────────────────────────────────────────────────────────────

function mapTaskType(serviceType: string): string {
  const map: Record<string, string> = {
    Emergency: 'Emergency Repair',
    Maintenance: 'Maintenance',
    Commercial: 'Commercial Plumbing',
    Residential: 'Residential Plumbing',
    Gas: 'Gas Fitting',
    Drainage: 'Blocked Drain',
    'Hot Water': 'Hot Water System',
    CCTV: 'CCTV Drain Camera',
    Backflow: 'Backflow Prevention',
    Civil: 'Civil Enquiry',
  };
  return map[serviceType] || 'General Enquiry';
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

export async function createClient(data: {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  suburb?: string;
  clientType?: string;
}): Promise<{ clientId: string; success: boolean }> {
  const [firstName, ...lastParts] = data.contactName.split(' ');
  const xml =
    `<clients><client>` +
    `<clientname>${xmlEscape(data.name || data.contactName)}</clientname>` +
    `<firstname>${xmlEscape(firstName || '')}</firstname>` +
    `<surname>${xmlEscape(lastParts.join(' '))}</surname>` +
    `<phone>${xmlEscape(data.phone)}</phone>` +
    `<email>${xmlEscape(data.email)}</email>` +
    `</client></clients>`;
  const json = await arofloPost('clients', xml);
  const inserted = json?.zoneresponse?.postresults?.inserts?.clients;
  const first = asArray<Record<string, unknown>>(inserted)[0];
  const clientId = str(first?.clientid);
  return { clientId, success: !!clientId };
}

export async function createTask(data: {
  clientId: string;
  taskName: string;
  description: string;
  taskType: string;
  priority: string;
  suburb?: string;
}): Promise<{ taskId: string; success: boolean }> {
  const xml =
    `<tasks><task>` +
    `<client><clientid>${xmlEscape(data.clientId)}</clientid></client>` +
    `<taskname>${xmlEscape(data.taskName)}</taskname>` +
    `<description>${xmlEscape(data.description)}</description>` +
    `<priority>${xmlEscape(data.priority)}</priority>` +
    `</task></tasks>`;
  const json = await arofloPost('tasks', xml);
  const inserted = json?.zoneresponse?.postresults?.inserts?.tasks;
  const first = asArray<Record<string, unknown>>(inserted)[0];
  const taskId = str(first?.taskid);
  return { taskId, success: !!taskId };
}

export async function createLeadFromForm(form: {
  name: string;
  company?: string;
  phone: string;
  email: string;
  serviceType: string;
  industry?: string;
  suburb?: string;
  message?: string;
}): Promise<{ success: boolean; taskId?: string; arofloError?: boolean }> {
  try {
    const created = await createClient({
      name: form.company || form.name,
      contactName: form.name,
      phone: form.phone,
      email: form.email,
      suburb: form.suburb,
      clientType: form.industry === 'Civil' ? 'Civil' : form.company ? 'Commercial' : 'Residential',
    });
    if (!created.clientId) return { success: true, arofloError: true };

    const priority =
      form.serviceType === 'Emergency' ? 'Urgent' : ['Commercial', 'Civil'].includes(form.industry || '') ? 'High' : 'Normal';
    const description = [
      `Source: pulseqld.com.au`,
      `Service: ${form.serviceType}`,
      form.industry ? `Industry: ${form.industry}` : null,
      form.suburb ? `Suburb: ${form.suburb}` : null,
      form.message ? `\nClient message:\n${form.message}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const task = await createTask({
      clientId: created.clientId,
      taskName: `Website Enquiry — ${form.serviceType} — ${form.suburb || 'QLD'}`,
      description,
      taskType: mapTaskType(form.serviceType),
      priority,
      suburb: form.suburb,
    });
    return { success: true, taskId: task.taskId };
  } catch (err) {
    console.error('[AroFlo] createLeadFromForm error:', err);
    return { success: true, arofloError: true };
  }
}

export async function createCivilEnquiry(form: {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  projectType: string;
  projectValue: string;
  projectLocation?: string;
  description: string;
  timeline?: string;
}): Promise<{ success: boolean; taskId?: string }> {
  try {
    const created = await createClient({
      name: form.companyName,
      contactName: form.contactName,
      phone: form.phone,
      email: form.email,
      suburb: form.projectLocation,
      clientType: 'Civil',
    });
    if (!created.clientId) return { success: true };

    const description = [
      `CIVIL PROJECT ENQUIRY`,
      `Project Type: ${form.projectType}`,
      `Estimated Value: ${form.projectValue}`,
      form.timeline ? `Timeline: ${form.timeline}` : null,
      form.projectLocation ? `Location: ${form.projectLocation}` : null,
      `\nProject Description:\n${form.description}`,
    ]
      .filter(Boolean)
      .join('\n');

    const task = await createTask({
      clientId: created.clientId,
      taskName: `Civil RFQ — ${form.projectType} — ${form.projectLocation || 'QLD'}`,
      description,
      taskType: 'Civil Enquiry',
      priority: form.projectValue.includes('500K') ? 'High' : 'Normal',
      suburb: form.projectLocation,
    });
    return { success: true, taskId: task.taskId };
  } catch (err) {
    console.error('[AroFlo] createCivilEnquiry error:', err);
    return { success: true };
  }
}
