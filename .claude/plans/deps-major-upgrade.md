# Mise à jour des dépendances majeures

> Reliquat §1.4 du plan `game-experience-enrichment.md` (« dépendances majeures à
> mettre à jour, lot dédié », relevé par `archive/code-review-2026-09.md` §4).
> Choix de l'utilisateur le 2026-10-28.

## 1. Constat (`pnpm -r outdated`, 2026-10-28)

| Paquet | Actuel | Dernier | Portée |
|---|---|---|---|
| typescript | 5.9.3 | 7.0.2 | tous |
| vitest | 3.2.6 (server 4.1.11) | 5.0.5 | engine, content, client, server |
| vite | 7.3.6 | 8.3.5 | client |
| eslint, @eslint/js | 9.39 | 10 | racine |
| immer | 10.2 | 11.2 | engine |
| zod | 3.25 | 4.6 | content |
| preact | 10.29 | 11.1 | client |
| @types/node | 22 | 26 | **garder 22** : CI et `engines` sur Node 22 |
| mineures/correctifs | — | — | pixi.js 8.22, playwright 1.64, wrangler, fast-check, typescript-eslint, zustand, tsx… |

## 2. Règles

- Une famille = un commit vérifié (typecheck, lint, build, tests, golden,
  `content:check`, budget) ; Playwright complet avant le push.
- Golden replay **inchangé** exigé (immer touche le moteur).
- Une famille qui demande une refonte disproportionnée est **reportée** avec la
  raison écrite ici, pas forcée.
- Aucun changement de règle de jeu ; pas de bump `CURRENT_SAVE_VERSION`.

## 3. Étapes

1. [x] Mineures et correctifs
2. [x] vitest 5 (+ pool Workers du serveur)
3. [x] eslint 10
4. [x] vite 8 (+ preset Preact)
5. [x] immer 11
6. [x] zod 4
7. [x] preact 11
8. [x] TypeScript 6.0 (TS 7 reporté)
9. [x] Docs (aucune version périmée dans 07/10/README), CLAUDE.md, plan d'enrichissement ; [ ] Playwright

## 4. Journal

- 2026-10-28 : plan ouvert.
- 2026-10-28 : étape 1 — `pnpm -r update` dans les plages existantes (lockfile
  seul) : pixi.js 8.22, @playwright/test 1.64, wrangler 4.154, typescript-eslint
  8.72, fast-check 4.10, zustand 5.0.16, preact 10.29.8… Tout vert ; bundle
  389 726 → 401 800 o gzip (pixi.js), budget 819 200.
- 2026-10-28 : étape 2 — vitest 5.0.5 partout. `@cloudflare/vitest-pool-workers`
  est déprécié (renommé) et plafonné à vitest 4 ⇒ remplacé par
  `@cloudflare/vitest-plugin` 1.4.9 (même API `cloudflareTest`, types
  `@cloudflare/vitest-plugin/types`). Aucun test modifié ; docs 15 et CLAUDE.md
  suivent le renommage.
- 2026-10-28 : étape 3 — eslint et @eslint/js 10 ; config plate inchangée. La
  nouvelle règle recommandée `no-useless-assignment` relève 10 initialisations
  écrasées dans `CombatScene.ts` (try/catch qui assignent des deux côtés, HSL
  dont chaque branche assigne) : initialiseurs retirés, comportement inchangé.
- 2026-10-28 : étape 4 — vite 8.3 (Rolldown) ; @preact/preset-vite accepte 8.x.
  `manualChunks` objet n'existe plus : chunk `pixi` reconstitué par un groupe
  `rolldownOptions.output.codeSplitting` ; `__dirname` → `import.meta.dirname`
  (avertissement du chargeur de config natif). Les deux mini-chunks dynamiques de
  pixi (`browserAll`, `webworkerAll`, < 0,3 Ko) rejoignent le chunk `pixi`.
  Bundle 401 789 → 388 183 o gzip. Smoke ciblé (démarrage, tap-tap ×4) vert ;
  un échec isolé de tap-tap sous charge parallèle, non reproduit en 8 passages.
- 2026-10-28 : étape 5 — immer 11.2 : aucune modification de code (`produce`,
  `current`, `isDraft`, `original` inchangés). Golden inchangé ; `faction:sim`
  identique à l'octet ; durée 155 s (immer 10) contre 162 s (immer 11) sur le
  conteneur, dans le bruit.
- 2026-10-28 : étape 6 — zod 4.6. Seul changement de sens relevé :
  `z.record(z.enum(...), …)` devient **exhaustif** (toutes les clés requises) ;
  les 7 enregistrements par ressource (coûts, stock de départ, `resourceValue`,
  butins…) sont partiels par nature ⇒ `z.partialRecord`. Autres pièges vérifiés :
  aucun `.default({})` sur un objet à défauts internes (seulement des records),
  pas d'usage de `.errors`. Bundle 388 667 → 402 488 o gzip (le loader embarque
  zod côté client) — 49 % du budget.
- 2026-10-28 : étape 7 — preact 11.1 (preset-vite 2.10 compatible) : aucune
  modification. Ruptures vérifiées dans le code : plus de suffixe `px` automatique
  sur un `style` numérique (les 15 `style=` du client sont des chaînes ou des
  variables CSS), aucun `defaultProps`/`forwardRef` ; `useSyncExternalStore`
  toujours exporté par `preact/compat`. Couverture réelle = smoke Playwright.
- 2026-10-28 : étape 8 — **TypeScript 7 reporté** : typescript-eslint 8.72 (le
  dernier) exige `typescript <6.1.0` ; lint typé impossible sous TS 7. Montée à
  **TS 6.0.3**, la dernière compatible. Ruptures de TS 6 corrigées : `baseUrl`
  déprécié (retiré du tsconfig client, `paths` déjà relatifs) ; `types` vaut `[]`
  par défaut ⇒ `"types": ["node"]` explicite dans engine et content, ce qui
  reproduit l'inclusion automatique d'avant (`structuredClone`, `node:*` des
  tests). À rouvrir quand typescript-eslint acceptera TS 7.
- 2026-10-28 : smoke complet — **régression preact 11** attrapée par « options :
  bascule de langue » (3 échecs sur 3) : fermer l'aide des raccourcis ouverte
  depuis Options fermait aussi Options. Cause : la couche démontée pendant le clic
  perd ses écouteurs (Preact 11 vide `_listeners` au démontage, le rendu passe en
  microtâche entre deux écouteurs) ; le `stopPropagation` de son panneau ne joue
  plus et le clic remonte au fond d'Options. Correctif générique : helper
  `ui/backdrop.ts` `closeOnBackdrop` — un fond ne ferme que sur un clic qui le
  vise lui-même (`target === currentTarget`) ; appliqué aux 23 fonds cliquables
  (modales, fiches, cartes). Vérifié isolément puis par le test du smoke.
