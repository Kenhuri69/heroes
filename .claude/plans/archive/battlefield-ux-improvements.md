# Plan — Améliorations UX du champ de bataille

Demande utilisateur : améliorer l'UX du combat hex.
1. **Affichage des quantités de soldats** sur le plateau.
2. **Popup d'info sur les stats de chaque unité au clic** (depuis le plateau).
3. Tout autre élément d'aide sur le même principe (surfacer l'info directement
   sur le champ de bataille).

## Constat (état actuel)

- Le jeton de pile canvas (`CombatScene.buildStackToken`) n'affiche **AUCUN
  effectif** — l'effectif n'apparaît que dans le bandeau d'ordre (`StackChip`)
  et la fiche (`StackSheet`). Sur le plateau lui-même, impossible de savoir
  combien de soldats compte une pile (régression de lisibilité vs. HoMM).
- La fiche d'unité `StackSheet` existe déjà (stats complètes) mais n'est
  ouvrable **que** par un tap sur une vignette du bandeau haut. Aucun geste
  d'inspection sur le plateau.
- L'infra d'appui long existe (`onLongPress`, doc 08 « appui long = fiche »),
  déjà câblée dans `AdventureScene` (→ `mapCard`), mais **pas** dans le combat.

## Principes respectés

- **Zéro diff moteur** : purement présentation client (badge canvas + geste +
  routage d'un champ d'UI). Garde-fou « zéro faction » intact, pas de bump save.
- **Convention maison** : inspection = appui long / clic maintenu (doc 08 §2.1,
  précédent `AdventureScene`) — le tap reste réservé à déplacer/attaquer.
- **a11y** : effectif = texte à fort contraste (contour), jamais couleur seule.
- Surgical : réutiliser `StackSheet` et `onLongPress` existants.

## Étapes

1. **Badge d'effectif sur les jetons du plateau** (`CombatScene.ts`).
   - Ajouter un badge (pastille + `Text`) en bas de chaque jeton dans
     `buildStackToken`, gardé en réf (`countLabel`) sur le conteneur.
   - Mettre à jour le texte à chaque `syncStacks` (l'effectif change après
     attaques/morts).
   - → vérif : à l'ouverture du combat, chaque jeton porte son effectif ;
     l'effectif décroît visiblement après des pertes (contrôle manuel + le
     champ `count` reste couvert par le bandeau DOM en smoke).

2. **Inspection au plateau → fiche de stats** (`CombatScene.ts`, `store.ts`,
   `combat.tsx`, `dispatch.ts`).
   - Store : nouveau champ `combatInspectId: string | null` (présentation, non
     persisté), remis à `null` aux transitions de combat (comme
     `combatSpellTarget`).
   - `CombatScene` : câbler `onLongPress` → hex → pile présente → `setState({
     combatInspectId })`. Se désabonner dans `destroy()` (symétrie CL2).
   - `combat.tsx` : `StackSheet` piloté par `combatInspectId` du store (source
     unique). `StackChip` du bandeau pose le même champ (au lieu de l'état local
     `sheetStackId`) ⇒ **même fiche, deux points d'entrée** (bandeau + plateau).
   - → vérif smoke : cliquer une vignette ouvre `stack-sheet` avec les stats,
     fermeture OK.

3. **Test & non-régression** (`tests/smoke.spec.ts`).
   - Étendre le test de combat : après `passPreBattle`, ouvrir la fiche via une
     vignette du bandeau, vérifier stats (PV/attaque/défense) + fermeture.
   - Le badge canvas est un rendu Pixi (non assertable en DOM) : le dire
     explicitement ; l'effectif sous-jacent reste couvert par le bandeau DOM.
   - → vérif : `pnpm -w typecheck && lint && test && build`, smoke ciblé vert.

## Écarts / décisions

- **Geste d'inspection = appui long / clic maintenu**, PAS un tap simple : le tap
  reste réservé à déplacer/attaquer (indispensable), et c'est la convention
  maison (doc 08 §2.1, `AdventureScene`). Reste ouvrable en 1 clic depuis les
  vignettes du bandeau haut.
- Badge canvas construit dans `buildStackToken`, réf via `label` Pixi + relookup
  `getChildByLabel` au resync (Pixi 8.19 expose bien l'API). Fond redimensionné
  au texte ; ignoré si l'effectif est inchangé (pas de rework par frame).
- **Vérifié** (Chromium headless, capture `/#arena`) : effectifs affichés sous
  chaque jeton (20/12 des deux camps), et appui long → fiche « 20 × Recrue »
  (PV 6/6, Att 3, Déf 2, Dégâts 1–2, Vit 5). Étape smoke DOM (bandeau → fiche)
  ajoutée au test `@core` de combat.
- ✅ typecheck / lint / 687 unitaires / build OK ; smoke `@core` (13) + arène (2)
  verts. Zéro diff moteur, pas de bump `CURRENT_SAVE_VERSION`.
