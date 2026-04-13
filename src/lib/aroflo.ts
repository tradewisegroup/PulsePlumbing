/**
 * AroFlo API client — HTTP Basic Auth + HMAC-SHA256 request signing
 *
 * Runs server-side only (Astro SSR / Cloudflare Workers).
 * Requires the `nodejs_compat` compatibility flag in wrangler.toml so that
 * `node:crypto` is available in the Workers runtime.
 *
 * Environment variables (set in .env.local and Cloudflare Pages dashboard):
 *   AROFLO_USERNAME    — AroFlo API username
 *   AROFLO_PASSWORD    — AroFlo API password
 *   AROFLO_SECRET_KEY  — HMAC signing secret (AroFlo Settings > API)
 *   AROFLO_BASE_URL    — Base URL, e.g. https://api.aroflo.com
 */

import { createHmac, createHash } from 'node:crypto';

// ─── Config ───────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return import.meta.env.AROFLO_BASE_URL ?? 'https://api.aroflo.com';
}

function isConfigured(): boolean {
  return Boolean(
    import.meta.env.AROFLO_USERNAME   &&
    import.meta.env.AROFLO_PASSWORD   &&
    import.meta.env.AROFLO_SECRET_KEY,
  );
}

// ─── Exported interfaces ──────────────────────────────────────────────────────

export interface ClientData {
  /** Company or trading name — used as the AroFlo client name */
  name:         string;
  /** Primary contact's full name */
  contactName:  string;
  phone:        string;
  email:        string;
  suburb?:      string;
  /** e.g. 'Residential' | 'Commercial' | 'Civil' */
  companyType?: string;
}

export interface TaskData {
  clientId:      string;
  taskName:      string;
  description:   string;
  /** AroFlo task type string, e.g. 'Quote Request' | 'Civil Enquiry' */
  taskType:      string;
  priority:      'Normal' | 'Urgent' | 'High';
  source:        string;
  suburb?:       string;
  customFields?: Record<string, string>;
}

export interface FormSubmission {
  email:        string;
  /** Full name of the contact (combined firstname + lastname) */
  fullName?:    string;
  companyName?: string;
  phone:        string;
  serviceType:  string;
  industry?:    string;
  suburb?:      string;
  message:      string;
}

/** Civil project enquiry — used by /api/civil-contact */
export interface CivilEnquiryInput {
  /** Trading name or legal entity of the enquiring organisation */
  companyName:      string;
  firstName:        string;
  lastName:         string;
  email:            string;
  phone:            string;
  projectType:      string;
  /** Raw value string from the form, e.g. "$500k – $1M" or "1m-plus" */
  projectValue?:    string;
  projectLocation?: string;
  description:      string;
  /** How they found us */
  howFound?:        string;
  /** UTM campaign tag */
  utmCampaign?:     string;
  /** Project start timeline, e.g. "Q3 2025" */
  timeline?:        string;
}

// ─── AroFlo response shapes ───────────────────────────────────────────────────
// AroFlo wraps responses in response.response.{resource}.{item}.
// A single result comes back as an object; multiple results as an array.
// We always normalise to an array with normaliseClients().

interface AroFloClientRecord {
  clientid?: string;
  clientId?: string;
  id?:       string;
  email?:    string;
  name?:     string;
}

interface AroFloClientsResponse {
  response?: {
    clients?: {
      client?: AroFloClientRecord | AroFloClientRecord[];
    };
  };
}

interface AroFloCreateResponse {
  response?: {
    result?: {
      clientid?: string;
      clientId?: string;
      id?:       string;
      taskid?:   string;
      taskId?:   string;
    };
  };
}

function normaliseClients(raw: AroFloClientsResponse): AroFloClientRecord[] {
  const client = raw?.response?.clients?.client;
  if (!client) return [];
  return Array.isArray(client) ? client : [client];
}

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * Build request headers for an AroFlo API call.
 *
 * Two-layer authentication:
 *   1. HTTP Basic Auth  — `Authorization: Basic base64(username:password)`
 *   2. HMAC-SHA256      — signs the request so AroFlo can verify the secret key
 *
 * Canonical string signed by HMAC (newline-separated):
 *   METHOD\nPATH\nTIMESTAMP\nSHA256(body)
 *
 * Exported so API route tests can assert on the header shape without making
 * real network calls.
 */
