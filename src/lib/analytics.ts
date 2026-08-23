/**
 * Shared analytics helpers — client-safe.
 *
 * resolveGtmId() treats missing values and the GTM-XXXXXXX placeholder as
 * unset so neither layout requests a container that does not exist.
 *
 * pushLeadSubmitted() is the single dataLayer event for fetch-based forms.
 * Call it only after the API returns ok — never on submit-attempt.
 */

export function resolveGtmId(raw: string | undefined): string {
  const id = (raw ?? '').trim();
  if (!id) return '';
  // Placeholder from .env.example / docs — never load this as a real container.
  if (/^GTM-X+$/i.test(id)) return '';
  if (!/^GTM-[A-Z0-9]+$/i.test(id)) return '';
  return id;
}

export interface LeadSubmittedEvent {
  form_name: string;
  lead_ref?: string;
  service_type?: string;
  suburb?: string;
  industry?: string;
}

export function pushLeadSubmitted(payload: LeadSubmittedEvent): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event:        'lead_submitted',
    form_name:    payload.form_name,
    lead_ref:     payload.lead_ref ?? '',
    service_type: payload.service_type ?? '',
    suburb:       payload.suburb ?? '',
    industry:     payload.industry ?? '',
  });
}

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}
