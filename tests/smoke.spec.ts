import { expect, test, type Page } from '@playwright/test';

// Smoke headless (guideline §7) : le build de prod charge, Pixi s'initialise,
// aucune erreur console. Étendu à chaque nouveau scénario livré (doc 10 §3) —
// Phase 2.3 : carte, déplacement tap-tap scripté (seed fixe), fin de tour,
// sauvegarde/rechargement IndexedDB (jalon Phase 0 roadmap).
// Phase 2.4 : victoire contre le gardien, arène /#arena, fluidité throttlée.
// Phase 2.5 : menu (Nouvelle partie/Continuer), autosave, i18n EN, XP,
// aller-retour export/import .heroes.
// Phase 3.1 : écran de ville, construire + croissance hebdo + recruter +
// transfert garnison → l'armée du héros augmente.
// Phase 3.2 : lancer un sort en combat (livre → cible → prévisualisation →
// CastSpell) réduit une pile ennemie ; gating de la modale de choix de
// compétence.
// Phase 3.5 (lot U) : menu → bouton scénario → boucle IA automatique (doc 02
// §6) → jour suivant avec l'IA ayant agi ; scénario « survival » gagné par
// surviveDays (15 jours) — la seule condition atteignable par la simple
// survie/attente, aucun combat héros-vs-héros n'existant côté moteur (écart
// assumé du plan phase-3.5) ; overlay victoire affiché.
// Non couvert ici (dit explicitement, guideline §7) : le tap-tap DANS le
// combat (sélection d'hex/cible au canvas) — couvert indirectement par
// AutoCombat ; à outiller quand la scène exposera ses coordonnées. La montée
// de niveau → choix de compétence (modale + ChooseSkill) n'est PAS jouable en
// smoke (niveau 2 ≈ 3732 XP, un gardien ≈ 20 XP) : le flux moteur (level-up →
// pendingSkillChoices → ChooseSkill) est couvert par `hero-level-up.test.ts` ;
// seul le gating d'affichage de la modale est vérifié ici.

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

/** Menu principal, sans partie démarrée (doc 08 §2.5) — point de départ des scénarios. */
async function openMenu(page: Page): Promise<string[]> {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  return errors;
}

function heroPos(page: Page): Promise<{ x: number; y: number } | undefined> {
  return page.evaluate(() => {
    const hero = window.__HEROES_TEST__?.getState().heroes[0];
    return hero ? { x: hero.pos.x, y: hero.pos.y } : undefined;
  });
}

/**
 * Déplacement déterministe via le hook moteur — pour les tests dont le tap-tap
 * n'est PAS le sujet (autosave, save/load, export). Le tap-tap réel garde son
 * test dédié ; l'utiliser pour préparer un état le rend flaky sous charge CI
 * (deux clics chronométrés). Chemin en ligne droite depuis (3,3) jusqu'au tas
 * d'or (6,3), qui arrête le héros (ramassage — doc 02 §2.2).
 */
async function moveHeroToGold(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [
        { x: 4, y: 3 },
        { x: 5, y: 3 },
        { x: 6, y: 3 },
      ],
    }),
  );
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
  expect(content?.factions).toEqual(['haven', 'arcane-hunters', 'test-faction', 'necropolis']);

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

/**
 * Mesure de fluidité anti-gel (doc 10 §6, doc 01 §5 critère 3) : compte les
 * frames `requestAnimationFrame` sur une fenêtre de 2 s après 1 s d'échauffement
 * (ignore le démarrage). Partagé par l'arène et la carte d'aventure — même
 * protocole de mesure, seule la scène ouverte avant l'appel diffère.
 */
async function measureFpsUnderThrottle(page: Page): Promise<number> {
  return page.evaluate(
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
}

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
  const fps = await measureFpsUnderThrottle(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  testInfo.annotations.push({ type: 'fps-throttled-x4', description: fps.toFixed(1) });
  console.log(`[smoke] arène throttlée ×4 : ${fps.toFixed(1)} fps (rendu logiciel CI)`);
  expect(fps).toBeGreaterThanOrEqual(5);
});

