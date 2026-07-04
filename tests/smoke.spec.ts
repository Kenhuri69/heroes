import { expect, test, type Page } from '@playwright/test';

// Smoke headless (guideline §7) : le build de prod charge, Pixi s'initialise,
// aucune erreur console. Étendu à chaque nouveau scénario livré (doc 10 §3) —
// Phase 2.3 : carte, déplacement tap-tap scripté (seed fixe), fin de tour,
// sauvegarde/rechargement IndexedDB (jalon Phase 0 roadmap).
// Phase 2.4 : victoire contre le gardien, arène /#arena, fluidité throttlée.
// Non couvert ici (dit explicitement, guideline §7) : le tap-tap DANS le
// combat (sélection d'hex/cible au canvas) — couvert indirectement par
// AutoCombat ; à outiller quand la scène exposera ses coordonnées.

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function openGame(page: Page): Promise<string[]> {
  const errors = collectErrors(page);
  await page.goto('./?seed=42'); // seed fixe : partie reproductible
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  return errors;
}

function heroPos(page: Page): Promise<{ x: number; y: number } | undefined> {
  return page.evaluate(() => {
    const hero = window.__HEROES_TEST__?.getState().heroes[0];
    return hero ? { x: hero.pos.x, y: hero.pos.y } : undefined;
  });
}

/** Tap-tap (doc 08 §2.1) : 1er tap = prévisualisation, 2ᵉ tap = exécution. */
async function tapTapTile(page: Page, x: number, y: number): Promise<void> {
  const screen = await page.evaluate(
    ([tx, ty]) => window.__HEROES_TEST__!.tileToScreen(tx!, ty!),
    [x, y],
  );
  await page.mouse.click(screen.x, screen.y);
  await page.waitForTimeout(100);
  await page.mouse.click(screen.x, screen.y);
}

test('le client démarre sans erreur et charge le contenu', async ({ page }) => {
  const errors = await openGame(page);

  await expect(page.locator('#canvas-root canvas')).toBeVisible();

  // Pipeline de contenu : les paquets du dépôt chargent et se valident dans
  // le navigateur (doc 06 §1) — aucun rejet toléré sur notre propre contenu.
  const content = await page.evaluate(() => window.__HEROES_CONTENT__);
  expect(content?.rejected).toEqual([]);
  expect(content?.factions).toEqual(['arcane-hunters', 'test-faction']);

  // La partie démarre sur la carte proto : héros à sa position de départ.
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.started).toBe(true);
  expect(state.map?.id).toBe('proto-01');
  expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 3 });
  expect(state.heroes[0]?.movementPoints).toBe(1700); // 1500 + 50 × vitesse 4 (armée de départ)
  await expect(page.getByTestId('resource-gold')).toHaveText('2000');

  expect(errors).toEqual([]);
});

test('tap-tap : déplacement scripté, ramassage, points décomptés', async ({ page }) => {
  const errors = await openGame(page);

  // Le tas d'or est en (6,3), 3 pas droits depuis (3,3) : 3 × 100 PM.
  await tapTapTile(page, 6, 3);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });

  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.movementPoints).toBe(1400);
  expect(state.players[0]?.resources.gold).toBe(2500); // 2000 + 500 ramassés
  expect(state.map?.objects.some((o) => o.id === 'gold-1')).toBe(false);
  await expect(page.getByTestId('resource-gold')).toHaveText('2500');
  await expect(page.getByTestId('movement-points')).toHaveText('PM 1400');

  expect(errors).toEqual([]);
});

test('fin de tour : jour suivant, points de mouvement restaurés', async ({ page }) => {
  const errors = await openGame(page);

  await tapTapTile(page, 6, 3);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });

  await page.getByTestId('end-turn').click();
  await expect(page.getByTestId('calendar')).toHaveText('Jour 2 · Semaine 1');
  await expect(page.getByTestId('movement-points')).toHaveText('PM 1700');

  expect(errors).toEqual([]);
});

