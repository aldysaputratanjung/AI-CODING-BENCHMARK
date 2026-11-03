// Integration tests config — runs the real Worker (workerd + local D1)
// against the built output (dist/), so the assets config is complete.
// Applies the project's SQL migrations to the isolated test D1 database.
// Unit tests keep the default vitest config. Run: npm run test:integration
import {
  defineWorkersConfig,
  applyD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async (env) => {
  const config = await env.getConfig();

  // Apply all migrations to the test-only D1 database (does NOT touch
  // .wrangler state used by `wrangler dev`).
  await applyD1Migrations(config, [
    { id: "0001", sql: new URL("./migrations/0001_initial_schema.sql", import.meta.url) },
    { id: "0002", sql: new URL("./migrations/0002_add_transactions.sql", import.meta.url) },
    { id: "0003", sql: new URL("./migrations/0003_add_activity_logs.sql", import.meta.url) },
    { id: "0004", sql: new URL("./migrations/0004_add_indexes.sql", import.meta.url) },
  ]);

  return {
    test: {
      include: ["tests/integration/**/*.test.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./dist/saas_analytics_platform/wrangler.json" },
          miniflare: {
            bindings: {
              // Test-only values (NOT production secrets).
              SESSION_SECRET: "integration-test-secret",
              BOOTSTRAP_ADMIN_EMAIL: "admin@test.local",
              BOOTSTRAP_ADMIN_PASSWORD: "AdminPass123!x",
              APP_VERSION: "test",
            },
          },
        },
      },
    },
  };
});
