# Plan — Phase 2.0 : Bootstrap & déploiement continu

Réf : `docs/10-plan-phase-2-implementation.md` §3 (Phase 2.0). Premier code
exécutable du dépôt → le smoke test headless est livré **dans le même lot**
(guideline §7).

## Étapes

- [x] Monorepo pnpm + TS strict + ESLint (flat config, garde-fous déterminisme
      armés pour `packages/engine` futur) → vérif : `pnpm typecheck && pnpm lint` verts. ✅
- [x] `packages/client` : Vite + PixiJS 8, damier 32×32 tuiles de 64 px,
      caméra pan (drag 1 doigt/souris), pinch-zoom, molette
      → vérif : smoke headless vert (desktop + mobile). Bundle : 138 Ko gzip
      (budget < 800 Ko, doc 07 §6). ✅
- [x] `tests/smoke.spec.ts` (Playwright/Chromium headless) : la page du build
      de prod charge, le canvas est présent, init Pixi signalée
      (`window.__HEROES_READY__`), zéro erreur console
      → vérif : `pnpm build && pnpm smoke` vert en local (2 projets :
      desktop + viewport mobile). ✅
- [x] `.github/workflows/ci.yml` (PR : typecheck, lint, build, smoke) ;
      `deploy.yml` remplacé par le build Vite réel + smoke sur build de prod
      avant publication ; suppression de `site/` → vérif finale : CI verte sur
      la PR, damier visible sur https://kenhuri69.github.io/heroes/ après merge.
- [x] Docs mises à jour dans le même lot (invariant §8.6) : doc 10 §4.1
      (base fixe), §4.2 (note bootstrap remplacée), CLAUDE.md (phase courante
      + structure). ✅
- [x] Vérif préalable settings Pages : run workflow_dispatch relancé sur main
      → **vert** (dépôt passé en public, Pages actif, page d'attente en ligne). ✅

## Écarts / décisions

1. **`base: '/heroes/'` inconditionnel** dans `vite.config.ts` (le doc 10
   montrait une base conditionnelle au build) : `vite preview` résout
   `command === 'serve'`, la base conditionnelle casserait le smoke test sur
   le build de prod. Base fixe = même comportement en dev/preview/prod.
   Doc 10 §4.1 mis à jour dans le même commit.
2. **Pas encore de Vitest ni `content:check`** dans les workflows : le moteur
   arrive en 2.1, le pipeline de contenu en 2.2 (rien de spéculatif,
   guidelines §2). Les étapes seront ajoutées aux workflows dans ces lots.
3. **Pas de Preact en 2.0** : le shell UI arrive avec la première UI réelle
   (2.3) ; le damier n'a besoin que du canvas.
4. ESLint embarque dès maintenant les interdits `Math.random`/`Date.now`
   scoping `packages/engine/**` et `packages/content/**` (globs sans effet
   tant que les packages n'existent pas — l'invariant est armé, coût nul).
5. pnpm 10 bloque les scripts postinstall : `pnpm.onlyBuiltDependencies:
   ["esbuild"]` ajouté au package.json racine (reproductible en CI).
6. Le smoke a détecté un 404 favicon (première prise du filet « zéro erreur
   console ») → favicon SVG inline dans `index.html`.
7. Sandbox sans les révisions de navigateurs Playwright : override opt-in
   `PW_CHROMIUM_PATH` dans `playwright.config.ts` (la CI installe sa propre
   révision, non affectée).
