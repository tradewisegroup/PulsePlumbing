/**
 * Cloudflare Pages Advanced Mode worker.
 * Pages is publishing dist/client (static HTML). The Astro SSR bundle is
 * not invoked, so POST /api/* was a 405. This worker is copied to
 * dist/client/_worker.js after build and only receives /api/* via _routes.json.
 */

import { setWorkerEnv } from './lib/worker-env';
import { POST as contactPost, OPTIONS as contactOptions } from './pages/api/contact';
import { POST as civilPost, OPTIONS as civilOptions } from './pages/api/civil-contact';
import { POST as scorecardPost, OPTIONS as scorecardOptions } from './pages/api/scorecard';
import { POST as jobsPost, OPTIONS as jobsOptions } from './pages/api/job-application';

type AstroHandler = (context: { request: Request }) => Response | Promise<Response>;

const routes: Record<string, { POST?: AstroHandler; OPTIONS?: AstroHandler }> = {
  '/api/contact':         { POST: contactPost, OPTIONS: contactOptions },
  '/api/civil-contact':   { POST: civilPost, OPTIONS: civilOptions },
  '/api/scorecard':       { POST: scorecardPost, OPTIONS: scorecardOptions },
  '/api/job-application': { POST: jobsPost, OPTIONS: jobsOptions },
};

function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export default {
  async fetch(request: Request, env?: Record<string, unknown>): Promise<Response> {
    setWorkerEnv(env);
    const path = normalize(new URL(request.url).pathname);
    const route = routes[path];
    if (!route) {
      return new Response(JSON.stringify({ success: false, error: 'Not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ctx = { request };
    if (request.method === 'OPTIONS' && route.OPTIONS) return route.OPTIONS(ctx);
    if (request.method === 'POST' && route.POST) return route.POST(ctx);
    return new Response(null, { status: 405, headers: { Allow: 'POST, OPTIONS' } });
  },
};
