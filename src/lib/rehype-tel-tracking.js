/**
 * Adds GTM click-tracking data attributes to every <a href="tel:...">
 * produced from Markdown (knowledge-base articles). Component and layout
 * tel links already carry these attributes in source.
 *
 * 07 2150 4175 = office; 0452 188 420 = after-hours / emergency.
 * Location defaults to "hero" for in-article content CTAs (not chrome).
 */

const OFFICE_DIGITS = '0721504175';

function walk(node) {
  if (node?.type === 'element' && node.tagName === 'a') {
    const href = node.properties?.href;
    if (typeof href === 'string' && href.toLowerCase().startsWith('tel:')) {
      const props = node.properties ?? (node.properties = {});
      const digits = href.replace(/\D/g, '');
      if (!props['data-track']) {
        props['data-track'] = 'call';
      }
      if (!props['data-call-number']) {
        props['data-call-number'] = digits === OFFICE_DIGITS ? 'office' : 'emergency';
      }
      if (!props['data-call-location']) {
        props['data-call-location'] = 'hero';
      }
    }
  }
  for (const child of node?.children ?? []) walk(child);
}

export default function rehypeTelTracking() {
  return (tree) => walk(tree);
}
