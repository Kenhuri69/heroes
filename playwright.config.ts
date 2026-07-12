import { defineConfig, devices } from '@playwright/test';

// Le smoke test tourne sur le BUILD DE PROD servi par `vite preview`
// (même artefact que celui déployé sur GitHub Pages).
export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  // Parallélisme intra-fichier : tout le smoke vit dans un seul fichier ; sans
  // `fullyParallel`, Playwright ne parallélise QUE par fichier ⇒ 1 seul worker
  // par projet. Chaque test ayant déjà un contexte/IndexedDB isolé, on peut les
  // répartir sur plusieurs workers sans changer une assertion (doc perf :
  // .claude/plans/test-performance-optimization.md). Les runners GH ont 4 vCPU.
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  // En CI : interdit un `test.only` oublié (garde-fou anti-couverture partielle)
  // et rejoue 2 fois un échec pour absorber la flakiness résiduelle du rendu.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/heroes/',
    locale: 'fr-FR', // langue UI déterministe (l'i18n suit la langue navigateur)
    // Environnements sans les révisions Playwright (sandbox, conteneurs) :
    // pointer PW_CHROMIUM_PATH sur un Chromium local. La CI n'en a pas besoin.
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    // Desktop : couverture complète (tous les tests).
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Mobile : parcours critique + tests réellement responsive/tactiles,
    // tagués `@mobile`. Évite de rejouer 88 tests identiques dans les 2
    // viewports (le desktop les couvre déjà) — voir plan perf §7.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'pnpm --filter @heroes/client preview',
    url: 'http://127.0.0.1:4173/heroes/',
    reuseExistingServer: !process.env.CI,
  },
});
