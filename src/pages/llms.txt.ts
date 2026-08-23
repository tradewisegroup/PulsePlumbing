import type { APIRoute } from 'astro';
import { generateLlmsTxt } from '../lib/llms-txt';

export const prerender = true;

export const GET: APIRoute = () => {
  return new Response(generateLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
