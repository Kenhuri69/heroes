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
// de niveau → choix de compétence/attribut (modales + ChooseSkill/ChooseAttribute)
// n'est PAS jouable en smoke (niveau 2 ≈ 3732 XP, un gardien ≈ 20 XP) : le flux
// moteur (level-up → pendingSkillChoices/pendingAttributeChoices → Choose*) est
// couvert par `hero-level-up.test.ts` ; seul le gating d'affichage est vérifié ici.

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
  // 1er tap = prévisualisation ⇒ le bouton « Annuler le déplacement » (M2)
  // apparaît. Sous charge (CI/parallèle), un tap peut être avalé pendant que la
  // scène Pixi initialise le pointeur : on re-tape jusqu'à voir la préviz, point
  // de synchro DÉTERMINISTE (plus fiable que l'ancienne attente aveugle 100 ms).
  const cancel = page.getByTestId('cancel-path');
  await expect(async () => {
    await page.mouse.click(screen.x, screen.y);
    await expect(cancel).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.mouse.click(screen.x, screen.y); // 2ᵉ tap = exécution
}

/**
 * Écran pré-combat (Lot 1, fidélité HoMM Online) : intercalé au démarrage de
 * TOUT combat. `'fight'` passe à la conduite manuelle (révèle `CombatUi`),
 * `'auto'` lance l'Auto-Battle (résolution déterministe immédiate).
 */
async function passPreBattle(page: Page, mode: 'fight' | 'auto' = 'fight'): Promise<void> {
  await expect(page.getByTestId('pre-battle')).toBeVisible();
  await page.getByTestId(mode === 'auto' ? 'pre-battle-auto' : 'pre-battle-fight').click();
}

/**
 * Bilan de fin de combat (retour de jeu 2026-07) : après un combat FOUILLÉ, une
 * modale de résultat s'affiche par-dessus la carte. Ce helper la ferme si elle
 * est présente (« Continuer »), pour reprendre les interactions sur la carte.
 */
async function dismissCombatResult(page: Page): Promise<void> {
  const cont = page.getByTestId('combat-result-continue');
  if (await cont.isVisible().catch(() => false)) await cont.click();
}

/**
 * Sauvegarde/chargement manuels : déplacés dans la modale Options (lot M5, C11).
 * Ouvre Options, clique le bouton, referme — pour laisser la carte au 1er plan.
 */
/**
 * Fin de tour via le bouton HUD (lot M8) : le garde-fou C12 peut intercaler une
 * confirmation si un héros n'a pas bougé — on la valide alors pour finir le tour.
 */
async function endTurn(page: Page): Promise<void> {
  // Un bilan de combat pendant (retour de jeu 2026-07) recouvre le HUD : le fermer d'abord.
  await dismissCombatResult(page);
  await page.locator('[data-testid="end-turn"]').click();
  const confirmGo = page.getByTestId('end-turn-confirm-go');
  if (await confirmGo.isVisible().catch(() => false)) await confirmGo.click();
}

async function clickSaveAction(page: Page, action: 'save' | 'load'): Promise<void> {
  await page.getByTestId('options-open').click();
  await page.getByTestId(action).click();
  // Referme Options par Échap (handler global) — robuste au re-render du toast
  // de sauvegarde. Le chargement referme déjà les modales (rechargement d'état).
  if (await page.getByTestId('options-panel').isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
  }
  await expect(page.getByTestId('options-panel')).toHaveCount(0);
}

/**
 * Trace les réponses d'images (lot intégration des assets) : `failed` = tout
 * PNG/JPG servi en ≥ 400 (le registre ne doit référencer que des fichiers
 * présents), `loaded` = URLs servies en < 400. À brancher AVANT `openGame`.
 */
function trackAssets(page: Page): { failed: string[]; loaded: string[] } {
  const tracked = { failed: [] as string[], loaded: [] as string[] };
  page.on('response', (res) => {
    const url = res.url();
    if (!/\.(png|jpe?g|webp)(\?|$)/.test(url)) return;
    if (res.status() >= 400) tracked.failed.push(`${res.status()} ${url}`);
    else tracked.loaded.push(url);
  });
  return tracked;
}

/** `naturalWidth` d'une `<img>` — > 0 ⇒ l'image est réellement décodée/affichée. */
function imgNaturalWidth(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => (el as HTMLImageElement).naturalWidth);
}

test('le client démarre sans erreur et charge le contenu', { tag: ['@mobile', '@core'] }, async ({ page }) => {
  const errors = await openGame(page);

  await expect(page.locator('#canvas-root canvas')).toBeVisible();

  // Pipeline de contenu : les paquets du dépôt chargent et se valident dans
  // le navigateur (doc 06 §1) — aucun rejet toléré sur notre propre contenu.
  const content = await page.evaluate(() => window.__HEROES_CONTENT__);
  expect(content?.rejected).toEqual([]);
  expect(content?.factions).toEqual([
    'haven',
    'arcane-hunters',
    'test-faction',
    'necropolis',
    'sylvan-court',
    'vox-arcana',
    'dungeon',
  ]);

  // La partie démarre sur la carte proto : héros à sa position de départ.
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.started).toBe(true);
  expect(state.map?.id).toBe('proto-01');
  expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 3 });
  expect(state.heroes[0]?.movementPoints).toBe(1700); // 1500 + 50 × vitesse 4 (armée de départ)
  await expect(page.getByTestId('resource-gold')).toHaveText('2000');

  expect(errors).toEqual([]);
});

test('tap-tap : déplacement scripté, ramassage, points décomptés', { tag: ['@mobile', '@core'] }, async ({ page }) => {
  const errors = await openGame(page);

  // Le tas d'or est en (6,3), 3 pas droits depuis (3,3) : 3 × 100 PM.
  await tapTapTile(page, 6, 3);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });

  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.movementPoints).toBe(1400);
  expect(state.players[0]?.resources.gold).toBe(2500); // 2000 + 500 ramassés
  expect(state.map?.objects.some((o) => o.id === 'gold-1')).toBe(false);
  await expect(page.getByTestId('resource-gold')).toHaveText('2500');
  await expect(page.getByTestId('movement-points')).toHaveText('PM 1400 / 1700');

  expect(errors).toEqual([]);
});

test('HUD mobile : bandeau d’armée replié par défaut, dépliable (X3)', { tag: '@mobile' }, async ({ page }) => {
  const errors = await openGame(page);

  // E3 : au 1er lancement le bandeau est REPLIÉ ⇒ la carte n'est plus masquée
  // (aucun slot rendu tant qu'il est replié).
  const band = page.getByTestId('army-band');
  await expect(band).toHaveClass(/collapsed/);
  await expect(page.locator('.army-band .army-slots')).toHaveCount(0);

  // Dépliage : les 2 piles de départ apparaissent (test-faction : recrue + élève).
  await page.getByTestId('army-band-toggle').click();
  await expect(band).not.toHaveClass(/collapsed/);
  await expect(page.locator('.army-band .army-slot.filled')).toHaveCount(2);

  expect(errors).toEqual([]);
});

// Tag @core (desktop) : la LOGIQUE E4 (handlers, appui long via Pointer Events) est
// indépendante du viewport ; la simulation d'appui long TACTILE sous charge est
// intrinsèquement flaky (course du minuteur). Le rendu tactile mobile est vérifié
// en capture manuelle. Le garde `hero-drawer-toggle` reste (no-op sur desktop).
test('E4 : navigation au pouce — héros suivant, tap portrait, appui long ville (sans clavier)', { tag: '@core' }, async ({ page }) => {
  // Recentrages INSTANTANÉS (reduce-motion) : pas d'animation rAF qui retarderait le
  // minuteur d'appui long, et la caméra bouge d'un coup ⇒ assertions déterministes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openGame(page);
  // Deux héros mobiles : recruter Garrick (même prépa que UX-HEROSWAP, via le hook
  // moteur — le sujet est la NAVIGATION, pas le recrutement).
  await page.evaluate(async () => {
    const d = window.__HEROES_TEST__!.dispatch;
    await d({ type: 'BuildStructure', townId: 'start-town', buildingId: 'tavern' });
    await d({ type: 'EndTurn', playerId: 'player-1' });
    await d({ type: 'EndTurn', playerId: 'player-1' });
    await d({ type: 'RecruitHero', townId: 'start-town', heroId: 'garrick', playerId: 'player-1' });
  });
  // Empreinte caméra : position écran d'une tuile fixe (un recentrage la déplace).
  const camFingerprint = (): Promise<{ x: number; y: number }> =>
    page.evaluate(() => window.__HEROES_TEST__!.tileToScreen(0, 0));
  const movedFrom = async (before: { x: number; y: number }): Promise<number> => {
    const c = await camFingerprint();
    return Math.hypot(c.x - before.x, c.y - before.y);
  };
  // La sélection se lit sur l'état ARIA du portrait (le store racine n'est pas exposé).
  const garrick = page.getByTestId('hero-select-hero-player-1-garrick');
  const starter = page.getByTestId('hero-select-hero-player-1');

  await test.step('bouton « héros suivant » : badge = 2, cycle la sélection + recentre', async () => {
    const btn = page.getByTestId('next-hero');
    await expect(btn).toBeVisible();
    await expect(page.getByTestId('next-hero-count')).toHaveText('2');
    await expect(starter).toHaveAttribute('aria-pressed', 'true'); // héros de départ sélectionné
    const before = await camFingerprint();
    await btn.click();
    await expect(garrick).toHaveAttribute('aria-pressed', 'true'); // cycle vers l'autre héros
    await expect.poll(() => movedFrom(before)).toBeGreaterThan(5); // caméra recentrée
  });

  await test.step('tap portrait : sélectionne le héros + recentre la caméra', async () => {
    // Mobile : le bandeau de portraits (HeroStrip) est dans le tiroir héros, replié
    // par défaut ⇒ l'ouvrir d'abord (sur desktop il est déjà visible, no-op).
    const drawerToggle = page.getByTestId('hero-drawer-toggle');
    if (await drawerToggle.isVisible().catch(() => false)) await drawerToggle.click();
    const before = await camFingerprint();
    await starter.click();
    await expect(starter).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => movedFrom(before)).toBeGreaterThan(5);
  });

  await test.step('appui long ville : recentre la carte SANS ouvrir la modale', async () => {
    const before = await camFingerprint();
    // `click({ delay })` = pointerdown, maintien > seuil (450 ms), pointerup —
    // simulation d'appui long fiable (événements pointer réels).
    await page.getByTestId('town-open-start-town').click({ delay: 900 });
    await expect(page.locator('.town-screen')).toHaveCount(0); // appui long ≠ tap
    await expect.poll(() => movedFrom(before)).toBeGreaterThan(5);
  });

  expect(errors).toEqual([]);
});

test("bandeau d'armée : tap sur une vignette ⇒ fiche d'unité (stats + capacités)", { tag: '@mobile' }, async ({
  page,
}) => {
  const errors = await openGame(page);

  // Déplie le bandeau puis ouvre la fiche de la 1ʳᵉ pile (vignette encadrée).
  await page.getByTestId('army-band-toggle').click();
  await page.locator('.army-band [data-testid="army-slot-0"]').click();

  const card = page.getByTestId('unit-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Attaque'); // stats localisées
  await expect(card).toContainText('Compétences'); // section capacités

  // Fermeture par le bouton × ⇒ retour à la carte.
  await page.getByTestId('unit-card-close').click();
  await expect(card).toBeHidden();

  expect(errors).toEqual([]);
});

test('UX-REORDER : réorganiser deux piles en tap-tap change l’ordre de l’armée', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Armée de départ du héros humain (heroes[0]) : 2 piles distinctes.
  const before = await page.evaluate(() =>
    window.__HEROES_TEST__!.getState().heroes[0]!.army.map((s) => s.unitId),
  );
  expect(before.length).toBe(2);

  // Déplie le bandeau, entre en mode réorganisation, déplace slot 0 → slot 1.
  // (Le testid existe aussi dans le tiroir héros desktop ⇒ on scope au bandeau.)
  await page.getByTestId('army-band-toggle').click();
  await page.locator('.army-band [data-testid="army-reorder-toggle"]').click();
  await page.locator('.army-band [data-testid="army-slot-0"]').click(); // sélectionne
  await page.locator('.army-band [data-testid="army-slot-1"]').click(); // déplace ici

  // L'ordre moteur est inversé (commande ReorderArmy appliquée).
  await expect
    .poll(() =>
      page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]!.army.map((s) => s.unitId)),
    )
    .toEqual([before[1], before[0]]);

  expect(errors).toEqual([]);
});

test('UX-SPLIT : séparer une pile en deux via le curseur ajoute un slot', async ({ page }) => {
  const errors = await openGame(page);

  // Armée de départ du héros humain : t1-recruit ×20 (slot 0), t1-eleve ×12.
  const before = await page.evaluate(() =>
    window.__HEROES_TEST__!.getState().heroes[0]!.army.map((s) => ({ id: s.unitId, n: s.count })),
  );
  expect(before.length).toBe(2);
  const slot0 = before[0]!;

  // Déplie le bandeau, entre en mode séparation, ouvre le curseur sur le slot 0.
  await page.getByTestId('army-band-toggle').click();
  await page.locator('.army-band [data-testid="army-split-toggle"]').click();
  await page.locator('.army-band [data-testid="army-slot-0"]').click();

  const dialog = page.getByTestId('split-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('split-confirm').click();

  // Une 3ᵉ pile apparaît, le même unitId total est conservé (split déterministe).
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]!.army.length))
    .toBe(before.length + 1);
  const total = await page.evaluate(
    (id) =>
      window
        .__HEROES_TEST__!.getState()
        .heroes[0]!.army.filter((s) => s.unitId === id)
        .reduce((sum, s) => sum + s.count, 0),
    slot0.id,
  );
  expect(total).toBe(slot0.n);

  expect(errors).toEqual([]);
});

test('tap sur une ressource : fiche stock + revenu/jour (doc 08 §2.1, lot M6 C8)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // UX-RAIL (doc 08 §2.1) : revenu quotidien inline dans la barre haute (hôtel de
  // ville = +500 or/j). Présent des deux côtés ; masqué par CSS en portrait
  // compact (toContainText lit le textContent sans exiger la visibilité).
  await expect(page.getByTestId('resource-income-gold')).toContainText('+500');

  // Tap sur l'or ⇒ fiche ressource : stock + revenu/jour (hôtel de ville = +500/j).
  await page.getByTestId('resource-open-gold').click();
  const card = page.getByTestId('resource-detail');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/\+500\/j|\+500\/day/);
  await page.getByTestId('resource-detail-close').click();
  await expect(card).toBeHidden();

  expect(errors).toEqual([]);
});

test("préviz de chemin : « Annuler le déplacement » efface l'aperçu (doc 08 §3, lot M2)", async ({
  page,
}) => {
  const errors = await openGame(page);

  // 1er tap = prévisualisation ⇒ le bouton d'annulation apparaît. Re-tap si le
  // tap est avalé pendant l'init du pointeur Pixi (robustesse sous charge).
  const screen = await page.evaluate(() => window.__HEROES_TEST__!.tileToScreen(6, 3));
  const cancel = page.getByTestId('cancel-path');
  await expect(async () => {
    await page.mouse.click(screen.x, screen.y);
    await expect(cancel).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await cancel.click();
  await expect(page.getByTestId('cancel-path')).toBeHidden();

  // La préviz est bien annulée : le héros n'a pas bougé, aucun PM dépensé.
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 3 });
  expect(state.heroes[0]?.movementPoints).toBe(1700);

  expect(errors).toEqual([]);
});

test("appui long sur la mine (3,6) : fiche d'objet de carte (doc 08 §2.1, lot M2)", async ({
  page,
}) => {
  const errors = await openGame(page);

  // En mobile, la tuile (3,6) tombe sous le HUD bas (DOM) : on PAN d'abord le
  // canvas pour amener la mine au centre du viewport (zone canvas nue), puis
  // appui maintenu ~600 ms sans bouger (tuile explorée : rayon de vision 5).
  const vp = page.viewportSize()!;
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  const before = await page.evaluate(() => window.__HEROES_TEST__!.tileToScreen(3, 6));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + (cx - before.x), cy + (cy - before.y), { steps: 8 });
  await page.mouse.up();
  const screen = await page.evaluate(() => window.__HEROES_TEST__!.tileToScreen(3, 6));
  await page.mouse.move(screen.x, screen.y);
  await page.mouse.down();
  // Marge large sur les 450 ms du geste : sous charge CI, le setTimeout du
  // long-press peut être retardé — un maintien trop court le fait annuler par
  // la relâche.
  await page.waitForTimeout(900);
  await page.mouse.up();

  const card = page.getByTestId('map-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/jour|day/i); // revenu quotidien de la mine
  await page.getByTestId('map-card-close').click();
  await expect(card).toBeHidden();

  expect(errors).toEqual([]);
});

test('E9 : les revenus du jour sont agrégés en une seule entrée de journal', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Fin de tour ⇒ (tours IA) ⇒ nouveau jour ⇒ revenus crédités (start-town…).
  await endTurn(page);
  await page.getByTestId('journal-open').click();
  // Lot 3a (E9) : UNE entrée « Revenus du jour : … » agrégée, et AUCUNE entrée
  // par-source (l'ancien `toast.townIncome`/`mineIncome`) — la pluie est éteinte.
  const income = page.getByTestId('journal-entry').filter({ hasText: /Revenus du jour|Daily income/ });
  await expect(income).toHaveCount(1);
  const perSource = page.getByTestId('journal-entry').filter({ hasText: /\(mine\)|\(revenu de ville\)|\(town income\)/ });
  await expect(perSource).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Tag @core (desktop) : la LOGIQUE E7 (repli/dépli d'une section + persistance
// localStorage) est indépendante du viewport ; sur desktop le tiroir héros est
// toujours visible ⇒ pas de dépendance au bouton hamburger mobile.
test('E7 : les sections du tiroir héros se replient et l’état persiste', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);

  // Corps de la section Compétences (liste de compétences OU état « aucune »).
  const toggle = page.getByTestId('hero-skills-toggle');
  const body = page.locator(
    '[data-testid="hero-skills"] .hero-skill-list, [data-testid="hero-skills"] .hero-skills-empty',
  );
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(body).toHaveCount(1);

  // Replier : le corps disparaît, `aria-expanded=false`, préférence persistée.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(body).toHaveCount(0);
  const stored = await page.evaluate(() => localStorage.getItem('heroes.section.skills'));
  expect(stored).toBe('1');

  // Déplier : le corps réapparaît (aucune perte de contenu).
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(body).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('I7 : le portrait du HeroStrip monte un avatar (ou son repli)', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Le bouton de portrait doit contenir soit l'avatar (`img.hero-portrait-avatar`)
  // soit son repli gracieux (`.hero-portrait-mini`) — jamais le cercle gris nu
  // en dur. Prouve que le chemin AssetImg (I7) s'est monté sans régression.
  const portrait = page.getByTestId('hero-select-hero-player-1');
  await expect(portrait).toBeVisible();
  await expect(portrait.locator('.hero-portrait-avatar, .hero-portrait-mini')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('I8 : le mute rapide coupe le son (aria-pressed) et persiste', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  const mute = page.getByTestId('mute-toggle');
  await expect(mute).toBeVisible();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  // Couper : `aria-pressed` bascule (2ᵉ canal a11y) et la préférence persiste.
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('heroes:audio:muted'))).toBe('1');
  // Rétablir.
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('heroes:audio:muted'))).toBe('0');
  expect(errors).toEqual([]);
});

