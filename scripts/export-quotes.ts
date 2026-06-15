/**
 * scripts/export-quotes.ts
 *
 * Pulls EVERY AroFlo quote (with line-item cost / sell / description) and
 * writes three Captain-ready artefacts to ./exports:
 *
 *   1. quotes-<ts>.json            full nested records (quote → line items)
 *   2. quote-headers-<ts>.csv      one row per quote  (pipeline / won-loss)
 *   3. quote-line-items-<ts>.csv   one row per line   (cost / sell / desc)
 *
 * Captain's ingest format is still TBD (built in a separate session), so we
 * emit BOTH JSON and CSV — whichever Captain ends up accepting (file upload,
 * REST POST, or DB load), the data is already shaped for it.
 *
 * Usage:
 *   npm run export:quotes                 # everything
 *   npm run export:quotes -- --since=2024-01-01
 *   npm run export:quotes -- --no-line-items   # headers only (much faster)
 *
 * Requires AROFLO_* credentials in .env.local (see .env.example).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exportAllQuotes, type QuoteRecord } from '../src/lib/aroflo.ts';

// ── arg parsing ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
};
const since = getArg('since'); // YYYY-MM-DD → filters on datemodified
const includeLineItems = !args.includes('--no-line-items');

// ── tiny CSV serialiser (no external dep) ───────────────────────────────────
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const head = columns.map(csvCell).join(',');
  const body = rows
    .map((r) => columns.map((c) => csvCell(r[c])).join(','))
    .join('\n');
  return `${head}\n${body}\n`;
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const where = since ? `datemodified>'${since}'` : undefined;

  console.log(
    `[export-quotes] fetching quotes${since ? ` modified since ${since}` : ' (all)'}` +
      `${includeLineItems ? ' with line items' : ' (headers only)'}…`
  );

  const records = await exportAllQuotes({
    where,
    includeLineItems,
    concurrency: 4,
    onProgress: (done, total) => {
      if (done === total || done % 25 === 0) {
        process.stdout.write(`\r[export-quotes] ${done}/${total} quotes`);
      }
    },
  });
  process.stdout.write('\n');

  if (records.length === 0) {
    console.warn(
      '[export-quotes] No quotes returned. Check AROFLO_* credentials and ' +
        'that the quote field names in src/lib/aroflo.ts (FIELD map) match ' +
        'your AroFlo API response — verify against https://apidocs.aroflo.com.'
    );
  }

  const outDir = resolve(process.cwd(), 'exports');
  await mkdir(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  // 1. full JSON
  const jsonPath = resolve(outDir, `quotes-${ts}.json`);
  await writeFile(jsonPath, JSON.stringify(records, null, 2), 'utf8');

  // 2. headers CSV
  const headerCols = [
    'quoteNumber', 'quoteId', 'clientName', 'clientId', 'status', 'outcome',
    'totalCost', 'totalSell', 'marginPct', 'lineItemCount',
    'dateCreated', 'dateModified',
  ];
  const headerRows = records.map((r) => ({
    ...r,
    lineItemCount: r.lineItems.length,
    marginPct: r.marginPct === null ? '' : r.marginPct.toFixed(2),
  }));
  const headerPath = resolve(outDir, `quote-headers-${ts}.csv`);
  await writeFile(headerPath, toCsv(headerRows, headerCols), 'utf8');

  // 3. line-items CSV (flattened, FK = quoteNumber)
  const lineCols = [
    'quoteNumber', 'quoteId', 'clientName', 'outcome',
    'description', 'quantity', 'unitCost', 'unitSell', 'markupPct',
    'lineCost', 'lineSell',
  ];
  const lineRows: Record<string, unknown>[] = [];
  for (const r of records) {
    for (const li of r.lineItems) {
      lineRows.push({
        quoteNumber: r.quoteNumber,
        quoteId: r.quoteId,
        clientName: r.clientName,
        outcome: r.outcome,
        ...li,
        markupPct: li.markupPct === null ? '' : li.markupPct,
      });
    }
  }
  const linePath = resolve(outDir, `quote-line-items-${ts}.csv`);
  await writeFile(linePath, toCsv(lineRows, lineCols), 'utf8');

  // ── summary ────────────────────────────────────────────────────────────
  const summary = records.reduce(
    (acc, r) => {
      acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
      acc.pipelineSell += r.totalSell;
      if (r.outcome === 'won') acc.wonSell += r.totalSell;
      return acc;
    },
    { won: 0, lost: 0, open: 0, other: 0, pipelineSell: 0, wonSell: 0 } as Record<string, number>
  );

  console.log('\n[export-quotes] done:');
  console.log(`  quotes:        ${records.length}`);
  console.log(`  line items:    ${lineRows.length}`);
  console.log(`  won/lost/open: ${summary.won}/${summary.lost}/${summary.open} (other: ${summary.other})`);
  console.log(`  pipeline sell: $${summary.pipelineSell.toFixed(2)}  (won: $${summary.wonSell.toFixed(2)})`);
  console.log('  files:');
  console.log(`    ${jsonPath}`);
  console.log(`    ${headerPath}`);
  console.log(`    ${linePath}`);
}

main().catch((err) => {
  console.error('[export-quotes] FAILED:', err);
  process.exit(1);
});
