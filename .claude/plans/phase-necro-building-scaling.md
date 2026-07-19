# Nécromancie graduée par bâtiment (doc 04 §2, différé F-SKILLS)

## Contexte

`raiseUndeadOnVictory` (engine/faction) scale déjà par **compétence**
(`scaleSkillId`/`percentByRank` : Nécromancie rang 1-3 ⇒ 10/15/20 %). Le
scaling par **bâtiment** (Amplificateur de Nécromancie, fidélité HoMM3) restait
différé. Choix utilisateur : l'ouvrir. **UN** point d'extension moteur
**générique** (aucun nom de faction) + les données Necropolis qui l'exercent.

## Design

- **Bonus** `raiseUndeadOnVictory` gagne 2 champs optionnels :
  - `scaleBuildingId?: string` — id opaque d'un bâtiment de ville.
  - `percentPerBuildingLevel?: number` — points de % **ajoutés** au pourcentage
    de relève, **par niveau** de ce bâtiment, **sommés sur les villes du
    vainqueur**. Absents ⇒ comportement historique (aucun bonus bâtiment).
- **Moteur** (`applyRaiseUndeadOnVictory`) : après le calcul du `percent`
  (base/compétence + spécialité), ajoute
  `Σ_towns(town.buildings[scaleBuildingId] ?? 0) × percentPerBuildingLevel` sur
  les villes dont `ownerPlayerId === hero.playerId`. Générique : le moteur ne lit
  qu'un id opaque + des niveaux, jamais de faction.
- **Données Necropolis** :
  - Bâtiment `necromancy-amplifier` (effet `none` — bâtiment-drapeau passif dont
    le niveau est LU par le bonus ; coûte de l'or, `requires` mageGuild@1,
    maxLevel 2). Ajouté à `manifest.town.buildings` + locales fr/en.
  - Bonus manifeste : `scaleBuildingId: "necromancy-amplifier"`,
    `percentPerBuildingLevel: 3` (max +6 %/ville, modeste vs 10-20 % compétence).

## Invariants

Générique, zéro `if (faction)` moteur. Champs optionnels ⇒ **golden inchangé**
(le replay n'a pas ce bonus ; les unités synthétiques du golden n'ont pas de
faction). Nouveau bâtiment = données pures. `TownState.buildings` inchangé de
forme ⇒ **pas de bump save**. Garde-fou « zéro faction » vert (id de bâtiment
vit dans les données, pas dans `packages/`).

## Étapes

1. `engine/faction/types.ts` : 2 champs optionnels → verify: typecheck.
2. `engine/faction/effects.ts` : somme des niveaux de bâtiment ajoutée au % → verify: typecheck.
3. `content/schemas.ts` : 2 champs optionnels sur le bonus → verify: content:check.
4. Données : `buildings.json` (amplifier) + `manifest.json` (town.buildings + bonus) + locales fr/en → verify: content:check.
5. Docs 04 §2 (Nécromancie graduée bâtiment) → verify: relecture.
6. Tests : engine (un amplifier niv. 2 augmente la relève vs sans) + content recruit/build si utile → verify.
7. Vérif complète : typecheck, lint, engine+content test, golden inchangé, content:check, garde-fou, build, budget, smoke @core.

## Statut

- [x] **LIVRÉ.** `RaiseUndeadOnVictoryBonus` gagne `scaleBuildingId?` +
      `percentPerBuildingLevel?` (`engine/faction/types.ts`) ; `effects.ts` ajoute
      `Σ_villes-vainqueur(niveau[scaleBuildingId]) × percentPerBuildingLevel` au %.
      Schéma content (2 champs, défauts neutres) + validation loader
      (`scaleBuildingId` ∈ `town.buildings` sinon erreur — évite le 0 silencieux).
      Données Necropolis : bâtiment `necromancy-amplifier` (effet `none`, maxLevel
      2, requiert mageGuild@1) + manifeste (`town.buildings` + bonus
      `scaleBuildingId`/`percentPerBuildingLevel: 3`) + locales fr/en. Docs 04
      (§signature, §2 table bâtiments, encart F-SKILLS) alignées sur le livré.
      Tests `faction-skills.test.ts` : +3 %/niveau monotone + villes du vainqueur
      seules.
- **Vérif** : typecheck ✓ · lint ✓ · **930 engine** (+2) ✓ · **156 content** ✓ ·
  **golden inchangé** · content:check ✓ · garde-fou faction ✓ (id de bâtiment hors
  `packages/`) · build ✓ · bundle **340.1 Ko** < 800 ✓ · smoke `@core` **35/35** ✓.
  **Pas de bump save** (forme `TownState.buildings` inchangée).