test('I12 : l’eau miroite sur la carte, coupé en reduce-motion', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Motion ON : la surface d'eau respire ⇒ l'alpha du miroitement oscille > 0.
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.waterSheen().alpha))
    .toBeGreaterThan(0);
  // Reduce-motion : surface figée ⇒ alpha ramené à 0 par la boucle.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.__HEROES_TEST__!.waterSheen().alpha)).toBe(0);
  expect(errors).toEqual([]);
});

test('I15 : le retour haptique est opt-in et se déclenche sur un kill', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Défaut OFF : une confirmation (construction) ne déclenche aucune vibration.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'BuildStructure', townId: 'start-town', buildingId: 'tavern' }),
  );
  expect(await page.evaluate(() => window.__HEROES_TEST__!.haptic().count)).toBe(0);
  // Opt-in via les Options : activer le retour tactile (persisté).
  await page.getByTestId('options-open').click();
  await page.getByTestId('options-haptics-on').click();
  await page.getByTestId('options-close').click();
  expect(await page.evaluate(() => localStorage.getItem('heroes:haptics'))).toBe('1');
  // Un kill dans un combat AFFICHÉ ⇒ tentative de vibration. Tireur ×40 one-shot
  // une pile fragile (le défenseur garde une 2ᵉ pile ⇒ le combat continue).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'StartCombat',
      attacker: [{ unitId: 't2-archer', count: 40 }],
      defender: [
        { unitId: 't1-recruit', count: 1 },
        { unitId: 't1-recruit', count: 1 },
      ],
      terrain: 'grass',
    }),
  );
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = window.__HEROES_TEST__!.getState().combat;
        return c?.stacks.find((s) => s.id === c.activeStackId)?.side;
      }),
    )
    .toBe('attacker');
  const targetId = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().combat!.stacks.find((s) => s.side === 'defender')!.id,
  );
  await page.evaluate(
    (tid) => window.__HEROES_TEST__!.dispatch({ type: 'CombatAction', action: { type: 'attack', targetStackId: tid } }),
    targetId,
  );
  await expect.poll(() => page.evaluate(() => window.__HEROES_TEST__!.haptic().count)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('fin de tour : jour suivant, points de mouvement restaurés', async ({ page }) => {
  const errors = await openGame(page);

  // Déplacement scripté via le hook moteur (cf. `moveHeroToGold`) : le sujet est
  // la fin de tour + restauration des PM, PAS le tap-tap (couvert par son test
  // dédié). Évite le flake tap-tap mobile sous charge (1er tap parfois perdu).
  await moveHeroToGold(page);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });

  await endTurn(page);
  await expect(page.getByTestId('calendar')).toHaveText('Mois 1 · Semaine 1 · Jour 2');
  await expect(page.getByTestId('movement-points')).toHaveText('PM 1700 / 1700');

  expect(errors).toEqual([]);
});

// Regroupe trois vérifs de confort sur l'écran de carte (un seul démarrage) :
// aide « ? » (X7), option « réduire les animations » (M8 C3), raccourci E +
// garde-fou de fin de tour (M8 C2/C12 — joué en dernier car il finit le tour).
test('confort : aide « ? », réduction des animations et raccourci E (doc 08, lot M8)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Établit le focus clavier du document (le contexte de test n'en a pas au
  // chargement) : tap sur la tuile du héros (3,3) = no-op sans dépenser de PM.
  const focusMap = async () => {
    const heroTile = await page.evaluate(() => window.__HEROES_TEST__!.tileToScreen(3, 3));
    await page.mouse.click(heroTile.x, heroTile.y);
  };
  await focusMap();

  await test.step('aide « ? » : ouverture puis fermeture Échap (X7)', async () => {
    // Re-frappé jusqu'à l'ouverture (la frappe peut être avalée sous charge
    // avant que le focus soit établi) ; fermeture Échap re-jouée de même.
    const panel = page.getByTestId('shortcuts-panel');
    await expect(async () => {
      if (!(await panel.isVisible())) await page.keyboard.press('Shift+Slash');
      await expect(panel).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0, { timeout: 1000 });
    }).toPass({ timeout: 10000 });
  });

  await test.step('option « réduire les animations » pose data-reduce-motion (C3)', async () => {
    await page.getByTestId('options-open').click();
    await page.getByTestId('options-reduce-motion-on').click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.reduceMotion))
      .toBe('true');
    await page.getByTestId('options-reduce-motion-off').click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.reduceMotion))
      .toBe('false');
    // Referme les options pour laisser la carte au 1er plan (le raccourci E suit).
    if (await page.getByTestId('options-panel').isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
    }
    await expect(page.getByTestId('options-panel')).toHaveCount(0);
  });

  await test.step('raccourci E : garde-fou de fin de tour puis jour suivant (C2/C12)', async () => {
    await focusMap(); // ré-établit le focus clavier après la modale d'options
    // Le héros n'a pas bougé (PM pleins) ⇒ E ouvre la confirmation (C12) ;
    // re-frappé jusqu'à la voir (même synchro déterministe que `tapTapTile`).
    const confirm = page.getByTestId('end-turn-confirm');
    await expect(async () => {
      if (!(await confirm.isVisible())) await page.keyboard.press('e');
      await expect(confirm).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await page.getByTestId('end-turn-confirm-go').click();
    await expect(page.getByTestId('calendar')).toHaveText('Mois 1 · Semaine 1 · Jour 2');
  });

  expect(errors).toEqual([]);
});

test('trigger de carte : le message onDay (jour 2) alimente le journal (comblement MVP)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // proto-01 porte un trigger onDay (jour 2, message) — la bascule de jour le tire.
  await endTurn(page);
  await expect(page.getByTestId('calendar')).toHaveText('Mois 1 · Semaine 1 · Jour 2');
  await page.getByTestId('journal-open').click();
  await expect(
    page.getByTestId('journal-entry').filter({ hasText: /éclaireurs|activité/i }).first(),
  ).toBeVisible();
  await page.getByTestId('journal-close').click();

  expect(errors).toEqual([]);
});

test('mine : capture au passage ⇒ propriétaire + revenu au jour suivant (doc 02 §2.2)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // La mine d'or est en (3,6), 3 pas droits depuis (3,3) — la fouler la capture.
  // Déplacement scripté via le hook moteur : le tap-tap n'est pas le sujet ici
  // (cf. `moveHeroToGold`) — sur desktop la tuile tombe sous un overlay DOM.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [
        { x: 3, y: 4 },
        { x: 3, y: 5 },
        { x: 3, y: 6 },
      ],
    }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 3, y: 6 });
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  const mine = state.map?.objects.find((o) => o.id === 'mine-gold-1');
  expect(mine?.type === 'mine' && mine.ownerId).toBe('player-1');

  // Revenu quotidien : 500 (hôtel de ville) + 1000 (mine d'or — doc 02 §3).
  const goldBefore = state.players[0]?.resources.gold ?? 0;
  await endTurn(page);
  await expect(page.getByTestId('calendar')).toHaveText('Mois 1 · Semaine 1 · Jour 2');
  await expect(page.getByTestId('resource-gold')).toHaveText(String(goldBefore + 1500));

  expect(errors).toEqual([]);
});

test('trésor : fouler le coffre ⇒ modale or/XP ⇒ or crédité (doc 02 §2.2)', async ({ page }) => {
  const errors = await openGame(page);

  // Le coffre est en (2,3), adjacent au départ (3,3) — le fouler ouvre le choix.
  // Déplacement scripté (cf. `moveHeroToGold`) : le sujet est coffre ⇒ modale,
  // pas le tap-tap (couvert par son test dédié).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [{ x: 2, y: 3 }],
    }),
  );
  await expect(page.getByTestId('treasure-choice')).toBeVisible();
  const pending = await page.evaluate(() => window.__HEROES_TEST__!.getState().pendingTreasure);
  expect(pending?.objectId).toBe('chest-1');

  await page.getByTestId('treasure-choice-gold').click();
  await expect(page.getByTestId('treasure-choice')).not.toBeVisible();
  await expect(page.getByTestId('resource-gold')).toHaveText('3000'); // 2000 + 1000
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.pendingTreasure).toBeNull();
  expect(state.map?.objects.some((o) => o.id === 'chest-1')).toBe(false);

  expect(errors).toEqual([]);
});

test('UX-HEROSWAP : recruter un 2ᵉ héros ⇒ transférer une pile (doc 02 §1.5, doc 08 §2.3)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Construire la Taverne du start-town (2,4) puis 2 fins de tour (+500 or/j
  // ⇒ 2500) ⇒ recruter Garrick. Le 2ᵉ héros apparaît sur la ville (2,4),
  // adjacent au héros de départ (3,3) — préparation via le hook moteur (le
  // sujet du test est l'ÉCHANGE, pas le recrutement, couvert par M-TAVERN.2).
  await page.evaluate(async () => {
    const d = window.__HEROES_TEST__!.dispatch;
    await d({ type: 'BuildStructure', townId: 'start-town', buildingId: 'tavern' });
    await d({ type: 'EndTurn', playerId: 'player-1' });
    await d({ type: 'EndTurn', playerId: 'player-1' });
    await d({ type: 'RecruitHero', townId: 'start-town', heroId: 'garrick', playerId: 'player-1' });
  });
  const heroCount = await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes.length);
  expect(heroCount).toBe(2);

  // Le tiroir héros (héros de départ sélectionné) affiche le bouton de rencontre.
  // Mobile : le tiroir est replié (bouton hamburger) ; desktop : colonne visible.
  const drawerToggle = page.getByTestId('hero-drawer-toggle');
  if (await drawerToggle.isVisible().catch(() => false)) await drawerToggle.click();
  await page.getByTestId('hero-swap-open-hero-player-1-garrick').click();
  await expect(page.getByTestId('heroswap')).toBeVisible();

  // Taper la 1ʳᵉ pile du héros de départ la donne au héros recruté.
  await page.getByTestId('heroswap-army-hero-player-1-0').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__HEROES_TEST__!.getState().heroes.find((h) => h.id === 'hero-player-1-garrick')?.army.length ?? 0,
      ),
    )
    .toBe(1);

  // « Tout donner » (revue 2026-07 B14) : le héros recruté rend TOUTES ses piles
  // au héros de départ, sans bandeau d'erreur (la boucle lisait un état périmé
  // et se terminait systématiquement en erreur `invalidTransfer`).
  await page.getByTestId('heroswap-giveall-hero-player-1-garrick').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__HEROES_TEST__!.getState().heroes.find((h) => h.id === 'hero-player-1-garrick')?.army.length ?? -1,
      ),
    )
    .toBe(0);
  await expect(page.getByTestId('heroswap-error')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('lieu de bonus & habitation : écurie ⇒ +PM, camp ⇒ recrutement (doc 02 §2.2)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Écurie en (4,4) : 1 pas diagonal (141 PM) puis +400 PM — visite en passant.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [{ x: 4, y: 4 }],
    }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 4, y: 4 });
  let state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.movementPoints).toBe(1700 - 141 + 400);

  // Habitation en (2,2) : recrute tout le stock abordable (8 × 30 or), fusion
  // avec la pile t1-recruit de départ.
  const before = state.heroes[0]?.army.find((s) => s.unitId === 't1-recruit')?.count ?? 0;
  const goldBefore = state.players[0]?.resources.gold ?? 0;
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [
        { x: 3, y: 3 },
        { x: 2, y: 2 },
      ],
    }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 2, y: 2 });
  state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  const stack = state.heroes[0]?.army.find((s) => s.unitId === 't1-recruit');
  expect((stack?.count ?? 0) - before).toBe(8);
  const camp = state.map?.objects.find((o) => o.id === 'camp-recrues');
  expect(camp?.type === 'dwelling' && camp.stock).toBe(0);
  // M-DWELLOWN (doc 02 §2.2) : fouler l'habitation la capture (drapeau du joueur).
  expect(camp?.type === 'dwelling' && camp.ownerId).toBe('player-1');
  expect(state.players[0]?.resources.gold).toBe(goldBefore - 8 * 30);

  expect(errors).toEqual([]);
});

test('combat : victoire contre le gardien, retour carte avec pertes appliquées', { tag: ['@mobile', '@core'] }, async ({ page }) => {
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

  // Le combat est ouvert : écran pré-combat (Lot 1) d'abord, puis conduite manuelle.
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();
  await expect.poll(() => heroPos(page)).toEqual({ x: 8, y: 2 });

  // Journal de combat (UX-COMBATLOG) : le bouton bascule le panneau ; le journal
  // est alimenté dès l'ouverture du combat (« Round 1 » déjà présent). Lot 1a :
  // sur mobile, le Journal est une action secondaire ⇒ ouvrir le tiroir « ⋯ »
  // d'abord (sur desktop « ⋯ » est masqué et les secondaires sont inline).
  const moreActions = page.getByTestId('combat-more');
  if (await moreActions.isVisible()) await moreActions.click();
  await page.getByTestId('combat-log-toggle').click();
  await expect(page.getByTestId('combat-log')).toBeVisible();
  await expect(page.getByTestId('combat-log-lines')).toContainText(/Round/i);
  const combat = await page.evaluate(() => window.__HEROES_TEST__!.getState().combat);
  expect(combat?.playerSide).toBe('attacker');
  expect(combat?.stacks.filter((s) => s.side === 'defender')).toHaveLength(1);

  // Amélioration UX champ de bataille : la fiche de stats d'une pile s'ouvre au
  // tap sur une vignette du bandeau (même fiche que l'appui long sur le plateau,
  // piloté par `combatInspectId`). Contenu à fort contraste : PV « X/Y » (le
  // badge d'effectif canvas est un rendu Pixi, non assertable ici — l'effectif
  // sous-jacent reste couvert par les vignettes DOM).
  await test.step('fiche de pile : stats consultables', async () => {
    await page.getByTestId('combat-order').locator('button.stack-chip').first().click();
    const sheet = page.getByTestId('stack-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('/'); // PV firstHp/maxHp
    await page.getByTestId('stack-sheet-close').click();
    await expect(sheet).toHaveCount(0);
  });

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

test('I2 : les jetons de combat respirent (idle procédural), coupé en reduce-motion', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Combat MANUEL (la scène reste vivante ⇒ la boucle idle tourne). D'abord en
  // reduce-motion : aucune respiration ; puis motion ON : les jetons oscillent.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'StartCombat',
      attacker: [{ unitId: 't1-recruit', count: 6 }],
      defender: [{ unitId: 't1-recruit', count: 6 }],
      terrain: 'grass',
    }),
  );
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();

  // Reduce-motion : la boucle idle remet tout `bob` à 0 — jamais d'oscillation.
  await expect.poll(() => page.evaluate(() => window.__HEROES_TEST__!.combatIdle().bob)).toBe(0);

  // Motion ON : les jetons respirent ⇒ amplitude idle > 0.
  await page.emulateMedia({ reducedMotion: null });
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.combatIdle().bob))
    .toBeGreaterThan(0);

  expect(errors).toEqual([]);
});

test('I5 : la mort d’une pile entière fait tressaillir le plateau', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Combat MANUEL : un gros paquet de tireurs one-shot une pile fragile d'UN
  // soldat ⇒ `StackDied` ⇒ `animateDeath` déclenche la micro-secousse (I5). Le
  // défenseur garde une 2ᵉ pile ⇒ le kill NE termine PAS le combat (la scène
  // reste vivante et l'animation de mort — donc la secousse — se joue).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'StartCombat',
      attacker: [{ unitId: 't2-archer', count: 40 }],
      defender: [
        { unitId: 't1-recruit', count: 1 },
        { unitId: 't1-recruit', count: 1 },
      ],
      terrain: 'grass',
    }),
  );
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();
  // Attendre le tour du tireur, puis tirer sur la pile ennemie (la tue).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = window.__HEROES_TEST__!.getState().combat;
        return c?.stacks.find((s) => s.id === c.activeStackId)?.side;
      }),
    )
    .toBe('attacker');
  const targetId = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().combat!.stacks.find((s) => s.side === 'defender')!.id,
  );
  await page.evaluate(
    (tid) => window.__HEROES_TEST__!.dispatch({ type: 'CombatAction', action: { type: 'attack', targetStackId: tid } }),
    targetId,
  );
  await expect.poll(() => page.evaluate(() => window.__HEROES_TEST__!.combatShake().count)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('B6 : un tir produit un projectile visible (sprint 1)', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Combat direct (arène) avec un TIREUR : l'archer tire à travers le plateau,
  // ce qui doit émettre un projectile (avant B6 : le tireur se « ruait » à vide).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'StartCombat',
      attacker: [{ unitId: 't2-archer', count: 6 }],
      defender: [{ unitId: 't1-recruit', count: 8 }],
      terrain: 'grass',
    }),
  );
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();
  // Attendre que le TIREUR (seul stack attaquant) soit actif (l'IA adverse joue
  // d'abord le cas échéant), puis le faire tirer MANUELLEMENT sur la pile ennemie.
  // Le combat reste actif ⇒ la scène est vivante et le projectile s'anime.
  // (L'auto-combat, lui, résout instantanément et détruit la scène : aucune
  // animation, par design — c'est en combat manuel que le tir doit se lire.)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = window.__HEROES_TEST__!.getState().combat;
        return c?.stacks.find((s) => s.id === c.activeStackId)?.side;
      }),
    )
    .toBe('attacker');
  const targetId = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().combat!.stacks.find((s) => s.side === 'defender')!.id,
  );
  await page.evaluate(
    (tid) => window.__HEROES_TEST__!.dispatch({ type: 'CombatAction', action: { type: 'attack', targetStackId: tid } }),
    targetId,
  );
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.combatFx().projectiles))
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('A1 : un gardien de carte est rendu comme un cluster gradué (sprint 2)', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Le gardien de départ (guard-camp, effectif « few » ⇒ cran solitaire) compose
  // son nœud : losange de visée + 1 instance de créature. La gradation rend
  // 1/3/4 instances selon le cran (groupe/horde vérifiés au verify manuel — aucune
  // carte de test ne porte un gardien > 99, et le client n'a pas de harnais unitaire).
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.objectChildCount('guard-camp')))
    .toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('E1 : la vue de royaume liste villes/héros et navigue vers une ville (sprint 3)', { tag: ['@core', '@mobile'] }, async ({ page }) => {
  const errors = await openGame(page);
  await page.getByTestId('kingdom-open').click();
  await expect(page.getByTestId('kingdom-panel')).toBeVisible();
  await expect(page.getByTestId('kingdom-towns')).toBeVisible();
  await expect(page.getByTestId('kingdom-heroes')).toBeVisible();
  // Tap sur la première ville ⇒ la vue se ferme (remplacement, pile ≤ 2) et
  // l'écran de ville s'ouvre — navigation directe, cœur du confort E1.
  await page.locator('[data-testid^="kingdom-town-"]').first().click();
  await expect(page.getByTestId('kingdom-panel')).toHaveCount(0);
  await expect(page.getByTestId('town-close')).toBeVisible();
  expect(errors).toEqual([]);
});

