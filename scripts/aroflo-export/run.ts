/**
 * scripts/aroflo-export/run.ts
 *
 * Full AroFlo extraction for the Earthwise → Captain migration ("export →
 * verify Captain → switch AroFlo off"). Pulls every entity needed to
 * decommission AroFlo and writes JSON + CSV per entity, plus a manifest with
 * counts and dollar totals for reconciliation. The Captain import is built
 * later (against EWG-Captain/modules/job) and reads these files.
 *
 * The `jobs` pass uses AroFlo joins, so it also yields per-job materials,
 * labour and attachments in one sweep.
 *
 * Usage:
 *   npm run export:aroflo                          # all entities, full history
 *   npm run export:aroflo -- --since=2023-07-01    # only created/updated since
 *   npm run export:aroflo -- --entities=clients,jobs,quotes,invoices
 *   npm run export:aroflo -- --download-attachments
 *
 * Requires AROFLO_UENCODED / PENCODED / ORGENCODED / SECRET_KEY (Earthwise's
 * org). See .env.example.
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
  exportAllQuotes,
} from './entities.ts';
import { arofloConfigured } from '../../src/lib/aroflo.ts';

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (n: string) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
};
const since = getArg('since'); // YYYY-MM-DD (optional)
const downloadAttachments = args.includes('--download-attachments');
const ALL = ['clients', 'jobs', 'quotes', 'invoices', 'timesheets', 'inventory'];
const selected = (getArg('entities')?.split(',').map((s) => s.trim()) ?? ALL).filter(Boolean);
const want = (name: string) => selected.includes(name);

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = resolve(process.cwd(), 'exports', `aroflo-${ts}`);

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

async function writeEntity(name: string, rows: Record<string, unknown>[]): Promise<number> {
  await writeFile(resolve(outDir, `${name}.json`), JSON.stringify(rows, null, 2), 'utf8');
  const flat = flatten(rows);
  await writeFile(resolve(outDir, `${name}.csv`), toCsv(flat, inferColumns(flat)), 'utf8');
  return rows.length;
}

const rec = (rows: unknown[]) => rows as unknown as Record<string, unknown>[];

async function main() {
  await mkdir(outDir, { recursive: true });
  if (!arofloConfigured()) {
    console.warn('[aroflo-export] AROFLO_* credentials not set — every zone will return empty.');
  }
  console.log(`[aroflo-export] → ${outDir}`);
  console.log(`[aroflo-export] entities: ${selected.join(', ')}${since ? `  since ${since}` : '  (full history)'}`);

  const manifest: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    since: since ?? null,
    counts: {} as Record<string, number>,
    totals: {} as Record<string, number>,
  };
  const counts = manifest.counts as Record<string, number>;
  const totals = manifest.totals as Record<string, number>;

  if (want('clients')) counts.clients = await writeEntity('clients', rec(await fetchClients(since)));

  if (want('jobs')) {
    const { jobs, materials, labours, attachments } = await fetchJobs(since);
    counts.jobs = await writeEntity('jobs', rec(jobs));
    counts.materials = await writeEntity('materials', rec(materials));
    counts.labours = await writeEntity('labours', rec(labours));
    counts.attachments = await writeEntity('attachments', rec(attachments));
    totals.jobsTotalEx = jobs.reduce((a, j) => a + j.totalEx, 0);

    if (downloadAttachments && attachments.length) {
      const dir = resolve(outDir, 'attachments');
      await mkdir(dir, { recursive: true });
      let ok = 0;
      for (const f of attachments) {
        if (!f.url) continue;
        try {
          const res = await fetch(f.url);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const safe = `${f.taskId}_${f.documentId}_${f.fileName}`.replace(/[^\w.\-]/g, '_');
          await writeFile(resolve(dir, safe), buf);
          ok++;
        } catch {
          /* best-effort; AroFlo doc URLs expire ~10 min */
        }
      }
      counts.attachmentsDownloaded = ok;
    }
  }

  if (want('quotes')) {
    const where = since ? `and|createddate|>|${since.replace(/-/g, '/')}` : undefined;
    const quotes = await exportAllQuotes({ where, includeLineItems: true });
    counts.quotes = await writeEntity('quotes', rec(quotes));
    const qLines = quotes.flatMap((q) =>
      q.lineItems.map((li) => ({ quoteNumber: q.quoteNumber, quoteId: q.quoteId, outcome: q.outcome, ...li }))
    );
    counts.quoteLineItems = qLines.length;
    await writeFile(resolve(outDir, 'quote-line-items.csv'), toCsv(qLines, inferColumns(qLines)), 'utf8');
    totals.quotesSell = quotes.reduce((a, q) => a + q.totalSell, 0);
    totals.quotesWonSell = quotes.filter((q) => q.outcome === 'won').reduce((a, q) => a + q.totalSell, 0);
  }

  if (want('invoices')) {
    const invoices = await fetchInvoices(since);
    counts.invoices = await writeEntity('invoices', rec(invoices));
    const iLines = invoices.flatMap((inv) =>
      inv.lineItems.map((li) => ({ invoiceNumber: inv.invoiceNumber, invoiceId: inv.invoiceId, ...li }))
    );
    counts.invoiceLineItems = iLines.length;
    await writeFile(resolve(outDir, 'invoice-line-items.csv'), toCsv(iLines, inferColumns(iLines)), 'utf8');
    totals.invoicedEx = invoices.reduce((a, inv) => a + inv.totalEx, 0);
    totals.invoicedInc = invoices.reduce((a, inv) => a + inv.totalInc, 0);
  }

  if (want('timesheets')) counts.timesheets = await writeEntity('timesheets', rec(await fetchTimesheets(since)));
  if (want('inventory')) counts.inventory = await writeEntity('inventory', rec(await fetchInventory(since)));

  await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.warn(
      '\n[aroflo-export] Nothing extracted. Check AROFLO_* credentials, and that ' +
        'the zone keys / field names in scripts/aroflo-export/entities.ts match your ' +
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
