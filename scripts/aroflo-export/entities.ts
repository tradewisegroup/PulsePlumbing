// AroFlo migration extractors — one fetcher per zone needed to decommission
// AroFlo. All reuse the signed client (`fetchZone`) from the website's AroFlo
// module so there is a single HMAC-SHA512 implementation.
//
// Field names & zone keys below are taken from the official AroFlo Postman
// collection (https://apidocs.aroflo.com). IMPORTANT: every zone applies a
// "last 30 days" default filter unless an explicit `where` is supplied, so each
// fetcher passes a broad date override to pull FULL history.
//
// WHERE format is pipe-delimited: "and|field|operator|value", dates "YYYY/MM/DD".

import {
  fetchZone,
  asArray,
  unwrapList,
  pick,
  num,
  str,
  sub,
  exportAllQuotes,
  type QuoteRecord,
} from '../../src/lib/aroflo.ts';

export type { QuoteRecord };
export { exportAllQuotes };

// Broad lower bound that defeats each zone's 30-day default filter.
const EPOCH = '2000/01/01';
const since = (date: string | undefined, field: string) =>
  `and|${field}|>|${(date ?? EPOCH).replace(/-/g, '/')}`;

// Shared nested line-item shape (quotes/invoices).
export interface LineItem {
  description: string;
  quantity: number;
  unitCost: number;
  unitSell: number;
  lineEx: number;
  lineTax: number;
  lineInc: number;
}
function parseLines(raw: unknown): LineItem[] {
  return unwrapList(raw).map((li) => {
    const quantity = num(pick(li, ['qty', 'quantity'])) || 1;
    const itemVal = (li as any).item;
    const description =
      typeof itemVal === 'object' && itemVal
        ? str(pick(itemVal, ['name', 'description', 'partno']))
        : str(pick(li, ['item', 'description', 'partno']));
    return {
      description,
      quantity,
      unitCost: num(pick(li, ['cost'])),
      unitSell: num(pick(li, ['sell'])),
      lineEx: num(pick(li, ['totalex'])),
      lineTax: num(pick(li, ['totaltax'])),
      lineInc: num(pick(li, ['totalinc'])),
    };
  });
}

// ── clients ─────────────────────────────────────────────────────────────────
export interface ClientRecord {
  clientId: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  mobile: string;
  abn: string;
  dateCreated: string;
  raw: Record<string, unknown>;
}
export async function fetchClients(date?: string): Promise<ClientRecord[]> {
  const rows = await fetchZone('clients', {
    where: since(date, 'datecreated'),
    join: 'locations,contacts',
  });
  return rows.map((c) => ({
    clientId: str(pick(c, ['clientid'])),
    clientName: str(pick(c, ['clientname'])),
    contactName: `${str(pick(c, ['firstname']))} ${str(pick(c, ['surname']))}`.trim(),
    email: str(pick(c, ['email'])),
    phone: str(pick(c, ['phone'])),
    mobile: str(pick(c, ['mobile'])),
    abn: str(pick(c, ['abn'])),
    dateCreated: str(pick(c, ['datecreated', 'datetimeinserted'])),
    raw: c,
  }));
}

// ── jobs / tasks (+ nested materials, labour, attachments) ───────────────────
// One tasks pass with joins yields jobs AND their materials/labour/attachments,
// which the orchestrator splits into separate output files.
export interface JobRecord {
  taskId: string;
  jobNumber: string;
  clientId: string;
  clientName: string;
  taskName: string;
  taskType: string;
  status: string;
  subStatus: string;
  priority: string;
  suburb: string;
  dateCreated: string;
  dateModified: string;
  dateCompleted: string;
  description: string;
  totalEx: number;
  totalInc: number;
  raw: Record<string, unknown>;
}
export interface MaterialRecord {
  lineId: string;
  taskId: string;
  itemId: string;
  partNumber: string;
  description: string;
  quantity: number;
  cost: number;
  sell: number;
  dateUsed: string;
}
export interface LabourRecord {
  lineId: string;
  taskId: string;
  user: string;
  workDate: string;
  hours: number;
  cost: number;
  sell: number;
  workType: string;
}
export interface FileRef {
  documentId: string;
  taskId: string;
  fileName: string;
  category: string;
  url: string; // ⚠️ AroFlo document URLs expire ~10 min after fetch
  sizeBytes: number;
}

export interface JobBundle {
  jobs: JobRecord[];
  materials: MaterialRecord[];
  labours: LabourRecord[];
  attachments: FileRef[];
}