test('écran pré-combat : puissances comparées + Auto-Battle résout (Lot 1)', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);

  // Interception du gardien (9,3) — même chemin que le test de combat.
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

  // L'écran pré-combat (fidélité HoMM Online) s'affiche AVANT le plateau hex :
  // deux puissances comparées, le plateau (CombatUi) encore masqué.
  await expect(page.getByTestId('pre-battle')).toBeVisible();
  await expect(page.getByTestId('combat-round')).toHaveCount(0);
  const power = (id: string): Promise<number> =>
    page.getByTestId(id).evaluate((el) => Number(el.textContent));
  const atk = await power('pre-battle-power-attacker');
  const def = await power('pre-battle-power-defender');
  expect(atk).toBeGreaterThan(0);
  expect(def).toBeGreaterThan(0);
  expect(atk).toBeGreaterThan(def); // 32 unités vs 4 : le joueur domine

  // Lot 6b : composition des deux armées (rangées de vignettes). Côté joueur
  // (attaquant) l'effectif est EXACT (un chiffre) ; côté ennemi il est
  // APPROXIMATIF (un descripteur façon HoMM, jamais le nombre brut).
  await expect(page.getByTestId('pre-battle-comp-attacker')).toBeVisible();
  await expect(page.getByTestId('pre-battle-comp-defender')).toBeVisible();
  await expect(page.getByTestId('pre-battle-comp-attacker')).toContainText(/\d/);
  await expect(page.getByTestId('pre-battle-comp-defender')).toContainText(
    /Quelques|A few|Plusieurs|Several|Groupe|Pack|Nombreux|Lots|Foule|Horde|Nuée|Throng/,
  );

  // Auto-Battle : résolution déterministe immédiate, retour à l'aventure.
  await page.getByTestId('pre-battle-auto').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat))
    .toBeNull();
  await expect(page.getByTestId('end-turn')).toBeVisible();
  expect(await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]?.id)).toBe(
    'hero-player-1',
  ); // victoire : le héros survit

  expect(errors).toEqual([]);
});

test('abandon pré-combat : renoncer garde l’armée et ne montre pas de bilan (retour de jeu 2026-07)', async ({
  page,
}) => {
  const errors = await openGame(page);

  const armyBefore = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().heroes[0]?.army.reduce((n, s) => n + s.count, 0) ?? 0,
  );

  // Interception du gardien (9,3) — même chemin que les autres tests de combat.
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

  // L'écran pré-combat offre « Abandonner » (uniquement pour un combat de héros).
  await expect(page.getByTestId('pre-battle')).toBeVisible();
  await page.getByTestId('pre-battle-abandon').click();

  // Combat quitté sans bataille : le héros survit avec son armée intacte, aucun
  // bilan (départ délibéré), le gardien reste sur la carte.
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat))
    .toBeNull();
  await expect(page.getByTestId('combat-result')).toHaveCount(0);
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.id).toBe('hero-player-1');
  const armyAfter = state.heroes[0]?.army.reduce((n, s) => n + s.count, 0) ?? 0;
  expect(armyAfter).toBe(armyBefore); // aucune perte
  expect(state.map?.objects.some((o) => o.id === 'guard-camp')).toBe(true); // gardien intact
  await expect(page.getByTestId('end-turn')).toBeVisible();

  expect(errors).toEqual([]);
});

test('bilan de fin de combat : morts/survivants + gains XP, « Continuer » ferme (retour de jeu 2026-07)', async ({
  page,
}) => {
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

  // Auto-Battle depuis le pré-combat ⇒ combat fouillé résolu ⇒ bilan affiché.
  await passPreBattle(page, 'auto');
  await expect(page.getByTestId('combat-result')).toBeVisible();
  await expect(page.getByTestId('combat-result-title')).toHaveText('Victoire');
  // Détail des deux armées + gains (le gardien anéanti donne de l'XP).
  await expect(page.getByTestId('combat-result-player')).toBeVisible();
  await expect(page.getByTestId('combat-result-enemy')).toBeVisible();
  await expect(page.getByTestId('combat-result-gains')).toBeVisible();

  // « Continuer » ferme le bilan et rend la main à la carte.
  await page.getByTestId('combat-result-continue').click();
  await expect(page.getByTestId('combat-result')).toHaveCount(0);
  await expect(page.getByTestId('end-turn')).toBeVisible();

  expect(errors).toEqual([]);
});

test("l'arène /#arena ouvre un combat immédiat et se résout en auto", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?seed=42#arena');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  await passPreBattle(page); // écran pré-combat (Lot 1) même en arène
  await expect(page.getByTestId('combat-round')).toHaveText('Manche 1');
  await expect(page.getByTestId('damage-preview')).toBeVisible();
  const stacks = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().combat?.stacks.length,
  );
  expect(stacks).toBe(4); // armées miroir : 2 piles par camp

  // Lot M4 : « Auto ▶▶ » joue désormais round par round — ×4 pour accélérer.
  await page.getByTestId('combat-speed').getByText('×4').click();
  await page.getByTestId('combat-auto').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat), { timeout: 20000 })
    .toBeNull();
  await expect(page.getByTestId('end-turn')).toBeVisible();

  expect(errors).toEqual([]);
});

test('auto-combat : bascule round par round et reprise de main (doc 08 §2.4, lot M4)', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('./?seed=42#arena');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  await passPreBattle(page);

  await expect(page.getByTestId('combat-round')).toHaveText('Manche 1');
  const auto = page.getByTestId('combat-auto');
  await auto.click(); // bascule ON : le libellé devient « Reprendre la main »
  await expect(auto).toHaveText('Reprendre la main');
  await expect(page.getByTestId('combat-wait')).toBeDisabled();

  // Le combat CONTINUE round par round (pas de résolution instantanée).
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat?.round), {
      timeout: 15000,
    })
    .toBeGreaterThan(1);

  // Reprise de main : la boucle s'arrête, les actions se réactivent, le combat est toujours là.
  await auto.click();
  await expect(auto).toHaveText('Auto ▶▶');
  await expect(page.getByTestId('combat-wait')).toBeEnabled();
  const combat = await page.evaluate(() => window.__HEROES_TEST__!.getState().combat);
  expect(combat).not.toBeNull();

  expect(errors).toEqual([]);
});

test('E2 : un bouton de combat désactivé affiche sa raison (sous-libellé + title)', { tag: '@core' }, async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?seed=42#arena');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  await passPreBattle(page); // arène : aucun héros lié ⇒ actions de héros désactivées
  const heroAttack = page.getByTestId('combat-hero-attack');
  await expect(heroAttack).toBeDisabled();
  // Lot 3b (E2) : plus de « grisé sans explication » — sous-libellé + title.
  await expect(heroAttack.locator('.combat-btn-reason')).toBeVisible();
  await expect(heroAttack).toHaveAttribute('title', /.+/);
  expect(errors).toEqual([]);
});

test('E1 : sur mobile, la barre de combat est compacte (secondaires derrière « ⋯ »)', { tag: '@core' }, async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('./?seed=42#arena');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  await passPreBattle(page); // écran pré-combat → plateau

  await expect(page.getByTestId('combat-wait')).toBeVisible();
  // Lot 1a (E1) : la barre tient sur ~2 rangées ⇒ < 30 % du viewport 640 (avant :
  // ~5 rangées ≈ la moitié basse de l'écran, le plateau était réduit à un bandeau).
  const box = await page.locator('.combat-actions').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThan(640 * 0.3);
  // Les secondaires (Se rendre…) sont repliées derrière « ⋯ » ; le tiroir les révèle.
  const more = page.getByTestId('combat-more');
  await expect(more).toBeVisible();
  await expect(page.getByTestId('combat-surrender')).toBeHidden();
  await more.click();
  await expect(page.getByTestId('combat-surrender')).toBeVisible();

  expect(errors).toEqual([]);
});

test("combat : la file d'ordre s'affiche (actif en tête) et la fiche de pile s'ouvre au tap", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('./?seed=42#arena');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  await passPreBattle(page); // écran pré-combat (Lot 1) → plateau

  // Lot M1 (C13) : file d'ordre de passage — la 1ʳᵉ vignette est la pile active.
  const order = page.getByTestId('combat-order');
  await expect(order).toBeVisible();
  const chips = order.locator('button.stack-chip');
  await expect(chips.first()).toHaveClass(/stack-chip-active/);
  const activeId = await page.evaluate(() => window.__HEROES_TEST__!.getState().combat?.activeStackId);
  const chipLabel = await chips.first().getAttribute('aria-label');
  const activeStack = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().combat?.stacks.find((s) => s.id === window.__HEROES_TEST__!.getState().combat?.activeStackId),
  );
  expect(activeId).toBeTruthy();
  expect(chipLabel).toContain(String(activeStack!.count));

  // Lot M1 (C14) : tap sur une vignette ⇒ fiche de pile avec stats, fermeture ×.
  await chips.first().click();
  const sheet = page.getByTestId('stack-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Attaque');
  await expect(sheet).toContainText('Dégâts');
  await page.getByTestId('stack-sheet-close').click();
  await expect(sheet).toBeHidden();

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

test('arène : fluidité sous throttling CPU ×4 (doc 10 §6)', { tag: '@perf' }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'mesure unique, desktop');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('./?seed=42#arena');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  await passPreBattle(page); // dismiss l'écran pré-combat pour mesurer la scène de combat

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

test('carte d’aventure : fluidité sous throttling CPU ×4 (doc 01 §5 critère 3)', { tag: '@perf' }, async ({ page }, testInfo) => {
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

test('menu : Nouvelle partie démarre, Continuer grisé sans sauvegarde', { tag: ['@mobile', '@core'] }, async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./'); // sans ?seed : le menu s'affiche (doc 08 §2.5)
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  await expect(page.getByTestId('menu-new-game')).toBeVisible();
  await expect(page.getByTestId('menu-continue')).toBeDisabled(); // IndexedDB vierge
  // Le bouton « En ligne » (Live 7.3) est masqué sans VITE_BACKEND_URL : le smoke
  // tourne hors-ligne, le réseau n'est jamais touché (flag de config).
  await expect(page.getByTestId('menu-online')).toHaveCount(0);

  // « Nouvelle partie » ouvre désormais l'écran de configuration ; « Lancer »
  // (réglages par défaut) démarre la partie sur une carte générée.
  await page.getByTestId('menu-new-game').click();
  await expect(page.getByTestId('newgame-screen')).toBeVisible();
  await page.getByTestId('newgame-start').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.started).toBe(true);

  expect(errors).toEqual([]);
});

test('nouvelle partie : configuration 3 joueurs + taille + ressources génèrent la partie', { tag: '@core' }, async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  await page.getByTestId('menu-new-game').click();
  await expect(page.getByTestId('newgame-screen')).toBeVisible();

  // 3 joueurs : un 3ᵉ siège apparaît, réglé en IA ; carte grande, ressources riches.
  await page.getByTestId('newgame-players-3').click();
  await expect(page.getByTestId('newgame-seat-2')).toBeVisible();
  await page.getByTestId('newgame-seat-2-ai').click();
  await page.getByTestId('newgame-size-large').click();
  await page.getByTestId('newgame-resources-riche').click();
  // Quantités par catégorie (« Nouvelle partie ») : plus de gardiens, aucune mine.
  await page.getByTestId('newgame-guardians-abundant').click();
  await page.getByTestId('newgame-mines-none').click();

  // Couleur de joueur (lot 6.4) : le joueur 1 choisit le vert (0x27ae60).
  await page.getByTestId('newgame-seat-0-color-27ae60').click();

  // Alliances (lot équipes) : joueurs 1 et 2 dans l'équipe A ; le 3ᵉ sans alliance.
  await page.getByTestId('newgame-seat-0-team-1').click();
  await page.getByTestId('newgame-seat-1-team-1').click();

  await page.getByTestId('newgame-start').click();

  // Overlay de chargement affiché puis partie démarrée sur une grande carte générée
  // (128², exerce le chunking + culling au viewport de `Tilemap`) — extension carte.
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.started).toBe(true);
  expect(state.players).toHaveLength(3);
  expect(state.players[0]?.controller).toBe('human');
  expect(state.map?.id).toBe('random');
  expect(state.map?.width).toBe(128);
  // Un héros par joueur, chacun à sa position de départ (3 positions générées).
  expect(state.heroes).toHaveLength(3);
  // La couleur choisie est appliquée au joueur 1 (présentation client).
  const colors = await page.evaluate(() => window.__HEROES_TEST__!.getPlayerColors());
  expect(colors['player-1']).toBe(0x27ae60);
  // Les équipes sont portées par l'état moteur : p1 & p2 alliés (1), p3 seul (0).
  expect(state.players.map((p) => p.team)).toEqual([1, 1, 0]);

  expect(errors).toEqual([]);
});

test('événements temporaires : actif « Événement » et passé « Archive », tous deux jouables (doc 13 N4d)', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // La section Événements liste l'événement en fenêtre (badge « Événement ») et
  // l'événement expiré (badge « Archive ») — statut via l'horloge CLIENT.
  await expect(page.getByTestId('menu-events')).toBeVisible();
  await expect(page.getByTestId('menu-event-badge-event-revenants')).toHaveText('Événement');
  await expect(page.getByTestId('menu-event-badge-event-curee')).toHaveText('Archive');

  // Les scénarios permanents ne portent PAS de badge d'événement.
  await expect(page.getByTestId('menu-event-badge-survival')).toHaveCount(0);

  // L'archive reste jouable : la fiche de scénario (N-BRIEFING) s'ouvre, puis
  // « Commencer » lance la partie.
  await page.getByTestId('menu-scenario-event-curee').click();
  await expect(page.getByTestId('briefing-panel')).toBeVisible();
  await page.getByTestId('briefing-start').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.started).toBe(true);
  expect(state.heroes[0]?.factionId).toBe('arcane-hunters');

  expect(errors).toEqual([]);
});

test('escarmouche vs IA : config + difficulté génèrent une partie 1v1 (Alpha 4.14)', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('./'); // menu (sans ?seed)
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Ouvre l'écran d'escarmouche depuis le menu, choisit « Difficile », lance.
  await page.getByTestId('menu-skirmish').click();
  await expect(page.getByTestId('skirmish-screen')).toBeVisible();
  await page.getByTestId('skirmish-difficulty-difficile').click();
  await page.getByTestId('skirmish-start').click();

  // La partie démarre sur la carte : 1 humain + 1 IA, chacun sa ville.
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.started).toBe(true);
  expect(state.players.map((p) => p.controller)).toEqual(['human', 'ai']);
  expect(state.scenario).not.toBeNull();
  expect(state.towns.find((t) => t.id === 'town-player-1')?.ownerPlayerId).toBe('player-1');
  expect(state.towns.find((t) => t.id === 'town-player-2')?.ownerPlayerId).toBe('player-2');

  // Difficulté « Difficile » : l'armée IA est mise à l'échelle (×1,6 = 48 vs 30).
  const humanArmy = state.heroes.find((h) => h.playerId === 'player-1')?.army[0]?.count;
  const aiArmy = state.heroes.find((h) => h.playerId === 'player-2')?.army[0]?.count;
  expect(humanArmy).toBe(30);
  expect(aiArmy).toBe(48);

  // La boucle IA joue son tour sans erreur à la fin de tour du joueur.
  await endTurn(page);
  await expect(page.getByTestId('calendar')).toContainText('2');

  expect(errors).toEqual([]);
});

test('carte aléatoire : l’escarmouche démarre sur une carte générée (doc 09, Live 6.2)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Écran d'escarmouche → choisir « Aléatoire » → lancer.
  await page.getByTestId('menu-skirmish').click();
  await expect(page.getByTestId('skirmish-screen')).toBeVisible();
  await page.getByTestId('skirmish-map-random').click();
  await page.getByTestId('skirmish-start').click();

  // La partie démarre sur une carte GÉNÉRÉE (id 'random'), validée en mémoire par
  // le même loadMap que les cartes du dépôt.
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.started).toBe(true);
  expect(state.map?.id).toBe('random');
  expect(state.map?.width ?? 0).toBeGreaterThanOrEqual(12);

  expect(errors).toEqual([]);
});

