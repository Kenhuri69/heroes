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
2. [ ] vitest 5 (+ pool Workers du serveur)
3. [ ] eslint 10
4. [ ] vite 8 (+ preset Preact)
5. [ ] immer 11
6. [ ] zod 4
7. [ ] preact 11
8. [ ] TypeScript 7 (compatibilité typescript-eslint à vérifier)
9. [ ] Docs (07 si versions citées), CLAUDE.md, plan d'enrichissement ; Playwright

## 4. Journal

- 2026-10-28 : plan ouvert.
- 2026-10-28 : étape 1 — `pnpm -r update` dans les plages existantes (lockfile
  seul) : pixi.js 8.22, @playwright/test 1.64, wrangler 4.154, typescript-eslint
  8.72, fast-check 4.10, zustand 5.0.16, preact 10.29.8… Tout vert ; bundle
  389 726 → 401 800 o gzip (pixi.js), budget 819 200.
