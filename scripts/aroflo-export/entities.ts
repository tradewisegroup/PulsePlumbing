// AroFlo migration extractors — one fetcher per zone needed to decommission
// AroFlo. All reuse the signed GET (`getJson`) from the website's AroFlo
// client so there is a single HMAC implementation.
//
// ⚠️ FIELD NAMES & ZONE PATHS are defensive guesses where AroFlo's docs are
// ambiguous. Confirm against the Postman collection at
// https://apidocs.aroflo.com before trusting a production run — each fetcher
// notes what to verify. Empty results or zeroed money columns => a name/path
// mismatch to fix here.

import {
  getJson,
  asArray,
  pick,
  num,
  str,
  exportAllQuotes,
  type QuoteRecord,
} from '../../src/lib/aroflo.ts';

export type { QuoteRecord };

// ── generic paged list fetch ────────────────────────────────────────────────
// AroFlo wraps lists as response.<plural>.<singular> (e.g. response.tasks.task).
export async function fetchAllPaged(
  zone: string,
  plural: string,
  singular: string,
  opts: { where?: string; fields?: string; pageLimit?: number } = {}
): Promise<Record<string, unknown>[]> {
  const pageLimit = opts.pageLimit ?? 100;
  const whereParam = opts.where ? `&where=${encodeURIComponent(opts.where)}` : '';
  const fieldsParam = opts.fields ? `&fields=${encodeURIComponent(opts.fields)}` : '';
  const out: Record<string, unknown>[] = [];

  for (let page = 1; ; page++) {
    const path = `/${zone}?page=${page}&pagelimit=${pageLimit}${whereParam}${fieldsParam}`;
    const data = await getJson(path);
    const node = data?.response?.[plural];
    const batch = asArray<Record<string, unknown>>(node?.[singular] ?? node);
    if (batch.length === 0) break;
    out.push(...batch);
    if (batch.length < pageLimit) break;
  }
  return out;
}

// ── line-item helper (shared shape for quotes/invoices) ─────────────────────
const LINE = {
  desc: ['description', 'itemdescription', 'name', 'partname'],
  qty: ['quantity', 'qty', 'units'],
  unitCost: ['unitcost', 'cost', 'costunit'],
  unitSell: ['unitsell', 'sell', 'unitprice', 'unitrate', 'price'],
  lineCost: ['linecost', 'totalcost'],
  lineSell: ['linesell', 'total', 'linetotal', 'selltotal'],
} as const;

export interface LineItem {
  description: string;
  quantity: number;
  unitCost: number;
  unitSell: number;
  lineCost: number;
  lineSell: number;
}