test('quêtes journalières : le mode libre génère des contrats déterministes (doc 13 N4c)', async ({ page }) => {
  const errors = await openMenu(page);

  // Le mode libre (escarmouche) génère des quêtes journalières depuis les gabarits,
  // déterministes (seed fixe du hook de test).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.startSkirmish({ humanFactionId: 'haven', aiFactionId: 'necropolis', difficulty: 'normal' }),
  );
  await expect(page.getByTestId('end-turn')).toBeVisible();

  const questIds = async (): Promise<string[]> =>
    page.evaluate(() => window.__HEROES_TEST__!.getState().quests?.quests.map((q) => q.def.id) ?? []);
  const first = await questIds();
  expect(first.length).toBeGreaterThan(0);
  expect(first.every((id) => id.startsWith('daily-'))).toBe(true);

  // Le journal (tiroir héros) affiche les contrats avec le badge « Journalier ».
  // Desktop : la colonne héros est persistante (pas de bascule) ; mobile : on ouvre.
  if (await page.getByTestId('hero-drawer-toggle').isVisible())
    await page.getByTestId('hero-drawer-toggle').click();
  await expect(page.getByTestId(`quest-entry-${first[0]}`)).toBeVisible();
  await expect(page.getByTestId(`quest-kind-${first[0]}`)).toBeVisible();

  // Déterminisme : même seed ⇒ mêmes contrats (page rechargée pour repartir à neuf).
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);
  await page.evaluate(() =>
    window.__HEROES_TEST__!.startSkirmish({ humanFactionId: 'haven', aiFactionId: 'necropolis', difficulty: 'normal' }),
  );
  await expect(page.getByTestId('end-turn')).toBeVisible();
  expect(await questIds()).toEqual(first);

  expect(errors).toEqual([]);
});

test('N-DAILYREFRESH : la fin de tour humain ajoute les contrats du nouveau jour', async ({
  page,
}) => {
  const errors = await openMenu(page);

  await page.evaluate(() =>
    window.__HEROES_TEST__!.startSkirmish({ humanFactionId: 'haven', aiFactionId: 'necropolis', difficulty: 'normal' }),
  );
  await expect(page.getByTestId('end-turn')).toBeVisible();

  const questIds = async (): Promise<string[]> =>
    page.evaluate(() => window.__HEROES_TEST__!.getState().quests?.quests.map((q) => q.def.id) ?? []);

  // Jour 1 : contrats embarqués (ids `daily-<tpl>`, sans préfixe de jour).
  const day1 = await questIds();
  expect(day1.length).toBeGreaterThan(0);
  expect(day1.some((id) => id.startsWith('daily-d2-'))).toBe(false);

  // Fin de tour humain ⇒ le jour avance et `AddQuests` ajoute les contrats du jour 2.
  await endTurn(page);
  await expect(page.getByTestId('calendar')).toHaveText('Mois 1 · Semaine 1 · Jour 2');
  await expect
    .poll(async () => (await questIds()).some((id) => id.startsWith('daily-d2-')))
    .toBe(true);
  // Les contrats du jour 1 restent présents (ajout, pas remplacement).
  expect((await questIds()).length).toBeGreaterThan(day1.length);

  expect(errors).toEqual([]);
});

test('hot-seat : deux humains locaux alternent avec l’overlay de passage (Alpha 4.15)', { tag: '@core' }, async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Escarmouche en mode « Joueur 2 » (hot-seat) : la difficulté disparaît.
  await page.getByTestId('menu-skirmish').click();
  await page.getByTestId('skirmish-opponent-human').click();
  await expect(page.getByTestId('skirmish-difficulty-normal')).toHaveCount(0);
  await page.getByTestId('skirmish-start').click();

  // Tour du joueur 1 : overlay de passage d'abord, plateau du J1 ensuite.
  await expect(page.getByTestId('handoff-overlay')).toBeVisible();
  // Lot 7a (I9) : l'overlay porte l'identité du siège — blason de faction (motif
  // = second canal non chromatique) + pastille de couleur du joueur.
  await expect(page.getByTestId('handoff-overlay').getByTestId('faction-badge')).toBeVisible();
  await expect(page.getByTestId('handoff-overlay').locator('.handoff-seat-swatch')).toBeVisible();
  await page.getByTestId('handoff-continue').click();
  await expect(page.getByTestId('handoff-overlay')).toHaveCount(0);
  let state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.players.map((p) => p.controller)).toEqual(['human', 'human']);
  expect(state.players[state.currentPlayer]?.id).toBe('player-1');
  await expect(page.getByTestId('town-open-town-player-1')).toBeVisible();

  // Fin de tour du J1 ⇒ tour du J2 : l'overlay de passage reparaît, puis le
  // plateau suit le joueur 2 (sa ville, pas celle du J1).
  await endTurn(page);
  await expect(page.getByTestId('handoff-overlay')).toBeVisible();
  await expect(page.getByTestId('handoff-player')).toContainText('2');
  await page.getByTestId('handoff-continue').click();
  state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.players[state.currentPlayer]?.id).toBe('player-2');
  await expect(page.getByTestId('town-open-town-player-2')).toBeVisible();
  await expect(page.getByTestId('town-open-town-player-1')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('H-VS-H : marcher sur un héros ennemi ⇒ combat ⇒ le perdant meurt (doc 02 §1.5/§5)', async ({
  page,
}) => {
  const errors = await openMenu(page);

  // Escarmouche HOT-SEAT (2 humains) : le héros du joueur 2 reste immobile (pas
  // d'IA), on peut donc rapprocher le héros du joueur 1 de façon déterministe.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.startSkirmish({
      humanFactionId: 'haven',
      aiFactionId: 'necropolis',
      difficulty: 'normal',
      opponent: 'human',
    }),
  );
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Rapproche le héros du joueur 1 du héros du joueur 2 (via le hook : chemin
  // moteur, on s'arrête ADJACENT — jamais sur la tuile ennemie pendant l'approche).
  await page.evaluate(async () => {
    const T = window.__HEROES_TEST__!;
    const A = 'hero-player-1';
    const B = 'hero-player-2';
    const st = () => T.getState();
    const posOf = (id: string) => st().heroes.find((h) => h.id === id)!.pos;
    const adj = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
    const bPos = posOf(B);
    for (let i = 0; i < 30; i++) {
      if (st().combat) break;
      const pt = st().pendingTreasure;
      if (pt) await T.dispatch({ type: 'ResolveTreasure', heroId: pt.heroId, choice: 'gold' });
      if (adj(posOf(A), bPos)) break;
      const path = T.findPath(A, bPos.x, bPos.y);
      if (!path || path.length <= 1) break;
      await T.dispatch({ type: 'MoveHero', heroId: A, path: path.slice(0, -1) });
      const pt2 = st().pendingTreasure;
      if (pt2) await T.dispatch({ type: 'ResolveTreasure', heroId: pt2.heroId, choice: 'gold' });
      if (adj(posOf(A), bPos) || st().combat) continue;
      await T.dispatch({ type: 'EndTurn', playerId: 'player-1' });
      await T.dispatch({ type: 'EndTurn', playerId: 'player-2' });
    }
  });

  // Le héros ADVERSE, désormais adjacent (donc dans le rayon de vision), doit
  // avoir un jeton RENDU sur la carte — sinon on ne pourrait pas le viser pour
  // déclencher le combat (régression : le rendu ne dessinait que les héros du
  // joueur humain).
  const rendered = await page.evaluate(() => window.__HEROES_TEST__!.renderedHeroIds());
  expect(rendered).toContain('hero-player-2');

  // Attaque : marcher sur la tuile du héros ennemi ⇒ combat avec les DEUX hero ids.
  await page.evaluate(() => {
    const T = window.__HEROES_TEST__!;
    const b = T.getState().heroes.find((h) => h.id === 'hero-player-2')!.pos;
    return T.dispatch({ type: 'MoveHero', heroId: 'hero-player-1', path: [{ x: b.x, y: b.y }] });
  });
  const combat = await page.evaluate(() => window.__HEROES_TEST__!.getState().combat);
  expect(combat?.attackerHeroId).toBe('hero-player-1');
  expect(combat?.defenderHeroId).toBe('hero-player-2'); // enfin non-null (H-VS-H)

  // Auto-Battle : un héros meurt (le perdant retiré) — de 2 héros à 1.
  await passPreBattle(page, 'auto');
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat), { timeout: 20000 })
    .toBeNull();
  const heroesLeft = await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes.length);
  expect(heroesLeft).toBe(1);

  expect(errors).toEqual([]);
});

test('multi-joueurs : indicateur de tour + progression IA non bloquante', async ({ page }) => {
  const errors = await openMenu(page);

  await page.evaluate(() =>
    window.__HEROES_TEST__!.startSkirmish({
      humanFactionId: 'haven',
      aiFactionId: 'necropolis',
      difficulty: 'normal',
    }),
  );
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Tour de l'humain (partie à 2 joueurs) : l'indicateur nomme le joueur actif.
  await expect(page.getByTestId('turn-indicator')).toBeVisible();
  await expect(page.getByTestId('active-player-label')).toContainText('1');

  // Fin de tour humain ⇒ l'IA joue sans figer l'UI : `dispatch` attend la boucle
  // IA (qui cède la main au navigateur entre chaque tour), et pendant ce relais
  // `store.aiTurn` porte la progression. On l'observe DE MANIÈRE DÉTERMINISTE via
  // le store (pas de capture DOM chronométrée, non fiable pour un état transitoire) :
  // au moins un état de progression IA est vu, avec un total ≥ 1.
  const sawAi = await page.evaluate(async () => {
    let seen: { seat: number; done: number; total: number } | null = null;
    const unsub = window.__HEROES_TEST__!.subscribe(() => {
      const ai = window.__HEROES_TEST__!.getAiTurn();
      if (ai) seen = ai;
    });
    try {
      await window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' });
    } finally {
      unsub();
    }
    return seen as { seat: number; done: number; total: number } | null;
  });
  expect(sawAi).not.toBeNull();
  expect(sawAi!.total).toBeGreaterThanOrEqual(1);

  // Après le relais IA : la main revient au joueur 1, l'indicateur de progression a
  // disparu, et l'indicateur nomme de nouveau le joueur actif.
  const back = await page.evaluate(() => {
    const s = window.__HEROES_TEST__!.getState();
    return { id: s.players[s.currentPlayer]?.id, aiTurn: window.__HEROES_TEST__!.getAiTurn() };
  });
  expect(back.id).toBe('player-1');
  expect(back.aiTurn).toBeNull();
  await expect(page.getByTestId('ai-progress')).toHaveCount(0);
  await expect(page.getByTestId('active-player-label')).toContainText('1');

  expect(errors).toEqual([]);
});

test('sort d’aventure : Ville-portail téléporte le héros vers sa ville (Alpha 4.16)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Éloigne le héros de sa ville de départ (start-town en (2,4)).
  await moveHeroToGold(page);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  const before = await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]?.mana ?? 0);
  expect(before).toBeGreaterThanOrEqual(16);

  // Ouvre le tiroir héros et lance Ville-portail (le héros connaît tous les
  // sorts de cercle ≤ 3).
  // Desktop : la colonne héros est persistante (pas de bascule) ; mobile : on ouvre.
  if (await page.getByTestId('hero-drawer-toggle').isVisible())
    await page.getByTestId('hero-drawer-toggle').click();
  await page.getByTestId('adventure-spell-ville-portail').click();

  // Téléporté vers la ville possédée la plus proche (start-town), mana décomptée.
  // (Les sorts d'AVENTURE déduisent le coût brut — la réduction Arcaniste ne joue
  // qu'en COMBAT, `effectiveManaCost` ; cf. hero/index.ts.)
  await expect.poll(() => heroPos(page)).toEqual({ x: 2, y: 4 });
  const after = await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]?.mana ?? 0);
  expect(after).toBe(before - 16);

  expect(errors).toEqual([]);
});

test('poupée d’équipement : l’artefact de départ occupe son slot typé (UXD-5b)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Ouvre le tiroir héros (desktop : colonne persistante ; mobile : on bascule).
  if (await page.getByTestId('hero-drawer-toggle').isVisible())
    await page.getByTestId('hero-drawer-toggle').click();

  // Le héros de départ porte « Lame aiguisée » (slot weapon) : elle occupe
  // l'emplacement typé Arme, pas un slot générique.
  const weapon = page.getByTestId('hero-slot-weapon');
  await expect(weapon).toHaveClass(/filled/);
  await expect(weapon).toContainText('Lame aiguisée');

  // A5 (jamais la couleur seule) : un emplacement typé vide affiche son libellé.
  const head = page.getByTestId('hero-slot-head');
  await expect(head).toHaveClass(/empty/);
  await expect(head).toContainText('Tête');

  expect(errors).toEqual([]);
});

test('éditeur de carte : peindre + départ ⇒ export valide (Alpha 4.18)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Ouverture depuis le menu.
  await page.getByTestId('menu-editor').click();
  await expect(page.getByTestId('map-editor')).toBeVisible();

  // Peindre une cellule en eau.
  await page.getByTestId('editor-tool-water').click();
  await page.getByTestId('editor-cell-1-1').click();

  // Export sans position de départ ⇒ refusé (validation).
  await page.getByTestId('editor-export').click();
  await expect(page.getByTestId('editor-error')).toBeVisible();

  // Poser un départ puis exporter ⇒ carte valide (`mapFileSchema`).
  await page.getByTestId('editor-tool-start').click();
  await page.getByTestId('editor-cell-0-0').click();
  await page.getByTestId('editor-export').click();
  await expect(page.getByTestId('editor-valid')).toBeVisible();

  // Retour menu.
  await page.getByTestId('editor-back').click();
  await expect(page.getByTestId('menu-new-game')).toBeVisible();

  expect(errors).toEqual([]);
});

test('télémétrie : opt-in enregistre tours + combats auto, en local (Alpha 4.19)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Activer la télémétrie (opt-in) depuis les options.
  await page.getByTestId('options-open').click();
  await page.getByTestId('options-telemetry-on').click();
  await expect(page.getByTestId('telemetry-stats')).toBeVisible();
  await page.getByTestId('options-close').click();

  // Combat de gardien résolu via le bouton « Auto » (compte comme abandon manuel).
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
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();
  // Lot M4 : l'auto joue round par round — ×4, et marge de poll élargie.
  await page.getByTestId('combat-speed').getByText('×4').click();
  await page.getByTestId('combat-auto').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat), { timeout: 20000 })
    .toBeNull();

  // Fin de tour ⇒ la durée du tour est enregistrée.
  await endTurn(page);
  await expect(page.getByTestId('calendar')).toContainText('2');

  // Rouvrir les options : stats non nulles (1 tour, 1 combat auto).
  await page.getByTestId('options-open').click();
  await expect(page.getByTestId('telemetry-turns')).toContainText('Tours : 1');
  await expect(page.getByTestId('telemetry-combats')).toContainText('Combats : 1');

  // Export local + réinitialisation.
  await page.getByTestId('telemetry-export').click();
  await page.getByTestId('telemetry-reset').click();
  await expect(page.getByTestId('telemetry-turns')).toContainText('Tours : 0');

  expect(errors).toEqual([]);
});

test('autosave à la fin de tour puis « Continuer » depuis le menu', { tag: '@mobile' }, async ({ page }) => {
  const errors = await openGame(page);

  await moveHeroToGold(page);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  await endTurn(page); // ⇒ autosave (doc 07 §4)
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

test('sauvegarde dont la main est à une IA : le chargement relance la boucle IA (revue 2026-07 B3)', async ({ page }) => {
  const errors = await openMenu(page);
  // Escarmouche vs IA (seed fixe du hook) : il faut un siège IA à qui donner la main.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.startSkirmish({ humanFactionId: 'haven', aiFactionId: 'necropolis', difficulty: 'normal' }),
  );
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Forge puis importe une sauvegarde « prise en plein relais IA »
  // (currentPlayer = siège IA) — le cas qui figeait la partie à jamais.
  expect(await page.evaluate(() => window.__HEROES_TEST__!.importAiTurnSave())).toBe(true);

  // La boucle IA reprend d'elle-même et rend la main au joueur humain.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = window.__HEROES_TEST__!.getState();
          return g.players[g.currentPlayer]?.controller ?? null;
        }),
      { timeout: 20000 },
    )
    .toBe('human');

  expect(errors).toEqual([]);
});

test('options : bascule de langue FR → EN appliquée à l’UI', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);

  // Calendrier persistant (M-CALWIDGET, doc 02 §2.3) : le chip affiche mois +
  // semaine + jour, localisé dans les deux langues (jour 1 ⇒ mois 1).
  await expect(page.getByTestId('calendar')).toHaveText('Mois 1 · Semaine 1 · Jour 1');
  // Aucune semaine spéciale en début de partie ⇒ pas de badge (le badge exige
  // un passage de semaine + un tirage RNG ≠ normal, non forçable ici).
  await expect(page.getByTestId('week-event')).toHaveCount(0);
  await page.getByTestId('options-open').click();
  await page.getByTestId('options-locale-en').click();
  await page.getByTestId('options-close').click();
  await expect(page.getByTestId('calendar')).toHaveText('Month 1 · Week 1 · Day 1');

  expect(errors).toEqual([]);
});

test('siège : marcher sur une ville neutre défendue ⇒ combat ⇒ capture (Alpha 4.13)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // La carte porte une ville neutre défendue (`neutral-keep` en (5,6)) — non
  // possédée, garnison non vide (doc 02 §4.1).
  const before = await page.evaluate(() =>
    window.__HEROES_TEST__!.getState().towns.find((t) => t.id === 'neutral-keep'),
  );
  expect(before?.ownerPlayerId).toBeNull();
  expect((before?.garrison.length ?? 0) > 0).toBe(true);

  // Amène le héros au contact (5,2), puis tap-tap sur la ville en (6,2) : le héros
  // y entre et déclenche le siège — le combat prend la main (routeur sur `combat`).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [
        { x: 4, y: 2 },
        { x: 5, y: 2 },
      ],
    }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 5, y: 2 });

  await tapTapTile(page, 6, 2);
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat?.townId ?? null))
    .toBe('neutral-keep');

  // Auto-résolution : l'armée de départ écrase la garnison ⇒ capture.
  // Lot M4 : l'auto joue round par round — ×4, et marge de poll élargie.
  await passPreBattle(page);
  await page.getByTestId('combat-speed').getByText('×4').click();
  await page.getByTestId('combat-auto').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat), { timeout: 20000 })
    .toBeNull();
  const after = await page.evaluate(() =>
    window.__HEROES_TEST__!.getState().towns.find((t) => t.id === 'neutral-keep'),
  );
  expect(after?.ownerPlayerId).toBe('player-1');
  expect(after?.garrison).toEqual([]);

  expect(errors).toEqual([]);
});

