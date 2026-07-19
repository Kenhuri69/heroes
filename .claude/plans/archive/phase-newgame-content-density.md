# Plan — Options de génération par catégorie (« Nouvelle partie »)

## Objectif

Permettre au joueur de régler indépendamment, à l'écran « Nouvelle partie », la
quantité de **gardiens**, de **mines**, de **bâtiments événement** (lieux de
bonus / visitables) et de **ressources & artefacts à ramasser**. Aujourd'hui un
seul bouton global (Ressources : Bas/Standard/Riche) pilote la densité de
presque tout via `resourceMultiplier`.

## Orientation (validée avec l'utilisateur)

- **1 curseur combiné** pour « ressources & artefacts » (resource + treasure + artifact) → 4 curseurs au total.
- **Cran « Aucun » (×0) autorisé** partout, y compris gardiens (⇒ carte pacifique : plus de sentinelle non plus).
- **Superposé, comportement par défaut inchangé** : chaque curseur est un **facteur relatif** multiplié sur la densité existante ; défaut = « Standard » (×1) ⇒ carte identique à aujourd'hui à graine égale.
- **Zéro diff moteur, pas de bump `CURRENT_SAVE_VERSION`** (les options sont consommées à la génération puis jetées ; la carte résolue est cuite dans `GameState`). Cohérent avec le lot « Nouvelle partie configurable » (doc 09, 6.3).

Crans par curseur : `Aucun (×0)` · `Rare (×0.5)` · `Standard (×1)` · `Abondant (×2)` · `Aléatoire` (tiré depuis la graine).

## Étapes

1. **`packages/content/src/mapgen.ts`** : ajouter 4 options `guardianDensity`,
   `mineDensity`, `eventBuildingDensity`, `pickupDensity` (défaut 1). Helper
   `scaledCat(base, factor)` = 0 si facteur ≤ 0, sinon `Math.max(1, round(base*density*factor))`
   (⇒ identique à `scaled(base)` pour facteur 1). Appliquer par catégorie ;
   gardiens (2 passes + sentinelles) pilotés par `guardianDensity`, sentinelle
   coupée si `guardianDensity ≤ 0`. Habitations (`dwelling`) **inchangées**
   (hors périmètre de la liste demandée).
   → vérif : `pnpm --filter @heroes/content test` (nouveaux cas 0/abondant).
2. **`packages/client/src/app/content.ts`** : élargir le type `opts` de
   `resolveGeneratedMap` avec les 4 densités (déjà spread `...opts`).
   → vérif : typecheck.
3. **`packages/client/src/app/game.ts`** : `CONTENT_LEVEL_FACTOR`
   (none/rare/standard/abundant), type `ContentLevel`, 4 champs dans
   `NewGameRawConfig` + `ResolvedNewGame.map`, résolution seedée (picks
   **en dernier** pour ne pas décaler la séquence RNG des tirages existants).
   → vérif : typecheck.
4. **`packages/client/src/main.ts`** : passer les 4 densités à `resolveGeneratedMap`.
   → vérif : typecheck.
5. **`NewGameScreen.tsx`** : 4 sections segmentées (défaut `standard`) + config brute.
   → vérif : typecheck.
6. **Locales fr/en** : titres des 4 curseurs + libellés de crans partagés
   (`newgame.contentLevel.*`).
   → vérif : audit i18n (parité, 0 clé manquante).
7. **Tests** : `mapgen.test.ts` (facteur 0 ⇒ catégorie absente incl. sentinelles ;
   abondant > standard) ; smoke : régler un curseur et vérifier le démarrage.
   → vérif : `pnpm test`, `pnpm build`, smoke headless.
8. **Docs** : doc 08 (écran Nouvelle partie), doc 09 (roadmap 6.3), CLAUDE.md.

## Suivi

- [x] 1 mapgen  - [x] 2 content  - [x] 3 game  - [x] 4 main  - [x] 5 UI
- [x] 6 locales - [x] 7 tests  - [x] 8 docs
- [x] typecheck / lint / test / build / smoke verts

### Notes de réalisation

- Habitations (`dwelling`) laissées inchangées (hors des 4 catégories demandées).
- Identité par défaut prouvée par un test (`facteurs 1 explicites = défaut`).
- Picks « Aléatoire » des 4 curseurs placés en dernier dans `resolveNewGameConfig`
  ⇒ aucune régression de la séquence RNG des tirages existants (faction/carte/héros).
- Smoke étendu (`newgame-guardians-abundant`, `newgame-mines-none`) ; suite complète verte.
- Env sandbox : smoke lancé avec `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
