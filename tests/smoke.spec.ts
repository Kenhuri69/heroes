import { expect, test } from '@playwright/test';

// Smoke headless (guideline §7) : le build de prod charge, Pixi s'initialise,
// aucune erreur console. Étendu à chaque nouveau scénario livré (doc 10 §3).
test('le client démarre sans erreur', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  await expect(page.locator('#canvas-root canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