test('caravane : posséder 2 villes ⇒ expédier une pile ⇒ arrivée en garnison (T-CARAVAN, doc 02 §4.1)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // 1) Capturer la ville neutre `neutral-keep` (6,2) pour posséder 2 villes.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [
        { x: 4, y: 2 },
        { x: 5, y: 2 },
      ],
    }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 5, y: 2 });
  await tapTapTile(page, 6, 2);
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat?.townId ?? null))
    .toBe('neutral-keep');
  await passPreBattle(page);
  await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'AutoCombat' }));
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat), { timeout: 20000 })
    .toBeNull();
  expect(
    await page.evaluate(
      () => window.__HEROES_TEST__!.getState().towns.find((t) => t.id === 'neutral-keep')?.ownerPlayerId,
    ),
  ).toBe('player-1');
  await dismissCombatResult(page); // le bilan de siège recouvre la carte

  // 2) Placer une pile dans la garnison de `neutral-keep` (le héros y est).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'GarrisonTransfer',
      townId: 'neutral-keep',
      heroId: 'hero-player-1',
      from: 'hero',
      slot: 0,
    }),
  );
  const sentUnit = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().towns.find((t) => t.id === 'neutral-keep')?.garrison[0]?.unitId,
  );
  expect(sentUnit).toBeTruthy();

  // 3) Expédier une caravane depuis `neutral-keep` vers `start-town` via l'UI.
  await page.getByTestId('town-open-neutral-keep').click();
  await page.getByTestId('town-tab-garrison').click();
  await expect(page.getByTestId('town-caravans')).toBeVisible();
  // Une seule autre ville possédée (start-town) ⇒ destination par défaut.
  await page.getByTestId('town-caravan-send-0').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().caravans.length))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => window.__HEROES_TEST__!.getState().caravans[0]?.toTownId),
  ).toBe('start-town');
  await page.getByTestId('town-close').click();

  // 4) Avancer les jours : la caravane arrive et dépose sa pile en garnison de start-town.
  for (let i = 0; i < 12; i++) {
    const left = await page.evaluate(() => window.__HEROES_TEST__!.getState().caravans.length);
    if (left === 0) break;
    await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }));
  }
  const startGarrison = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().towns.find((t) => t.id === 'start-town')?.garrison ?? [],
  );
  expect(startGarrison.some((s) => s.unitId === sentUnit)).toBe(true);

  expect(errors).toEqual([]);
});

test('routeur : Échap ferme la modale ouverte (pile de modales, doc 08 §3, U2)', async ({ page }) => {
  const errors = await openGame(page);

  // En partie, la modale de ville se ferme à Échap via le handler GLOBAL du
  // routeur (U2) — remplace l'ancien `useEscapeKey` par écran.
  await page.getByTestId('town-open-start-town').click();
  await expect(page.getByTestId('town-close')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('town-close')).toHaveCount(0);

  // Idem pour les options en partie (même pile, même handler).
  await page.getByTestId('options-open').click();
  await expect(page.getByTestId('options-close')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('options-close')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('routeur : options du MENU passent par la pile de modales (doc 08 §3, U2)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./'); // menu (sans ?seed)
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Depuis le menu, le bouton options ouvre le panneau rendu par le SHELL via le
  // routeur (avant U2 : `useState` local à MenuScreen). Échap le referme.
  await page.getByTestId('menu-options').click();
  await expect(page.getByTestId('options-close')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('options-close')).toHaveCount(0);
  await expect(page.getByTestId('menu-new-game')).toBeVisible(); // toujours au menu

  expect(errors).toEqual([]);
});

test('accessibilité : les 3 crans de police changent la taille du texte (doc 08 §4)', { tag: '@mobile' }, async ({ page }) => {
  const errors = await openGame(page);

  const calendarFontSizePx = (): Promise<number> =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="calendar"]');
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    });

  // Attendre que le bandeau de tour (calendrier) soit rendu : sinon la mesure
  // « cran 1 » peut tomber à 0 (élément absent) → ratio Infinity (flake CI).
  await expect(page.getByTestId('calendar')).toBeVisible();
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
  await passPreBattle(page);
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

test('sauvegarde à version de forme incompatible : import rejeté proprement (lot 3.8)', async ({
  page,
}) => {
  const errors = await openGame(page);

  await moveHeroToGold(page);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  // Une sauvegarde d'une autre version de forme est refusée (garde doc 07 §4) —
  // aucun état malformé n'est adopté, la partie en cours reste intacte.
  const rejected = await page.evaluate(() =>
    window.__HEROES_TEST__!.importIncompatibleSave(),
  );
  expect(rejected).toBe(false);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 }); // partie inchangée

  expect(errors).toEqual([]);
});

test('ville : construire + croissance + recruter + transférer → armée du héros', { tag: ['@mobile', '@core'] }, async ({ page }) => {
  const errors = await openGame(page);

  // La ville de départ est chargée (doc 02 §4) : bouton [Ville] + écran.
  const town = await page.evaluate(() => window.__HEROES_TEST__!.getState().towns[0]);
  expect(town?.id).toBe('start-town');
  expect(town?.ownerPlayerId).toBe('player-1');
  await expect(page.getByTestId('town-open-start-town')).toBeVisible();
  await page.getByTestId('town-open-start-town').click();
  await expect(page.getByTestId('town-tab-build')).toBeVisible();
  // Motif de bannière de faction (doc 08 §4, accessibilité non chromatique) —
  // présent dans l'en-tête, dérivé de `town.factionId` (aucun nom en dur).
  // Scopé à l'écran de ville : depuis U4, la liste de villes du HUD porte aussi
  // un `faction-badge` par bouton (plusieurs villes possibles).
  await expect(page.locator('.town-screen').getByTestId('faction-badge')).toBeVisible();
  // Vue de ville peinte (doc 08 §2.2/§5, lot U5) : les bâtiments construits
  // apparaissent en vignettes (la ville de départ a townHall + habitation T1).
  await expect(page.getByTestId('town-view')).toBeVisible();
  expect(await page.getByTestId('town-view-building').count()).toBeGreaterThanOrEqual(2);
  // UX-TOWNVIEW : scène COMPOSÉE (plus une bande) — chaque emplacement est posé
  // en absolu à SA place (left/top en %), distincts entre bâtiments. On lit les
  // styles inline (le rendu peint n'est pas assertable au pixel).
  const slotPositions = await page
    .getByTestId('town-view-building')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).style.left + '|' + (el as HTMLElement).style.top));
  expect(slotPositions.every((p) => /%\|.*%/.test(p))).toBe(true); // left ET top en %
  expect(new Set(slotPositions).size).toBeGreaterThanOrEqual(2); // positions distinctes → composé
  // Statut exposé en DOM (2ᵉ canal a11y) : au moins un emplacement construit.
  expect(await page.locator('.town-view-building[data-status="constructed"]').count()).toBeGreaterThanOrEqual(1);
  // UX-TOWNVIEW 3 : indicateur d'upgrade — townHall (niveau 1, maxLevel 4, sans
  // prérequis) est construit ET encore améliorable ⇒ au moins un emplacement
  // porte data-upgradeable="true" + le badge chevron.
  expect(await page.locator('.town-view-building[data-upgradeable="true"]').count()).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('town-view-upgrade').first()).toBeVisible();
  // UX-TOWNVIEW 3 : infobulle bâtiment (parité tactile §1.1) — focus clavier d'un
  // emplacement ⇒ la ligne d'inspection montre son niveau (X/Y). Purement client.
  await page.getByTestId('town-view-building').first().focus();
  await expect(page.getByTestId('town-view-inspect')).toBeVisible();
  await expect(page.getByTestId('town-view-inspect-level')).toHaveText(/\d+\/\d+/);
  // Texte d'ambiance (doc 13 §3.5, lot N1) : les bâtiments communs (townHall/fort)
  // portent un lore affiché sous leur en-tête dans l'onglet Construire.
  await expect(page.locator('.town-building-lore').first()).toBeVisible();
  // Chantier du jour (doc 02 §4.2) : au 1er jour rien n'est bâti, le créneau du
  // jour est LIBRE — badge compact dans l'en-tête (refonte UX lot D).
  await expect(page.getByTestId('town-build-queue-state')).toHaveText(/Libre/);
  // Cohérence des onglets (refonte UX lot A) : la ville de départ n'a ni marché
  // ni guilde ⇒ ces onglets sont MASQUÉS (le moteur refuserait l'action sinon).
  await expect(page.getByTestId('town-tab-market')).toHaveCount(0);
  await expect(page.getByTestId('town-tab-guild')).toHaveCount(0);
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

  // Passage de semaine (jour 8) : l'habitation T1 génère son stock (croissance
  // 14 = growthPerWeek, sans bonus de fort). L'événement de calendrier de la
  // semaine (M-CALENDAR, doc 02 §2.3) module cette croissance par son
  // `growthFactor` — on lit l'événement effectivement tiré (RNG seedé) pour
  // asserter `floor(14 × facteur)`, robuste quelle que soit la semaine tirée.
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }));
  }
  const expectedGrowth = await page.evaluate(() => {
    const s = window.__HEROES_TEST__!.getState();
    const id = s.calendar.weekEventId;
    const factor = id ? (s.config?.calendar?.events.find((e) => e.id === id)?.growthFactor ?? 1) : 1;
    return Math.floor(14 * factor);
  });
  expect(
    await page.evaluate(() => window.__HEROES_TEST__!.getState().towns[0]?.stock['t1-recruit'] ?? 0),
  ).toBe(expectedGrowth);

  // Recruter des recrues dans la garnison (débit d'or) — au plus le stock
  // disponible (une « semaine de la peste » peut l'avoir réduit sous 10).
  const recruitCount = Math.min(10, expectedGrowth);
  await page.evaluate(
    (count) =>
      window.__HEROES_TEST__!.dispatch({
        type: 'RecruitUnits',
        townId: 'start-town',
        unitId: 't1-recruit',
        count,
      }),
    recruitCount,
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

  // L'armée du héros a augmenté du nombre recruté (fusion avec la pile existante).
  expect(await armyTotal()).toBe(before + recruitCount);

  expect(errors).toEqual([]);
});

test('E6 : le marché a des steppers tactiles (− / + / Max)', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Construire le marché (start-town n'en a pas) puis ouvrir son onglet.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'BuildStructure', townId: 'start-town', buildingId: 'market' }),
  );
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-market').click();
  const amount = page.getByTestId('market-amount');
  await expect(amount).toHaveValue('1');
  // Lot 4b (E6) : + / − ajustent la quantité (le total reçu suit déjà).
  await page.getByTestId('market-amount-inc').click();
  await expect(amount).toHaveValue('2');
  await page.getByTestId('market-amount-dec').click();
  await expect(amount).toHaveValue('1');
  // « Max » porte la quantité au stock de la ressource donnée (bois > 1 au départ).
  await page.getByTestId('market-amount-max').click();
  await expect.poll(() => amount.inputValue()).not.toBe('1');
  expect(errors).toEqual([]);
});

test('E5 : « tout transférer » garnison ↔ héros en un geste', { tag: '@core' }, async ({ page }) => {
  const errors = await openGame(page);
  // Héros de départ (2 piles) amené sur sa ville (2,4) ; garnison vide au départ.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'MoveHero', heroId: 'hero-player-1', path: [{ x: 2, y: 4 }] }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 2, y: 4 });
  const heroStacks = (): Promise<number> =>
    page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]!.army.length);
  const garrStacks = (): Promise<number> =>
    page.evaluate(() => window.__HEROES_TEST__!.getState().towns[0]!.garrison.length);
  expect(await heroStacks()).toBeGreaterThan(1);
  expect(await garrStacks()).toBe(0);

  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-garrison').click();
  // Lot 4a (E5) : « Tout vers la garnison » vide l'armée du héros en UN clic.
  await page.getByTestId('garrison-all-to-town').click();
  await expect.poll(heroStacks).toBe(0);
  await expect.poll(garrStacks).toBeGreaterThan(1);
  // Aller-retour : « Tout vers le héros » les ramène toutes.
  await page.getByTestId('garrison-all-to-hero').click();
  await expect.poll(heroStacks).toBeGreaterThan(1);
  await expect.poll(garrStacks).toBe(0);

  expect(errors).toEqual([]);
});

test('taverne : construire ⇒ onglet Taverne ⇒ recruter un héros nommé (M-TAVERN.2)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Avant construction : pas d'onglet Taverne (comme Marché/Guilde — le moteur
  // refuserait le recrutement, l'onglet serait un cul-de-sac).
  await page.getByTestId('town-open-start-town').click();
  await expect(page.getByTestId('town-tab-build')).toBeVisible();
  await expect(page.getByTestId('town-tab-tavern')).toHaveCount(0);

  // Construire la Taverne (500 or + 5 bois) via l'onglet Construire.
  await page.getByTestId('town-build-tavern').click();
  await expect(page.getByTestId('town-tab-tavern')).toBeVisible();

  // Or : 2000 − 500 = 1500 < coût de recrutement (2500) ⇒ bouton désactivé.
  await page.getByTestId('town-tab-tavern').click();
  const recruitBtn = page.getByTestId('town-tavern-recruit-garrick');
  await expect(recruitBtn).toBeVisible();
  await expect(recruitBtn).toBeDisabled();

  await test.step('guilde des voleurs (doc 18 E3) : comparatif visible, rangs seuls à 1 Taverne', async () => {
    await expect(page.getByTestId('town-thieves-guild')).toBeVisible();
    const row = page.getByTestId('town-thieves-row-player-1');
    await expect(row).toBeVisible();
    // 1 Taverne ⇒ précision graduée au rang : `#1` affiché, pas la valeur exacte.
    await expect(row).toContainText('#1');
  });

  // Deux fins de tour : +500 or/jour (hôtel de ville) ⇒ 2500 = coût exact.
  await page.getByTestId('town-close').click();
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() =>
      window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }),
    );
  }

  // Recruter Garrick (roster test-faction) à la Taverne.
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-tavern').click();
  await expect(page.getByTestId('town-tavern-status')).toContainText('1/8');
  await expect(recruitBtn).toBeEnabled();
  await recruitBtn.click();

  // Moteur : 2ᵉ héros créé sur la ville, armée vide, or décompté (2500 → 0).
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes).toHaveLength(2);
  const recruited = state.heroes.find((h) => h.id === 'hero-player-1-garrick');
  expect(recruited?.pos).toEqual({ x: 2, y: 4 });
  expect(recruited?.army).toEqual([]);
  expect(state.players[0]?.resources.gold).toBe(0);

  // UI : la carte passe en « Recruté », le compteur suit, et le héros recruté
  // devient le héros SÉLECTIONNÉ (bande de portraits à 2 entrées).
  await expect(page.getByTestId('town-tavern-recruited-garrick')).toBeVisible();
  await expect(page.getByTestId('town-tavern-status')).toContainText('2/8');
  await page.getByTestId('town-close').click();
  await expect(page.getByTestId('hero-select-hero-player-1-garrick')).toBeVisible();
  await expect(page.getByTestId('hero-select-hero-player-1-garrick')).toHaveClass(/selected/);

  // Tiroir héros : nom + spécialité du héros nommé résolus depuis les locales
  // de PAQUET (correctif M-TAVERN.2 — plus de clé brute à l'écran).
  if (await page.getByTestId('hero-drawer-toggle').isVisible())
    await page.getByTestId('hero-drawer-toggle').click();
  await expect(page.getByTestId('hero-name')).toHaveText('Garrick');
  await expect(page.getByTestId('hero-specialty')).toContainText('Videur de taverne');

  expect(errors).toEqual([]);
});

test('M-TAVERN.4 : pool exclusif — un héros recruté chez p1 est indisponible pour p2', async ({
  page,
}) => {
  const errors = await openMenu(page);

  // Hot-seat MÊME faction (haven vs haven) : les deux Tavernes offrent le même
  // roster ⇒ l'exclusivité inter-joueurs est observable.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.startSkirmish({
      humanFactionId: 'haven',
      aiFactionId: 'haven',
      difficulty: 'normal',
      opponent: 'human',
    }),
  );
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Via le hook : bâtir les 2 Tavernes, accumuler l'or (townHall +500/j), puis
  // p1 recrute un héros haven encore LIBRE (les héros nommés de DÉPART occupent
  // déjà des entrées de pool — H-NAMED.2). Le sujet est l'EXCLUSIVITÉ.
  const target = await page.evaluate(async () => {
    const T = window.__HEROES_TEST__!;
    const d = T.dispatch;
    await d({ type: 'BuildStructure', townId: 'town-player-1', buildingId: 'tavern' });
    await d({ type: 'EndTurn', playerId: 'player-1' });
    await d({ type: 'BuildStructure', townId: 'town-player-2', buildingId: 'tavern' });
    await d({ type: 'EndTurn', playerId: 'player-2' });
    for (let i = 0; i < 4; i++) {
      await d({ type: 'EndTurn', playerId: 'player-1' });
      await d({ type: 'EndTurn', playerId: 'player-2' });
    }
    const g = T.getState();
    const taken = new Set(g.heroes.map((h) => h.rosterId).filter(Boolean));
    // Héros haven du roster non encore en jeu (les départs nommés en ont pris).
    const free = Object.keys(g.heroRoster).find(
      (id) => g.heroRoster[id]!.factionId === 'haven' && !taken.has(id),
    )!;
    await d({ type: 'RecruitHero', townId: 'town-player-1', heroId: free, playerId: 'player-1' });
    return free;
  });
  const p1HasIt = await page.evaluate(
    (id) => window.__HEROES_TEST__!.getState().heroes.some((h) => h.playerId === 'player-1' && h.rosterId === id),
    target,
  );
  expect(p1HasIt).toBe(true);

  // p2 tente de recruter le MÊME héros (vivant chez p1) ⇒ REFUS moteur (exclusivité).
  const rejected = await page.evaluate(async (id) => {
    try {
      await window.__HEROES_TEST__!.dispatch({ type: 'RecruitHero', townId: 'town-player-2', heroId: id, playerId: 'player-2' });
      return false;
    } catch {
      return true;
    }
  }, target);
  expect(rejected).toBe(true);
  const p2HasIt = await page.evaluate(
    (id) => window.__HEROES_TEST__!.getState().heroes.some((h) => h.playerId === 'player-2' && h.rosterId === id),
    target,
  );
  expect(p2HasIt).toBe(false);

  expect(errors).toEqual([]);
});

test('H-NAMED.2 : choisir son héros de départ à l’Escarmouche (doc 02 §1.2)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Écran Escarmouche : faction humaine = haven, puis choix explicite du héros
  // « anton » dans le sélecteur de héros (H-NAMED.2).
  await page.getByTestId('menu-skirmish').click();
  await page.getByTestId('skirmish-human-faction').selectOption('haven');
  await page.getByTestId('skirmish-human-hero').selectOption('anton');
  await page.getByTestId('skirmish-start').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Le héros de départ du joueur porte l'identité du roster (rosterId + nom).
  const hero = await page.evaluate(() => {
    const g = window.__HEROES_TEST__!.getState();
    const h = g.heroes.find((x) => x.id === 'hero-player-1')!;
    return { rosterId: h.rosterId, name: h.name, rosterName: g.heroRoster['anton']?.name ?? null };
  });
  expect(hero.rosterId).toBe('anton');
  expect(hero.name).toBe(hero.rosterName); // nom résolu depuis le roster, pas générique

  expect(errors).toEqual([]);
});

