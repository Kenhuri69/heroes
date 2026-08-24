# Plan — Taille de carte « Colossale » 512²

> Branche : `claude/map-extension-options-8xt11c`. Décision utilisateur (2026-07-19,
> « go 512 ») : ajouter un 5ᵉ cran de taille de carte à **512²**, après l'analyse de
> faisabilité (sous-sol reporté). Contrainte non négociable : **zéro faction dans le
> moteur**, RNG seedé (jamais `Math.random`), moteur sans dépendance rendu, docs =
> source de vérité.

## Contexte (recherche faite)

- Le moteur est **size-agnostique** : indexation `y*width+x` partout (fog, A\*, objets,
  mouvement, roam, vision). Aucune borne haute côté règles. → **zéro diff moteur**.
- **Plafond bloquant** : `mapFileSchema` cape `width`/`height` à **256**
  (`schemas.ts:1027-1028`). Les cartes générées passent par `loadMap` →
  `mapFileSchema.parse` (`content.ts:133`), donc le cap est **load-bearing**, pas
  cosmétique — à bumper à 512.
- **Rendu déjà prêt** : `Tilemap` chunké 16² + construction paresseuse + culling au
  viewport (`tilemap.ts:65-120`). Coût borné au viewport, quelle que soit la taille.
- **A\* déjà bordé** contre le flood (le risque « gel IA ») : budget `maxCost` (F7) +
  pré-filtre `octileLowerBound` qui écarte les cibles hors budget **sans** lancer
  l'A\* sur le chemin chaud de l'IA (`path.ts:53-152`).
- **Save** : `explored` sérialisé en tableau brut (`serialize.ts:26`) — 262 144
  entrées/joueur à 512², mais gzippé et surtout des 0 ⇒ très compressible.
  Plafond cloud `MAX_SAVE_BYTES = 4 Mo` (`worker.ts:40`) → **à mesurer**.
- **Aucun bump `CURRENT_SAVE_VERSION`** : la forme de save ne change pas (le cap de
  taille est une borne de validation, pas un champ). Golden inchangé (unités
  synthétiques du replay ≠ génération de carte).

## Lots (chacun vérifiable)

### Lot 1 — Enablement 512  ✅
- `schemas.ts` : `width`/`height` `.max(256)` → `.max(512)`. ✅
- `game.ts` : `MAP_SIZE_DIMENSIONS` += `colossal: 512` ; `MAP_SIZE_ORDER` += `'colossal'`. ✅
- `NewGameScreen.tsx` : `MAP_SIZES` += `'colossal'` (avant `RANDOM`). ✅
- Locales `en.json`/`fr.json` : `newgame.mapSize.colossal` = « Colossal (512²) » /
  « Colossale (512²) ». ✅
- Vérif : typecheck ✅ ; lint ✅ ; smoke newgame existant vert ✅.

### Lot 2 — Tests & mesure perf/mémoire  ✅
- Test contenu : `generateMap(512)` → `loadMap` **valide** + **déterministe** (2 runs
  identiques), 4 départs. ✅ (`mapgen.test.ts`, 158 tests contenu verts.)
- Mesure ad hoc (test jetable supprimé) : save gzip 512² **~129 Ko** tout exploré à
  4 joueurs (raw 6,6 Mo, écrasé par la répétition) ⇒ 32× sous le cap cloud 4 Mo. ✅
- Vérif headless one-off (guideline §7) : partie 512² **génère + rend + pan sans
  gel**, 0 erreur console, `map.width=512` (test jetable supprimé, ~45 s dont ~45 s
  de génération en rendu logiciel). ✅ Non ajouté au smoke CI (coûteux).
- Vérif : content 158 ✅, moteur 935 (golden inchangé) ✅, budget 351 Ko < 800 ✅.

### Lot 3 — Docs & mémoire  ✅
- `docs/02-mechanics.md` : table des tailles (+ Colossale 512²) + note plafond 512
  + « 64²→512² jouables ». ✅
- `CLAUDE.md` : ligne mémoire « Extension carte » mise à jour (cran 512). ✅
- Ce plan finalisé. ✅

## Journal
- (init) Recherche terminée : moteur size-agnostique, A\* déjà bordé, rendu chunké
  prêt, seul le cap schéma 256 bloque. Plan écrit. Décision : reporter le sous-sol
  (chantier moteur transversal + bump save), livrer 512 (données + client + 1 champ
  schéma).
- Lot 1 ✅ : cap schéma 256→512, cran `colossal: 512`, `MAP_SIZE_ORDER`, `MAP_SIZES`,
  locales FR/EN. Typecheck + lint verts.
- Lot 2 ✅ : test contenu 512² (valide+déterministe). Mesure save : **129 Ko gzip**
  au pire cas (32× sous cap 4 Mo) ⇒ save non-problématique. Headless one-off :
  512² génère/rend/pan sans gel ni erreur (~45 s génération, overlay de progression).
  Moteur 935/935 golden inchangé, budget 351 Ko.
- Lot 3 ✅ : docs 02 + mémoire CLAUDE.md alignées. **Sortie du lot 512.**
- **Observé/limitation** : génération 512² ~45 s en rendu logiciel conteneur (SwiftShader) ;
  sur vrai GPU plus rapide, et couverte par `LoadingOverlay`. Pas de smoke 512² en CI
  (le contenu couvre la validité/déterminisme ; le smoke coûte ~100×).