function parseLineItems(container: any): LineItem[] {
  const raw =
    container?.lineitems?.lineitem ??
    container?.items?.item ??
    container?.lineitems ??
    container?.items;
  return asArray<Record<string, unknown>>(raw).map((li) => {
    const quantity = num(pick(li, LINE.qty)) || 1;
    const unitCost = num(pick(li, LINE.unitCost));
    const unitSell = num(pick(li, LINE.unitSell));
    return {
      description: str(pick(li, LINE.desc)),
      quantity,
      unitCost,
      unitSell,
      lineCost: num(pick(li, LINE.lineCost)) || unitCost * quantity,
      lineSell: num(pick(li, LINE.lineSell)) || unitSell * quantity,
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
  suburb: string;
  clientType: string;
  raw: Record<string, unknown>;
}
export async function fetchClients(where?: string): Promise<ClientRecord[]> {
  const rows = await fetchAllPaged('clients', 'clients', 'client', { where });
  return rows.map((c) => ({
    clientId: str(pick(c, ['clientid', 'clientID', 'id'])),
    clientName: str(pick(c, ['clientname', 'client', 'name'])),
    contactName: str(pick(c, ['contactname', 'firstname'])),
    email: str(pick(c, ['email', 'email1'])),
    phone: str(pick(c, ['phone1', 'phone', 'mobile'])),
    suburb: str(pick(c, ['suburb', 'city'])),
    clientType: str(pick(c, ['clienttype', 'type'])),
    raw: c,
  }));
}

// ── jobs / tasks ─────────────────────────────────────────────────────────────
// Verify: zone may be 'tasks'; some sites expose projects separately.
export interface JobRecord {
  taskId: string;
  taskNumber: string;
  clientId: string;
  clientName: string;
  taskName: string;
  taskType: string;
  status: string;
  priority: string;
  suburb: string;
  dateCreated: string;
  dateModified: string;
  description: string;
  raw: Record<string, unknown>;
}
export async function fetchJobs(where?: string): Promise<JobRecord[]> {
  const rows = await fetchAllPaged('tasks', 'tasks', 'task', { where });
  return rows.map((t) => ({
    taskId: str(pick(t, ['taskid', 'taskID', 'id'])),
    taskNumber: str(pick(t, ['tasknumber', 'taskno', 'number'])),
    clientId: str(pick(t, ['clientid', 'clientID'])),
    clientName: str(pick(t, ['clientname', 'client'])),
    taskName: str(pick(t, ['taskname', 'name'])),
    taskType: str(pick(t, ['tasktype', 'type'])),
    status: str(pick(t, ['status', 'taskstatus'])),
    priority: str(pick(t, ['priority'])),
    suburb: str(pick(t, ['suburb', 'city'])),
    dateCreated: str(pick(t, ['datecreated', 'created'])),
    dateModified: str(pick(t, ['datemodified', 'modified'])),
    description: str(pick(t, ['description', 'notes'])),
    raw: t,
  }));
}

// ── invoices (+ line items) ──────────────────────────────────────────────────
export interface InvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  taskId: string;
  clientId: string;
  clientName: string;
  status: string;
  total: number;
  totalTax: number;
  dateIssued: string;
  datePaid: string;
  lineItems: LineItem[];
  raw: Record<string, unknown>;
}
export async function fetchInvoices(
  where?: string,
  includeLineItems = true
): Promise<InvoiceRecord[]> {
  const rows = await fetchAllPaged('invoices', 'invoices', 'invoice', { where });
  const out: InvoiceRecord[] = [];
  for (const inv of rows) {
    const invoiceId = str(pick(inv, ['invoiceid', 'invoiceID', 'id']));
    let lineItems = parseLineItems(inv);
    if (includeLineItems && lineItems.length === 0 && invoiceId) {
      const detail = await getJson(`/invoices/${encodeURIComponent(invoiceId)}`);
      const node = detail?.response?.invoices?.invoice ?? detail?.response?.invoice;
      lineItems = parseLineItems(node);
    }
    out.push({
      invoiceId,
      invoiceNumber: str(pick(inv, ['invoicenumber', 'invoiceno', 'number'])),
      taskId: str(pick(inv, ['taskid', 'taskID'])),
      clientId: str(pick(inv, ['clientid', 'clientID'])),
      clientName: str(pick(inv, ['clientname', 'client'])),
      status: str(pick(inv, ['status', 'invoicestatus'])),
      total: num(pick(inv, ['total', 'invoicetotal', 'amount'])),
      totalTax: num(pick(inv, ['totaltax', 'tax', 'gst'])),
      dateIssued: str(pick(inv, ['dateissued', 'issued', 'datecreated'])),
      datePaid: str(pick(inv, ['datepaid', 'paid'])),
      lineItems,
      raw: inv,
    });
  }
  return out;
}

// ── timesheets / labour ──────────────────────────────────────────────────────
export interface TimesheetRecord {
  timesheetId: string;
  taskId: string;
  userId: string;
  userName: string;
  date: string;
  hours: number;
  costRate: number;
  sellRate: number;
  notes: string;
  raw: Record<string, unknown>;
}
export async function fetchTimesheets(where?: string): Promise<TimesheetRecord[]> {
  const rows = await fetchAllPaged('timesheets', 'timesheets', 'timesheet', { where });
  return rows.map((ts) => ({
    timesheetId: str(pick(ts, ['timesheetid', 'timesheetID', 'id'])),
    taskId: str(pick(ts, ['taskid', 'taskID'])),
    userId: str(pick(ts, ['userid', 'userID', 'staffid'])),
    userName: str(pick(ts, ['username', 'user', 'staffname'])),
    date: str(pick(ts, ['date', 'datestart', 'workdate'])),
    hours: num(pick(ts, ['hours', 'totalhours', 'duration'])),
    costRate: num(pick(ts, ['costrate', 'cost'])),
    sellRate: num(pick(ts, ['sellrate', 'sell', 'chargerate'])),
    notes: str(pick(ts, ['notes', 'description'])),
    raw: ts,
  }));
}

// ── inventory / materials catalogue ──────────────────────────────────────────
// NOTE: this is the materials *catalogue*. Materials *used on a job* usually
// live on the task/quote/invoice line items above, not here.
export interface InventoryRecord {
  itemId: string;
  partNumber: string;
  description: string;
  cost: number;
  sell: number;
  supplier: string;
  raw: Record<string, unknown>;
}
export async function fetchInventory(where?: string): Promise<InventoryRecord[]> {
  const rows = await fetchAllPaged('inventory', 'inventory', 'item', { where });
  return rows.map((it) => ({
    itemId: str(pick(it, ['itemid', 'inventoryid', 'id'])),
    partNumber: str(pick(it, ['partnumber', 'partno', 'sku', 'code'])),
    description: str(pick(it, ['description', 'name', 'partname'])),
    cost: num(pick(it, ['cost', 'unitcost', 'costprice'])),
    sell: num(pick(it, ['sell', 'unitsell', 'sellprice', 'price'])),
    supplier: str(pick(it, ['supplier', 'suppliername'])),
    raw: it,
  }));
}

// ── attachments / files per job ──────────────────────────────────────────────
// Verify the files zone/path against apidocs — sites differ. Returns metadata;
// run.ts downloads the binaries.
export interface FileRef {
  fileId: string;
  taskId: string;
  fileName: string;
  url: string;
  size: number;
  raw: Record<string, unknown>;
}
export async function fetchTaskFiles(taskId: string): Promise<FileRef[]> {
  const data = await getJson(`/tasks/${encodeURIComponent(taskId)}/files`);
  const node = data?.response?.files ?? data?.response?.attachments;
  const raw = node?.file ?? node?.attachment ?? node;
  return asArray<Record<string, unknown>>(raw).map((f) => ({
    fileId: str(pick(f, ['fileid', 'id'])),
    taskId,
    fileName: str(pick(f, ['filename', 'name', 'title'])),
    url: str(pick(f, ['url', 'downloadurl', 'href', 'link'])),
    size: num(pick(f, ['size', 'filesize'])),
    raw: f,
  }));
}

// quotes are handled by the website client's exportAllQuotes
export { exportAllQuotes };