export function buildAroFloHeaders(
  method: string,
  path:   string,
  body  = '',
): Record<string, string> {
  const username  = import.meta.env.AROFLO_USERNAME   ?? '';
  const password  = import.meta.env.AROFLO_PASSWORD   ?? '';
  const secretKey = import.meta.env.AROFLO_SECRET_KEY ?? '';

  const timestamp = Date.now().toString();
  const bodyHash  = createHash('sha256').update(body).digest('hex');

  const canonical = [method.toUpperCase(), path, timestamp, bodyHash].join('\n');
  const hmac      = createHmac('sha256', secretKey).update(canonical).digest('hex');

  const base64Credentials = btoa(`${username}:${password}`);

  return {
    'Authorization':       `Basic ${base64Credentials}`,
    'Accept':              'application/json',
    'Content-Type':        'application/json',
    'x-aroflo-hmac':       hmac,
    'x-aroflo-timestamp':  timestamp,
  };
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function aroFloRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  path:   string,
  body?:  object,
): Promise<T> {
  const bodyStr = body ? JSON.stringify(body) : '';
  const headers = buildAroFloHeaders(method, path, bodyStr);
  const url     = `${getBaseUrl()}${path}`;

  const res = await globalThis.fetch(url, {
    method,
    headers,
    ...(bodyStr && { body: bodyStr }),
  });

  if (res.status === 429) {
    console.warn(
      `[AroFlo] Rate limited on ${method} ${path} — Retry-After: ` +
      `${res.headers.get('Retry-After') ?? 'unknown'}s`,
    );
    throw new Error('AroFlo rate limit reached (429).');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`AroFlo ${res.status} on ${method} ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API functions ─────────────────────────────────────────────────────

/**
 * Search AroFlo for a client with the given email address.
 *
 * Returns the first matching record, or null when not found or on error.
 * Errors are soft-failed so callers can fall through to createClient().
 */
export async function findClientByEmail(
  email: string,
): Promise<AroFloClientRecord | null> {
  try {
    const raw = await aroFloRequest<AroFloClientsResponse>(
      'GET',
      `/clients?filters=email%3D${encodeURIComponent(email)}&pageSize=1`,
    );
    const [first] = normaliseClients(raw);
    return first ?? null;
  } catch (err) {
    console.warn(`[AroFlo] findClientByEmail failed for ${email}:`, err);
    return null;
  }
}

/**
 * Create a new client record in AroFlo.
 *
 * Returns the new client's ID string, or null on failure (errors logged,
 * not rethrown — caller decides how to proceed).
 */
export async function createClient(data: ClientData): Promise<string | null> {
  try {
    const raw = await aroFloRequest<AroFloCreateResponse>('POST', '/clients', {
      name:        data.name,
      contactName: data.contactName,
      phone:       data.phone,
      email:       data.email,
      suburb:      data.suburb ?? '',
      state:       'QLD',
      country:     'Australia',
      type:        data.companyType ?? 'Residential',
    });
    const result = raw?.response?.result;
    return result?.clientid ?? result?.clientId ?? result?.id ?? null;
  } catch (err) {
    console.error('[AroFlo] createClient failed:', err);
    return null;
  }
}

/**
 * Create a task/job in AroFlo linked to an existing client.
 *
 * Returns the new task ID string, or null on failure (errors logged,
 * not rethrown — AroFlo outage should not block the user response).
 */
export async function createTask(data: TaskData): Promise<string | null> {
  try {
    const raw = await aroFloRequest<AroFloCreateResponse>('POST', '/tasks', {
      clientId:     data.clientId,
      name:         data.taskName,
      description:  data.description,
      type:         data.taskType,
      priority:     data.priority,
      source:       data.source,
      suburb:       data.suburb ?? '',
      customFields: data.customFields ?? {},
    });
    const result = raw?.response?.result;
    return result?.taskid ?? result?.taskId ?? null;
  } catch (err) {
    console.error('[AroFlo] createTask failed:', err);
    return null;
  }
}

// ─── Priority helpers ─────────────────────────────────────────────────────────

const SERVICE_PRIORITY_MAP: Record<string, TaskData['priority']> = {
  emergency:       'Urgent',
  'blocked-drain': 'High',
  'hot-water':     'High',
};

function serviceTypeToPriority(serviceType: string): TaskData['priority'] {
  return SERVICE_PRIORITY_MAP[serviceType] ?? 'Normal';
}

// ─── Orchestration: standard lead ────────────────────────────────────────────

/**
 * Process a standard quote / contact form submission into AroFlo.
 *
 * Steps:
 *   1. Search for an existing client by email
 *   2. Create the client if not found
 *   3. Create a Quote Request task linked to that client
 *
 * Never throws. Returns `{ taskId }` on success or `{ taskId: null, arofloError: true }`
 * when AroFlo is not configured or every operation fails. The `arofloError` flag
 * lets callers log without surfacing AroFlo details to the end user.
 */
export async function createLeadFromForm(
  form: FormSubmission,
): Promise<{ taskId: string | null; arofloError?: boolean }> {
  if (!isConfigured()) {
    console.warn('[AroFlo] Credentials not configured — skipping lead creation.');
    return { taskId: null, arofloError: true };
  }

  // 1. Find or create client
  let clientId: string | null = null;

  const existing = await findClientByEmail(form.email);
  if (existing) {
    clientId = existing.clientid ?? existing.clientId ?? existing.id ?? null;
    if (clientId) {
      console.info(`[AroFlo] Found existing client ${clientId} for ${form.email}`);
    }
  }

  if (!clientId) {
    clientId = await createClient({
      name:        form.companyName || form.fullName || form.email,
      contactName: form.fullName ?? '',
      phone:       form.phone,
      email:       form.email,
      suburb:      form.suburb,
      companyType: form.industry ? 'Commercial' : 'Residential',
    });
    if (clientId) {
      console.info(`[AroFlo] Created client ${clientId} for ${form.email}`);
    }
  }

  if (!clientId) {
    console.error('[AroFlo] Could not obtain client ID — skipping task creation.');
    return { taskId: null, arofloError: true };
  }

  // 2. Build task description
  const descLines: string[] = [];
  if (form.serviceType) descLines.push(`Service: ${form.serviceType}`);
  if (form.industry)    descLines.push(`Industry: ${form.industry}`);
  if (form.suburb)      descLines.push(`Suburb: ${form.suburb}`);
  if (form.message)     descLines.push(`\nDetails:\n${form.message}`);
  const description = descLines.join('\n') || 'Website quote request';

  // 3. Create task
  const taskId = await createTask({
    clientId,
    taskName:    `Quote Request — ${form.serviceType || 'General'}`,
    description,
    taskType:    'Quote Request',
    priority:    serviceTypeToPriority(form.serviceType),
    source:      'Website',
    suburb:      form.suburb,
  });

  if (taskId) {
    console.info(`[AroFlo] Created task ${taskId} for client ${clientId}`);
    return { taskId };
  }

  return { taskId: null, arofloError: true };
}

// ─── Orchestration: civil enquiry ─────────────────────────────────────────────

function civilPriority(projectValue: string | undefined): TaskData['priority'] {
  if (!projectValue) return 'Normal';
  const v = projectValue.toLowerCase();
  if (
    v.includes('500k-1m')  ||
    v.includes('1m-plus')  ||
    v.includes('1m+')      ||
    v.includes('$500k')    ||
    v.includes('$1m')      ||
    /\$[1-9]\d*\s*m/.test(v)
  ) {
    return 'High';
  }
  return 'Normal';
}

function buildCivilDescription(input: CivilEnquiryInput): string {
  const lines: string[] = [
    `Company: ${input.companyName}`,
    `Contact: ${[input.firstName, input.lastName].filter(Boolean).join(' ')}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone}`,
    `Project Type: ${input.projectType}`,
  ];
  if (input.projectValue)    lines.push(`Project Value: ${input.projectValue}`);
  if (input.projectLocation) lines.push(`Location: ${input.projectLocation}`);
  if (input.timeline)        lines.push(`Timeline: ${input.timeline}`);
  lines.push('', 'Project Description:', input.description);
  if (input.howFound)    lines.push(`\nHow Found: ${input.howFound}`);
  if (input.utmCampaign) lines.push(`Campaign: ${input.utmCampaign}`);
  return lines.join('\n');
}

/**
 * Process a civil project enquiry into AroFlo.
 *
 * Steps:
 *   1. Search for existing client by email
 *   2. Create client if not found
 *   3. Create a Civil Enquiry task
 *
 * Returns the task ID on success, or null when AroFlo is not configured or all
 * operations fail. Never throws — HubSpot already captured the lead by the time
 * this is called, so AroFlo failure must not block the user response.
 */
export async function createCivilEnquiry(
  input: CivilEnquiryInput,
): Promise<string | null> {
  if (!isConfigured()) {
    console.warn('[AroFlo] Credentials not configured — skipping civil enquiry creation.');
    return null;
  }

  // 1. Find or create client
  let clientId: string | null = null;

  const existing = await findClientByEmail(input.email);
  if (existing) {
    clientId = existing.clientid ?? existing.clientId ?? existing.id ?? null;
    if (clientId) {
      console.info(`[AroFlo] Found existing client ${clientId} for ${input.email}`);
    }
  }

  if (!clientId) {
    clientId = await createClient({
      name:        input.companyName,
      contactName: [input.firstName, input.lastName].filter(Boolean).join(' '),
      phone:       input.phone,
      email:       input.email,
      suburb:      input.projectLocation,
      companyType: 'Civil',
    });
    if (clientId) {
      console.info(`[AroFlo] Created civil client ${clientId} for ${input.email}`);
    }
  }

  if (!clientId) {
    console.error('[AroFlo] Civil: could not obtain client ID — skipping task creation.');
    return null;
  }

  // 2. Create Civil Enquiry task
  const taskId = await createTask({
    clientId,
    taskName:     `Civil Enquiry — ${input.projectType}`,
    description:  buildCivilDescription(input),
    taskType:     'Civil Enquiry',
    priority:     civilPriority(input.projectValue),
    source:       'Website — Civil',
    suburb:       input.projectLocation,
    customFields: {
      project_type:  input.projectType,
      project_value: input.projectValue ?? '',
    },
  });

  if (taskId) {
    console.info(`[AroFlo] Created civil task ${taskId} for client ${clientId}`);
  }
  return taskId;
}
