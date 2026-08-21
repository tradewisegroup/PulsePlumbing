/**
 * src/lib/attribution.ts  — CLIENT-SAFE
 *
 * First-party attribution layer. Manages two persistent cookies so every
 * lead can be traced to the page, campaign and keyword that produced it.
 *
 * Cookies
 * ───────
 * pulse_attr_first  Written once on first visit, never overwritten. 365 days.
 * pulse_attr_last   Overwritten whenever the current URL carries utm_* or a
 *                   click-ID parameter. 90 days.
 *
 * Both hold the same JSON-encoded AttrSnapshot shape.
 *
 * GA4 IDs
 * ───────
 * ga_client_id   Parsed from the _ga cookie  (last two dot-segments).
 * ga_session_id  Parsed from any _ga_* cookie (third dot-segment).
 *
 * Safe for server-side rendering: all document/window access is guarded by
 * typeof checks. getAttribution() returns an empty-string object on the server.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttrSnapshot {
  ts:           string;
  landing_page: string;
  referrer:     string;
  utm_source:   string;
  utm_medium:   string;
  utm_campaign: string;
  utm_term:     string;
  utm_content:  string;
  gclid:        string;
  gbraid:       string;
  wbraid:       string;
  msclkid:      string;
}

export interface Attribution {
  // First-touch
  first_ts:           string;
  first_landing_page: string;
  first_referrer:     string;
  first_utm_source:   string;
  first_utm_medium:   string;
  first_utm_campaign: string;
  first_utm_term:     string;
  first_utm_content:  string;
  first_gclid:        string;
  first_gbraid:       string;
  first_wbraid:       string;
  first_msclkid:      string;
  // Last-touch
  last_ts:            string;
  last_landing_page:  string;
  last_referrer:      string;
  last_utm_source:    string;
  last_utm_medium:    string;
  last_utm_campaign:  string;
  last_utm_term:      string;
  last_utm_content:   string;
  last_gclid:         string;
  last_gbraid:        string;
  last_wbraid:        string;
  last_msclkid:       string;
  // GA4
  ga_client_id:   string;
  ga_session_id:  string;
  // Session context
  page_path:   string;
  page_title:  string;
  user_agent:  string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FIRST_COOKIE = 'pulse_attr_first';
const LAST_COOKIE  = 'pulse_attr_last';

const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'msclkid'] as const;
const UTM_PARAMS      = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  return Object.fromEntries(
    document.cookie.split(';').map((c) => {
      const idx = c.indexOf('=');
      if (idx < 0) return [c.trim(), ''];
      return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1))];
    }),
  );
}

function writeCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie =
    `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function readSnapshot(cookies: Record<string, string>, name: string): AttrSnapshot | null {
  const raw = cookies[name];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AttrSnapshot;
  } catch {
    return null;
  }
}

// ─── GA4 helpers ──────────────────────────────────────────────────────────────

function readGA4ClientId(cookies: Record<string, string>): string {
  // _ga value: "GA1.1.1234567890.1234567890" — client ID is the last two segments
  const val = cookies['_ga'] ?? '';
  const parts = val.split('.');
  if (parts.length >= 4) return parts.slice(-2).join('.');
  return '';
}

function readGA4SessionId(cookies: Record<string, string>): string {
  // Any _ga_XXXXX cookie holds the session; session ID is the third dot-segment
  for (const [key, val] of Object.entries(cookies)) {
    if (key.startsWith('_ga_') && key !== '_ga') {
      const parts = val.split('.');
      if (parts.length >= 3) return parts[2] ?? '';
    }
  }
  return '';
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

function currentSnapshot(): AttrSnapshot {
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  );
  return {
    ts:           new Date().toISOString(),
    landing_page: typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '',
    referrer:     typeof document !== 'undefined' ? document.referrer : '',
    utm_source:   params.get('utm_source')   ?? '',
    utm_medium:   params.get('utm_medium')   ?? '',
    utm_campaign: params.get('utm_campaign') ?? '',
    utm_term:     params.get('utm_term')     ?? '',
    utm_content:  params.get('utm_content')  ?? '',
    gclid:        params.get('gclid')        ?? '',
    gbraid:       params.get('gbraid')       ?? '',
    wbraid:       params.get('wbraid')       ?? '',
    msclkid:      params.get('msclkid')      ?? '',
  };
}

function hasAttributionSignals(snap: AttrSnapshot): boolean {
  return (
    [...UTM_PARAMS, ...CLICK_ID_PARAMS] as string[]
  ).some((k) => Boolean(snap[k as keyof AttrSnapshot]));
}

function emptyAttribution(): Attribution {
  const z = '';
  return {
    first_ts: z, first_landing_page: z, first_referrer: z,
    first_utm_source: z, first_utm_medium: z, first_utm_campaign: z,
    first_utm_term: z, first_utm_content: z,
    first_gclid: z, first_gbraid: z, first_wbraid: z, first_msclkid: z,
    last_ts: z, last_landing_page: z, last_referrer: z,
    last_utm_source: z, last_utm_medium: z, last_utm_campaign: z,
    last_utm_term: z, last_utm_content: z,
    last_gclid: z, last_gbraid: z, last_wbraid: z, last_msclkid: z,
    ga_client_id: z, ga_session_id: z,
    page_path: z, page_title: z, user_agent: z,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read and maintain the two attribution cookies, then return a flat Attribution
 * object with first_*, last_*, GA4 IDs, and current session context.
 *
 * Safe to call during SSR — returns an all-empty Attribution object.
 */
export function getAttribution(): Attribution {
  if (typeof document === 'undefined') return emptyAttribution();

  const cookies = parseCookies();
  const snap     = currentSnapshot();

  // ── First-touch: write once, never overwrite ────────────────────────────
  let first = readSnapshot(cookies, FIRST_COOKIE);
  if (!first) {
    first = snap;
    writeCookie(FIRST_COOKIE, JSON.stringify(first), 365);
  }

  // ── Last-touch: overwrite whenever there are attribution signals ─────────
  let last = readSnapshot(cookies, LAST_COOKIE) ?? first;
  if (hasAttributionSignals(snap)) {
    last = snap;
    writeCookie(LAST_COOKIE, JSON.stringify(last), 90);
  }

  return {
    first_ts:           first.ts,
    first_landing_page: first.landing_page,
    first_referrer:     first.referrer,
    first_utm_source:   first.utm_source,
    first_utm_medium:   first.utm_medium,
    first_utm_campaign: first.utm_campaign,
    first_utm_term:     first.utm_term,
    first_utm_content:  first.utm_content,
    first_gclid:        first.gclid,
    first_gbraid:       first.gbraid,
    first_wbraid:       first.wbraid,
    first_msclkid:      first.msclkid,
    last_ts:            last.ts,
    last_landing_page:  last.landing_page,
    last_referrer:      last.referrer,
    last_utm_source:    last.utm_source,
    last_utm_medium:    last.utm_medium,
    last_utm_campaign:  last.utm_campaign,
    last_utm_term:      last.utm_term,
    last_utm_content:   last.utm_content,
    last_gclid:         last.gclid,
    last_gbraid:        last.gbraid,
    last_wbraid:        last.wbraid,
    last_msclkid:       last.msclkid,
    ga_client_id:       readGA4ClientId(cookies),
    ga_session_id:      readGA4SessionId(cookies),
    page_path:          window.location.pathname + window.location.search,
    page_title:         document.title,
    user_agent:         navigator.userAgent,
  };
}
