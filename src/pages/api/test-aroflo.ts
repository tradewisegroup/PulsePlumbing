/**
 * GET /api/test-aroflo
 *
 * Temporary endpoint to verify AroFlo HMAC auth is working.
 * ⚠️  DELETE THIS FILE after confirming the connection works.
 * Never leave test endpoints in production.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { findClientByEmail } from '../../lib/aroflo';

export const GET: APIRoute = async () => {
  try {
    const result = await findClientByEmail('test@test.com');

    return new Response(
      JSON.stringify({
        connected: true,
        message:   'AroFlo API connection successful',
        result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const isAuth = msg.includes('401') || msg.includes('403');

    return new Response(
      JSON.stringify({
        connected: false,
        error: isAuth
          ? 'Auth failed — check AROFLO credentials'
          : msg,
      }),
      { status: isAuth ? 401 : 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
