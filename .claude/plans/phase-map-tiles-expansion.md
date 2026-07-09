# Plan — Extension carte : tailles, terrains, génération par biomes, assets de profondeur

> Branche : `claude/map-tiles-expansion-8kaqr1`. Décisions utilisateur (2026-07-09) :
> **tailles** culling puis 64/128/256 ; **terrains** set complet type HoMM ;
> **génération** biomes par bruit ; **profondeur** pipeline + prompts Gemini + repli
> procédural. Contrainte non négociable : **zéro faction dans le moteur**, RNG seedé
> (jamais `Math.random`), moteur sans dépendance rendu, docs = source de vérité.

## Contexte (état des lieux, recherche)

- **Tailles** : `MAP_SIZE_DIMENSIONS = {small:24,medium:36,large:48}` (`game.ts:673`).
  Schéma Zod plafonne à **256** (`schemas.ts:509`). `generateMap` : min 12, aucune
  borne haute. proto-01 = 32×32 (écrit main). Point dur rendu : `tilemap.ts:62` perd
  le cache mono-texture dès `W+H ≥ 124` ; **aucun culling/chunking**.
- **Terrains (4)** : grass(100)/swamp(150)/water(null)/mountain(null)
  (`config.json:11`). Schéma terrain = chaîne ouverte, validée au load contre la
  config (`loader.ts:835`). Repli couleur : `tilemap.ts:13`, `MiniMap.tsx:23`.
  Recettes procédurales : `gen_tiles.py` (échoue si un terrain config n'a pas de
  recette).
- **Génération** : `mapgen.ts` — PRNG mulberry32 + amas de disques aléatoires
  (pas de bruit, pas de biomes), routes vides.
- **Assets** : tuiles plates gouache 64², 3 variantes, losange iso dérivé. Profondeur
  = via props overlay `assets/map/` + `mapObjects.ts` (ancrage `isoAnchor` + tri
  `isoDepth`). Tuiles plates 64×32 ne portent pas de relief.

## Lots (chacun vérifiable, commit atomique)

### Lot 1 — Terrains data + assets procéduraux plats  ✅
- `data/core/config.json` : ajouter dirt(100), sand(150), forest(150), snow(150),
  rough(125), river(200 passable), rocks(null). **Ne pas** toucher aux 4 existants
  (stabilité golden).
- `gen_tiles.py` : recettes procédurales pour les 7 nouveaux terrains. Régénérer
  `assets/tiles/*` + `iso/*` (déterministe, re-run = octets identiques).
- `tilemap.ts` TERRAIN_COLORS + `MiniMap.tsx` TERRAIN : nuances de repli par terrain.
- Vérif : `gen_tiles.py` × 2 ⇒ `git status` propre ; typecheck ; tests contenu.

### Lot 2 — Génération par biomes  ✅
- `mapgen.ts` : bruit de valeur fractal seedé (élévation + humidité + latitude/temp),
  classification en biomes cohérents (eau basse → sable côtier → plaine/forêt/
  marais/rough/neige selon humidité+temp → montagne/rochers en altitude), **rivières**
  tracées de l'altitude vers l'eau (terrain river passable). Légende à chars fixes.
  Départs & objets forcés sur tuile franchissable. Rester pur & déterministe.
- `mapgen.test.ts` : config de test étendue aux nouveaux terrains ; asserts biomes
  (eau présente, cohérence côte/sable, déterminisme, validité loadMap N graines).
- Vérif : tests mapgen verts, déterminisme, validité sur ≥40 graines et tailles.

### Lot 3 — Rendu : chunking + culling  ✅
- `tilemap.ts` : découper la carte en chunks (16×16 tuiles), chaque chunk = Container
  `cacheAsTexture` ; bornes monde par chunk ; `updateVisibility(viewport)` bascule
  `chunk.visible`. Supprime le seuil géant unique.
- `AdventureScene.ts` : brancher le culling sur le ticker/caméra (viewport monde
  dérivé de `camera.world` + `app.screen`).
- (Option) allègement fog sur grandes cartes.
- Vérif : smoke desktop+mobile ; carte 128² se charge et pan fluide (pas de gel).

### Lot 4 — Tailles de carte 64/128/256  ✅
- `game.ts` : `MAP_SIZE_DIMENSIONS = {small:64,medium:96,large:128,huge:256}` +
  liste RANDOM. `NewGameScreen.tsx` : `MAP_SIZES` + le 4ᵉ cran. Locales FR/EN
  `newgame.mapSize.huge`.
- Vérif : typecheck ; smoke ; nouvelle partie 256² démarre.

### Lot 5 — Profondeur forêt/montagne (props overlay)  ✅
- Nouvelle couche client « props de terrain » : pour chaque tuile forest/mountain,
  poser un sprite plus haut que la tuile (variante par hash de position), trié en
  profondeur iso. Repli procédural (Pillow) avec variation + relief.
- Script de génération des props procéduraux (arbres, pics) + **prompts Gemini**
  (docs/12 §7) prêts à l'emploi ; l'art Gemini se branche par simple dépôt de PNG.
- Vérif : smoke ; forêts/montagnes rendues avec repli, art Gemini optionnel.

### Lot 6 — Docs & mémoire  ✅
- `docs/02-mechanics.md` (table terrains), `docs/12-assets-style-guide.md` (terrains,
  props de profondeur, prompts Gemini), `CLAUDE.md` (mémoire), ce plan finalisé.

## Journal
- (init) Recherche terminée (3 explorations). Décisions utilisateur prises. Plan écrit.
