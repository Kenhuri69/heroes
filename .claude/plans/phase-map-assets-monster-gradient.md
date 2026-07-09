# Plan — Tailles d'assets cohérentes + gradation des gardiens

Demande utilisateur : (1) uniformiser la taille des objets posés sur la carte
d'aventure (le **coffre au trésor** est bien trop gros vs les autres) ;
(2) revoir la **disposition des monstres** pour une **gradation** autour des
points de départ — du plus **faible** près des départs au plus **fort** vers le
centre.

## Contexte (constats de code)

- `packages/client/src/render/mapObjects.ts` : deux stratégies de taille
  incohérentes coexistent.
  - `withMapProp(prop, fallback, scale=1.0)` (props peints) ajuste par la plus
    grande dimension à `TILE_SIZE * scale`. **Le coffre** (`buildTreasure`)
    appelle `withMapProp('chest', …)` **sans réduire `scale`** ⇒ occupe toute
    la tuile (64 px) = « trop gros ».
  - `sprite.setSize(…)` (direct) : ressource/gardien = `TILE_SIZE` plein,
    artefact = `0.8`.
- `packages/content/src/mapgen.ts` : les gardiens sont placés à des tuiles
  **totalement aléatoires** ; l'unité est tirée **uniformément** dans la palette
  (aucun tier), la pile `count = randBetween(5,20)` fixe. **Aucun lien** avec la
  distance aux départs ni au centre.

## Étapes

### 1. Tailles cohérentes des objets de carte → `mapObjects.ts`
- [x] Ajouter `COLLECTIBLE_SCALE = 0.8` (ressource, coffre, artefact = petits
      objets posés) et un helper `placeSprite(texture, scale)` (ancre 0.5, ajuste
      la plus grande dimension à `TILE_SIZE*scale`, centre sur la tuile).
- [x] `withMapProp` réutilise `placeSprite` (DRY).
- [x] `buildResourcePile` : `placeSprite(tex, COLLECTIBLE_SCALE)` (au lieu de
      `setSize(TILE, TILE)`).
- [x] `buildTreasure` : `withMapProp('chest', …, COLLECTIBLE_SCALE)`.
- [x] `buildGroundArtifact` : `placeSprite(texture, COLLECTIBLE_SCALE)`.
- Gardien (créature) laissé **plein tuile** = volontairement le plus visible.
- Vérif : coffre/ressource/artefact rendus à la même empreinte (0.8), plus petits
  que le gardien.

### 2. Gradation des gardiens → `mapgen.ts` (+ plomberie tiers)
- [x] `loader.ts` : helper `knownUnitTiers(report): Record<string, number>`
      (id → tier), exporté depuis `index.ts`.
- [x] `MapGenOptions.unitTiers?: Record<string, number>` (optionnel ⇒ rétro-
      compatible ; sans lui, gradation par pile seule).
- [x] Fonction `difficultyAt(x,y) = min(1, distNearestStart / radius)` : 0 près
      d'un départ → 1 au centre / zones profondes.
- [x] Sélection d'unité **graduée par tier** : palette triée par tier, index ≈
      `t*(n-1)` (± jitter) ⇒ bas tier près des départs, haut tier au centre.
- [x] Pile `count` graduée : `~4` près des départs → `~40` au centre (± jitter).
- [x] Léger relèvement du nombre de gardiens pour rendre la rampe visible.
- [x] `content.ts` + `tools/map-gen.ts` : passer `unitTiers`.

### 3. Tests & non-régression
- [x] Test unitaire mapgen : gardiens près des départs = tier/pile plus faibles
      que ceux proches du centre (déterministe).
- [x] `pnpm typecheck && pnpm lint && pnpm test` verts.
- [x] Smoke Playwright/Chromium headless : **131 passed** (1 flaky pré-existant
      — « raccourci E + garde-fou fin de tour », sans lien avec ce lot ; repasse
      vert en isolé ; la CI absorbe via `retries: 2`).
- Garde-fous : zéro diff **moteur** (changements dans `@heroes/content` +
  client uniquement), garde-fou « zéro faction » intact, pas de bump
  `CURRENT_SAVE_VERSION` (carte générée, hors sauvegarde de forme).
