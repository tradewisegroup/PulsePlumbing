/**
 * Dynamic Number Insertion — client only.
 *
 * When PUBLIC_CALL_TRACKING_ENABLED is 'true', wait for the provider
 * (AVANSER / Delacon / generic PulseCallTracking hook) then swap href +
 * visible digits on [data-dni="true"]. Footer NAP and schema never have
 * that attribute.
 *
 * Fails silent: if the provider never loads, the real number stays.
 */

import { EMERGENCY_PHONE, EMERGENCY_PHONE_TEL, OFFICE_PHONE, OFFICE_PHONE_TEL } from './site';

const WAIT_MS = 4000;
const POLL_MS = 200;

type NumberType = 'office' | 'emergency';

interface PulseCallTracking {
  office?: string;
  emergency?: string;
  number?: string;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function formatAuDisplay(raw: string): string {
  const d = digitsOnly(raw);
  const national = d.startsWith('61') ? '0' + d.slice(2) : d.startsWith('0') ? d : d;
  if (/^04\d{8}$/.test(national)) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  if (/^0[2-9]\d{8}$/.test(national)) {
    return `${national.slice(0, 2)} ${national.slice(2, 6)} ${national.slice(6)}`;
  }
  return raw.trim();
}

function telFromRaw(raw: string): string {
  const d = digitsOnly(raw);
  if (d.startsWith('61')) return d;
  if (d.startsWith('0')) return d;
  return d;
}

/** Session tracking number from AVANSER, Delacon, or a generic hook. */
export function readProviderNumber(numberType: NumberType): string | null {
  const w = window as Window & {
    PulseCallTracking?: PulseCallTracking;
    AvanserGetNumber?: (pool?: string) => string;
    avanser?: { numbers?: Record<string, string>; number?: string };
    Delacon?: { getNumber?: (pool?: string) => string };
    dl_replacement_number?: string;
    delaconNumber?: string;
  };

  const bag = w.PulseCallTracking;
  const fromBag = bag?.[numberType] || bag?.number;
  if (fromBag) return String(fromBag);

  try {
    if (typeof w.AvanserGetNumber === 'function') {
      const n = w.AvanserGetNumber(numberType);
      if (n) return String(n);
    }
  } catch {
    /* provider API mismatch — ignore */
  }
  const av = w.avanser?.numbers?.[numberType] || w.avanser?.number;
  if (av) return String(av);

  try {
    if (typeof w.Delacon?.getNumber === 'function') {
      const n = w.Delacon.getNumber(numberType);
      if (n) return String(n);
    }
  } catch {
    /* provider API mismatch — ignore */
  }
  if (w.dl_replacement_number) return String(w.dl_replacement_number);
  if (w.delaconNumber) return String(w.delaconNumber);

  return null;
}

function realDisplay(numberType: NumberType): string {
  return numberType === 'office' ? OFFICE_PHONE : EMERGENCY_PHONE;
}

function realTel(numberType: NumberType): string {
  return numberType === 'office' ? OFFICE_PHONE_TEL : EMERGENCY_PHONE_TEL;
}

function replaceText(root: Element, fromDisplay: string, toDisplay: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.includes(fromDisplay)) continue;
    node.textContent = node.textContent.replaceAll(fromDisplay, toDisplay);
  }
}

export function applyTrackingNumber(el: HTMLAnchorElement, raw: string): void {
  const type = (el.getAttribute('data-call-number') === 'office' ? 'office' : 'emergency') as NumberType;
  const nextDisplay = formatAuDisplay(raw);
  const nextTel = telFromRaw(raw);
  if (!nextTel) return;
  el.href = `tel:${nextTel}`;
  replaceText(el, realDisplay(type), nextDisplay);
  el.dataset.dniApplied = 'true';
}

function swapAll(): boolean {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[data-dni="true"]');
  if (!links.length) return true;
  let pending = 0;
  links.forEach((el) => {
    if (el.dataset.dniApplied === 'true') return;
    const type = el.getAttribute('data-call-number') === 'office' ? 'office' : 'emergency';
    const raw = readProviderNumber(type);
    if (!raw) {
      pending += 1;
      return;
    }
    applyTrackingNumber(el, raw);
  });
  return pending === 0;
}

export function initDni(): void {
  try {
    if (import.meta.env.PUBLIC_CALL_TRACKING_ENABLED !== 'true') return;

    const started = Date.now();
    const tick = () => {
      try {
        if (swapAll()) return;
        if (Date.now() - started >= WAIT_MS) return;
        window.setTimeout(tick, POLL_MS);
      } catch {
        /* leave real numbers */
      }
    };
    tick();
  } catch {
    /* leave real numbers */
  }
}

export const REAL_NUMBERS = {
  office: { display: OFFICE_PHONE, tel: OFFICE_PHONE_TEL },
  emergency: { display: EMERGENCY_PHONE, tel: EMERGENCY_PHONE_TEL },
};
