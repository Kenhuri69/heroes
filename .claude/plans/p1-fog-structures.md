# P1 — Brouillard depuis les villes/mines possédées (F1) + tour de guet (F2)

> Backlog `gap-audit.md` items **F1** (vision liée aux héros uniquement — villes/
> mines possédées n'éclairent rien) et **F2** (aucun objet donneur de vision).
> Irritant utilisateur n°1 : « on devrait aussi voir depuis les bâtiments possédés ».

## Design

1. **F1 — révélation autour des structures possédées.** Le brouillard `explored`
   (bit persistant) est révélé autour de chaque **ville** et **mine** possédée :
   - au `StartGame` (structures de départ),
   - à la **capture** d'une ville (undefended `capture.ts` + victoire de siège
     `combat/turns.ts`) et d'une **mine** (`adventure/movement.ts`).
   Rayon = `config.buildingVisionRadius` (data-driven, distinct du rayon héros).
   **Côté client**, les villes/mines possédées deviennent aussi des **sources de
   vision vivante** (ajoutées aux `sightings` de `AdventureScene`) ⇒ halo clair
   permanent autour d'elles (pas seulement du gris exploré).
2. **F2 — tour de guet (visitable `vision`).** Nouvel effet `visitable`
   `{ kind: 'vision'; amount }` : à la visite, révèle un large rayon autour du
   lieu (reveal permanent). Data-only + petit handler. La version « vision
   continue tant que possédé » dépend de la capture d'objets de carte (M5) → plus tard.

## Étapes & vérif

- [x] `config.buildingVisionRadius` : type moteur (`adventure/config.ts`, optionnel
      ⇒ 0 si absent, golden/fixtures inchangés), `config.json` = 4, schéma contenu (optionnel).
- [x] `adventure/vision.ts` : `revealStructure(draft, ownerId, pos)` +
      `revealOwnedStructures(draft)` (villes + mines possédées).
- [x] Hooks reveal : `StartGame` (`core/engine.ts`), `handleCaptureTown`
      (`town/capture.ts`), victoire de siège (`combat/turns.ts`), capture de mine
      (`adventure/movement.ts`).
- [x] Client `AdventureScene.sync` : ajouter villes possédées + mines possédées
      aux `sightings` (rayon `buildingVisionRadius`).
- [x] F2 : effet `visitable` `vision` (`adventure/map.ts` type + `visitable.ts`
      handler `revealAround`) ; ajouter une tour de guet à `proto-01` pour le smoke.
- [x] Tests moteur : « capturer une ville révèle son voisinage » ; « StartGame
      révèle autour de la ville de départ ». Golden : re-fixer SEULEMENT si un
      fixture porte un buildingVisionRadius (a priori non → inchangé).
- [x] Smoke : le voisinage d'une ville possédée est exploré même sans héros à côté.

## Invariants
- Moteur faction-agnostique, RNG non concerné, déterministe. `buildingVisionRadius`
  optionnel ⇒ pas de bump de save (champ de config embarqué, pas d'état nouveau).

## Journal
- 2026-07-08 — Plan créé après merge de #137. Implémentation P1 en cours.
- 2026-07-08 — **F1+F2 livrés** : `buildingVisionRadius` (config, 4), module
  `adventure/vision.ts` (`revealStructure`/`revealOwnedStructures`), hooks
  StartGame + capture ville (undefended + siège) + capture mine ; client
  `AdventureScene` villes/mines possédées en sightings ; F2 effet `visitable`
  `vision` + tour de guet sur proto-01. Vérif : typecheck 5/5, lint, 361 tests
  moteur (dont vision.test.ts) + 83 contenu, content:check, guards, build,
  smoke 108. Golden inchangé (fixtures sans buildingVisionRadius).
