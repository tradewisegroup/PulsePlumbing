/**
 * Canonical business identity for Pulse Plumbing, Gas & Civil.
 * Import from here so schema, footer, llms.txt and copy cannot drift.
 */

export const SITE_URL = 'https://pulseqld.com.au';

export const TRADING_NAME = 'Pulse Plumbing, Gas & Civil';
export const BRAND_NAME = 'Pulse Plumbing & Gas';
export const LEGAL_NAME = 'Pulse Plumbing and Gas Pty Ltd';

export const ABN = '62 652 712 699';
export const ACN = '652 712 699';
export const QBCC_LICENCE = '15384771';
export const NSW_LICENCE = '476430C';

export const OFFICE_PHONE = '07 2150 4175';
export const OFFICE_PHONE_TEL = '0721504175';
export const EMERGENCY_PHONE = '0452 188 420';
export const EMERGENCY_PHONE_TEL = '0452188420';
export const EMAIL = 'admin@pulseqld.com.au';

export const BASE_SUBURB = 'Ormeau';
export const BASE_POSTCODE = '4208';
export const BASE_REGION = 'QLD';

export const GOOGLE_BUSINESS_URL = 'https://g.page/r/CQ0kkEnNqOaHEBM';
export const FACEBOOK_URL =
  (import.meta.env.PUBLIC_FACEBOOK_URL as string | undefined) ??
  (import.meta.env.FACEBOOK_URL as string | undefined) ??
  'https://www.facebook.com/Pulseqld';
export const INSTAGRAM_URL =
  (import.meta.env.PUBLIC_INSTAGRAM_URL as string | undefined) ??
  (import.meta.env.INSTAGRAM_URL as string | undefined) ??
  'https://www.instagram.com/pulseplumbinggascivil';
export const LINKEDIN_URL =
  (import.meta.env.PUBLIC_LINKEDIN_URL as string | undefined) ??
  (import.meta.env.LINKEDIN_URL as string | undefined) ??
  '';

/** Live GTM web container — installed on every page via BaseLayout + MainLayout. */
export const GTM_CONTAINER_ID = 'GTM-MMNMHPTK';

/**
 * Resolve the GTM container ID. Empty values and the old GTM-XXXXXXX
 * placeholder fall back to the live container so every page always loads GTM.
 */
export function resolveGtmId(): string {
  const fromEnv = (import.meta.env.PUBLIC_GTM_ID as string | undefined)?.trim() ?? '';
  if (!fromEnv || fromEnv === 'GTM-XXXXXXX') return GTM_CONTAINER_ID;
  return fromEnv;
}

/** Profile URLs used in schema sameAs — GBP, Facebook, Instagram, LinkedIn (when configured). */
export function getSameAs(): string[] {
  return [GOOGLE_BUSINESS_URL, FACEBOOK_URL, INSTAGRAM_URL, LINKEDIN_URL].filter(
    (url): url is string => Boolean(url),
  );
}

export function businessIdentifiers(): Array<{
  '@type': 'PropertyValue';
  name: string;
  value: string;
}> {
  return [
    { '@type': 'PropertyValue', name: 'ABN', value: ABN },
    { '@type': 'PropertyValue', name: 'QBCC Licence', value: QBCC_LICENCE },
  ];
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}