test('combat : victoire contre le gardien, retour carte avec pertes appliquées', async ({ page }) => {
  const errors = await openGame(page);

  // Chemin scripté vers le gardien (9,3) par la rangée 2 (évite le tas d'or
  // en (6,3) qui arrêterait le héros) — le dernier pas déclenche l'interception.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [
        { x: 4, y: 2 },
        { x: 5, y: 2 },
        { x: 6, y: 2 },
        { x: 7, y: 2 },
        { x: 8, y: 2 },
        { x: 9, y: 3 },
      ],
    }),
  );

  // Le combat est ouvert : le héros n'est PAS entré sur la tuile du gardien.
  await expect(page.getByTestId('combat-round')).toBeVisible();
  await expect.poll(() => heroPos(page)).toEqual({ x: 8, y: 2 });
  const combat = await page.evaluate(() => window.__HEROES_TEST__!.getState().combat);
  expect(combat?.playerSide).toBe('attacker');
  expect(combat?.stacks.filter((s) => s.side === 'defender')).toHaveLength(1);

  // Auto-résolution : 32 unités contre 4 — victoire, gardien retiré, pertes ≤ effectif.
  await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'AutoCombat' }));
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat))
    .toBeNull();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.id).toBe('hero-player-1'); // victoire : le héros survit
  expect(state.map?.objects.some((o) => o.id === 'guard-camp')).toBe(false);
  const total = state.heroes[0]?.army.reduce((sum, s) => sum + s.count, 0) ?? 0;
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(32);
  await expect(page.getByTestId('end-turn')).toBeVisible(); // retour à l'aventure

  expect(errors).toEqual([]);
});

test("l'arène /#arena ouvre un combat immédiat et se résout en auto", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?seed=42#arena');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  await expect(page.getByTestId('combat-round')).toHaveText('Round 1');
  await expect(page.getByTestId('damage-preview')).toBeVisible();
  const stacks = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().combat?.stacks.length,
  );
  expect(stacks).toBe(4); // armées miroir : 2 piles par camp

  await page.getByTestId('combat-auto').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat))
    .toBeNull();
  await expect(page.getByTestId('end-turn')).toBeVisible();

  expect(errors).toEqual([]);
});

test('arène : fluidité sous throttling CPU ×4 (doc 10 §6)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'mesure unique, desktop');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('./?seed=42#arena');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Garde-fou ANTI-GEL, pas budget de perf : le runner CI partagé rend en
  // LOGICIEL (SwiftShader) sous throttling ×4 — mesuré ~10 fps, variable avec
  // la charge du runner. On logge la mesure et on n'asserte qu'un plancher
  // (≥ 5 fps ⇒ la boucle de rendu vit) ; le budget 60 fps se mesurera sur
  // device en 2.5 (écart tracé au plan phase-2.4).
  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        let start = 0;
        const loop = (): void => {
          const now = performance.now();
          if (start === 0) {
            if (now > 1000) start = now; // échauffement : on ignore le démarrage
          } else {
            frames += 1;
            if (now - start >= 2000) {
              resolve(frames / ((now - start) / 1000));
              return;
            }
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  testInfo.annotations.push({ type: 'fps-throttled-x4', description: fps.toFixed(1) });
  console.log(`[smoke] arène throttlée ×4 : ${fps.toFixed(1)} fps (rendu logiciel CI)`);
  expect(fps).toBeGreaterThanOrEqual(5);
});

test('sauvegarde puis rechargement IndexedDB : position restaurée', async ({ page }) => {
  const errors = await openGame(page);

  await tapTapTile(page, 6, 3);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });

  await page.getByTestId('save').click();

  // Déplacement après sauvegarde… ((5,5) reste dans le viewport mobile)
  await tapTapTile(page, 5, 5);
  await expect.poll(() => heroPos(page)).toEqual({ x: 5, y: 5 });

  // …annulé par le rechargement du slot.
  await page.getByTestId('load').click();
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.movementPoints).toBe(1400);
  await expect(page.getByTestId('resource-gold')).toHaveText('2500');

  expect(errors).toEqual([]);
});
