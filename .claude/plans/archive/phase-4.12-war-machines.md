# Plan — Alpha 4.12 : machines de guerre basiques (Baliste)

> Suite de l'ordre roadmap (doc 09 Phase 2 Alpha) : après Arcane Hunters (re-
> vérifiée) et upgrades (4.11), l'item suivant est « machines de guerre
> basiques ; sièges v1 ». Ce lot livre la **Baliste** — la machine de guerre
> iconique — comme tranche « basique ». Sièges v1 = lot suivant.

## Périmètre (tight)
La **Baliste** : machine de guerre possédée par le héros, achetée à la **Forge**,
qui combat comme une pile supplémentaire de son camp (hors cap 7). First Aid
Tent / Ammo Cart = différés (notés).

## Conception (générique, zéro nom de faction)
1. **Contenu core** : nouveau catalogue `data/core/war-machines.json` (comme
   `core/artifacts.json`) : la Baliste = unité (stats + `shooter` + `cost`).
   Schéma `warMachineSchema` + `coreWarMachines` dans `LoadedContent`. Le client
   les **fusionne dans le catalogue d'unités** (`buildUnitCatalog`) — le moteur
   ne voit que des `CombatUnitDef` par id, comme les unités de faction.
2. **Moteur** :
   - `HeroState.warMachines: string[]` (ids possédés ; ≤ 1 de chaque). Save v→6.
   - Commande `BuyWarMachine { townId, unitId }` : Forge construite + héros
     présent + coût `cost` (débité) + pas déjà possédée → ajoute à `hero.warMachines`.
     Effet de bâtiment générique `{ type: 'warMachineVendor' }` porté par la Forge
     (débloque l'achat, comme `market`).
   - Setup de combat : les machines du héros rejoignent son camp comme piles
     `count: 1` (placées après l'armée, hors cap 7). Générique dans
     `placeSide`/`beginGuardianCombat`/`handleStartCombat`.
   - Golden re-fixé (forme d'état : `warMachines` + save v6).
3. **Client** : bouton « Acheter » à la Forge (onglet ville) + toast ; la Baliste
   apparaît au combat (sprite/repli existant).

## Lots
- [x] **A** — contenu core : `war-machines.json` (Baliste) + `warMachineSchema`/
  `warMachineCatalogSchema` + loader (`coreWarMachines`) ; effet
  `warMachineVendor { units }` sur la Forge ; **`forge` ajouté au town.buildings
  des 4 factions** (sinon non constructible → machines inachetables).
- [x] **B** — moteur : `HeroState.warMachines` (save v6), `BuyWarMachine`
  (`warMachineUnavailable`), inclusion dans `beginGuardianCombat`, EXCLUSION de la
  reconstruction d'armée post-combat. **6 tests** unitaires.
- [x] **C** — client : merge catalogue (`buildUnitCatalog`), `resolveUnitName`
  repli core, bouton « Acheter » (Forge, onglet Garnison) + aperçu coût, toast
  `WarMachineBought`, i18n FR/EN.
- [x] **D** — smoke (bâtir Forge → héros présent voit l'achat) ; docs 02 §4.1/§5
  + roadmap 09 + plan. **62 smoke**, 269 engine + 70 content, golden `aba92b9f`.

## Invariants
Moteur pur, **zéro nom de faction** (Baliste = unité core générique), RNG seedé,
golden re-fixé explicitement (save v6), budget < 800 Ko, anti-gel ×4, touch-first,
garde-fou faction vérifié **localement** avant push (leçon #67).

## Journal
- **2026-07-06** — Création. Base `fdf7507` (main, après #68). Item suivant de
  l'ordre roadmap. Baliste via catalogue core générique + achat Forge.
- **2026-07-06** — A/B/C/D livrés (piloté). Piège attrapé : un test de combat
  utilisait le RNG NON seedé de `createEmptyState` (PCG32 dégénéré) → combat sans
  fin ; corrigé (`seedRng`). Vérif : typecheck 4/4, lint, **269 engine + 70
  content** (dont town-war-machine ×6), golden re-fixé `aba92b9f` (save v6),
  content:check (34 bâtiments), build 72,9 Ko, **62 smoke**. Garde-fou faction
  vérifié localement. Docs 02/09 + plan à jour. Prêt PR.
