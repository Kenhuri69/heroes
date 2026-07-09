# Plan — Alliances / équipes (lot moteur, config de partie)

« La suite » demandée après les couleurs : des joueurs **alliés** qui ne se
combattent pas et **partagent la victoire**. Contrairement aux couleurs, c'est un
vrai lot **moteur** (champ d'état + prédicat « ennemi » + bump save + golden).

## Modèle
- `PlayerState.team: number` (requis) et `PlayerSetup.team?: number` (défaut 0).
  **`team === 0` = sans alliance** (ennemi de tous, y compris des autres team 0) ⇒
  comportement FFA **identique** à aujourd'hui quand personne ne choisit d'équipe.
- Alliés = `areAllies(a,b)` : `a.id !== b.id && a.team !== 0 && a.team === b.team`.

## Points moteur touchés (générique, aucune faction)
1. `core/state.ts` : champ `team`, helper `areAllies`, bump `CURRENT_SAVE_VERSION`
   11→**12** + doc du champ + doc 07 §4.
2. `core/commands.ts` : `PlayerSetup.team?`.
3. `core/engine.ts` (StartGame) : `team: p.team ?? 0`.
4. `scenario/outcome.ts` :
   - `eliminateAllEnemies` : allié compté comme non-ennemi.
   - `evaluateOutcome` : le scan `enemyWinner` ignore les alliés ; le « gagnant »
     de repli sur défaite n'est pas un allié.
5. `town/capture.ts` : interdit d'assiéger la ville d'un **allié**.
6. `ai/adventure.ts` : `pickAdjacentCapturableTown` saute les villes **alliées**.

## Save / golden
- `save-shape.test.ts` : `toBe(11)` → `toBe(12)`.
- `golden-replay.test.ts` : le champ `team` change l'état sérialisé ⇒ **re-fixer
  `GOLDEN_HASH`** (2 joueurs, team 0). Re-run, coller la nouvelle valeur.

## Client
- `game.ts` : `NewGameSlot.team`, propager dans `newGameSeat`/`newGameStartCommand`
  → `PlayerSetup.team` ; `resolveNewGameConfig` reporte l'équipe.
- `NewGameScreen.tsx` : sélecteur d'équipe par siège (Aucune / A / B / C …), i18n.
- La victoire partagée tombe toute seule (objectif `eliminateAllEnemies` : dès que
  tous les non-alliés sont éliminés, chaque allié le remplit).

## Tests moteur (nouveaux)
- allié non compté comme ennemi ⇒ victoire quand tous les NON-alliés éliminés,
  allié encore vivant.
- siège d'une ville alliée refusé (`validateCaptureTown`).
- FFA inchangé (team 0 partout) : mêmes issues qu'avant.

## Étapes (vérif)
1. Moteur (state/commands/engine/outcome/capture/ai) → typecheck.
2. Bump version + doc + save-shape → `pnpm --filter @heroes/engine test` (save-shape).
3. Re-fixer golden → engine test vert.
4. Tests teams (nouveau fichier) → verts.
5. Client (game.ts + NewGameScreen + locales) → build.
6. Smoke : partie avec 2 alliés vs 1 ⇒ démarre, `players[].team` corrects.
7. typecheck + lint + build + engine/content tests + garde-fou faction + smoke.

## Écarts constatés
- Étapes 1→7 faites. Helper `areAllies` dans `core/state.ts`, exporté par l'index.
- `team === 0` = sans alliance (défaut) ⇒ FFA strictement inchangé (test dédié).
- Golden re-fixé 4c6b39e6 → 60ade9a5 (seule la forme change, joueurs team 0).
- save-shape v12→v13 ; ~7 fixtures de test moteur complétées avec `team: 0`.
- **Rebase** : `main` avait déjà bumpé save→v12 (lot P2/C1 `heroAttackUsed`) ⇒
  collision résolue en **v13** ; golden re-calculé `d49416ba` (état = main +
  heroAttackUsed + team).
- Client : `NewGameSlot.team` + `NewGameSeat.team` + `PlayerSetup.team` ; sélecteur
  d'équipe par siège (Aucune/A/B/C) ; locales FR/EN.
- Victoire partagée : tombe toute seule via `eliminateAllEnemies` (allié = non-ennemi).
- Vérifs : engine 381 ✓, content 92 ✓, typecheck/lint/build ✓ (~103 Ko gzip), garde-fou
  faction ✓, smoke config (players team [1,1,0]) ✓. Suite complète en cours.