export async function fetchJobs(date?: string): Promise<JobBundle> {
  const rows = await fetchZone('tasks', {
    where: since(date, 'createdutc'),
    join: 'material,labour,documentsandphotos,tasktotals,location',
  });
  const jobs: JobRecord[] = [];
  const materials: MaterialRecord[] = [];
  const labours: LabourRecord[] = [];
  const attachments: FileRef[] = [];

  for (const t of rows) {
    const taskId = str(pick(t, ['taskid']));
    const totals = (t as any).tasktotals ?? {};
    jobs.push({
      taskId,
      jobNumber: str(pick(t, ['jobnumber'])),
      clientId: sub(t, 'client', ['clientid']),
      clientName: sub(t, 'client', ['clientname']),
      taskName: str(pick(t, ['taskname'])),
      taskType: str(pick(t, ['tasktype'])) || sub(t, 'tasktasktype', ['name']),
      status: str(pick(t, ['status'])),
      subStatus: str(pick(t, ['substatus'])),
      priority: str(pick(t, ['priority'])),
      suburb: sub(t, 'location', ['suburb']),
      dateCreated: str(pick(t, ['createdutc', 'createddatetimeutc'])),
      dateModified: str(pick(t, ['lastupdatedutc', 'lastupdated'])),
      dateCompleted: str(pick(t, ['completeddate', 'completeddatetime'])),
      description: str(pick(t, ['description', 'taskdescription'])),
      totalEx: num(pick(totals, ['totalex'])),
      totalInc: num(pick(totals, ['totalinc'])),
      raw: t,
    });

    for (const m of unwrapList((t as any).materials)) {
      materials.push({
        lineId: str(pick(m, ['lineid'])),
        taskId,
        itemId: str(pick(m, ['itemid'])),
        partNumber: str(pick(m, ['partnumber'])),
        description: typeof (m as any).item === 'object' ? sub(m, 'item', ['name', 'description']) : str(pick(m, ['item'])),
        quantity: num(pick(m, ['quantity'])),
        cost: num(pick(m, ['cost'])),
        sell: num(pick(m, ['sell'])),
        dateUsed: str(pick(m, ['dateused'])),
      });
    }
    for (const l of unwrapList((t as any).labours)) {
      labours.push({
        lineId: str(pick(l, ['lineid'])),
        taskId,
        user: typeof (l as any).user === 'object' ? sub(l, 'user', ['username', 'name']) : str(pick(l, ['user'])),
        workDate: str(pick(l, ['workdate', 'workdatetimestart'])),
        hours: num(pick(l, ['hours'])),
        cost: num(pick(l, ['cost'])),
        sell: num(pick(l, ['sell'])),
        workType: str(pick(l, ['worktype'])),
      });
    }
    for (const d of unwrapList((t as any).documentsandphotos)) {
      attachments.push({
        documentId: str(pick(d, ['documentid'])),
        taskId,
        fileName: str(pick(d, ['name'])),
        category: str(pick(d, ['category'])),
        url: str(pick(d, ['url'])),
        sizeBytes: num(pick(d, ['sizeinbytes'])),
      });
    }
  }
  return { jobs, materials, labours, attachments };
}

// ── invoices (+ line items) ──────────────────────────────────────────────────
export interface InvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  taskId: string;
  clientId: string;
  clientName: string;
  status: string;
  totalEx: number;
  totalGst: number;
  totalInc: number;
  dateInvoiced: string;
  dueDate: string;
  lineItems: LineItem[];
  raw: Record<string, unknown>;
}
export async function fetchInvoices(date?: string): Promise<InvoiceRecord[]> {
  const rows = await fetchZone('invoices', {
    where: since(date, 'lastupdatedutc'),
    join: 'lineitems,task',
  });
  return rows.map((inv) => ({
    invoiceId: str(pick(inv, ['invoiceid'])),
    invoiceNumber: str(pick(inv, ['invoicenumber'])),
    taskId: sub(inv, 'task', ['taskid']),
    clientId: sub(inv, 'client', ['clientid']),
    clientName: sub(inv, 'client', ['clientname']),
    status: str(pick(inv, ['status'])),
    totalEx: num(pick(inv, ['totalex'])),
    totalGst: num(pick(inv, ['totalgst'])),
    totalInc: num(pick(inv, ['totalinc'])),
    dateInvoiced: str(pick(inv, ['dateinvoiced'])),
    dueDate: str(pick(inv, ['duedate'])),
    lineItems: parseLines((inv as any).lines ?? (inv as any).lineitems),
    raw: inv,
  }));
}

// ── timesheets ────────────────────────────────────────────────────────────────
export interface TimesheetRecord {
  timesheetId: string;
  taskId: string;
  user: string;
  workDate: string;
  hours: number;
  cost: number;
  charge: number;
  workType: string;
  note: string;
  raw: Record<string, unknown>;
}
export async function fetchTimesheets(date?: string): Promise<TimesheetRecord[]> {
  const rows = await fetchZone('timesheets', { where: since(date, 'workdate') });
  return rows.map((ts) => ({
    timesheetId: str(pick(ts, ['timesheetid'])),
    taskId: sub(ts, 'task', ['taskid']),
    user: typeof (ts as any).user === 'object' ? sub(ts, 'user', ['username', 'name']) : str(pick(ts, ['user'])),
    workDate: str(pick(ts, ['workdate'])),
    hours: num(pick(ts, ['hours'])),
    cost: num(pick(ts, ['cost'])),
    charge: num(pick(ts, ['charge'])),
    workType: str(pick(ts, ['worktype'])),
    note: str(pick(ts, ['note'])),
    raw: ts,
  }));
}

// ── inventory / materials catalogue ──────────────────────────────────────────
export interface InventoryRecord {
  itemId: string;
  partNumber: string;
  description: string;
  costEx: number;
  sellTask: number;
  sellQuote: number;
  supplier: string;
  manufacturer: string;
  raw: Record<string, unknown>;
}
export async function fetchInventory(date?: string): Promise<InventoryRecord[]> {
  const rows = await fetchZone('inventory', { where: since(date, 'createdutc') });
  return rows.map((it) => ({
    itemId: str(pick(it, ['itemid'])),
    partNumber: str(pick(it, ['partnumber'])),
    description: str(pick(it, ['description'])),
    costEx: num(pick(it, ['costex'])),
    sellTask: num(pick(it, ['sell_task'])),
    sellQuote: num(pick(it, ['sell_qte'])),
    supplier: typeof (it as any).supplier === 'object' ? sub(it, 'supplier', ['name', 'suppliername']) : str(pick(it, ['supplier'])),
    manufacturer: str(pick(it, ['manufacturer'])),
    raw: it,
  }));
}
