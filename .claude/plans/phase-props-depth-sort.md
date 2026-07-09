# Plan — Tri de profondeur props de relief ↔ entités (héros/objets)

> Branche : `claude/map-tiles-expansion-8kaqr1` (repart de `main` à jour ; PR #171 mergée).
> Objectif : un héros situé DERRIÈRE une forêt/montagne de premier plan doit être
> **occulté** par elle (fidélité iso HoMM). Aujourd'hui les props vivent dans la
> couche SOL (`tilemap`), toujours SOUS les entités ⇒ le héros passe toujours
> par-dessus les arbres. Zéro diff moteur (rendu client uniquement).

## Contrainte de perf
Une grande carte (128²/256²) a des milliers de tuiles forêt/montagne. On ne peut pas
mettre tous leurs props dans la couche triée en permanence. Solution : **props culés
au viewport par chunk** (réutilise l'infra de culling de `Tilemap`), instanciés à
l'entrée d'un chunk dans le viewport, détruits à sa sortie.

## Étapes
1. `render/tilemap.ts` : **retirer** le rendu des props des chunks (le SOL forêt/
   montagne — losange texturé — reste). Exporter `chunkBounds` + `CHUNK`. → vérif : typecheck.
2. `render/terrainProps.ts` (nouveau) : `TerrainProps(map, layer)` — précompute les
   tuiles à prop par chunk (bornes monde avec débord vertical), `updateVisibility(view)`
   ajoute/retire les billboards dans la **couche d'entités triée** (`zIndex =
   isoDepth(tile) − 0.1` : un héros sur la même tuile reste au-dessus, un prop une
   tuile DEVANT occulte le héros). `destroy()` nettoie. → vérif : typecheck.
3. `scenes/adventure/AdventureScene.ts` : instancier `TerrainProps(map, this.entities)`,
   l'`updateVisibility` dans `cullTilemap` (même viewport), le détruire dans `destroy`.
   → vérif : typecheck.
4. Vérif visuelle (screenshot) : héros derrière une montagne = occulté ; sur une tuile
   forêt = visible au-dessus de son propre arbre. Smoke desktop (démarrage, assets, 128²).

## Journal
- (init) Plan écrit. Choix utilisateur = tri profondeur props↔héros.
- Étape 1 ✅ : props retirés des chunks `Tilemap` (sol forêt/montagne conservé) ; `CHUNK`
  et `chunkBounds(...,overhangTop)` exportés. Typecheck OK.
- Étape 2 ✅ : `render/terrainProps.ts` — `TerrainProps` cule les props par chunk au
  viewport, les instancie dans la couche d'entités triée (`zIndex = isoDepth − 0,1`).
- Étape 3 ✅ : `AdventureScene` instancie `TerrainProps(map, this.entities)`, l'update
  dans `cullTilemap` (viewport partagé), le détruit dans `destroy`.
- Étape 4 ✅ : typecheck + build OK ; smoke desktop (démarrage, config 128², assets sans
  404, fluidité ×4 = 18 fps). Vérif visuelle : héros à la lisière d'une forêt = **occulté
  par les arbres de premier plan** (autres arbres derrière non), anneau de sélection sous
  les arbres. Comportement conforme. **Terminé.**
