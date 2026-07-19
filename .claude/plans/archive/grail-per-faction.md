# Lot — Effets de Graal par faction (migration données pure)

> **Zéro diff moteur.** Le gate `requiresGrail` (`build.ts:61`) et la résolution
> `factionId` des bâtiments (universel = core sans `factionId`, town-scoped =
> faction) sont **déjà génériques**. On remplace l'unique Graal **core**
> (`growthBonus 100 %`, universel) par **un Graal signature par faction**, chacun
> réutilisant un effet de bâtiment **générique existant**. Pas de bump
> `CURRENT_SAVE_VERSION` (bâtiments sérialisés dans `buildingCatalog`), golden
> inchangé (aucune fixture ne construit le Graal). Décision utilisateur 2026-07-16
> (« Go, tu choisis les effets »).

## Contrainte structurante

Un `BuildingDef` = **un effet par niveau**, et le Graal core est **universel**
(pas de `factionId`). On ne peut donc PAS demi-migrer (sinon une ville verrait 2
Graals). ⇒ **migration atomique tous-factions dans une seule PR** : retrait du
Graal core + ajout des 7 Graals de faction.

## Design — effet signature par faction (ancré doc, palette générique)

Le Graal est un unique durement gagné (méta-puzzle obélisques → `Dig` →
`uniquePerPlayer`). Chaque Graal **double la signature** de sa faction. Effets
pris dans la palette générique existante (`growthBonus`, `heroAura` multi-champs
town-scoped, `income`, `factionResourceIncome`) — **rappel** : les champs
`heroAura` (moral/déf/mouvement) sont **town-scoped** (héros sur la tuile de
ville / défense de siège), pas globaux.

| Faction | id bâtiment | Effet | Ancrage |
|---|---|---|---|
| Haven | `haven-grail` | `heroAura { combatMoraleBonus:2, garrisonDefense:5, movementBonusFlat:400 }` | Ordre/Lumière/défense (doc 03 §2) — bastion sacré |
| Necropolis | `necropolis-grail` | `growthBonus { percent:100 }` | Nécromancie/nuée (doc 04 §2) |
| Arcane Hunters | `arcane-hunters-grail` | `factionResourceIncome { essence, 12 }` | Essence = ressource faction (doc 05) |
| Sylvan Court | `sylvan-court-grail` | `heroAura { movementBonusFlat:700 }` | Symbiose/forêt (doc 14) — sentiers de la sylve |
| Vox Arcana | `vox-arcana-grail` | `factionResourceIncome { resonance, 12 }` | Résonance = ressource faction (doc 16) |
| Dungeon | `dungeon-grail` | `income { gold, 1500 }` | Elfes noirs mercantiles (doc 17) — trésor du Donjon |
| test-faction | `test-faction-grail` | `growthBonus { percent:100 }` | Neutre — miroir de l'ancien Graal core (stabilité smoke) |

5 types d'effet distincts sur 7 factions. Magnitudes = **1ère calibration**,
ajustable via `faction:sim`. Chaque Graal : `maxLevel 1`, `cost {}` (le
méta-puzzle EST le coût), `requires [{townHall,1}]` (core, présent partout),
`requiresGrail true`, `uniquePerPlayer true`.

## Étapes (une PR atomique)

1. `data/core/buildings.json` : retirer le bâtiment `grail`.
   → vérif : `content:check` + tests contenu verts.
2. `data/core/locales/{fr,en}.json` : retirer les clés orphelines
   `building.grail` + `building.grail.lore` (garder `toast.grail*` /
   `cmdError.grailRequired` = mécanique, intactes).
3. Pour chaque faction : ajouter le Graal à `buildings.json`, l'id à
   `manifest.town.buildings`, les clés `building.<id>` (+ `.lore`) en fr ET en.
   → vérif : loader `checkPackNameKeys` (clé de nom exigée) vert.
4. `docs/02-mechanics.md` §2.2 : remplacer « Graal core `growthBonus` » par la
   table par-faction (source de vérité). Cross-ref d'une ligne dans docs
   03/04/05/14/16/17.
   → vérif : cohérence doc ↔ données (invariant #4).
5. Pipeline complet vert (typecheck/lint/tests/golden/content:check/garde-fous
   faction+couleurs/build/bundle/smoke) avant push.

## Garde-fous / invariants

- **Invariant #1** : ids de faction dans les **données** uniquement
  (`data/factions/…`), jamais dans `packages/`. Le garde-fou CI grep `packages/`
  seulement ⇒ non impacté. Aucun `if (faction === …)` moteur.
- **Save/golden** : pas de bump, golden inchangé (Graal jamais construit en
  fixture). Garde save-shape non déclenché (formes HeroState/CombatStack
  intactes).
- Les 2 tests unitaires (`town-build.test.ts`, `loader.test.ts`) injectent leur
  **propre** faux `grail` dans un catalogue local ⇒ non impactés par le retrait
  du Graal core.

## Écarts constatés / décisions

- **Un effet par niveau de bâtiment** ⇒ chaque Graal porte UN effet signature
  (Haven cumule plusieurs champs dans un même `heroAura`, autorisé par le schéma).
- **Tous les champs `heroAura` sont town-scoped** (`townBuildingAura` exige le
  héros sur la tuile de ville / défense de siège) — documenté dans doc 02 §2.2.
  Les effets « larges » (toujours utiles) = `growthBonus` / `income` /
  `factionResourceIncome` ; les `heroAura` (Haven, Sylvan) = bonus de bastion.
- **test-faction** conserve un Graal `growthBonus 100 %` = miroir de l'ancien
  Graal core ⇒ chemin smoke/partie rapide inchangé.
- Les 2 tests unitaires injectant un faux `grail` local passent inchangés.
- Ajout test `packages/content/test/faction-grail.test.ts` (faction-agnostique).

## Vérification (pipeline)

- ✅ JSON parse (tous), `content:check` (7 paquets valides), tests contenu
  (148, dont faction-grail ×2), tests moteur (829, **golden inchangé**).
- ✅ typecheck, lint, garde-fou faction (status 1), garde-fou couleurs (status 1).
- ✅ build, bundle gzip 322 356 o < 819 200.
- Smoke @core : le test T-GRAIL lot 3 codait en dur l'ancien id core `grail`
  (`town-requires-grail-grail` / `town-build-grail`). La ville de départ est
  `test-faction` ⇒ son Graal est désormais `test-faction-grail`. Testids mis à
  jour (tests/smoke.spec.ts ; `tests/` hors périmètre du garde-fou faction).
- ✅ smoke @core : 22/22 (T-GRAIL lot 3 corrigé).

## Statut : LIVRÉ (pipeline complet vert)