test('carte d’aventure : fluidité sous throttling CPU ×4 (doc 01 §5 critère 3)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'mesure unique, desktop');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('./?seed=42'); // carte d'aventure (pas #arena) — même seed fixe
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Même garde-fou anti-gel que l'arène (≥ 5 fps), étendu à la scène d'aventure
  // (pan/zoom + brouillard) — critère de sortie MVP « 60 fps carte + combat
  // sous throttling ×4 » (doc 01 §5), plancher CI logiciel identique.
  const fps = await measureFpsUnderThrottle(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  testInfo.annotations.push({ type: 'fps-throttled-x4-adventure', description: fps.toFixed(1) });
  console.log(`[smoke] carte d'aventure throttlée ×4 : ${fps.toFixed(1)} fps (rendu logiciel CI)`);
  expect(fps).toBeGreaterThanOrEqual(5);
});

test('menu : Nouvelle partie démarre, Continuer grisé sans sauvegarde', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./'); // sans ?seed : le menu s'affiche (doc 08 §2.5)
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  await expect(page.getByTestId('menu-new-game')).toBeVisible();
  await expect(page.getByTestId('menu-continue')).toBeDisabled(); // IndexedDB vierge

  await page.getByTestId('menu-new-game').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.started).toBe(true);

  expect(errors).toEqual([]);
});

test('autosave à la fin de tour puis « Continuer » depuis le menu', async ({ page }) => {
  const errors = await openGame(page);

  await moveHeroToGold(page);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  await page.getByTestId('end-turn').click(); // ⇒ autosave (doc 07 §4)
  await expect(page.getByTestId('calendar')).toContainText('2');
  // L'écriture IndexedDB est asynchrone : attendre qu'elle soit durable
  // avant de naviguer (sinon la sauvegarde serait interrompue).
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const req = indexedDB.open('heroes');
            req.onsuccess = () => {
              const db = req.result;
              try {
                const get = db.transaction('saves', 'readonly').objectStore('saves').get('auto');
                get.onsuccess = () => {
                  db.close();
                  resolve(get.result !== undefined);
                };
                get.onerror = () => {
                  db.close();
                  resolve(false);
                };
              } catch {
                db.close();
                resolve(false);
              }
            };
            req.onerror = () => resolve(false);
          }),
      ),
    )
    .toBe(true);

  // Recharger SANS seed : menu, « Continuer » actif, partie restaurée.
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  await expect(page.getByTestId('menu-continue')).toBeEnabled();
  await page.getByTestId('menu-continue').click();
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.calendar.day).toBe(2);

  expect(errors).toEqual([]);
});

test('options : bascule de langue FR → EN appliquée à l’UI', async ({ page }) => {
  const errors = await openGame(page);

  await expect(page.getByTestId('calendar')).toHaveText('Jour 1 · Semaine 1');
  await page.getByTestId('options-open').click();
  await page.getByTestId('options-locale-en').click();
  await page.getByTestId('options-close').click();
  await expect(page.getByTestId('calendar')).toHaveText('Day 1 · Week 1');

  expect(errors).toEqual([]);
});

test('accessibilité : les 3 crans de police changent la taille du texte (doc 08 §4)', async ({ page }) => {
  const errors = await openGame(page);

  const calendarFontSizePx = (): Promise<number> =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="calendar"]');
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    });

  const small = await calendarFontSizePx(); // cran 1 (100%) par défaut

  await page.getByTestId('options-open').click();
  await page.getByTestId('options-fontscale-3').click(); // cran 3 (125%)
  await page.getByTestId('options-close').click();
  const large = await calendarFontSizePx();

  // La police en dur (px) ne suivrait pas ce changement — la conversion en
  // unités relatives (rem, héritées du fontSize racine) doit faire varier la
  // taille calculée d'un élément de texte visible sur l'écran de la carte.
  expect(large).toBeGreaterThan(small);
  expect(large / small).toBeCloseTo(1.25, 1);

  // Revenir au cran 1 pour ne pas affecter les tests suivants du même worker.
  await page.getByTestId('options-open').click();
  await page.getByTestId('options-fontscale-1').click();
  await page.getByTestId('options-close').click();

  expect(errors).toEqual([]);
});

test('XP : la victoire contre le gardien crédite le héros', async ({ page }) => {
  const errors = await openGame(page);

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
  await expect(page.getByTestId('combat-round')).toBeVisible();
  await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'AutoCombat' }));
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat))
    .toBeNull();
  // Gardien : 4 élèves à 5 PV ⇒ 20 XP (coefficient 1, doc 02 §1.2).
  const hero = await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]);
  expect(hero?.xp).toBe(20);
  expect(hero?.level).toBe(1);

  expect(errors).toEqual([]);
});

test('export puis import .heroes : aller-retour valide (gzip)', async ({ page }) => {
  const errors = await openGame(page);

  await moveHeroToGold(page);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  const ok = await page.evaluate(() => window.__HEROES_TEST__!.saveRoundtrip());
  expect(ok).toBe(true);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 }); // état rechargé intact

  expect(errors).toEqual([]);
});

