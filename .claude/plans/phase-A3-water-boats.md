# A3 — Eau navigable & bateaux (doc 18 Étape 5, écart A3, chantier L multi-lots)

Arbitrage utilisateur (2026-07) : **lancer A3** (option a — chantier, pas la
divergence assumée). Décomposition en PR atomiques ; chaque lot vérifié
(typecheck/lint/test/golden/garde-fous/build/budget/smoke).

## État des lieux (cartographie)

- Terrain `water` existe déjà (`config.json` : `moveCost: null`) ⇒ **bloquant à
  pied** comme `mountain`/`rocks`. Aucune sémantique navale.
- Pathfinding `packages/engine/src/adventure/path.ts` : `isPassable`/`stepCost`
  clé sur `moveCost === null` ; voisin infranchissable exclu du graphe.
- `HeroState` (state.ts:98-203) : aucun champ transport. Clés verrouillées par
  `HeroKey` + `Exact<keyof>` (`save-shape.test.ts`) ⇒ **tout champ héros = bump
  `CURRENT_SAVE_VERSION`** (actuel 33) + golden re-fixé si le hash change.
- Objets de carte : union `MapObjectDef` (map.ts:218-227) ⇒ un `boat` s'y ajoute.
- Déplacement pas-à-pas : `advanceHeroAlongPath` (movement.ts:48-260).
- mapgen : eau posée en basse élévation ; **flood-fill de connectivité creuse
  des corridors À TRAVERS l'eau** (traitée bloquante) ⇒ à réexaminer quand l'eau
  devient navigable (lot A3.4).

## Découpage en lots (PR atomiques)

### A3.1 — Fondation pathfinding *domain-aware* terre/mer  ← CE PR
Plomberie golden-safe, aucun effet visible, aucun bump save.
- `TerrainRule.navalCost?: number | null` (config.ts + schéma Zod). `water` reçoit
  un `navalCost` en données ; terres = pas de `navalCost` (infranchissables en mer).
- `path.ts` : `isPassable`/`stepCost`/`findPath`/`minStepCost` gagnent un paramètre
  `naval = false`. Domaine terre (`moveCost`) vs mer (`navalCost`), **disjoints**.
  Défaut `false` ⇒ **comportement bit-identique** (aucun appelant naval hors tests).
- Tests unitaires (`adventure.test.ts`) : un chemin naval traverse l'eau et refuse
  la terre ; un chemin terrestre inchangé (eau toujours bloquante à pied).
- Vérif : golden inchangé (navalCost sur un terrain à `moveCost:null` = no-op côté
  terre ; défaut `naval=false`), pas de bump save.
- Critère de sortie : `naval=true` sait router sur l'eau, `naval=false` identique.

### A3.2 — État naval du héros + embarquement/débarquement (bump save 34)
- `HeroState.naval: boolean` (+ `HeroKey`, bump 33→34, golden re-fixé « forme »).
- `BoatObjectDef` (`type:'boat'`) dans `MapObjectDef`.
- Commandes `BoardBoat`/`DisembarkBoat` (transition au rivage, style monolithe) ;
  `MoveHero`/`advanceHeroAlongPath` route selon `hero.naval`.
- Tests : embarquer → naviguer → débarquer ; PM ; interception en mer.

### A3.3 — Chantier naval (shipyard)
- Bâtiment data-driven produisant un bateau sur une tuile d'eau adjacente.

### A3.4 — mapgen mers + connectivité navale
- Générer des mers cohérentes ; réexaminer le flood-fill (ne pas boucher l'eau
  quand une route navale existe) ; placer chantiers/bateaux.

### A3.5 — Client
- Sprite bateau (objet + héros embarqué), rendu héros en mer, prévisualisation de
  chemin sur l'eau, UI embarquement/débarquement, smoke.

## Statut A3.1 — LIVRÉ

- [x] navalCost (config.ts `TerrainRule.navalCost?`, schéma Zod, config.json water=100)
      — `| undefined` explicite requis (`exactOptionalPropertyTypes`).
