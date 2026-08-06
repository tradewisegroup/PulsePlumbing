// @ts-check
import { defineConfig }    from 'astro/config';
import sitemap             from '@astrojs/sitemap';
import react               from '@astrojs/react';
import cloudflare          from '@astrojs/cloudflare';
import { statSync }        from 'fs';
import { resolve, join }   from 'path';
import { fileURLToPath }   from 'url';
import { loadEnv }         from 'vite';

// Load all env vars (including non-PUBLIC_) into process.env for SSR routes
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
Object.assign(process.env, env);

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = fileURLToPath(new URL('.', import.meta.url));

// ─── Source-file → lastmod helper ────────────────────────────────────────────
//
// Maps a URL pathname back to its Astro source file so we can use the file's
// mtime as the sitemap lastmod date. Falls back to the current build time when
// the source file cannot be determined (e.g. for pages generated from content
// collections or external data).
//
// Dynamic-route pages (e.g. /locations/loganholme) resolve to the template
// file (src/pages/locations/[suburb].astro) — intentional: when the template
// changes, every generated page from it should report a new lastmod.

/** @param {string} pathname — URL path, e.g. "/industries/childcare" */
function resolveLastMod(pathname) {
  // Strip trailing slash for consistent matching
  const p = pathname === '/' ? '' : pathname.replace(/\/$/, '');

  /** @type {string[]} */
  const candidates = [];

  if (p === '') {
    // Homepage
    candidates.push('src/pages/index.astro');
  } else if (p.startsWith('/locations/')) {
    // Dynamic suburb pages — all share the same template
    candidates.push('src/pages/locations/[suburb].astro');
  } else if (p.startsWith('/plumber-')) {
    // Legacy dynamic suburb pages
    candidates.push('src/pages/plumber-[suburb].astro');
  } else if (p.startsWith('/blog/')) {
    // Blog posts — check both .astro and markdown/MDX
    const slug = p.replace('/blog/', '');
    candidates.push(
      `src/pages/blog/${slug}.astro`,
      `src/content/blog/${slug}.md`,
      `src/content/blog/${slug}.mdx`,
      'src/pages/blog/[slug].astro',
    );
  } else {
    // Static pages — try direct file match then index file
    candidates.push(
      `src/pages${p}.astro`,
      `src/pages${p}/index.astro`,
    );
  }

  for (const rel of candidates) {
    try {
      return statSync(resolve(ROOT, rel)).mtime;
    } catch {
      // File not found — try next candidate
    }
  }

  // Fallback: report the current build time so the entry is never stale
  return new Date();
}

// ─── Sitemap serialiser ───────────────────────────────────────────────────────
//
// Called once per discovered page. Returns a modified SitemapItem — or
// undefined to exclude the page from the sitemap entirely.
//
// Priority scale (aligned with Google's documented interpretation):
//   1.0  Homepage                   — the most important single URL
//   0.9  Industry / Service / Civil — high-value, keyword-targeted content
//   0.8  Location pages, service-areas hub, contact, emergency, civil contact
//   0.7  Blog posts                 — informational; lower conversion intent
//   0.6  Everything else            — catch-all default
//
// Note: the sitemap package formats priority with .toFixed(1), so avoid .x5
// values — 0.85 renders as 0.8 due to floating-point representation.

/** @param {import('@astrojs/sitemap').SitemapItem} item */
function serializeSitemapItem(item) {
  const { pathname } = new URL(item.url);
  const p = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

  /** @type {number} */    let priority   = 0.6;
  /** @type {string} */    let changefreq = 'monthly';

  // ── Homepage ──────────────────────────────────────────────────────────────
  if (p === '/') {
    priority   = 1.0;
    changefreq = 'weekly';
  }

  // ── High-frequency pages (news-adjacent, high user intent) ───────────────
  else if (
    p === '/contact'          ||
    p === '/emergency'        ||
    p === '/get-a-quote'
  ) {
    priority   = 0.8;
    changefreq = 'weekly';
  }

  // ── Industry pages ────────────────────────────────────────────────────────
  else if (p.startsWith('/industries/')) {
    priority   = 0.9;
    changefreq = 'monthly';
  }

  // ── Service pages ─────────────────────────────────────────────────────────
  else if (p.startsWith('/services/')) {
    priority   = 0.9;
    changefreq = 'monthly';
  }

  // ── Civil section — B2B infrastructure services ──────────────────────────
  else if (p === '/civil' || p.startsWith('/civil/')) {
    priority   = p === '/civil/contact' ? 0.8 : 0.9;
    changefreq = 'monthly';
  }

  // ── Location / suburb pages ───────────────────────────────────────────────
  else if (p.startsWith('/locations/') || p.startsWith('/plumber-')) {
    priority   = 0.8;
    changefreq = 'monthly';
  }

  // ── Service areas hub ─────────────────────────────────────────────────────
  else if (p === '/service-areas') {
    priority   = 0.8;
    changefreq = 'monthly';
  }

  // ── Blog posts ────────────────────────────────────────────────────────────
  else if (p.startsWith('/blog/')) {
    priority   = 0.7;
    changefreq = 'monthly';
  }

  return {
    ...item,
    priority,
    changefreq,
    lastmod: resolveLastMod(p),
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

export default defineConfig({
  // ── Site URL ──────────────────────────────────────────────────────────────
  site: 'https://pulseqld.com.au',

  // ── Output mode ───────────────────────────────────────────────────────────
  // 'static' pre-renders all pages at build time by default. Individual routes
  // opt into SSR with `export const prerender = false` (used by /api/* routes,
  // deployed as Cloudflare Workers). 'hybrid' was removed in Astro 6.
  output: 'static',

  // ── Cloudflare adapter ────────────────────────────────────────────────────
  // Handles static pages at build time; API routes with prerender = false
  // are deployed as Cloudflare Workers automatically.
  adapter: cloudflare(),

  // ── Integrations ──────────────────────────────────────────────────────────
  integrations: [

    // ── Sitemap ─────────────────────────────────────────────────────────────
    sitemap({
      // Exclude server-rendered API routes and any accidental internal paths.
      // API routes with prerender = false don't appear in the static output,
      // but this filter acts as a belt-and-braces guard.
      filter: (page) => {
        const { pathname } = new URL(page);
        return (
          !pathname.startsWith('/api/')    &&
          !pathname.startsWith('/_')       &&  // Astro internal routes
          !pathname.includes('/404')       &&
          !pathname.includes('/500')
        );
      },

      // Per-page priority, changefreq and lastmod (from source file mtime).
      serialize: serializeSitemapItem,

      // Split into multiple sitemap files when page count exceeds this limit.
      // Default is 45,000; the value below gives comfortable headroom while
      // keeping the index file short during early site growth.
      entryLimit: 10000,
    }),

    // ── React islands ────────────────────────────────────────────────────────
    // Tailwind v4 is handled via postcss.config.mjs (@tailwindcss/postcss).
    // The Vite plugin is NOT used here to avoid double-processing.
    react(),
  ],
});
