/**
 * Persist sales leads to Cloudflare D1.
 * Never throws — a D1 failure must not block the Resend safety-net email.
 */

import type { Lead } from './lead.ts';

export interface LeadRow {
  lead_ref:           string;
  created_at:         string;
  name:               string;
  company:            string;
  email:              string;
  phone_e164:         string;
  suburb:             string;
  service_type:       string;
  industry:           string;
  message:            string;
  source_form:        string;
  first_source:       string;
  first_medium:       string;
  first_campaign:     string;
  first_landing_page: string;
  first_seen_at:      string;
  last_source:        string;
  last_medium:        string;
  last_campaign:      string;
  gclid:              string;
  converted_on:       string;
  ga_client_id:       string;
}

const INSERT_SQL = `
  INSERT OR IGNORE INTO leads (
    lead_ref, created_at, name, company, email, phone_e164,
    suburb, service_type, industry, message, source_form,
    first_source, first_medium, first_campaign,
    first_landing_page, first_seen_at,
    last_source, last_medium, last_campaign,
    gclid, converted_on, ga_client_id
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?,
    ?, ?, ?,
    ?, ?, ?
  )
`;

/**
 * Astro 6 / @astrojs/cloudflare removed `Astro.locals.runtime.env`.
 * Bindings are the same Worker `env` already used for Resend
 * (`import { env } from 'cloudflare:workers'`).
 */
export async function getLeadsDb(): Promise<D1Database | undefined> {
  try {
    const { env } = await import('cloudflare:workers');
    return (env as { DB?: D1Database }).DB;
  } catch {
    return undefined;
  }
}

export function leadToRow(lead: Lead): LeadRow {
  const a = lead.attribution ?? ({} as Lead['attribution']);
  return {
    lead_ref:           lead.lead_ref,
    created_at:         lead.created_at,
    name:               lead.name || 'Unknown',
    company:            lead.company ?? '',
    email:              lead.email,
    phone_e164:         lead.phone_e164 || lead.phone || '',
    suburb:             lead.suburb ?? '',
    service_type:       lead.service_type ?? '',
    industry:           lead.industry ?? '',
    message:            lead.message ?? '',
    source_form:        lead.source_form || 'quote',
    first_source:       a.first_utm_source ?? '',
    first_medium:       a.first_utm_medium ?? '',
    first_campaign:     a.first_utm_campaign ?? '',
    first_landing_page: a.first_landing_page ?? '',
    first_seen_at:      a.first_ts ?? '',
    last_source:        a.last_utm_source ?? '',
    last_medium:        a.last_utm_medium ?? '',
    last_campaign:      a.last_utm_campaign ?? '',
    gclid:              a.last_gclid || a.first_gclid || '',
    converted_on:       a.page_path ?? '',
    ga_client_id:       a.ga_client_id ?? '',
  };
}

export async function persistLead(
  db: D1Database | undefined,
  row: LeadRow,
): Promise<boolean> {
  if (!db) {
    console.error('[d1] DB binding missing — lead not persisted', row.lead_ref);
    return false;
  }

  try {
    await db
      .prepare(INSERT_SQL)
      .bind(
        row.lead_ref,
        row.created_at,
        row.name,
        row.company,
        row.email,
        row.phone_e164,
        row.suburb,
        row.service_type,
        row.industry,
        row.message,
        row.source_form,
        row.first_source,
        row.first_medium,
        row.first_campaign,
        row.first_landing_page,
        row.first_seen_at,
        row.last_source,
        row.last_medium,
        row.last_campaign,
        row.gclid,
        row.converted_on,
        row.ga_client_id,
      )
      .run();
    return true;
  } catch (err) {
    console.error('[d1] FAILED to persist lead — email will still send', row.lead_ref, err);
    return false;
  }
}

export async function persistLeadFromModel(lead: Lead): Promise<boolean> {
  try {
    return await persistLead(await getLeadsDb(), leadToRow(lead));
  } catch (err) {
    console.error('[d1] FAILED to persist lead — email will still send', lead.lead_ref, err);
    return false;
  }
}
