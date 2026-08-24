/**
 * Backfill D1 `leads` from exported Resend notification emails.
 *
 * Usage:
 *   npm run backfill-leads -- ./exports/
 *   npm run backfill-leads -- ./exports/lead.eml --remote
 *
 * Reads .eml and .txt files (one notification per file, or several
 * concatenated). Inserts with INSERT OR IGNORE so reruns are safe.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { parseLeadEmail } from '../src/lib/leads-email.ts';
import { persistLead, type LeadRow } from '../src/lib/leads-db.ts';

async function collectFiles(target: string): Promise<string[]> {
  const info = await stat(target);
  if (info.isFile()) return [target];
  const names = await readdir(target);
  const out: string[] = [];
  for (const name of names) {
    const ext = extname(name).toLowerCase();
    if (ext === '.eml' || ext === '.txt') out.push(join(target, name));
  }
  return out.sort();
}

function splitMessages(raw: string): string[] {
  if (/^From /m.test(raw) && raw.includes('\nFrom ')) {
    return raw.split(/\n(?=From )/).filter((p) => p.trim());
  }
  return [raw];
}

async function getDb(remote: boolean): Promise<D1Database> {
  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy({ persist: true, remote });
  const db = (proxy.env as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error('D1 binding DB is missing. Check wrangler.jsonc d1_databases.');
  }
  return db;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const remote = args.includes('--remote');
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('Usage: npm run backfill-leads -- <file-or-dir> [--remote]');
    process.exit(1);
  }

  const files = await collectFiles(target);
  if (!files.length) {
    console.error('No .eml or .txt files found in', target);
    process.exit(1);
  }

  const db = await getDb(remote);
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const messages = splitMessages(raw);
    for (const msg of messages) {
      const row: LeadRow | null = parseLeadEmail(msg);
      if (!row) {
        skipped += 1;
        continue;
      }
      const ok = await persistLead(db, row);
      if (ok) {
        inserted += 1;
        console.log('upsert', row.lead_ref, row.email, row.phone_e164);
      } else {
        failed += 1;
      }
    }
  }

  console.log(`Done. inserted_or_ignored=${inserted} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
