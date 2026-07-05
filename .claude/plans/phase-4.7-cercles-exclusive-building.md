# Plan — Phase 4.7 : Cercles — choix de bâtiment exclusif (Arcane Hunters)

Sous-lot Alpha (plan 4.1). Point d'extension **générique** :
`exclusiveBuildingChoice` (doc 05 §3.2, les 4 Cercles) — un mécanisme utile à
toute faction (choix irréversible d'une branche de ville, comme les upgrades
alternatifs HoMM). Le moteur ne connaît pas « Cercle », juste des **groupes
exclusifs** de bâtiments déclarés en données.

## Design

`BuildingDef` gagne `exclusiveGroup?: string`. À la construction
(`validateBuildStructure`) : si le bâtiment appartient à un groupe exclusif et
qu'un **autre** bâtiment du **même** groupe est déjà bâti (niveau ≥ 1) dans la
ville, rejet `exclusiveChoiceLocked`. Irréversible (pas de démolition au MVP).

Données : 4 bâtiments de Cercle (`arcane-hunters-circle-{vigile,traque,sceau,
abime}`), `exclusiveGroup: "arcane-circle"`, prérequis `mageGuild` (stand-in du
Grand Amphithéâtre), chacun un **effet existant** distinct (revenu / bonus de
croissance) — choix économique différencié et irréversible. Les **passifs
fidèles** de doc 05 (vision, vitesse, coût mana, dégâts T7/T8) nécessitent de
nouveaux effets de bâtiment : **différés** (documenté).

## Étapes

1. **Moteur** : `town/types.ts` `BuildingDef.exclusiveGroup?`; `commands.ts`
   code `exclusiveChoiceLocked`; `build.ts` garde d'exclusivité.
2. **Contenu** : `buildingSchema` += `exclusiveGroup: z.string().optional()`.
3. **Données** : 4 bâtiments de Cercle (buildings.json + manifest town.buildings) ;
   noms `building.<id>` (locales core, fr/en).
4. **Client** : `nextBuildStatus` → `locked` si un frère exclusif est déjà bâti
   (affiche le verrou ; le moteur reste l'autorité).
5. **Tests** : moteur (`town-build`) — bâtir un Cercle verrouille ses frères
   (`exclusiveChoiceLocked`) ; un autre groupe reste libre. content:check.
6. **Docs** doc 05 « État 4.7 ». Vérif, PR.

## Vérification

typecheck, lint, garde-fou, tests moteur+contenu, content:check, smoke, budget.
**Golden inchangé** (aucun bâtiment du golden n'a d'`exclusiveGroup`). Seul diff
moteur = une contrainte de construction générique.

## Écarts

- Passifs fidèles des Cercles (vision/vitesse/mana/dégâts) + bâtiments exclusifs
  débloqués par Cercle : lots ultérieurs (nouveaux effets de bâtiment).
- Pas de Grand Amphithéâtre dédié : prérequis `mageGuild` en attendant.