test('ville : construire + croissance + recruter + transférer → armée du héros', async ({ page }) => {
  const errors = await openGame(page);

  // La ville de départ est chargée (doc 02 §4) : bouton [Ville] + écran.
  const town = await page.evaluate(() => window.__HEROES_TEST__!.getState().towns[0]);
  expect(town?.id).toBe('start-town');
  expect(town?.ownerPlayerId).toBe('player-1');
  await expect(page.getByTestId('town-open')).toBeVisible();
  await page.getByTestId('town-open').click();
  await expect(page.getByTestId('town-tab-build')).toBeVisible();
  // Motif de bannière de faction (doc 08 §4, accessibilité non chromatique) —
  // présent dans l'en-tête, dérivé de `town.factionId` (aucun nom en dur).
  await expect(page.getByTestId('faction-badge')).toBeVisible();
  await page.getByTestId('town-close').click();

  const armyTotal = (): Promise<number> =>
    page.evaluate(
      () =>
        window.__HEROES_TEST__!.getState().heroes[0]?.army.reduce((s, st) => s + st.count, 0) ?? 0,
    );
  const before = await armyTotal();

  // Construire un bâtiment (1/jour, doc 02 §4.1) : le marché (1000 or, 5 bois).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'BuildStructure',
      townId: 'start-town',
      buildingId: 'market',
    }),
  );
  expect(
    await page.evaluate(() => window.__HEROES_TEST__!.getState().towns[0]?.buildings['market']),
  ).toBe(1);

  // Passage de semaine (jour 8) : l'habitation T1 génère son stock (croissance 14).
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }));
  }
  expect(
    await page.evaluate(() => window.__HEROES_TEST__!.getState().towns[0]?.stock['t1-recruit'] ?? 0),
  ).toBe(14);

  // Recruter 10 recrues dans la garnison de la ville (débit d'or).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'RecruitUnits',
      townId: 'start-town',
      unitId: 't1-recruit',
      count: 10,
    }),
  );

  // Amener le héros sur la tuile de la ville (2,4) puis transférer la garnison.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [{ x: 2, y: 4 }],
    }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 2, y: 4 });
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'GarrisonTransfer',
      townId: 'start-town',
      heroId: 'hero-player-1',
      from: 'town',
      slot: 0,
    }),
  );

  // L'armée du héros a augmenté de 10 (fusion avec la pile t1-recruit existante).
  expect(await armyTotal()).toBe(before + 10);

  expect(errors).toEqual([]);
});

test('sort : le héros lance un sort en combat et réduit une pile ennemie', async ({ page }) => {
  const errors = await openGame(page);

  // Interception du gardien (9,3) : le héros est lié au camp attaquant (doc 02
  // §5.2) → habilité à lancer un sort. Chemin identique au test de combat.
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
  await expect(page.getByTestId('combat-round')).toBeVisible();

  // Dotation de départ (config.newGame.startingHero) : Savoir 4 ⇒ 40 mana,
  // sorts de cercle ≤ 3 connus d'emblée (décision 3.2 #7).
  const setup = await page.evaluate(() => {
    const g = window.__HEROES_TEST__!.getState();
    const target = g.combat!.stacks.find((s) => s.side === 'defender')!;
    return {
      mana: g.heroes[0]!.mana,
      spells: g.heroes[0]!.spells.length,
      targetId: target.id,
      count: target.count,
    };
  });
  expect(setup.spells).toBeGreaterThan(0);
  expect(setup.mana).toBe(40);

  // Tour du joueur : le bouton [Sort héros] s'active (canCastSpell) — l'IA
  // adverse a déjà joué son tour le cas échéant (runAiIfNeeded).
  await expect(page.getByTestId('combat-spell')).toBeEnabled();
  await page.getByTestId('combat-spell').click();

  // Livre → « éclair magique » (cercle 1, 4 mana) → pile ennemie →
  // prévisualisation OBLIGATOIRE (doc 08 §2.4) → confirmation.
  await page.getByTestId('spell-eclair-magique').click();
  await page.getByTestId(`spell-target-${setup.targetId}`).click();
  await expect(page.getByTestId('spell-preview')).toContainText(/\d/);
  await page.getByTestId('spell-cast').click();

  // Pile ennemie réduite (ou détruite), mana débitée, 1 sort/round consommé.
  const after = await page.evaluate((targetId) => {
    const g = window.__HEROES_TEST__!.getState();
    const target = g.combat?.stacks.find((s) => s.id === targetId);
    return {
      mana: g.heroes[0]!.mana,
      remaining: target?.count ?? 0,
      cast: g.combat?.heroCastThisRound ?? false,
    };
  }, setup.targetId);
  expect(after.mana).toBeLessThan(setup.mana);
  expect(after.remaining).toBeLessThan(setup.count);
  expect(after.cast).toBe(true);

  expect(errors).toEqual([]);
});

