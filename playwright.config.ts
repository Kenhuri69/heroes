import { defineConfig, devices } from '@playwright/test';

// Le smoke test tourne sur le BUILD DE PROD servi par `vite preview`
// (même artefact que celui déployé sur GitHub Pages).
export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
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
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm --filter @heroes/client preview',
    url: 'http://127.0.0.1:4173/heroes/',
    reuseExistingServer: !process.env.CI,
  },
});
