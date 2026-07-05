// Captures d'audit ergonomique (skill ux-audit). Pilote le build de prod servi
// par `vite preview` (http://127.0.0.1:4173/heroes/) et shoote chaque écran ×
// viewport × cran de police. Mesure aussi les cibles tactiles DOM < 44 px (A1).
//
// Usage : node .claude/skills/ux-audit/capture.mjs [dossier-sortie]
//   PW_CHROMIUM_PATH=/chemin/chrome  (Chromium préinstallé, sandbox/conteneur)
// Prérequis : `pnpm build && pnpm --filter @heroes/client preview` en fond.

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

/** Écrans à capturer : chacun prépare l'état voulu depuis une page prête. */
const SCREENS = [
  { name: 'menu', open: async (page) => page.goto(BASE) },
  { name: 'adventure', open: async (page) => page.goto(`${BASE}?seed=42`) },
  {
    name: 'town',
    open: async (page) => {
      await page.goto(`${BASE}?seed=42`);
      await ready(page);
      await page.getByTestId('town-open').click({ timeout: 5000 });
      await page.getByTestId('town-tab-build').waitFor({ timeout: 5000 });
    },
  },
  {
    name: 'combat',
    open: async (page) => {
      // L'arène immédiate exige la seed ET le hash ensemble (cf. smoke). Passage
      // par about:blank : sinon un `#arena` ajouté à une URL déjà en `?seed=42`
      // est une navigation same-document (pas de reload) et le bootstrap arène
      // ne rejoue pas.
      await page.goto('about:blank');
      await page.goto(`${BASE}?seed=42#arena`);
      await ready(page);
      await page.getByTestId('combat-round').waitFor({ timeout: 5000 });
    },
  },
];

async function ready(page) {
  await page.waitForFunction(() => window.__HEROES_READY__ === true, { timeout: 15000 });
}

/** Mesure les cibles tactiles DOM visibles ; renvoie celles sous 44 px. */
function measureTargets(page) {
  return page.evaluate((min) => {
    const sel = 'button, a, [role="button"], input, select, [data-testid^="town-build-"]';
    const under = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // caché
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

async function run() {
  await mkdir(OUT, { recursive: true });
  const launch = process.env.PW_CHROMIUM_PATH
    ? { executablePath: process.env.PW_CHROMIUM_PATH }
    : {};
  const browser = await chromium.launch(launch);
  const warnings = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      locale: 'fr-FR',
    });
    const page = await context.newPage();
    for (const screen of SCREENS) {
      for (const font of FONT_SCALES) {
        const tag = `${screen.name}-${vp.name}-font${font}`;
        try {
          await screen.open(page);
          await ready(page);
          // Cran de police : l'app pose font-size sur <html> (rem partout).
          await page.evaluate((pct) => {
            document.documentElement.style.fontSize = pct;
          }, FONT_PERCENT[font]);
          await page.waitForTimeout(300); // laisse le rendu se stabiliser
          await page.screenshot({ path: `${OUT}/${tag}.png` });
          const under = await measureTargets(page);
          if (under.length > 0) {
            warnings.push({ tag, under });
            console.log(`WARN ${tag} — ${under.length} cible(s) DOM < ${MIN_TARGET}px :`);
            for (const u of under) console.log(`     ${u.tag}[${u.testid}] ${u.w}×${u.h}`);
          } else {
            console.log(`ok   ${tag}`);
          }
        } catch (e) {
          console.log(`FAIL ${tag} — ${String(e).split('\n')[0]}`);
        }
      }
    }
    await context.close();
  }
  await browser.close();

  console.log(`\nCaptures dans ${OUT}/. A1 (cibles < 44 px) : ${warnings.length} écran(s) en warning.`);
  console.log(
    'Rappel : les hexes de combat sont dans le CANVAS (non mesurés ici) — ' +
      'c\'est le constat CL7/A7, à traiter au lot U1.',
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
