// Captures d'audit ergonomique (skill ux-audit). Pilote le build de prod servi
// par `vite preview` (http://127.0.0.1:4173/heroes/) et shoote chaque écran ×
// viewport × cran de police. Mesure aussi les cibles tactiles DOM < 44 px (A1).
//
// Usage : node .claude/skills/ux-audit/capture.mjs [dossier-sortie]
//   PW_CHROMIUM_PATH=/chemin/chrome  (Chromium préinstallé, sandbox/conteneur)
// Prérequis : `pnpm build && pnpm --filter @heroes/client preview` en fond.
//
// Remise à niveau lot X1 (plan ux-enrichissement-2026-07) :
// - un « flux » prépare l'état UNE fois puis photographie ses écrans aux
//   3 crans de police (l'ancien script rejouait la préparation 3 fois) ;
// - le combat franchit le PreBattleScreen (et le capture au passage) ;
// - le tiroir héros n'est cliqué qu'en mobile (colonne permanente ≥ 900 px) ;
// - le sélecteur A1 ne mesure que les éléments interactifs (plus de faux
//   positif sur les spans `town-build-queue-state`) ;
// - nouveaux écrans : newgame, options, market, guild, quests, outcome,
//   handoff — et un parcours « joueur réel » (NewGameScreen → Haven) pour
//   adventure/town/hero, en plus du chemin dev `?seed=42` (test-faction).

import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173/heroes/';
const OUT = process.argv[2] ?? 'ux-captures';
const MIN_TARGET = 44;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800, isMobile: false, deviceScaleFactor: 1 },
  { name: 'mobile', width: 360, height: 640, isMobile: true, deviceScaleFactor: 3 },
];
const FONT_SCALES = [1, 2, 3];
const FONT_PERCENT = { 1: '100%', 2: '112.5%', 3: '125%' };

async function ready(page) {
  await page.waitForFunction(() => window.__HEROES_READY__ === true, { timeout: 15000 });
}

/** Attend la fin d'un éventuel relais IA après un EndTurn dispatché. */
async function aiIdle(page) {
  await page.waitForFunction(() => window.__HEROES_TEST__?.getAiTurn() === null, {
    timeout: 60000,
  });
}

/** Fin de tour déterministe via le hook moteur (le tap-tap a son smoke dédié). */
async function endTurn(page) {
  await page.evaluate(() => {
    const s = window.__HEROES_TEST__.getState();
    const playerId = s.players[s.currentPlayer].id;
    return window.__HEROES_TEST__.dispatch({ type: 'EndTurn', playerId });
  });
  await aiIdle(page);
}

/** Mesure les cibles tactiles DOM visibles ; renvoie celles sous 44 px.
 *  Interactifs seulement (X1.3) : les textes de statut (spans) ne sont pas des
 *  cibles — les cartes cliquables du jeu sont toutes des <button>. */
