// src/lib/aroflo.ts
// AroFlo REST API service — server-side only
// Auth: Basic (base64) + HMAC-SHA256 signing
// Docs: https://apidocs.aroflo.com

import { createHmac, createHash } from 'node:crypto';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

// In dev the Vercel adapter's SSR worker runs in an isolated context that
// doesn't inherit Vite's env loading. Load .env.local directly so
// process.env is populated. In production (Vercel) the file won't exist
// and dotenv silently no-ops — process.env is already set by the platform.
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

function env(key: string): string {
  // import.meta.env exists under Vite/Astro SSR but not in a plain Node
  // script run (e.g. scripts/export-quotes.ts), so guard against it.
  const viteEnv = (import.meta as { env?: Record<string, string> }).env;
  return (process.env[key] ?? viteEnv?.[key] ?? '') as string;
}

const BASE_URL = env('AROFLO_BASE_URL') || 'https://api.aroflo.com';
const USERNAME = env('AROFLO_USERNAME');
const PASSWORD = env('AROFLO_PASSWORD');
const SECRET   = env('AROFLO_SECRET_KEY');

interface AroFloHeaders {
  Authorization: string;
  Accept: string;
  'Content-Type': string;
  'x-aroflo-hmac': string;
  'x-aroflo-timestamp': string;
}

