import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

// Harnais de test du Worker (revue 2026-09, R8) : workerd + D1 locale via
// Miniflare ; le schéma (`server/schema.sql`) est appliqué par les tests.
// Mode dev explicite (`DEV_RETURN_VERIFY_LINK`) : le lien magic-link est renvoyé
// dans la réponse — jamais en production (`wrangler.toml` ne le pose pas).
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        d1Databases: { DB: 'heroes-test' },
        bindings: { DEV_RETURN_VERIFY_LINK: '1', APP_ORIGIN: 'https://app.test' },
      },
    }),
  ],
});