function measureTargets(page) {
  return page.evaluate((min) => {
    const sel = 'button, a, [role="button"], input, select';
    const under = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // caché
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (r.width < min || r.height < min) {
        under.push({
          tag: el.tagName.toLowerCase(),
          testid: el.getAttribute('data-testid') ?? '',
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return under;
  }, MIN_TARGET);
}

/**
 * Flux de capture : chaque étape prépare un état puis nomme l'écran obtenu.
 * `open(page, vp)` amène à l'état ; les 3 crans de police sont photographiés
 * sans re-préparer (le cran ne change que `font-size` sur <html>).
 * Un flux = une navigation fraîche (robustesse > vitesse).
 */
const FLOWS = [
  {
    name: 'menu',
    steps: [{ screen: 'menu', open: async (page) => page.goto(BASE) }],
  },
  {
    name: 'newgame',
    steps: [
      {
        screen: 'newgame',
        open: async (page) => {
          await page.goto(BASE);
          await ready(page);
          await page.getByTestId('menu-new-game').click();
          await page.getByTestId('newgame-screen').waitFor({ timeout: 5000 });
        },
      },
    ],
  },
  {
    name: 'options',
    steps: [
      {
        screen: 'options',
        open: async (page) => {
          await page.goto(BASE);
          await ready(page);
          await page.getByTestId('menu-options').click();
          await page.getByTestId('options-panel').waitFor({ timeout: 5000 });
        },
      },
    ],
  },
  {
    // Chemin dev conservé (rapide, seed fixe — mais faction de test : les noms/
    // avatars « réels » sont jugés par le flux `real` ci-dessous).
    name: 'seed',
    steps: [
      { screen: 'adventure', open: async (page) => page.goto(`${BASE}?seed=42`) },
      {
        screen: 'town',
        open: async (page) => {
          // U4 (multi-villes) : le testid est town-open-<id> — cibler par préfixe.
          await page.locator('[data-testid^="town-open"]').first().click({ timeout: 5000 });
          await page.getByTestId('town-tab-build').waitFor({ timeout: 5000 });
        },
      },
      {
        screen: 'hero',
        open: async (page, vp) => {
          await page.keyboard.press('Escape'); // referme l'écran de ville
          await page.getByTestId('town-tab-build').waitFor({ state: 'hidden', timeout: 5000 });
          // ≥ 900 px la colonne héros est permanente (toggle en display:none) :
          // ne cliquer la bascule qu'en mobile.
          if (vp.name === 'mobile') {
            await page.getByTestId('hero-drawer-toggle').click({ timeout: 5000 });
            await page.waitForTimeout(300); // transition d'ouverture (0.2s)
          }
        },
      },
    ],
  },
  {
    name: 'arena',
    steps: [
      {
        screen: 'prebattle',
        open: async (page) => {
          // L'arène immédiate exige la seed ET le hash ensemble (cf. smoke).
          // Passage par about:blank : un `#arena` ajouté à une URL déjà en
          // `?seed=42` serait une navigation same-document (pas de bootstrap).
          await page.goto('about:blank');
          await page.goto(`${BASE}?seed=42#arena`);
          await ready(page);
          await page.getByTestId('pre-battle').waitFor({ timeout: 8000 });
        },
      },
      {
        screen: 'combat',
        open: async (page) => {
          await page.getByTestId('pre-battle-fight').click();
          await page.getByTestId('combat-round').waitFor({ timeout: 8000 });
        },
      },
    ],
  },
  {
    // Onglets conditionnels de la ville : marché (jour 1) puis guilde de mages
    // (l'or de départ ne paie pas les deux — on passe des tours jusqu'au coût).
    name: 'town-extras',
    steps: [
      {
        screen: 'market',
        open: async (page) => {
          await page.goto(`${BASE}?seed=42`);
          await ready(page);
          await page.evaluate(() => {
            const s = window.__HEROES_TEST__.getState();
            const townId = s.towns[0].id;
            return window.__HEROES_TEST__.dispatch({
              type: 'BuildStructure',
              townId,
              buildingId: 'market',
            });
          });
          await page.locator('[data-testid^="town-open"]').first().click({ timeout: 5000 });
          await page.getByTestId('town-tab-market').click({ timeout: 5000 });
          await page.getByTestId('town-panel-market').waitFor({ timeout: 5000 });
        },
      },
      {
        screen: 'guild',
        open: async (page) => {
          await page.keyboard.press('Escape'); // referme la ville pour finir les tours
          // 1 construction/jour + or insuffisant le jour 1 : avancer jusqu'à
          // pouvoir payer la guilde (2000 or, revenu +500/jour, plafond large).
          for (let i = 0; i < 8; i++) {
            const gold = await page.evaluate(
              () => window.__HEROES_TEST__.getState().players[0].resources.gold,
            );
            if (gold >= 2000) break;
            await endTurn(page);
          }
          await page.evaluate(() => {
            const s = window.__HEROES_TEST__.getState();
            const townId = s.towns[0].id;
            return window.__HEROES_TEST__.dispatch({
              type: 'BuildStructure',
              townId,
              buildingId: 'mageGuild',
            });
          });
          await page.locator('[data-testid^="town-open"]').first().click({ timeout: 5000 });
          await page.getByTestId('town-tab-guild').click({ timeout: 5000 });
          await page.getByTestId('town-panel-guild').waitFor({ timeout: 5000 });
        },
      },
    ],
  },
  {
    // Parcours joueur réel (X1.5) : menu → Nouvelle partie → faction Haven,
    // petite carte, seed fixe — ville nommée/avatars réels, pas test-faction.
    name: 'real',
    steps: [
      {
        screen: 'adventure-real',
        open: async (page) => {
          await page.goto(BASE);
          await ready(page);
          await page.getByTestId('menu-new-game').click();
          await page.getByTestId('newgame-screen').waitFor({ timeout: 5000 });
          await page.getByTestId('newgame-seat-0-faction').selectOption('haven');
          await page.getByTestId('newgame-size-small').click();
          await page.getByTestId('newgame-seed').fill('42');
          await page.getByTestId('newgame-start').click();
          // Génération de carte (LoadingOverlay) : attendre le HUD de jeu.
          await page.getByTestId('end-turn').waitFor({ timeout: 60000 });
        },
      },
      {
        screen: 'town-real',
        open: async (page) => {
          await page.locator('[data-testid^="town-open"]').first().click({ timeout: 5000 });
          await page.getByTestId('town-tab-build').waitFor({ timeout: 5000 });
        },
      },
      {
        screen: 'hero-real',
        open: async (page, vp) => {
          await page.keyboard.press('Escape');
          await page.getByTestId('town-tab-build').waitFor({ state: 'hidden', timeout: 5000 });
          if (vp.name === 'mobile') {
            await page.getByTestId('hero-drawer-toggle').click({ timeout: 5000 });
            await page.waitForTimeout(300);
          }
        },
      },
    ],
  },
  {
    // Hot-seat 2 humains : le passage d'appareil s'affiche à la fin du tour.
    name: 'handoff',
    steps: [
      {
        screen: 'handoff',
        open: async (page) => {
          await page.goto(BASE);
          await ready(page);
          await page.getByTestId('menu-new-game').click();
          await page.getByTestId('newgame-screen').waitFor({ timeout: 5000 });
          await page.getByTestId('newgame-seat-1-human').click();
          await page.getByTestId('newgame-size-small').click();
          await page.getByTestId('newgame-seed').fill('42');
          await page.getByTestId('newgame-start').click();
          await page.getByTestId('end-turn').waitFor({ timeout: 60000 });
          await page.evaluate(() => {
            const s = window.__HEROES_TEST__.getState();
            const playerId = s.players[s.currentPlayer].id;
            return window.__HEROES_TEST__.dispatch({ type: 'EndTurn', playerId });
          });
          await page.getByTestId('handoff-overlay').waitFor({ timeout: 10000 });
        },
      },
    ],
  },
  {
    // Scénario « survival » : journal de quêtes visible, puis victoire par
    // surviveDays (même boucle déterministe que le smoke).
    name: 'scenario',
    steps: [
      {
        screen: 'quests',
        open: async (page) => {
          await page.goto(BASE);
          await ready(page);
          await page.evaluate(() => window.__HEROES_TEST__.startScenario('survival'));
          await page.getByTestId('end-turn').waitFor({ timeout: 30000 });
        },
      },
      {
        screen: 'outcome',
        open: async (page) => {
          for (let i = 0; i < 30; i++) {
            const outcome = await page.evaluate(
              () => window.__HEROES_TEST__.getState().outcome,
            );
            if (outcome) break;
            await endTurn(page);
          }
          await page.getByTestId('outcome-overlay').waitFor({ timeout: 10000 });
        },
      },
    ],
  },
];

async function run() {
  await mkdir(OUT, { recursive: true });
  const launch = process.env.PW_CHROMIUM_PATH
    ? { executablePath: process.env.PW_CHROMIUM_PATH }
    : {};
  const browser = await chromium.launch(launch);
  const warnings = [];
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      locale: 'fr-FR',
    });
    const page = await context.newPage();
    for (const flow of FLOWS) {
      let broken = false; // une étape ratée invalide la suite du flux
      for (const step of flow.steps) {
        if (broken) {
          for (const font of FONT_SCALES) console.log(`SKIP ${step.screen}-${vp.name}-font${font}`);
          continue;
        }
        try {
          await step.open(page, vp);
          await ready(page);
          for (const font of FONT_SCALES) {
            const tag = `${step.screen}-${vp.name}-font${font}`;
            // Cran de police : l'app pose font-size sur <html> (rem partout).
            await page.evaluate((pct) => {
              document.documentElement.style.fontSize = pct;
            }, FONT_PERCENT[font]);
            await page.waitForTimeout(250); // laisse le rendu se stabiliser
            await page.screenshot({ path: `${OUT}/${tag}.png` });
            const under = await measureTargets(page);
            if (under.length > 0) {
              warnings.push({ tag, under });
              console.log(`WARN ${tag} — ${under.length} cible(s) DOM < ${MIN_TARGET}px :`);
              for (const u of under) console.log(`     ${u.tag}[${u.testid}] ${u.w}×${u.h}`);
            } else {
              console.log(`ok   ${tag}`);
            }
          }
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '100%';
          });
        } catch (e) {
          failures++;
          broken = true;
          console.log(`FAIL ${step.screen}-${vp.name} — ${String(e).split('\n')[0]}`);
        }
      }
    }
    await context.close();
  }
  await browser.close();

  console.log(
    `\nCaptures dans ${OUT}/. A1 (cibles < 44 px) : ${warnings.length} écran(s) en warning ; ${failures} étape(s) en échec.`,
  );
  console.log(
    'Rappel : les hexes de combat sont dans le CANVAS (non mesurés ici) — ' +
      'couverts par la caméra min-scale du lot U1 (pan/pinch, cibles ≥ 44 px).',
  );
  if (failures > 0) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