// Build HMAC-signed headers for every AroFlo request
function buildHeaders(
  method: string,
  path: string,
  body?: string
): AroFloHeaders {
  const credentials = Buffer.from(
    `${USERNAME}:${PASSWORD}`
  ).toString('base64');

  const timestamp = new Date().toISOString();

  // Hash the request body (empty string if no body)
  const bodyHash = createHash('sha256')
    .update(body || '')
    .digest('hex');

  // Build canonical string to sign
  const canonical = [
    method.toUpperCase(),
    path,
    timestamp,
    bodyHash
  ].join('\n');

  // HMAC-SHA256 sign with secret key
  const signature = createHmac('sha256', SECRET)
    .update(canonical)
    .digest('hex');

  return {
    Authorization: `Basic ${credentials}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-aroflo-hmac': signature,
    'x-aroflo-timestamp': timestamp,
  };
}

// Map service type string to AroFlo task type
function mapTaskType(serviceType: string): string {
  const map: Record<string, string> = {
    'Emergency':    'Emergency Repair',
    'Maintenance':  'Maintenance',
    'Commercial':   'Commercial Plumbing',
    'Residential':  'Residential Plumbing',
    'Gas':          'Gas Fitting',
    'Drainage':     'Blocked Drain',
    'Hot Water':    'Hot Water System',
    'CCTV':         'CCTV Drain Camera',
    'Backflow':     'Backflow Prevention',
    'Civil':        'Civil Enquiry',
  };
  return map[serviceType] || 'General Enquiry';
}

// Find existing client by email address
export async function findClientByEmail(
  email: string
): Promise<{ clientId: string } | null> {
  const path = `/clients?where=email%3D'${encodeURIComponent(email)}'&fields=clientid,clientname,email`;
  const headers = buildHeaders('GET', path);

  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    if (!res.ok) return null;

    const data = await res.json();
    const client = data?.response?.clients?.client;

    if (!client) return null;

    // AroFlo returns array or single object
    const first = Array.isArray(client) ? client[0] : client;
    return first ? { clientId: String(first.clientid) } : null;

  } catch (err) {
    console.error('[AroFlo] findClientByEmail error:', err);
    return null;
  }
}

// Create a new AroFlo client
export async function createClient(data: {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  suburb?: string;
  clientType?: string;
}): Promise<{ clientId: string; success: boolean }> {
  const path = '/clients';
  const [firstName, ...lastParts] = data.contactName.split(' ');

  const body = JSON.stringify({
    client: {
      clientname:  data.name || data.contactName,
      firstname:   firstName || '',
      lastname:    lastParts.join(' ') || '',
      phone1:      data.phone,
      email:       data.email,
      suburb:      data.suburb || '',
      clienttype:  data.clientType || 'Residential',
    }
  });

  const headers = buildHeaders('POST', path, body);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST', headers, body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AroFlo createClient failed: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const clientId = String(
    json?.response?.client?.clientid ||
    json?.response?.clientid ||
    ''
  );

  return { clientId, success: !!clientId };
}

// Create a new AroFlo task (job)
export async function createTask(data: {
  clientId: string;
  taskName: string;
  description: string;
  taskType: string;
  priority: 'Normal' | 'Urgent' | 'High';
  source: string;
  suburb?: string;
}): Promise<{ taskId: string; success: boolean }> {
  const path = '/tasks';

  const body = JSON.stringify({
    task: {
      clientid:    data.clientId,
      taskname:    data.taskName,
      description: data.description,
      tasktype:    data.taskType,
      priority:    data.priority,
      source:      data.source,
      suburb:      data.suburb || '',
      status:      'Scheduled',
    }
  });

  const headers = buildHeaders('POST', path, body);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST', headers, body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AroFlo createTask failed: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const taskId = String(
    json?.response?.task?.taskid ||
    json?.response?.taskid ||
    ''
  );

  return { taskId, success: !!taskId };
}

// Main orchestration: form → AroFlo client + task
export async function createLeadFromForm(form: {
  name: string;
  company?: string;
  phone: string;
  email: string;
  serviceType: string;
  industry?: string;
  suburb?: string;
  message?: string;
}): Promise<{
  success: boolean;
  taskId?: string;
  arofloError?: boolean
}> {
  try {
    // 1. Find or create client
    let clientId: string;
    const existing = await findClientByEmail(form.email);

    if (existing) {
      clientId = existing.clientId;
    } else {
      const created = await createClient({
        name:        form.company || form.name,
        contactName: form.name,
        phone:       form.phone,
        email:       form.email,
        suburb:      form.suburb,
        clientType:  form.industry === 'Civil' ? 'Civil' :
                     (form.company ? 'Commercial' : 'Residential'),
      });
      clientId = created.clientId;
    }

    // 2. Set task priority
    const priority =
      form.serviceType === 'Emergency' ? 'Urgent' :
      ['Commercial','Civil'].includes(form.industry || '') ? 'High' :
      'Normal';

    // 3. Build task name and description
    const taskName =
      `Website Enquiry — ${form.serviceType} — ${form.suburb || 'QLD'}`;

    const description = [
      `Source: pulseqld.com.au`,
      `Service: ${form.serviceType}`,
      form.industry ? `Industry: ${form.industry}` : null,
      form.suburb ? `Suburb: ${form.suburb}` : null,
      form.message ? `\nClient message:\n${form.message}` : null,
    ].filter(Boolean).join('\n');

    // 4. Create task
    const task = await createTask({
      clientId,
      taskName,
      description,
      taskType: mapTaskType(form.serviceType),
      priority,
      source: 'Website — pulseqld.com.au',
      suburb: form.suburb,
    });

    return { success: true, taskId: task.taskId };

  } catch (err) {
    console.error('[AroFlo] createLeadFromForm error:', err);
    // Don't fail the whole form submit if AroFlo is down
    return { success: true, arofloError: true };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// QUOTE EXPORT  →  Captain (pipeline / forecast / won-loss)
//
// The native AroFlo→Xero integration does NOT push quotes (only invoices,
// POs, contacts, payments, credit notes, timesheets). So quote data — with
// line-item cost / sell / description — has to be pulled from the AroFlo API
// and handed to Captain. These helpers do that pull.
//
// NOTE ON FIELD NAMES: AroFlo's JSON keys for quote line items are not 100%
// stable across zones/versions. The readers below are deliberately defensive
// (try several key spellings) and the candidate lists are centralised in the
// `FIELD` map so they're trivial to confirm/adjust against the live Postman
// collection at https://apidocs.aroflo.com.
// ──────────────────────────────────────────────────────────────────────────

// Candidate JSON keys per logical field — first present wins.
const FIELD = {
  quoteId:     ['quoteid', 'quoteID', 'id'],
  quoteNumber: ['quotenumber', 'quoteno', 'number'],
  clientId:    ['clientid', 'clientID'],
  clientName:  ['clientname', 'client'],
  status:      ['status', 'quotestatus'],
  totalCost:   ['totalcost', 'cost', 'costtotal'],
  totalSell:   ['total', 'totalsell', 'selltotal', 'quotetotal', 'amount'],
  created:     ['datecreated', 'created', 'createddate'],
  modified:    ['datemodified', 'modified', 'lastmodified'],
  // line items
  liDesc:      ['description', 'itemdescription', 'name', 'partname'],
  liQty:       ['quantity', 'qty', 'units'],
  liUnitCost:  ['unitcost', 'cost', 'costunit'],
  liUnitSell:  ['unitsell', 'sell', 'unitprice', 'unitrate', 'price'],
  liLineCost:  ['linecost', 'totalcost'],
  liLineSell:  ['linesell', 'total', 'linetotal', 'selltotal'],
  liMarkup:    ['markup', 'markuppct', 'margin'],
} as const;

function pick(obj: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      return obj[k];
    }
  }
  return undefined;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

// Normalise AroFlo's free-text quote status into a pipeline outcome that
// Captain can forecast against.
export type QuoteOutcome = 'won' | 'lost' | 'open' | 'other';
function toOutcome(status: string): QuoteOutcome {
  const s = status.toLowerCase();
  if (/(won|accept|approv|success)/.test(s)) return 'won';
  if (/(lost|declin|reject|unsuccess)/.test(s)) return 'lost';
  if (/(expir|cancel|void|withdrawn)/.test(s)) return 'other';
  if (/(pending|draft|sent|open|new|review)/.test(s)) return 'open';
  return 'other';
}

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitCost: number;
  unitSell: number;
  markupPct: number | null;
  lineCost: number;
  lineSell: number;
}

export interface QuoteRecord {
  quoteId: string;
  quoteNumber: string;
  clientId: string;
  clientName: string;
  status: string;          // raw AroFlo status
  outcome: QuoteOutcome;   // normalised for pipeline forecasting
  totalCost: number;
  totalSell: number;
  marginPct: number | null;
  dateCreated: string;
  dateModified: string;
  lineItems: QuoteLineItem[];
}

// Coerce AroFlo's "array OR single object OR missing" shapes into an array.
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Generic signed GET returning parsed JSON (null on failure).
async function getJson(path: string): Promise<any | null> {
  const headers = buildHeaders('GET', path);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    if (!res.ok) {
      console.error(`[AroFlo] GET ${path} → ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[AroFlo] GET ${path} error:`, err);
    return null;
  }
}

// Pull every quote header, paging through the full result set.
// `where` is an optional AroFlo filter clause (already URL-safe), e.g.
//   "datemodified>'2024-01-01'"  — omit to export everything.
export async function fetchAllQuotes(opts: {
  where?: string;
  pageLimit?: number;
} = {}): Promise<Record<string, unknown>[]> {
  const pageLimit = opts.pageLimit ?? 100;
  const whereParam = opts.where ? `&where=${encodeURIComponent(opts.where)}` : '';
  const out: Record<string, unknown>[] = [];

  for (let page = 1; ; page++) {
    const path = `/quotes?page=${page}&pagelimit=${pageLimit}${whereParam}`;
    const data = await getJson(path);
    const batch = asArray<Record<string, unknown>>(
      data?.response?.quotes?.quote ?? data?.response?.quotes
    );
    if (batch.length === 0) break;
    out.push(...batch);
    if (batch.length < pageLimit) break; // last page
  }

  return out;
}

// Fetch line items for one quote. AroFlo exposes these either nested in the
// quote detail or via a quoteitems zone — try the detail endpoint first.
export async function fetchQuoteLineItems(
  quoteId: string
): Promise<QuoteLineItem[]> {
  const data = await getJson(`/quotes/${encodeURIComponent(quoteId)}`);
  const q = data?.response?.quotes?.quote ?? data?.response?.quote ?? {};

  // Line items live under a few possible containers.
  const raw =
    q?.lineitems?.lineitem ??
    q?.quoteitems?.quoteitem ??
    q?.items?.item ??
    q?.lineitems ??
    q?.items;

  return asArray<Record<string, unknown>>(raw).map((li) => {
    const quantity = num(pick(li, FIELD.liQty)) || 1;
    const unitCost = num(pick(li, FIELD.liUnitCost));
    const unitSell = num(pick(li, FIELD.liUnitSell));
    const markupRaw = pick(li, FIELD.liMarkup);
    // Prefer explicit line totals; otherwise derive from unit × qty.
    const lineCost = num(pick(li, FIELD.liLineCost)) || unitCost * quantity;
    const lineSell = num(pick(li, FIELD.liLineSell)) || unitSell * quantity;
    return {
      description: str(pick(li, FIELD.liDesc)),
      quantity,
      unitCost,
      unitSell,
      markupPct: markupRaw === undefined ? null : num(markupRaw),
      lineCost,
      lineSell,
    };
  });
}

// Orchestrate the full export: every quote + its line items, normalised into
// Captain-ready QuoteRecords. `concurrency` throttles the per-quote line-item
// calls so we don't hammer the AroFlo API.
export async function exportAllQuotes(opts: {
  where?: string;
  pageLimit?: number;
  concurrency?: number;
  includeLineItems?: boolean;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<QuoteRecord[]> {
  const includeLineItems = opts.includeLineItems ?? true;
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const headers = await fetchAllQuotes({
    where: opts.where,
    pageLimit: opts.pageLimit,
  });

  const records: QuoteRecord[] = new Array(headers.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < headers.length) {
      const i = cursor++;
      const h = headers[i];
      const quoteId = str(pick(h, FIELD.quoteId));
      const totalCost = num(pick(h, FIELD.totalCost));
      const totalSell = num(pick(h, FIELD.totalSell));
      const status = str(pick(h, FIELD.status));

      const lineItems =
        includeLineItems && quoteId ? await fetchQuoteLineItems(quoteId) : [];

      records[i] = {
        quoteId,
        quoteNumber: str(pick(h, FIELD.quoteNumber)),
        clientId: str(pick(h, FIELD.clientId)),
        clientName: str(pick(h, FIELD.clientName)),
        status,
        outcome: toOutcome(status),
        totalCost,
        totalSell,
        marginPct:
          totalSell > 0 ? ((totalSell - totalCost) / totalSell) * 100 : null,
        dateCreated: str(pick(h, FIELD.created)),
        dateModified: str(pick(h, FIELD.modified)),
        lineItems,
      };

      done++;
      opts.onProgress?.(done, headers.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, headers.length) }, worker)
  );

  return records;
}

// Civil-specific enquiry (separate task type, project fields)
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
    let clientId: string;
    const existing = await findClientByEmail(form.email);

    if (existing) {
      clientId = existing.clientId;
    } else {
      const created = await createClient({
        name:        form.companyName,
        contactName: form.contactName,
        phone:       form.phone,
        email:       form.email,
        suburb:      form.projectLocation,
        clientType:  'Civil',
      });
      clientId = created.clientId;
    }

    const priority =
      form.projectValue.includes('500K') ? 'High' : 'Normal';

    const description = [
      `CIVIL PROJECT ENQUIRY`,
      `Project Type: ${form.projectType}`,
      `Estimated Value: ${form.projectValue}`,
      form.timeline ? `Timeline: ${form.timeline}` : null,
      form.projectLocation ? `Location: ${form.projectLocation}` : null,
      `\nProject Description:\n${form.description}`,
    ].filter(Boolean).join('\n');

    const task = await createTask({
      clientId,
      taskName: `Civil RFQ — ${form.projectType} — ${form.projectLocation || 'QLD'}`,
      description,
      taskType: 'Civil Enquiry',
      priority,
      source: 'Website Civil RFQ — pulseqld.com.au',
      suburb: form.projectLocation,
    });

    return { success: true, taskId: task.taskId };

  } catch (err) {
    console.error('[AroFlo] createCivilEnquiry error:', err);
    return { success: true };
  }
}