test('H-COND : héros à spécialité conditionnelle jouable (Vhalen, doc 04 §5)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Escarmouche necropolis + choix du héros « vhalen » (spécialité conditionnelle
  // +att/déf aux vampires par 2 niveaux — H-COND). Vérifie l'intégration bout en
  // bout (roster → sélection → identité + effet conditionnel résolu sur le héros).
  await page.getByTestId('menu-skirmish').click();
  await page.getByTestId('skirmish-human-faction').selectOption('necropolis');
  await page.getByTestId('skirmish-human-hero').selectOption('vhalen');
  await page.getByTestId('skirmish-start').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();

  const hero = await page.evaluate(() => {
    const h = window.__HEROES_TEST__!.getState().heroes.find((x) => x.id === 'hero-player-1')!;
    return { rosterId: h.rosterId, specialtyId: h.specialtyId, cond: h.specialtyEffects[0]?.conditional ?? null };
  });
  expect(hero.rosterId).toBe('vhalen');
  expect(hero.specialtyId).toBe('chevalier-vampirique');
  // L'effet conditionnel est résolu sur le héros (ciblé sur les vampires, par 2 niveaux).
  expect(hero.cond?.unitId).toBe('t4-vampire');
  expect(hero.cond?.perLevels).toBe(2);

  expect(errors).toEqual([]);
});

test('H-COND-EXACT : le familier de départ d’Alwin rejoint son armée (doc 05 §7)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Escarmouche arcane-hunters + héros « alwin » (Doyen) : sa spécialité EXACTE
  // (`startingArmyBonus`) dote son armée d'un familier T2 gratuit à la création.
  await page.getByTestId('menu-skirmish').click();
  await page.getByTestId('skirmish-human-faction').selectOption('arcane-hunters');
  await page.getByTestId('skirmish-human-hero').selectOption('alwin');
  await page.getByTestId('skirmish-start').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();

  const hero = await page.evaluate(() => {
    const h = window.__HEROES_TEST__!.getState().heroes.find((x) => x.id === 'hero-player-1')!;
    return { rosterId: h.rosterId, specialtyId: h.specialtyId, army: h.army };
  });
  expect(hero.rosterId).toBe('alwin');
  expect(hero.specialtyId).toBe('doyen');
  // Le familier (t2-familier) est présent dans l'armée de départ (count ≥ 1).
  const familiar = hero.army.find((s) => s.unitId === 't2-familier');
  expect(familiar).toBeDefined();
  expect(familiar!.count).toBeGreaterThanOrEqual(1);

  expect(errors).toEqual([]);
});

test('taverne : le portrait DÉDIÉ d’un héros canon s’affiche (M-TAVERN.3)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Escarmouche haven : le roster porte des héros canon à portrait dédié stagé.
  // On choisit explicitement « aldric » comme héros de départ (H-NAMED.2) pour
  // qu'« anton » reste LIBRE au pool ⇒ recrutable à la Taverne (déterministe :
  // sinon le tirage aléatoire du héros de départ pourrait prendre anton).
  await page.getByTestId('menu-skirmish').click();
  await page.getByTestId('skirmish-human-faction').selectOption('haven');
  await page.getByTestId('skirmish-human-hero').selectOption('aldric');
  await page.getByTestId('skirmish-start').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Bâtir la Taverne de la ville humaine puis ouvrir l'onglet.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'BuildStructure',
      townId: 'town-player-1',
      buildingId: 'tavern',
    }),
  );
  await page.getByTestId('town-open-town-player-1').click();
  await page.getByTestId('town-tab-tavern').click();

  // La carte d'Anton affiche son PORTRAIT DÉDIÉ (assets/heroes/haven-anton.png,
  // via la clé `avatar` de sa fiche) — pas l'archétype générique de la faction.
  await expect(page.getByTestId('town-tavern-recruit-anton')).toBeVisible();
  const card = page.locator('.town-tavern-hero', {
    has: page.getByTestId('town-tavern-recruit-anton'),
  });
  const src = await card.locator('img.town-tavern-avatar').getAttribute('src');
  expect(src ?? '').toContain('haven-anton');

  expect(errors).toEqual([]);
});

test('héros nommé : nom + spécialité affichés, effets résolus (H-NAMED, lot 3)', async ({ page }) => {
  const errors = await openGame(page);

  // Le héros de départ porte un nom et une spécialité, résolus depuis les données
  // (config.newGame.startingHeroName / startingHeroSpecialty) — pas en dur au moteur.
  const hero = await page.evaluate(() => {
    const h = window.__HEROES_TEST__!.getState().heroes[0]!;
    return { name: h.name, specialtyId: h.specialtyId, effects: h.specialtyEffects };
  });
  expect(hero.name).toBe('hero.name.default');
  expect(hero.specialtyId).toBe('arcanist');
  // Effet déclaratif résolu (mêmes champs que Maison/compétences) : -20 % coût mana.
  expect(hero.effects).toEqual([{ manaCostReductionPct: 20 }]);

  // Tiroir héros : nom + spécialité résolus en clair (i18n FR).
  if (await page.getByTestId('hero-drawer-toggle').isVisible())
    await page.getByTestId('hero-drawer-toggle').click();
  await expect(page.getByTestId('hero-name')).toHaveText("Aldric l'Érudit");
  await expect(page.getByTestId('hero-specialty')).toContainText('Arcaniste');

  expect(errors).toEqual([]);
});

test('ville : en-tête revenu/croissance (C21) + « Tout recruter » (C19) (lot M7)', async ({
  page,
}) => {
  const errors = await openGame(page);

  await page.getByTestId('town-open-start-town').click();
  // En-tête de décision (C21) : revenu or/jour (hôtel de ville = +500) + croissance.
  await expect(page.getByTestId('town-income')).toContainText('500');
  await expect(page.getByTestId('town-growth')).toBeVisible();
  // Tri Construire par statut (C20) : le 1er bâtiment listé est DISPONIBLE
  // (plus jamais un verrouillé en tête comme avec le tri alphabétique).
  const firstBuild = page.locator('.town-building').first();
  await expect(firstBuild).toHaveClass(/town-building-available/);
  await page.getByTestId('town-close').click();

  // Générer du stock (croissance hebdo) puis « Tout recruter ».
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }));
  }
  const goldBefore = await page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]!.resources.gold);
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-recruit').click();
  // T-GROWTHUI (doc 02 §4.1) : le détail de croissance de l'habitation est
  // affiché — rythme hebdo (+X/sem) et plafond d'accumulation (max 2X).
  await expect(page.getByTestId('town-growth-t1-recruit')).toContainText('/sem');
  await expect(page.getByTestId('town-growth-t1-recruit')).toContainText('max');
  await page.getByTestId('town-recruit-all').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]!.resources.gold))
    .toBeLessThan(goldBefore); // de l'or a été dépensé
  const garrison = await page.evaluate(() =>
    window.__HEROES_TEST__!.getState().towns[0]!.garrison.reduce((s, st) => s + st.count, 0),
  );
  expect(garrison).toBeGreaterThan(0); // des créatures recrutées dans la garnison

  expect(errors).toEqual([]);
});

test('ville : parité tactile du lore (X2) — un tap déplie le texte tronqué', { tag: '@mobile' }, async ({ page }) => {
  const errors = await openGame(page);

  await page.getByTestId('town-open-start-town').click();
  await expect(page.getByTestId('town-tab-build')).toBeVisible();
  // Lore tronqué (2 lignes) accessible au doigt : le bouton part replié, un tap
  // le déplie (A2 — l'info n'est plus exclusive au survol `title`).
  const lore = page.locator('.lore-toggle').first();
  await expect(lore).toBeVisible();
  await expect(lore).toHaveAttribute('aria-expanded', 'false');
  // Clampé au départ (2 lignes) : le clamp CSS retire le texte au-delà du pli.
  expect(await lore.evaluate((el) => getComputedStyle(el).webkitLineClamp)).toBe('2');
  await lore.click();
  await expect(lore).toHaveAttribute('aria-expanded', 'true');
  // Déplié : le clamp est levé ⇒ texte intégral (indépendant du viewport).
  expect(await lore.evaluate((el) => getComputedStyle(el).webkitLineClamp)).toBe('none');

  expect(errors).toEqual([]);
});

test('T-GRAIL : visiter un obélisque affiche la progression (doc 02 §2.2)', { tag: ['@core'] }, async ({
  page,
}) => {
  const errors = await openGame(page);
  // proto-01 porte 3 obélisques ; obelisk-1 est en (5,6). Chemin propre depuis
  // (3,3) évitant les autres objets (pas de toast parasite).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [{ x: 3, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 6 }],
    }),
  );
  // L'obélisque est compté pour le joueur humain (le hook de test dispatch
  // directement le moteur ; le toast, câblé dans `notifications.ts`, passe par
  // l'UI et n'est pas exercé ici).
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]?.obelisksVisited ?? []))
    .toContain('obelisk-1');
  expect(errors).toEqual([]);
});

test('T-GRAIL lot 2 : fouiller la tuile du Graal donne le Graal (doc 02 §2.2)', { tag: ['@core'] }, async ({
  page,
}) => {
  const errors = await openGame(page);
  // grailPos de proto-01 est en (6,6), atteignable. Amener le héros dessus.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [{ x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }],
    }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 6 });
  // Fouiller : le joueur obtient le Graal (débloque le bâtiment Graal, lot 3).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'Dig', heroId: 'hero-player-1' }),
  );
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]?.hasGrail ?? false))
    .toBe(true);
  expect(errors).toEqual([]);
});

test('T-GRAIL lot 3 : le bâtiment Graal est verrouillé sans Graal, constructible ensuite (doc 02 §2.2)', { tag: ['@core'] }, async ({
  page,
}) => {
  const errors = await openGame(page);
  // Sans Graal : le bâtiment Graal est verrouillé (message dédié, pas de bouton).
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-build').click();
  await expect(page.getByTestId('town-requires-grail-test-faction-grail')).toBeVisible();
  await expect(page.getByTestId('town-build-test-faction-grail')).toHaveCount(0);
  await page.getByTestId('town-close').click();
  // Obtenir le Graal (fouille en (6,6)) puis rouvrir : le bâtiment devient constructible.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'MoveHero',
      heroId: 'hero-player-1',
      path: [{ x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }],
    }),
  );
  await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'Dig', heroId: 'hero-player-1' }));
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-build').click();
  await expect(page.getByTestId('town-build-test-faction-grail')).toBeVisible();
  await expect(page.getByTestId('town-requires-grail-test-faction-grail')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('upgrade : bâtir le dwelling amélioré puis améliorer une pile de garnison (Alpha 4.11)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Amener le héros sur la ville (2,4) et déposer sa pile de base en garnison.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'MoveHero', heroId: 'hero-player-1', path: [{ x: 2, y: 4 }] }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 2, y: 4 });
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'GarrisonTransfer',
      townId: 'start-town',
      heroId: 'hero-player-1',
      from: 'hero',
      slot: 0,
    }),
  );
  // Améliorer l'habitation (dwelling gradué niveau 2 = variante d'élite débloquée).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'BuildStructure',
      townId: 'start-town',
      buildingId: 'test-faction-dwelling-t1',
    }),
  );
  expect(
    await page.evaluate(
      () => window.__HEROES_TEST__!.getState().towns[0]?.buildings['test-faction-dwelling-t1'],
    ),
  ).toBe(2);

  // Écran de ville → onglet Garnison → bouton « Améliorer » → pile convertie.
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-garrison').click();
  await page.getByTestId('town-garrison-upgrade-0').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().towns[0]?.garrison[0]?.unitId))
    .toBe('t1-recruit-elite');

  expect(errors).toEqual([]);
});

test('guilde des mages : bâtir la guilde puis visiter → le héros apprend les sorts du pool (G2)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Amener le héros sur la tuile de la ville (2,4) — condition de « visite ».
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'MoveHero', heroId: 'hero-player-1', path: [{ x: 2, y: 4 }] }),
  );
  await expect.poll(() => heroPos(page)).toEqual({ x: 2, y: 4 });

  const spellsBefore = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().heroes[0]?.spells.length ?? 0,
  );

  // Bâtir la guilde des mages (niveau 1, 2000 or + 5 bois) : tire 4 sorts de
  // cercle 1 dans le pool ; le héros présent les apprend aussitôt.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'BuildStructure',
      townId: 'start-town',
      buildingId: 'mageGuild',
    }),
  );
  const pool = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().towns[0]?.spellPool ?? [],
  );
  expect(pool).toHaveLength(4);
  // Le héros a appris les sorts du pool (cercle 1 ≤ cercle apprenable 3).
  const spellsAfter = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().heroes[0]?.spells ?? [],
  );
  for (const id of pool) expect(spellsAfter).toContain(id);
  expect(spellsAfter.length).toBeGreaterThan(spellsBefore);

  // Onglet Guilde de l'écran de ville : le pool est listé, marqué « connu ».
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-guild').click();
  await expect(page.getByTestId('town-panel-guild')).toBeVisible();
  expect(await page.locator('[data-testid^="guild-spell-"]').count()).toBe(4);
  expect(await page.locator('.town-guild-spell.is-known').count()).toBe(4);

  expect(errors).toEqual([]);
});

test('ville : une construction refusée affiche une erreur localisée (remédiation CL6)', async ({ page }) => {
  const errors = await openGame(page);

  await expect(page.getByTestId('town-open-start-town')).toBeVisible();
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-build').click();

  // Remédiation R4b (CO6) : les bâtiments portent leur NOM localisé, pas leur id.
  await expect(page.getByTestId('town-panel-build')).toContainText('Guilde des mages');

  // Le fort coûte 5000 or + 20 minerai ; le joueur démarre avec 2000/10/10 :
  // la construction est refusée (`cannotAfford`) — clic via l'UI (pas dispatch).
  await page.getByTestId('town-build-fort').click();

  const townError = page.getByTestId('town-error');
  await expect(townError).toBeVisible();
  // Message LOCALISÉ (CL6) : le libellé de `cmdError.cannotAfford`, plus le
  // format brut « code: message » qui fuyait auparavant.
  await expect(townError).toHaveText('Ressources insuffisantes');

  expect(errors).toEqual([]);
});

test('sort : le héros lance un sort en combat et réduit une pile ennemie', { tag: '@core' }, async ({ page }) => {
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
  await passPreBattle(page);
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

  // C-SPELLUI.1 : grimoire feuilletable par onglets d'école (doc 08 §2.3) —
  // « éclair magique » est de l'école neutre ⇒ on ouvre son onglet.
  await page.getByTestId('spellbook-tab-neutral').click();
  // C-SPELLUI.4 : l'onglet indique la maîtrise du héros dans l'école (le héros
  // de départ n'a pas de compétence de magie ⇒ maîtrise « de base »).
  await expect(page.getByTestId('spellbook-mastery-neutral')).toContainText('base');

  // Famille S (gen_spell_assets.py) : l'entrée de sort porte son icône `spell-icon`
  // (couple école/type `spells/neutral-damage`) — intégration DOM du grimoire, le
  // repli (sans image) laisserait 0 `<img>`.
  await expect(page.getByTestId('spell-eclair-magique').locator('img.spell-icon')).toBeVisible();

  // Livre → « éclair magique » (cercle 1, 4 mana) → pile ennemie →
  // prévisualisation OBLIGATOIRE (doc 08 §2.4) → confirmation.
  // Remédiation R4 (CO5) : le sort porte son NOM localisé, plus l'id brut.
  await expect(page.getByTestId('spell-eclair-magique')).toContainText('Éclair magique');
  await page.getByTestId('spell-eclair-magique').click();
  // C-SPELLUI.3 : l'écran de ciblage passe la modale en mode dock (fond
  // transparent, plateau révélé) où la zone d'effet est surlignée en Pixi — le
  // highlight canvas lui-même n'est pas assertable en smoke DOM.
  await expect(page.getByTestId('spellbook-modal')).toHaveClass(/targeting/);
  await page.getByTestId(`spell-target-${setup.targetId}`).click();
  await expect(page.getByTestId('spell-preview')).toContainText(/\d/);
  // C-SPELLUI.2 : « éclair magique » est mono-cible ⇒ aucune liste de zone
  // (le cas multi-piles splash/all/chaîne est couvert par le unit test moteur
  // combat-spell-affected — le scénario smoke n'a qu'une pile gardien).
  await expect(page.getByTestId('spell-zone')).toHaveCount(0);
  await page.getByTestId('spell-cast').click();

  // Pile ennemie réduite (ou détruite), mana débitée, 1 sort/round consommé.
  const after = await page.evaluate((targetId) => {
    const g = window.__HEROES_TEST__!.getState();
    const target = g.combat?.stacks.find((s) => s.id === targetId);
    return {
      mana: g.heroes[0]!.mana,
      remaining: target?.count ?? 0,
      cast: g.combat?.heroCastThisRound ?? [],
    };
  }, setup.targetId);
  // Coût éclair magique 4, réduit de 20 % par la spécialité Arcaniste du héros
  // (H-NAMED) ⇒ round(4 × 0,8) = 3 : la spécialité agit bien EN COMBAT.
  expect(after.mana).toBe(setup.mana - 3);
  expect(after.remaining).toBeLessThan(setup.count);
  // C-AIPARITY : verrou 1 sort/round PAR CAMP (liste des camps ayant lancé).
  expect(after.cast).toContain('attacker');

  // B6 (sprint 1) : le sort a produit un FX d'impact DISTINCT de la frappe
  // (retour visuel avant B6 : aucun). Compteur cumulé exposé au test.
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.combatFx().impacts))
    .toBeGreaterThan(0);

  expect(errors).toEqual([]);
});

