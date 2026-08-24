/**
 * POST /api/call
 *
 * Webhook the call-tracking provider (AVANSER or Delacon) hits on
 * call completion. Switching provider is a payload-shape difference
 * handled in src/lib/call-webhook.ts — not a deploy of new pages.
 *
 * Header: CALL_WEBHOOK_SECRET: <shared secret>
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { handleCallWebhook } from '../../lib/call-webhook';

export { normalizeCallPayload } from '../../lib/call-webhook';

export const POST: APIRoute = async ({ request }) => handleCallWebhook(request);
