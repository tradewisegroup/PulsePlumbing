import { EMERGENCY_PHONE, EMERGENCY_PHONE_TEL, OFFICE_PHONE, OFFICE_PHONE_TEL } from './site';

export type CallLocation = 'header' | 'hero' | 'footer' | 'sticky' | 'emergency';
export type CallNumberType = 'office' | 'emergency';

export function displayNumber(numberType: CallNumberType): string {
  return numberType === 'office' ? OFFICE_PHONE : EMERGENCY_PHONE;
}

export function telDigits(numberType: CallNumberType): string {
  return numberType === 'office' ? OFFICE_PHONE_TEL : EMERGENCY_PHONE_TEL;
}

export function telHref(numberType: CallNumberType): string {
  return `tel:${telDigits(numberType)}`;
}

/** Same attrs CallLink.astro emits — for React islands that cannot import .astro. */
export function callLinkAttrs(
  location: CallLocation,
  numberType: CallNumberType,
  opts?: { staticNumber?: boolean },
): Record<string, string> {
  const attrs: Record<string, string> = {
    href: telHref(numberType),
    'data-track': 'call',
    'data-call-location': location,
    'data-call-number': numberType,
  };
  if (!opts?.staticNumber) attrs['data-dni'] = 'true';
  return attrs;
}
