/**
 * Pages Advanced Mode (_worker.js) passes bindings as fetch(request, env).
 * `import { env } from 'cloudflare:workers'` is empty in that worker, which
 * made RESEND_API_KEY look unset and the quote form return 502.
 *
 * Production env vars are the same for every request — stash the object
 * at the start of fetch() and read it from notify / D1 helpers.
 */

export type WorkerEnv = Record<string, unknown>;

let current: WorkerEnv = {};

export function setWorkerEnv(env: WorkerEnv | undefined | null): void {
  if (env && typeof env === 'object') current = env;
}

export function getWorkerEnv(): WorkerEnv {
  return current;
}

export function workerVar(name: string): string {
  const value = current[name];
  if (value == null || value === '') return '';
  return String(value);
}