test('compétence : aucune modale de choix sans montée de niveau (gating)', async ({ page }) => {
  const errors = await openGame(page);

  // Héros niveau 1, aucune proposition en attente ⇒ la modale de choix
  // (montée `shell.tsx` sur `pendingSkillChoices.length > 0`) reste absente.
  const hero = await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]);
  expect(hero?.level).toBe(1);
  expect(hero?.pendingSkillChoices).toHaveLength(0);
  await expect(page.getByTestId('skill-choice')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('sauvegarde puis rechargement IndexedDB : position restaurée', async ({ page }) => {
  const errors = await openGame(page);

  await moveHeroToGold(page);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });

  await page.getByTestId('save').click();

  // Déplacement après sauvegarde (déterministe, à réverter par le chargement).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [
        { x: 5, y: 4 },
        { x: 5, y: 5 },
      ],
    }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 5, y: 5 });

  // …annulé par le rechargement du slot.
  await page.getByTestId('load').click();
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.movementPoints).toBe(1400);
  await expect(page.getByTestId('resource-gold')).toHaveText('2500');

  expect(errors).toEqual([]);
});

test('scénario : le menu démarre le tutoriel, l’IA joue son tour', async ({ page }) => {
  const errors = await openMenu(page);

  await expect(page.getByTestId('menu-scenario-tutorial')).toBeVisible();
  await page.getByTestId('menu-scenario-tutorial').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();

  const before = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(before.calendar.day).toBe(1);
  expect(before.heroes).toHaveLength(2);
  expect(before.players.map((p) => p.controller)).toEqual(['human', 'ai']);

  // Fin de tour humain : la boucle IA (app/dispatch.ts) joue automatiquement
  // le tour de l'IA (déplacement/ramassage/ville — doc 11 §3.5) puis termine
  // son tour à son tour — le jour avance donc d'un cran, sans intervention.
  await page.getByTestId('end-turn').click();
  await expect(page.getByTestId('calendar')).toHaveText('Jour 2 · Semaine 1');

  const after = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(after.calendar.day).toBe(2);
  expect(after.currentPlayer).toBe(0); // revenu au joueur humain
  expect(after.combat).toBeNull(); // un combat déclenché par l'IA aurait été auto-résolu
  expect(after.heroes).toHaveLength(2); // aucun gardien accessible au jour 1 (héros distants)

  expect(errors).toEqual([]);
});

test('scénario : gagner « survie » contre l’IA (surviveDays)', async ({ page }) => {
  const errors = await openMenu(page);

  await page.evaluate(() => window.__HEROES_TEST__!.startScenario('survival'));
  await expect(page.getByTestId('end-turn')).toBeVisible();

  const state0 = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state0.scenario).not.toBeNull();
  expect(state0.outcome).toBeNull();

  // Le joueur humain se contente de finir son tour ; la boucle IA joue
  // automatiquement le tour adverse (aucun combat héros-vs-héros au moteur —
  // écart assumé plan phase-3.5, cf. commentaire d'en-tête) jusqu'à ce que
  // `surviveDays: 15` soit atteint. Plafond largement au-delà du nécessaire.
  const MAX_TURNS = 30;
  for (let i = 0; i < MAX_TURNS; i++) {
    const outcome = await page.evaluate(() => window.__HEROES_TEST__!.getState().outcome);
    if (outcome) break;
    await page.evaluate(() =>
      window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }),
    );
  }

  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.outcome).not.toBeNull();
  expect(state.outcome?.status).toBe('won');
  expect(state.calendar.day).toBeGreaterThanOrEqual(15);
  await expect(page.getByTestId('outcome-overlay')).toBeVisible();
  await expect(page.getByTestId('outcome-status')).toHaveText('Victoire !');

  // Retour au menu depuis l'overlay (bouton, doc 08).
  await page.getByTestId('outcome-back-to-menu').click();
  await expect(page.getByTestId('menu-new-game')).toBeVisible();

  expect(errors).toEqual([]);
});
