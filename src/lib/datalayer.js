/**
 * GTM dataLayer helpers — client-safe.
 * Only call after a confirmed 2xx from the API. Never on submit-attempt.
 */

function layer() {
  if (typeof window === 'undefined') return null;
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

export function pushLeadSubmitted({
  form_name,
  lead_ref = '',
  service_type = '',
  suburb = '',
  industry = '',
}) {
  const dl = layer();
  if (!dl) return;
  dl.push({
    event: 'lead_submitted',
    form_name,
    lead_ref,
    service_type,
    suburb,
    industry,
  });
}

export function pushApplicationSubmitted() {
  const dl = layer();
  if (!dl) return;
  dl.push({ event: 'application_submitted' });
}
