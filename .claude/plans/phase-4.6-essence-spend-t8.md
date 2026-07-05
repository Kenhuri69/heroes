# Plan — Phase 4.6 : dépense d'Essence + T8 Pénitent (Arcane Hunters)

Sous-lot Alpha (plan 4.1). Ferme la boucle économique ouverte en 4.4 (gain
d'Essence) : la ressource de faction devient **dépensable** (coût de
recrutement), et le **8ᵉ tier** (Pénitent Démonique) devient recrutable — le
lineup complet.

## Découverte

Le **contenu** supporte déjà les ressources de faction dans un coût d'unité :
`unit.cost` est `z.record(z.string())` et le loader valide déjà les clés contre
`COMMON_RESOURCE_IDS + factionResources` (loader.ts:212). Seul le **moteur**
ignore les clés de faction : `canAfford`/`payCost` n'itèrent que `RESOURCE_IDS`.
⇒ un coût en Essence est aujourd'hui silencieusement gratuit. C'est le trou à
combler.

## Étapes

1. **Moteur** (`town/resources.ts` + `recruit.ts` + `unit-economy.ts`) :
   - `recruitCost` typé `Record<string, number>` (clés core **ou** faction).
   - `scaleCost` générique (itère toutes les clés).
   - Helpers **faction-aware** `canAffordCost(player, cost)` / `spendCost(player,
     cost)` : chaque clé routée vers `player.resources` (si ∈ `RESOURCE_IDS`)
     sinon `player.factionResources`. `recruit.ts` les utilise.
   - `build.ts` inchangé (coûts de bâtiment core-only, schéma déjà restreint).
2. **Données** : `t8-penitent.json` (stats doc 05 : 210/24/18/[40,60]/7,
   croissance 1, coût 3800 or + 3 gemmes + **40 essence**, capacité `mark` ;
   `demonform`/`devourMarks` différés). Bâtiment `arcane-hunters-dwelling-t8`
   (coût core : or/gemmes/mercure, requiert dwelling T7). Manifeste : `units`
   +t8, `town` +dwelling t8.
3. **Client** : `CostList` (TownScreen) rend les coûts de faction avec le bon
   préfixe locale (`factionResource.<id>` vs `resource.<id>`).
4. **Tests** : moteur (`town-recruit`) — recruter une unité à coût Essence
   débite `factionResources.essence` ; sous le seuil ⇒ `cannotAfford`. Mettre à
   jour le test « recrute chaque tier » (essence seedée). content:check.
5. **Docs** doc 05 « État 4.6 ». Vérif, PR.

## Vérification

typecheck, lint, garde-fou, tests moteur+contenu, content:check (AH 8 unités),
smoke, budget. **Golden inchangé** (unités du golden sans coût de faction ;
`payCost`/`canAfford` core-only inchangés pour build.ts). Seul diff moteur =
paiement générique faction-aware.

## Écarts

- **Croissance partagée apex** (T7/T8, choix hebdo) : non implémentée — T8 a une
  croissance indépendante (1/sem). `sharedGrowthGroups` reste `{}`. Lot ultérieur.
- **demonform** (T8 signature) : lot ultérieur (module stateful). T8 combat en
  unité forte à `mark` en attendant.
- Coûts de **bâtiment** en Essence (Portail de l'Abîme §5) : différés (schéma de
  coût de bâtiment core-only) — l'Essence se dépense au recrutement pour l'instant.
