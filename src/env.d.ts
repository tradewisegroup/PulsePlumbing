/// <reference types="astro/client" />

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareRuntimeEnv {
  DB?: D1Database;
  RESEND_API_KEY?: string;
  RESEND_API_URL?: string;
  LEAD_NOTIFY_TO?: string;
  JOBS_NOTIFY_TO?: string;
}

declare namespace App {
  interface Locals {
    runtime?: {
      env?: CloudflareRuntimeEnv;
    };
  }
}
