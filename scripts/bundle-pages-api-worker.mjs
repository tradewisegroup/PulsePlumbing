/**
 * Bundle src/pages-api-worker.ts → dist/client/_worker.js
 * so Cloudflare Pages (static output directory) still runs form APIs.
 */
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist/client', { recursive: true });

await build({
  entryPoints: ['src/pages-api-worker.ts'],
  outfile: 'dist/client/_worker.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  conditions: ['worker', 'browser', 'import'],
  external: ['cloudflare:workers', 'astro'],
  define: {
    'import.meta.env': '{}',
  },
  logLevel: 'info',
});

console.log('Bundled Pages API worker → dist/client/_worker.js');