test('attaque du héros : frappe directe sur une pile ennemie, 1×/combat (C1)', async ({ page }) => {
  const errors = await openGame(page);

  // Même interception que le test de sort : le héros est lié au camp attaquant.
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
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();

  const target = await page.evaluate(() => {
    const g = window.__HEROES_TEST__!.getState();
    const t = g.combat!.stacks.find((s) => s.side === 'defender')!;
    return { id: t.id, count: t.count };
  });

  // F-SKILLS.2-UI : le bouton [Prière] existe mais reste DÉSACTIVÉ — le héros de
  // départ ne porte pas la compétence de Prière de bataille (gating d'absence
  // vérifié ; le flux actif est couvert en unitaire moteur `combat-hero-rally`).
  await expect(page.getByTestId('combat-prayer')).toBeDisabled();

  // Bouton [Attaque du héros] actif → modale → prévisualisation → cible.
  await expect(page.getByTestId('combat-hero-attack')).toBeEnabled();
  await page.getByTestId('combat-hero-attack').click();
  await expect(page.getByTestId('hero-attack-preview')).toContainText(/\d/);
  await page.getByTestId(`hero-attack-target-${target.id}`).click();

  const after = await page.evaluate((id) => {
    const g = window.__HEROES_TEST__!.getState();
    const c = g.combat;
    return {
      remaining: c?.stacks.find((s) => s.id === id)?.count ?? 0,
      used: c?.heroAttackUsed ?? [],
      active: !!c && !c.finished,
    };
  }, target.id);
  // La frappe a porté : pile réduite (0 si l'attaque a résolu le combat).
  expect(after.remaining).toBeLessThan(target.count);
  // Tant que le combat continue : camp marqué (1×/combat) + bouton désactivé.
  if (after.active) {
    expect(after.used).toContain('attacker');
    await expect(page.getByTestId('combat-hero-attack')).toBeDisabled();
  }

  expect(errors).toEqual([]);
});

test('fuite : quitter le combat — le héros survit, armée abandonnée (C3)', async ({ page }) => {
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
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();

  // [Fuir] → confirmation → le combat se résout, le héros survit sans armée.
  await expect(page.getByTestId('combat-retreat')).toBeEnabled();
  await page.getByTestId('combat-retreat').click();
  await page.getByTestId('combat-leave-confirm').click();

  await expect.poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().combat)).toBeNull();
  const hero = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().heroes.find((h) => h.id === 'hero-player-1') ?? null,
  );
  expect(hero).not.toBeNull(); // le héros a survécu à la fuite
  expect(hero?.army.length).toBe(0); // armée abandonnée

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
  // Idem pour le choix d'attribut (H-LEVELCHOICE) : même gating, absent au niveau 1.
  // Le flux complet (montée → file → ChooseAttribute) est couvert en unitaire
  // (`hero-level-up.test.ts`) — non déclenchable en smoke (XP de niveau trop élevée).
  expect(hero?.pendingAttributeChoices).toHaveLength(0);
  await expect(page.getByTestId('attribute-choice')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('sauvegarde puis rechargement IndexedDB : position restaurée', { tag: ['@mobile', '@core'] }, async ({ page }) => {
  const errors = await openGame(page);

  await moveHeroToGold(page);
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });

  await clickSaveAction(page, 'save'); // lot M5 : save/load via Options

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
  await clickSaveAction(page, 'load');
  await expect.poll(() => heroPos(page)).toEqual({ x: 6, y: 3 });
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.movementPoints).toBe(1400);
  await expect(page.getByTestId('resource-gold')).toHaveText('2500');

  expect(errors).toEqual([]);
});

test('sauvegarde en échec de stockage : toast d’erreur visible (lot 3.9)', async ({ page }) => {
  await openGame(page);

  // Simule un stockage indisponible (navigation privée, quota) : `indexedDB.open`
  // lève ⇒ `saveGame` rejette. La perte ne doit pas être silencieuse.
  await page.evaluate(() => {
    window.indexedDB.open = () => {
      throw new DOMException('storage disabled', 'SecurityError');
    };
  });

  await clickSaveAction(page, 'save'); // lot M5 : save via Options
  const toast = page.getByTestId('toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(/sauvegarde|save/i);
  // UXD-6b : le toast d'échec est typé « erreur » (accent + SFX ui-error).
  await expect(toast).toHaveAttribute('data-kind', 'error');
});

test('journal & feedback : un événement humain alimente le journal + toast de sauvegarde (U3)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Démarrage silencieux : aucune notification ⇒ pas de badge de non-lus.
  await expect(page.getByTestId('journal-unread')).toHaveCount(0);

  // Ramassage de ressource par le héros HUMAIN : notifié (doc 08 §3) ⇒ badge + entrée.
  await moveHeroToGold(page);
  await expect(page.getByTestId('journal-unread')).toBeVisible();

  // Ouvrir le journal : la liste contient l'entrée, le compteur de non-lus se remet à 0.
  await page.getByTestId('journal-open').click();
  await expect(page.getByTestId('journal-panel')).toBeVisible();
  await expect(page.getByTestId('journal-entry').first()).toBeVisible();
  await expect(page.getByTestId('journal-unread')).toHaveCount(0);
  await page.getByTestId('journal-close').click();
  await expect(page.getByTestId('journal-panel')).toHaveCount(0);

  // Feedback de sauvegarde manuelle RÉUSSIE (nouveau U3) : toast « sauvegardée ».
  await clickSaveAction(page, 'save'); // lot M5 : save via Options
  const savedToast = page.getByTestId('toast').filter({ hasText: /sauvegard|saved/i });
  await expect(savedToast).toBeVisible();
  // UXD-6b : le toast de succès est typé « success » (accent + SFX ui-confirm).
  await expect(savedToast).toHaveAttribute('data-kind', 'success');

  expect(errors).toEqual([]);
});

test('multi-héros / multi-villes : bandeau de portraits + liste de villes (U4)', { tag: '@mobile' }, async ({ page }) => {
  const errors = await openGame(page);

  // Bandeau de portraits (dans le tiroir héros, doc 08 §2.1) : le héros humain
  // est listé et sélectionné par défaut (repli 1er héros). `toBeAttached` plutôt
  // que `toBeVisible` : le tiroir est hors écran tant qu'il n'est pas ouvert en
  // mobile, et le toggle est masqué en desktop (tiroir toujours ouvert) — mais le
  // portrait est bien rendu dans le DOM sur les deux viewports.
  const portrait = page.getByTestId('hero-select-hero-player-1');
  await expect(portrait).toBeAttached();
  await expect(portrait).toHaveAttribute('aria-pressed', 'true');

  // Liste de villes (barre d'actions, toujours visible) : une entrée par ville
  // possédée — même chemin `humanTowns.map` pour N villes (2ᵉ ville capturée accessible).
  const townButtons = page.getByTestId(/^town-open-/);
  await expect(townButtons).toHaveCount(1);
  await page.getByTestId('town-open-start-town').click();
  await expect(page.getByTestId('town-tab-build')).toBeVisible();
  await page.getByTestId('town-close').click();

  // Mini-carte : aria-label LOCALISÉ (i18n hole comblé) — plus de FR en dur.
  // `toBeAttached` : le tiroir/colonne est dans le DOM sur les deux viewports.
  const minimap = page.getByTestId('mini-map-drawer');
  await expect(minimap).toBeAttached();
  await expect(minimap).toHaveAttribute('aria-label', /^Mini-carte \(\d+ héros\)$/);

  expect(errors).toEqual([]);
});

test('marché : construire un marché puis vendre une ressource contre de l’or (U6a)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Construit le marché (setup, coût 1000 or + 5 bois) — la ville de départ n'en a pas.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'BuildStructure',
      townId: 'start-town',
      buildingId: 'market',
    }),
  );
  const goldBefore = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().players[0]?.resources.gold ?? 0,
  );

  // Ouvre la ville → onglet Marché ; vend 5 bois → aperçu 125 or (sellRate 25).
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-market').click();
  await expect(page.getByTestId('town-panel-market')).toBeVisible();
  await page.getByTestId('market-amount').fill('5');
  await expect(page.getByTestId('market-received')).toContainText('125');
  await page.getByTestId('market-trade').click();

  // L'échange débite le bois et crédite l'or via `tradeQuote` (helper moteur).
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]?.resources.gold))
    .toBe(goldBefore + 125);
  expect(
    await page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]?.resources.wood),
  ).toBe(0); // 10 − 5 (marché) − 5 (vente)

  // Troc (T-MARKETRATE) : mode Troc, donner 4 minerai → recevoir du bois
  // (floor(4 × 25 / 50) = 2). Le 2ᵉ sélecteur choisit la ressource reçue.
  await page.getByTestId('market-mode-barter').click();
  await expect(page.getByTestId('market-count')).toBeVisible(); // « Marchés possédés : 1 »
  await page.getByTestId('market-resource').selectOption('ore');
  await page.getByTestId('market-barter-receive').selectOption('wood');
  await page.getByTestId('market-amount').fill('4');
  await expect(page.getByTestId('market-received')).toContainText('2');
  await page.getByTestId('market-trade').click();
  await expect
    .poll(() => page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]?.resources.wood))
    .toBe(2);
  expect(
    await page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]?.resources.ore),
  ).toBe(6); // 10 − 4 (troc)
  await page.getByTestId('town-close').click();

  expect(errors).toEqual([]);
});

test('scénario : le menu démarre le tutoriel, l’IA joue son tour', { tag: '@core' }, async ({ page }) => {
  const errors = await openMenu(page);

  await expect(page.getByTestId('menu-scenario-tutorial')).toBeVisible();
  await page.getByTestId('menu-scenario-tutorial').click();
  // Fiche de scénario (N-BRIEFING) avant lancement : objectif + faction, puis démarrage.
  await expect(page.getByTestId('briefing-panel')).toBeVisible();
  await expect(page.getByTestId('briefing-victory')).not.toBeEmpty();
  await expect(page.getByTestId('briefing-faction')).not.toBeEmpty();
  await page.getByTestId('briefing-start').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();

  const before = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(before.calendar.day).toBe(1);
  expect(before.heroes).toHaveLength(2);
  expect(before.players.map((p) => p.controller)).toEqual(['human', 'ai']);

  // Fin de tour humain : la boucle IA (app/dispatch.ts) joue automatiquement
  // le tour de l'IA (déplacement/ramassage/ville — doc 11 §3.5) puis termine
  // son tour à son tour — le jour avance donc d'un cran, sans intervention.
  await endTurn(page);
  await expect(page.getByTestId('calendar')).toHaveText('Mois 1 · Semaine 1 · Jour 2');

  const after = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(after.calendar.day).toBe(2);
  expect(after.currentPlayer).toBe(0); // revenu au joueur humain
  expect(after.combat).toBeNull(); // un combat déclenché par l'IA aurait été auto-résolu
  expect(after.heroes).toHaveLength(2); // aucun gardien accessible au jour 1 (héros distants)

  expect(errors).toEqual([]);
});

test('prologue narratif : dialogue → journal → quête récompensée (doc 13 N2b)', async ({ page }) => {
  const errors = await openMenu(page);

  // Démarre le Prologue Haven (scénario porteur de quêtes + dialogues).
  await page.evaluate(() => window.__HEROES_TEST__!.startScenario('prologue'));
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Le dialogue d'ouverture s'affiche (doc 13 §6.3).
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await expect(page.getByTestId('dialogue-text')).not.toHaveText('');

  // « Passer » saute chaque nœud : ouverture (4 lignes) puis le dialogue
  // `dialogBefore` de l'étape « bâtir le Fort » (2 lignes). Deux Passer suffisent.
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);

  // Journal à jour : la quête « Relever Cendregarde » est active (tiroir héros).
  // Desktop : la colonne héros est persistante (pas de bascule) ; mobile : on ouvre.
  if (await page.getByTestId('hero-drawer-toggle').isVisible())
    await page.getByTestId('hero-drawer-toggle').click();
  await expect(page.getByTestId('quest-entry-prologue-relever')).toBeVisible();

  const goldBefore = await page.evaluate(
    () => window.__HEROES_TEST__!.getState().players[0]!.resources.gold,
  );

  // Bâtir le Fort → étape satisfaite → quête complétée → récompense (+1000 or).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'BuildStructure', townId: 'start-town', buildingId: 'fort' }),
  );

  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  const relever = state.quests?.quests.find((q) => q.def.id === 'prologue-relever');
  expect(relever?.status).toBe('completed');
  // Or = avant − 5000 (coût Fort) + 1000 (récompense).
  expect(state.players[0]!.resources.gold).toBe(goldBefore - 5000 + 1000);
  // Le journal reflète la complétion.
  await expect(page.getByTestId('quest-progress-prologue-relever')).toHaveText('Terminé');

  expect(errors).toEqual([]);
});

test('campagne : gagner le chapitre 1 débloque le 2 et reporte le héros (doc 13 N3a)', { tag: '@core' }, async ({ page }) => {
  const errors = await openMenu(page);

  // La campagne Haven apparaît au menu : chapitre 1 jouable, chapitre 2 verrouillé.
  await expect(page.getByTestId('menu-campaign-haven-campaign')).toBeVisible();
  await expect(page.getByTestId('menu-chapter-haven-campaign-0')).toBeEnabled();
  await expect(page.getByTestId('menu-chapter-haven-campaign-1')).toBeDisabled();

  // Démarre le chapitre 1 (= le Prologue), doté d'un artefact de départ.
  await page.evaluate(() => window.__HEROES_TEST__!.startCampaignChapter('haven-campaign', 0));
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const ch1 = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(ch1.heroes[0]?.artifacts[0]).toBe('trefle-chance');
  expect(ch1.quests).not.toBeNull();

  // Gagner le chapitre : survivre 2 jours (finir des tours jusqu'à l'issue).
  for (let i = 0; i < 6; i++) {
    const outcome = await page.evaluate(() => window.__HEROES_TEST__!.getState().outcome);
    if (outcome) break;
    await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }));
  }
  expect(await page.evaluate(() => window.__HEROES_TEST__!.getState().outcome?.status)).toBe('won');

  // Retour au menu : le chapitre 2 est désormais débloqué (progression persistée).
  await page.getByTestId('outcome-back-to-menu').click();
  await expect(page.getByTestId('menu-chapter-haven-campaign-1')).toBeEnabled();

  // Le chapitre 2 démarre avec le héros REPORTÉ (artefact conservé — continuité).
  await page.evaluate(() => window.__HEROES_TEST__!.startCampaignChapter('haven-campaign', 1));
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const ch2 = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(ch2.heroes[0]?.artifacts).toContain('trefle-chance');

  expect(errors).toEqual([]);
});

test('artefacts : déséquiper vers le sac puis rééquiper depuis le tiroir héros (H-ARTEQUIP)', async ({
  page,
}) => {
  const errors = await openMenu(page);

  // Le Prologue Haven dote le héros de `trefle-chance` (slot `ring`) équipé.
  await page.evaluate(() => window.__HEROES_TEST__!.startCampaignChapter('haven-campaign', 0));
  await expect(page.getByTestId('end-turn')).toBeVisible();
  // Purge la file de dialogues d'ouverture (openingDialog + dialogBefore).
  const skip = page.getByTestId('dialogue-skip');
  for (let i = 0; i < 8 && (await skip.count()) > 0; i++) await skip.click();

  // Ouvre le tiroir héros (mobile ; desktop = colonne persistante).
  if (await page.getByTestId('hero-drawer-toggle').isVisible())
    await page.getByTestId('hero-drawer-toggle').click();
  await expect(page.getByTestId('hero-inventory')).toBeVisible();
  await expect(page.getByTestId('hero-bag-empty')).toBeVisible(); // sac vide au départ

  // Déséquiper l'anneau (trefle-chance) → il tombe dans le sac.
  await page.getByTestId('hero-slot-ring').click();
  await expect(page.getByTestId('hero-bag-item-0')).toBeVisible();
  const unequipped = await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]!);
  expect(unequipped.backpack).toContain('trefle-chance');
  expect(unequipped.artifacts).not.toContain('trefle-chance');

  // Rééquiper depuis le sac → il repart dans un slot, le sac se vide.
  await page.getByTestId('hero-bag-item-0').click();
  await expect(page.getByTestId('hero-bag-empty')).toBeVisible();
  const reequipped = await page.evaluate(() => window.__HEROES_TEST__!.getState().heroes[0]!);
  expect(reequipped.artifacts).toContain('trefle-chance');
  expect(reequipped.backpack ?? []).not.toContain('trefle-chance');

  expect(errors).toEqual([]);
});

test('campagne : 2ᵉ maison (Necropolis) = données pures, apparaît et démarre (doc 13 N3b)', async ({ page }) => {
  const errors = await openMenu(page);

  // Test de modularité narratif : une 2ᵉ campagne existe sans un octet de moteur
  // en plus — chapitre 1 jouable, chapitre 2 verrouillé.
  await expect(page.getByTestId('menu-campaign-necropolis-campaign')).toBeVisible();
  await expect(page.getByTestId('menu-chapter-necropolis-campaign-0')).toBeEnabled();
  await expect(page.getByTestId('menu-chapter-necropolis-campaign-1')).toBeDisabled();

  // Le chapitre 1 démarre : héros Necropolis, dialogue d'ouverture, quête active.
  await page.evaluate(() => window.__HEROES_TEST__!.startCampaignChapter('necropolis-campaign', 0));
  await expect(page.getByTestId('end-turn')).toBeVisible();
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.factionId).toBe('necropolis');
  expect(state.quests?.quests.some((q) => q.def.id === 'necro-ch1-sanctuaire')).toBe(true);

  expect(errors).toEqual([]);
});

test('campagne : 3ᵉ maison (Arcane Hunters) = données pures, apparaît et démarre (doc 13 N4a)', async ({ page }) => {
  const errors = await openMenu(page);

  // 3ᵉ test de modularité narratif : une 3ᵉ campagne existe sans un octet de moteur
  // en plus — chapitre 1 jouable, chapitre 2 verrouillé.
  await expect(page.getByTestId('menu-campaign-arcane-campaign')).toBeVisible();
  await expect(page.getByTestId('menu-chapter-arcane-campaign-0')).toBeEnabled();
  await expect(page.getByTestId('menu-chapter-arcane-campaign-1')).toBeDisabled();

  // Le chapitre 1 démarre : héros Arcane Hunters, dialogue d'ouverture, quête active.
  await page.evaluate(() => window.__HEROES_TEST__!.startCampaignChapter('arcane-campaign', 0));
  await expect(page.getByTestId('end-turn')).toBeVisible();
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.factionId).toBe('arcane-hunters');
  expect(state.quests?.quests.some((q) => q.def.id === 'arcane-ch1-avant-poste')).toBe(true);

  expect(errors).toEqual([]);
});

