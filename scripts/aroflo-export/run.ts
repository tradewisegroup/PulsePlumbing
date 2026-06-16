/**
 * scripts/aroflo-export/run.ts
 *
 * Full AroFlo extraction for the Earthwise → Captain migration ("export →
 * verify Captain → switch AroFlo off"). Pulls every entity needed to
 * decommission AroFlo and writes JSON + CSV per entity, plus a manifest with
 * counts and dollar totals for reconciliation. The Captain import is built
 * later (once modules/job is finalised) and reads these files.
 *
 * Usage:
 *   npm run export:aroflo                         # all entities
 *   npm run export:aroflo -- --since=2023-07-01   # only modified since
 *   npm run export:aroflo -- --entities=clients,jobs,quotes,invoices
 *   npm run export:aroflo -- --download-attachments
 *
 * Requires AROFLO_USERNAME / PASSWORD / SECRET_KEY (and optional
 * AROFLO_BASE_URL) — Earthwise's org credentials. See .env.example.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { toCsv, inferColumns } from './csv.ts';
import {
  fetchClients,
  fetchJobs,
  fetchInvoices,
  fetchTimesheets,
  fetchInventory,
  fetchTaskFiles,
  exportAllQuotes,
  type FileRef,
} from './entities.ts';

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (n: string) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
};
const since = getArg('since');
const where = since ? `datemodified>'${since}'` : undefined;
const downloadAttachments = args.includes('--download-attachments');
const ALL = ['clients', 'jobs', 'quotes', 'invoices', 'timesheets', 'inventory', 'attachments'];
const selected = (getArg('entities')?.split(',').map((s) => s.trim()) ?? ALL).filter(Boolean);
const want = (name: string) => selected.includes(name);

// ── output dir ───────────────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = resolve(process.cwd(), 'exports', `aroflo-${ts}`);

// strip heavy/nested fields for the flat CSV
function flatten(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === 'raw' || Array.isArray(v) || (v && typeof v === 'object')) continue;
      o[k] = v;
    }
    return o;
  });
}

async function writeEntity(name: string, rows: Record<string, unknown>[]) {
  await writeFile(resolve(outDir, `${name}.json`), JSON.stringify(rows, null, 2), 'utf8');
  const flat = flatten(rows);
  await writeFile(resolve(outDir, `${name}.csv`), toCsv(flat, inferColumns(flat)), 'utf8');
  return rows.length;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(outDir, { recursive: true });
  console.log(`[aroflo-export] → ${outDir}`);
  console.log(`[aroflo-export] entities: ${selected.join(', ')}${since ? `  since ${since}` : ''}`);

  const manifest: Record<string, unknown> = { generatedAt: new Date().toISOString(), since: since ?? null, counts: {}, totals: {} };
  const counts = manifest.counts as Record<string, number>;
  const totals = manifest.totals as Record<string, number>;

  // clients
  if (want('clients')) counts.clients = await writeEntity('clients', (await fetchClients(where)) as unknown as Record<string, unknown>[]);

  // jobs / tasks
  let jobIds: string[] = [];
  if (want('jobs') || (want('attachments') && jobIds.length === 0)) {
    const jobs = await fetchJobs(where);
    jobIds = jobs.map((j) => j.taskId).filter(Boolean);
    if (want('jobs')) counts.jobs = await writeEntity('jobs', jobs as unknown as Record<string, unknown>[]);
  }

  // quotes (+ line items) — reuse the tested quote exporter
  if (want('quotes')) {
    const quotes = await exportAllQuotes({ where, includeLineItems: true, concurrency: 4 });
    counts.quotes = await writeEntity('quotes', quotes as unknown as Record<string, unknown>[]);
    const qLines = quotes.flatMap((q) =>
      q.lineItems.map((li) => ({ quoteNumber: q.quoteNumber, quoteId: q.quoteId, outcome: q.outcome, ...li }))
    );
    counts.quoteLineItems = qLines.length;
    await writeFile(resolve(outDir, 'quote-line-items.csv'), toCsv(qLines, inferColumns(qLines)), 'utf8');
    totals.quotesSell = quotes.reduce((a, q) => a + q.totalSell, 0);
    totals.quotesWonSell = quotes.filter((q) => q.outcome === 'won').reduce((a, q) => a + q.totalSell, 0);
  }

  // invoices (+ line items)
  if (want('invoices')) {
    const invoices = await fetchInvoices(where, true);
    counts.invoices = await writeEntity('invoices', invoices as unknown as Record<string, unknown>[]);
    const iLines = invoices.flatMap((inv) =>
      inv.lineItems.map((li) => ({ invoiceNumber: inv.invoiceNumber, invoiceId: inv.invoiceId, ...li }))
    );
    counts.invoiceLineItems = iLines.length;
    await writeFile(resolve(outDir, 'invoice-line-items.csv'), toCsv(iLines, inferColumns(iLines)), 'utf8');
    totals.invoicedTotal = invoices.reduce((a, inv) => a + inv.total, 0);
  }

  // timesheets
  if (want('timesheets')) counts.timesheets = await writeEntity('timesheets', (await fetchTimesheets(where)) as unknown as Record<string, unknown>[]);

  // inventory catalogue
  if (want('inventory')) counts.inventory = await writeEntity('inventory', (await fetchInventory()) as unknown as Record<string, unknown>[]);

  // attachments (metadata always; binaries with --download-attachments)
  if (want('attachments')) {
    const files: FileRef[] = [];
    for (const id of jobIds) files.push(...(await fetchTaskFiles(id)));
    counts.attachments = await writeEntity('attachments', files as unknown as Record<string, unknown>[]);
    if (downloadAttachments && files.length) {
      const dir = resolve(outDir, 'attachments');
      await mkdir(dir, { recursive: true });
      let ok = 0;
      for (const f of files) {
        if (!f.url) continue;
        try {
          const res = await fetch(f.url);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const safe = `${f.taskId}_${f.fileId}_${f.fileName}`.replace(/[^\w.\-]/g, '_');
          await writeFile(resolve(dir, safe), buf);
          ok++;
        } catch { /* best-effort */ }
      }
      counts.attachmentsDownloaded = ok;
    }
  }

  await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.warn(
      '\n[aroflo-export] Nothing extracted. Check AROFLO_* credentials and that ' +
        'zone paths / field names in scripts/aroflo-export/entities.ts match your ' +
        'AroFlo API response (verify at https://apidocs.aroflo.com).'
    );
  }
  console.log('\n[aroflo-export] done. counts:', JSON.stringify(counts));
  if (Object.keys(totals).length) console.log('[aroflo-export] $ totals:', JSON.stringify(totals));
  console.log(`[aroflo-export] reconcile these against AroFlo, then archive ${outDir}`);
}

main().catch((err) => {
  console.error('[aroflo-export] FAILED:', err);
  process.exit(1);
});