- [x] path.ts domain-aware : helper `domainCost` + param `naval=false` sur
      `isPassable`/`stepCost`/`findPath`/`minStepCost`. Défaut = bit-identique.
- [x] 4 tests navals (`adventure.test.ts`) : stepCost naval, eau bloquante à pied,
      chemin naval entre 2 tuiles d'eau, domaines disjoints (pas de terre en mer).
- [x] doc 02 §1.5 (table terrains + `navalCost` + section « Navigation » A3.1).
- [x] Vérif : typecheck -r ✓, lint ✓, test 880 (golden inchangé, save v33) ✓,
      content:check ✓, garde-fou faction vert, build ✓, budget 330 Ko < 800 ✓,
      smoke @core 19/19 ✓.

## Statut A3.2 — LIVRÉ

- [x] `HeroState.naval: boolean` (requis, défaut false) + save v33→**v34** +
      `HeroKey` mis à jour + golden re-fixé `d2f06bdb`→`7c1cdc04` (forme seule).
- [x] `BoatObjectDef` (`type:'boat'`) dans `MapObjectDef` + schéma content + loader
      + narrowing engine/client (MapEditor, MapObjectCard, mapObjects `buildBoat`).
- [x] Commandes `BoardBoat`/`DisembarkBoat` (validate + handlers) + codes d'erreur
      (`alreadyNaval`/`notNaval`/`unknownBoat`/`boatNotAdjacent`/`tileOccupied`) +
      événements `BoardedBoat`/`Disembarked` (non hachés). Embarquer/débarquer ⇒ PM=0.
- [x] Domaine câblé : `validatePath` + `advanceHeroAlongPath` (stepCost `hero.naval`).
      IA inchangée (naval=false par défaut, ne navigue pas encore).
- [x] 5 tests `boat.test.ts` (embarquer/naviguer/débarquer + refus). Locales
      `mapCard.boat*` FR/EN.
- [x] Vérif : typecheck -r ✓, lint ✓, test **885** ✓, content:check ✓, garde-fou
      faction vert, i18n parité ✓, build ✓, budget 332 Ko < 800 ✓, smoke @core 20/20 ✓.

## A3.3 — Chantier naval (shipyard) — LIVRÉ

Bâtiment data-driven produisant un bateau sur une tuile d'eau adjacente. Patron
copié de `BuyWarMachine` (achat gaté par un bâtiment de ville).

- [x] `BuildingEffect` `{ type:'shipyard'; boatCost: Partial<Resources> }` (types.ts)
      + schéma Zod (mirror).
- [x] Bâtiment `shipyard` dans `data/core/buildings.json` (coût gold 2000/wood 20,
      `boatCost` gold 1000) + locales `building.shipyard`(.lore) FR/EN.
- [x] Commande `BuildBoat { townId }` + codes `noShipyard`/`noAdjacentWater` +
      événement `BoatBuilt` (non haché).
- [x] `town/shipyard.ts` : validate (ville possédée, effet shipyard, eau navigable
      adjacente LIBRE via `DIRECTIONS`, or suffisant `canAfford`) + handler (débit
      `payCost`, pose le bateau sur la 1ʳᵉ tuile libre) ; ré-export index.
- [x] Enregistrement engine.ts (import, GAME_OVER_BLOCKED, validate, handler).
- [x] 5 tests `town-shipyard.test.ts`. **Pas de bump save** (bateau = objet de
      carte déjà sérialisé), **golden inchangé** (890 tests).
- [x] Docs 02 §1.5 (navigation A3.3) + §4.1 (table bâtiments).
- [x] Vérif : typecheck ✓, lint ✓, test 890 ✓, content:check ✓, garde-fou faction
      vert, i18n ✓, build ✓, budget 332 Ko ✓, smoke @core 20/20 ✓.

### Prochain : A3.4 (mapgen mers + connectivité navale) — ou A3.5 (rendu/UX client).
