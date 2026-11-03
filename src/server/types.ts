// Server-side types: Workers bindings (interface Env).

export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  ASSETS: Fetcher;
  APP_VERSION: string;
  // Secrets (never in wrangler.jsonc / client code):
  SESSION_SECRET: string;
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
}
