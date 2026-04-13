// src/lib/aroflo.ts
// AroFlo REST API service — server-side only
// Auth: Basic (base64) + HMAC-SHA256 signing
// Docs: https://apidocs.aroflo.com

import { createHmac, createHash } from 'node:crypto';

const BASE_URL = import.meta.env.AROFLO_BASE_URL ||
  'https://api.aroflo.com';
const USERNAME = import.meta.env.AROFLO_USERNAME;
const PASSWORD = import.meta.env.AROFLO_PASSWORD;
const SECRET  = import.meta.env.AROFLO_SECRET_KEY;

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