test('campagne : 4ᵉ maison (Vox Arcana) = données pures, apparaît et démarre (doc 13 N-CAMPAIGNS2)', async ({ page }) => {
  const errors = await openMenu(page);

  // 4ᵉ test de modularité narratif : une campagne Vox Arcana existe sans un octet
  // de moteur en plus — le chapitre 1 (prologue « La brèche ») est jouable.
  await expect(page.getByTestId('menu-campaign-vox-campaign')).toBeVisible();
  await expect(page.getByTestId('menu-chapter-vox-campaign-0')).toBeEnabled();

  // Le chapitre 1 démarre : héros Vox Arcana, dialogue d'ouverture, quête active.
  await page.evaluate(() => window.__HEROES_TEST__!.startCampaignChapter('vox-campaign', 0));
  await expect(page.getByTestId('end-turn')).toBeVisible();
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.heroes[0]?.factionId).toBe('vox-arcana');
  expect(state.quests?.quests.some((q) => q.def.id === 'vox-ch1-honmoon')).toBe(true);

  expect(errors).toEqual([]);
});

test('bark de combat : une réplique s’affiche au début d’un combat de campagne (doc 13 N4b)', async ({ page }) => {
  const errors = await openMenu(page);

  // arcane-ch1 embarque un pool de barks. On démarre le scénario puis on déclenche
  // un combat : une réplique de l'antagoniste apparaît dans le bandeau (tirée côté
  // client, hors simulation).
  await page.evaluate(() => window.__HEROES_TEST__!.startScenario('arcane-ch1'));
  await expect(page.getByTestId('end-turn')).toBeVisible();

  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'StartCombat',
      attacker: [{ unitId: 't1-eleve', count: 20 }],
      defender: [{ unitId: 't1-squelette', count: 4 }],
      terrain: 'grass',
    }),
  );
  await passPreBattle(page);
  await expect(page.getByTestId('combat-round')).toBeVisible();
  const bark = page.getByTestId('combat-bark');
  await expect(bark).toBeVisible();
  expect(((await bark.textContent()) ?? '').trim().length).toBeGreaterThan(0);

  // Fin du combat : le bark disparaît.
  await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'AutoCombat' }));
  await expect(page.getByTestId('combat-bark')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('cinématique : letterbox + Passer sur l’ouverture d’un chapitre (doc 13 N3c.1)', async ({ page }) => {
  const errors = await openMenu(page);

  // haven-ch2 embarque une cinématique d'ouverture (pano caméra + dialogue),
  // jouée en arrière-plan une fois la scène en place.
  await page.evaluate(() => window.__HEROES_TEST__!.startScenario('haven-ch2'));

  // Letterbox + bouton Passer (≥ 44 px) apparaissent pendant la cinématique.
  await expect(page.getByTestId('cutscene-overlay')).toBeVisible();
  await expect(page.getByTestId('cutscene-skip')).toBeVisible();

  // « Passer » (doc 13 §6.3) interrompt la cinématique : plus de letterbox et la
  // partie est jouable.
  await page.getByTestId('cutscene-skip').click();
  await expect(page.getByTestId('cutscene-overlay')).toHaveCount(0);
  await expect(page.getByTestId('end-turn')).toBeVisible();

  expect(errors).toEqual([]);
});

// Arcs personnels de campagne (doc 13 §5.4). La DONNÉE des 6 arcs (nœud de
// choix binaire → drapeaux) est validée en contenu (dialogue-arcs.test.ts) ;
// le smoke ne garde que 2 parcours UI REPRÉSENTATIFS pour prouver le câblage
// dialogue→drapeau persistant côté client : un arc simple (choix dès
// l'ouverture) et un arc CHAÎNÉ (enfilé après d'autres nœuds à choix du même
// scénario). Un seul corps paramétré ⇒ 2 cas isolés, exécutés en parallèle
// (plan test-performance-optimization §9, axes F/G).
const DIALOGUE_ARCS_UI = [
  { label: 'Aldric — arc simple (haven-ch2)', scenario: 'haven-ch2', set: 'aldric-merciful', unset: 'aldric-ruthless' },
  { label: 'Marchmont — arc chaîné (arcane-ch2)', scenario: 'arcane-ch2', set: 'marchmont-reveal', unset: 'marchmont-protect' },
] as const;

for (const arc of DIALOGUE_ARCS_UI) {
  test(`choix de dialogue : ${arc.label} pose un drapeau persistant (doc 13 §5.4)`, async ({
    page,
  }) => {
    const errors = await openMenu(page);
    await page.evaluate((id) => window.__HEROES_TEST__!.startScenario(id), arc.scenario);
    await expect(page.getByTestId('dialogue-box')).toBeVisible();

    // Patron robuste : résout chaque nœud (choix → option 0, sinon « Passer »)
    // jusqu'au drapeau visé — tolère l'ordre des nœuds et les arcs enfilés dans
    // un même scénario. L'option 0 ne pose jamais le drapeau « frère ».
    const choices = page.getByTestId('dialogue-choices');
    const skip = page.getByTestId('dialogue-skip');
    const flagsNow = () => page.evaluate(() => window.__HEROES_TEST__!.campaignFlags());
    for (let i = 0; i < 16; i++) {
      const f = await flagsNow();
      if (f[arc.set] || f[arc.unset]) break;
      if ((await choices.count()) > 0) await page.getByTestId('dialogue-choice-0').click();
      else if ((await skip.count()) > 0) await skip.click();
      else break;
    }

    const flags = await flagsNow();
    expect(flags[arc.set]).toBe(true);
    expect(flags[arc.unset]).toBeUndefined();
    expect(errors).toEqual([]);
  });
}

test('campagne : 3ᵉ chapitre Haven sur sa carte dédiée proto-02 (doc 13 N3c.3)', async ({ page }) => {
  const errors = await openMenu(page);

  // La campagne Haven compte désormais 3 chapitres (le 3ᵉ verrouillé tant que le 2ᵉ
  // n'est pas gagné).
  await expect(page.getByTestId('menu-campaign-haven-campaign')).toBeVisible();
  await expect(page.getByTestId('menu-chapter-haven-campaign-2')).toBeVisible();

  // Le chapitre 3 (index 2) charge sa carte DÉDIÉE proto-02 (24×24) — pas proto-01.
  await page.evaluate(() => window.__HEROES_TEST__!.startCampaignChapter('haven-campaign', 2));
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const state = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state.map?.id).toBe('proto-02');
  expect(state.map?.width).toBe(24);
  expect(state.map?.height).toBe(24);
  expect(state.heroes[0]?.factionId).toBe('haven');

  expect(errors).toEqual([]);
});

test('scénario : gagner « survie » contre l’IA (surviveDays)', { tag: '@core' }, async ({ page }) => {
  const errors = await openMenu(page);

  await page.evaluate(() => window.__HEROES_TEST__!.startScenario('survival'));
  await expect(page.getByTestId('end-turn')).toBeVisible();

  const state0 = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(state0.scenario).not.toBeNull();
  expect(state0.outcome).toBeNull();

  // Le joueur humain se contente de finir son tour ; la boucle IA joue
  // automatiquement le tour adverse jusqu'à ce que `surviveDays: 15` soit
  // atteint. Depuis AI-HERO-HUNT, l'IA d'aventure PEUT attaquer un héros ennemi
  // « battable » (marge ≥ 1,5×) — mais l'armée de départ humaine (25 squelettes)
  // domine assez la force IA (même boostée par l'habitation de carte) pour que
  // l'IA ne l'engage jamais : le héros passif survit. Plafond au-delà du besoin.
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

  // Lot 7b (I10) : le fond victoire/défaite est PLEIN ÉCRAN (porté par le
  // backdrop), pas confiné au panneau ; le panneau chrome flotte par-dessus.
  const backdropBg = await page
    .getByTestId('outcome-backdrop')
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(backdropBg).toContain('url(');

  // Graphique de puissance de fin de partie (doc 08 §2.5, lot U6b) : une barre
  // par joueur (ici humain + IA), rendu depuis l'état final avant le reset.
  await expect(page.getByTestId('outcome-power-chart')).toBeVisible();
  await expect(page.getByTestId('outcome-power-bar')).toHaveCount(2);

  // Récapitulatif de fin de partie (UX-ENDSTATS, doc 08 §2.5) : durée + avoirs.
  await expect(page.getByTestId('outcome-stats')).toBeVisible();
  await expect(page.getByTestId('outcome-duration')).toHaveText(/Jour \d+ · Semaine \d+/);

  // Retour au menu depuis l'overlay (bouton, doc 08).
  await page.getByTestId('outcome-back-to-menu').click();
  await expect(page.getByTestId('menu-new-game')).toBeVisible();

  // Remédiation CL1 : relancer une partie après retour au menu doit
  // reconstruire une scène FRAÎCHE (auparavant l'ancienne carte était rejouée,
  // textures et listeners fuités). On enchaîne menu → partie → menu → partie.
  await page.getByTestId('menu-new-game').click();
  await page.getByTestId('newgame-start').click();
  await expect(page.getByTestId('end-turn')).toBeVisible();
  const restarted = await page.evaluate(() => window.__HEROES_TEST__!.getState());
  expect(restarted.started).toBe(true);
  expect(restarted.combat).toBeNull();
  // La scène et la caméra reconstruites répondent : coordonnées écran valides
  // (`tileToScreen` renvoie {-1,-1} tant que la caméra n'existe pas).
  const hero = restarted.heroes[0]!;
  const sp = await page.evaluate(
    ([x, y]) => window.__HEROES_TEST__!.tileToScreen(x!, y!),
    [hero.pos.x, hero.pos.y],
  );
  expect(sp.x).toBeGreaterThan(0);
  expect(sp.y).toBeGreaterThan(0);

  expect(errors).toEqual([]);
});

test('contrat de chasse : bâtir le Tableau des Contrats → cible assignée au passage de semaine (doc 05 §3.3)', async ({
  page,
}) => {
  const errors = await openMenu(page);
  // Le scénario « conquête » démarre le joueur humain en faction Arcane Hunters
  // (seule faction avec le bâtiment `huntContract`).
  await page.evaluate(() => window.__HEROES_TEST__!.startScenario('conquest'));
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Le Tableau des Contrats requiert la Taverne (D9, doc 05 §3.3) : on la bâtit
  // au jour 1 (une construction/jour), puis le contrat au jour 2.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'BuildStructure', townId: 'start-town', buildingId: 'tavern' }),
  );
  await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }));

  // Bâtir le Tableau des Contrats (prérequis tavern@1, 800 or + 5 bois).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({
      type: 'BuildStructure',
      townId: 'start-town',
      buildingId: 'arcane-hunters-contracts',
    }),
  );
  expect(
    await page.evaluate(
      () =>
        window.__HEROES_TEST__!.getState().towns.find((t) => t.id === 'start-town')?.buildings[
          'arcane-hunters-contracts'
        ],
    ),
  ).toBe(1);

  // Avancer jusqu'au passage de semaine (jour 8) : un contrat est assigné.
  // (Le jour 1 a déjà consommé un EndTurn ci-dessus ⇒ 6 tours restants.)
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.__HEROES_TEST__!.dispatch({ type: 'EndTurn', playerId: 'player-1' }));
  }
  const contract = await page.evaluate(() => window.__HEROES_TEST__!.getState().players[0]?.huntContract);
  expect(contract).not.toBeNull();
  expect(contract?.targetObjectId).toBeTruthy();

  expect(errors).toEqual([]);
});

test('machine de guerre : bâtir la Forge → le héros présent voit l’achat d’une baliste (doc 02 §5)', async ({
  page,
}) => {
  const errors = await openGame(page);

  // Bâtir la Forge (effet `warMachineVendor`) — 2000 or + 10 minerai (départ).
  await page.evaluate(() =>
    window.__HEROES_TEST__!.dispatch({ type: 'BuildStructure', townId: 'start-town', buildingId: 'forge' }),
  );
  expect(
    await page.evaluate(
      () => window.__HEROES_TEST__!.getState().towns.find((t) => t.id === 'start-town')?.buildings['forge'],
    ),
  ).toBe(1);

  // Amener le héros sur la tuile de la ville (2,4) : requis pour acheter.
  await tapTapTile(page, 2, 4);
  await expect.poll(() => heroPos(page)).toEqual({ x: 2, y: 4 });

  // Ouvrir la ville → onglet Garnison : section « Machines de guerre » + bouton d'achat.
  await page.getByTestId('town-open-start-town').click();
  await page.getByTestId('town-tab-garrison').click();
  await expect(page.getByTestId('town-war-machines')).toBeVisible();
  await expect(page.getByTestId('town-buy-machine-ballista')).toBeVisible();

  expect(errors).toEqual([]);
});

test('assets : PNG servis sans 404, icônes de ressources et vignettes de bâtiments affichées (lot intégration)', async ({
  page,
}) => {
  const assets = trackAssets(page);
  const errors = await openGame(page);

  // Barre de ressources : l'icône <img> est réellement décodée (repli sur le
  // pastille CSS sinon — on vérifie ici le cas nominal, asset présent).
  await expect(page.locator('.resource-bar .resource-icon').first()).toBeVisible();
  await expect
    .poll(() => imgNaturalWidth(page, '.resource-bar .resource-icon'))
    .toBeGreaterThan(0);

  // Écran de ville : vignette de bâtiment (au moins un bâtiment commun a un
  // asset `buildings/core/<id>` quelle que soit la faction de départ).
  await page.getByTestId('town-open-start-town').click();
  await expect(page.locator('.town-building-vignette').first()).toBeVisible();
  await expect.poll(() => imgNaturalWidth(page, '.town-building-vignette')).toBeGreaterThan(0);
  await page.getByTestId('town-close').click();

  // Préchargement PixiJS (tuiles + mines) et barre UI : au moins un PNG de
  // chaque famille a été servi (200), preuve du chargement hors bundle.
  expect(assets.loaded.some((u) => /(grass|water|mountain|swamp)-\d/.test(u))).toBe(true);
  expect(assets.loaded.some((u) => /mine-/.test(u))).toBe(true);
  expect(assets.loaded.some((u) => /res-/.test(u))).toBe(true);

  // Gardiens de carte illustrés (DA Beta) : proto-01 place deux gardiens
  // (`t1-eleve` arcane-hunters, `t1-recruit` test-faction) dont le sprite
  // d'unité est chargé pour remplacer le fanion de repli. Prouve aussi que la
  // correction de nommage des sprites Arcane Hunters les rend bien résolvables.
  await expect
    .poll(() => assets.loaded.some((u) => /(t1-eleve|t1-recruit)-\w/.test(u)))
    .toBe(true);

  // Le registre ne référence que des fichiers présents : aucun asset en 404.
  expect(assets.failed).toEqual([]);
  expect(errors).toEqual([]);
});

// Vox Arcana (doc 16) : vignettes de bâtiments toutes peintes — 8 habitations
// (`buildings/vox-arcana/vox-arcana-dwelling-t*`) + 5 bâtiments « Le Choixpeau »
// (`buildings/vox-arcana/vox-arcana-house-*`). Régression des captures
// utilisateur : tuiles de bâtiment vides (repli beige).
test('assets : Vox Arcana — ville peinte (habitations, Maisons, fond) + jetons de carte', async ({
  page,
}) => {
  const assets = trackAssets(page);
  const errors = await openMenu(page);

  // Escarmouche Vox Arcana (seed fixe) ⇒ ville de départ de faction vox-arcana.
  await page.evaluate(() =>
    window.__HEROES_TEST__!.startSkirmish({
      humanFactionId: 'vox-arcana',
      aiFactionId: 'haven',
      difficulty: 'normal',
    }),
  );
  await expect(page.getByTestId('end-turn')).toBeVisible();

  // Jetons de carte peints : le héros (map/hero-vox-arcana) et la ville
  // (map/town-vox-arcana) chargent leur texture Pixi au montage de la scène,
  // remplaçant le repli procédural.
  await expect
    .poll(() => assets.loaded.some((u) => /hero-vox-arcana-\w/.test(u)))
    .toBe(true);
  await expect
    .poll(() => assets.loaded.some((u) => /town-vox-arcana-\w/.test(u)))
    .toBe(true);

  await page.locator('[data-testid^="town-open-"]').first().click();
  // La vue peinte liste tous les bâtiments de la faction en emplacements. Une
  // habitation (src `…dwelling-t…`) et un bâtiment « Le Choixpeau »
  // (src `…house-…`) montrent leur art dédié — les deux réellement décodés
  // (repli beige exclu).
  const dwelling = page.locator('.town-view-vignette[src*="dwelling-t"]');
  await expect(dwelling.first()).toBeVisible();
  await expect
    .poll(() => imgNaturalWidth(page, '.town-view-vignette[src*="dwelling-t"]'))
    .toBeGreaterThan(0);
  const badge = page.locator('.town-view-vignette[src*="house-"]');
  await expect(badge.first()).toBeVisible();
  await expect
    .poll(() => imgNaturalWidth(page, '.town-view-vignette[src*="house-"]'))
    .toBeGreaterThan(0);
  // Fond de ville peint (backgrounds/town-vox-arcana) posé en CSS sur la scène.
  await expect
    .poll(() => page.locator('.town-view-scene').getAttribute('style'))
    .toContain('town-vox-arcana');

  expect(assets.failed).toEqual([]);
  expect(errors).toEqual([]);
});

// Phase 8.1 (Beta doc 09) : PWA hors-ligne. Le build de prod expose un manifeste
// installable et un service worker offline-first. Preuve d'offline : après un
// chargement en ligne (SW actif + cache peuplé), on coupe le réseau et l'app
// démarre quand même (coquille + contenu servis par le cache). Le SW ne
// s'enregistre qu'en PROD → le smoke tourne sur `vite preview` (build de prod).
test('PWA : manifeste installable + service worker ⇒ démarrage hors-ligne', { tag: '@core' }, async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Manifeste lié et servi (nom + scope corrects).
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const manifest = await page.evaluate(async () => {
    const res = await fetch('manifest.webmanifest');
    return res.ok ? res.json() : null;
  });
  expect(manifest?.name).toBe('Heroes');
  expect(manifest?.scope).toBe('/heroes/');

  // Service worker enregistré et actif (register sur l'évènement load).
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 15000,
  });

  // Recharge EN LIGNE une fois : la page contrôlée par le SW route désormais ses
  // requêtes assets/contenu par le cache → celui-ci se peuple.
  await page.reload();
  await page.waitForFunction(() => window.__HEROES_READY__ === true);

  // Coupe le réseau et recharge : l'app démarre depuis le cache (offline-first).
  await page.context().setOffline(true);
  try {
    await page.reload();
    await page.waitForFunction(() => window.__HEROES_READY__ === true, null, { timeout: 15000 });
    await expect(page.getByTestId('menu-new-game')).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});
