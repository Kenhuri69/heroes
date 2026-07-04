# Plan — Phase 3.1 : Villes & town building

Réf : doc 11 §Phase 3.1 ; doc 02 §3–§4 ; doc 06 §2–§5 ; doc 08 §2.1–§2.2 ;
doc 07 §3. Orchestration : lots sous-agents Sonnet
(`.claude/prompts/lancer-phase.md`), surfaces figées au cadrage.

## Périmètre resserré (le maillon économique du core loop, doc 02 §4)

3.1 livre : **construire (1/jour) → recruter → croissance hebdo → revenu
quotidien**, l'armée du héros grossit depuis la ville. Beaucoup de bâtiments
dépendent de phases ultérieures : ils sont **modélisables mais pas tous
interprétés** en 3.1.

## Décisions préalables (points non spécifiés)

1. **Bâtiments réellement interprétés en 3.1** (effets actifs) :
   - `townHall` (gradué 1→4 : Hôtel de ville→Capitole) — revenu d'or
     500/1000/2000/4000/j (doc 02 §4.1). Un seul Capitole (niveau 4) par joueur.
   - `fort` (gradué 1→3 : Fort→Château) — bonus de croissance +0/+50/+100 %.
   - `dwelling(tier)` — débloque le recrutement du tier ; sa croissance/coût
     vivent dans les données d'unité (déjà `growthPerWeek`/`cost`).
   - `mageGuild` (gradué 1→3) — **buildable en 3.1**, effet sorts en **3.2**
     (structure + prérequis valides, aucun sort débloqué encore).
2. **Bâtiments modélisés mais différés** (schéma les accepte, effet no-op tracé
   ou effet livré plus tard) : `market` (troc → MVP ultérieur), `tavern`
   (héros → 3.2), `special` de faction (sorts/nécromancie → 3.3/3.4),
   `forge` (post-MVP). Le schéma d'effet n'autorise en 3.1 QUE les types
   interprétés (`income`, `growthBonus`, `dwelling`, `mageGuild`) — un effet
   non câblé est refusé (comme `abilityModules` en 2.2 : pas de mensonge de
   validation). `market`/`tavern`/`forge`/`special` sont des bâtiments SANS
   effet mécanique en 3.1 (juste prérequis d'arbre), autorisés via un type
   `none`.
3. **Prérequis gradués** : un bâtiment porte un `maxLevel` ; chaque niveau a
   son coût et ses prérequis. Un prérequis = `{ building: id, level: n }`
   (ex. T7 requiert `{ fort: 3 }` = Château). `BuildStructure` construit le
   niveau courant+1.
4. **Coûts** : chiffrés en données (`data/core/buildings.json` pour les
   communs, manifeste pour les habitations/spéciaux). Valeurs de départ :
   townHall 1 = gratuit (préconstruit), 2 = 2500 or, 3 = 5000 or + 5 gemmes,
   4 = 10000 or + 10 gemmes+cristal ; fort 1 = 5000 or/20 minerai, 2/3
   croissants ; dwellings T1 ≈ 500 or → T7 ≈ 5000 or + rares (dans les données
   de faction). Ajustables.
5. **Revenu quotidien** (`DayStarted`) : pour chaque ville du joueur, somme des
   effets `income(resource, n)` de ses bâtiments (townHall selon niveau) ;
   crédité au propriétaire. Mines de la carte = objets d'aventure (déjà
   ressources au sol en 2.3 ; mines productrices = phase ultérieure). Arrondi
   entier, jamais négatif.
6. **Croissance hebdo** (`WeekStarted`) : pour chaque dwelling construit,
   `stock += floor(growthPerWeek × (1 + growthBonusFort))` ; plafond
   `2 × floor(growthPerWeek × (1+bonus))`. Recalculé chaque semaine.
7. **Recrutement** : `RecruitUnits(townId, unitId, count)` — count ≤ stock,
   débite `cost × count` (toutes ressources), ajoute à la **garnison de la
   ville** (≤ 7 piles, fusion par unitId). Le transfert garnison↔héros est
   `GarrisonTransfer` (P2 de 3.1 ; sinon le héros recrute directement s'il est
   en ville — décision : **recrutement direct dans l'armée du héros s'il est
   sur la ville, sinon dans la garnison**). Pour rester simple et jouable :
   recrutement → garnison ; si un héros est présent sur la tuile ville, un
   bouton « vers le héros » déplace une pile (P2). Le smoke vérifie via la
   garnison.
   → **Révision retenue** : recrutement → garnison de la ville ; l'armée du
   héros grossit par un `GarrisonTransfer` explicite (livré, simple : échange
   une pile ville↔héros quand le héros est sur la ville). Le smoke « recruter
   puis transférer → armée du héros augmente ».
8. **Ville de départ** : `config.newGame.startingTown { id, factionId, pos,
   prebuilt: [buildingId@level] }` ; objet `town` ajouté à `proto-01` à une
   tuile adjacente au départ du héros (3,3). Garnison de départ **vide** (le
   héros a `startingArmy`).
9. **Capture** : commande `CaptureTown` + logique (ville sans garnison ⇒
   capture immédiate) **implémentée et testée en unitaire** ; la règle « 7
   jours sinon défaite » et l'acteur ennemi arrivent avec l'IA d'aventure
   (3.5) — squelette + test, pas d'acteur jouable en 3.1.
10. **Mono-ville jouable** : une ville du joueur en 3.1 ; le multi-villes
    (Capitole unique, cumuls) reste supporté par les données mais non exercé.
11. **Combat de ville** : terrain standard (pas de décor ni de murs — MVP,
    doc 02 §4.1).

## Surfaces figées au cadrage (session principale)

- **Moteur** :
  - `TownState { id, ownerPlayerId: string|null, pos: GridPos, factionId,
    buildings: Record<string, number> /*id→niveau construit*/, builtToday:
    boolean, garrison: ArmyStack[], stock: Record<string /*unitId*/, number> }`.
  - `GameState.towns: TownState[]` ; `GameState.buildingCatalog:
    Record<string, BuildingDef>` (résolu par le contenu, comme `unitCatalog`).
  - `BuildingDef { id, maxLevel, levels: { cost: Partial<Resources>,
    requires: { building: string, level: number }[], effect: BuildingEffect }[] }`
    ; `BuildingEffect = { type:'income', resource, amount } | { type:'growthBonus',
    percent } | { type:'dwelling', tier, unitId } | { type:'mageGuild', level }
    | { type:'none' }`.
  - Commandes : `BuildStructure { townId, buildingId }`,
    `RecruitUnits { townId, unitId, count }`,
    `GarrisonTransfer { townId, heroId, from:'town'|'hero', slot }`,
    `CaptureTown { townId, playerId }`.
  - Événements : `TownBuilt { townId, buildingId, level }`,
    `UnitsRecruited { townId, unitId, count }`,
    `TownIncome { playerId, resource, amount }`,
    `TownGrowth { townId, unitId, added }`,
    `TownCaptured { townId, playerId }`.
  - `builtToday` remis à false au `DayStarted` ; revenu au `DayStarted` ;
    croissance au `WeekStarted`.
- **Contenu** : `buildingSchema` ; manifeste `town { buildings: [...],
  dwellings: [{ tier, unitId, buildingId }] }` ; `data/core/buildings.json`
  (communs) ; `config.newGame.startingTown` ; `proto-01` objet `town`.
- **Client** : store `townScreenOpen: string|null` (townId) ; `TownScreen`
  (onglets Construire/Recruter/Garnison) ; bouton `[Ville]`.

## Lots

- [x] **Cadrage (principal)** : ce plan + surfaces figées (état/commandes/
      événements/schéma/stubs), golden refigé, vert.
- [x] **Lot H (sonnet) — moteur town** : `engine/src/town/` (build 1/jour,
      recruit, croissance `WeekStarted`, revenu `DayStarted`, garrison
      transfer, capture) + tests (1 build/jour rejeté au 2ᵉ, recrutement
      plafonné/débité, revenu au bon palier/jour, croissance plafonnée,
      capture sans garnison, property « ressources ≥ 0 »). Livré :
      `town/{build,recruit,transfer,capture,economy,helpers,resources,
      unit-economy}.ts` (règles), `town/index.ts` réécrit en façade qui
      ré-exporte ces fonctions sous les noms figés (signatures inchangées) ;
      `test/town-{build,recruit,transfer,capture,economy,property}.test.ts`
      (29 tests) + `test/town-fixtures.ts` (catalogue de bâtiments/unités et
      ville de test propres au lot — n'a pas touché `test/fixtures.ts`
      partagé). 119/119 tests verts, golden hash inchangé (`1dadf3da`),
      typecheck/lint verts.
      **Écart de surface signalé** : `CombatUnitDef` (figé, phase 2.4) n'a ni
      `recruitCost` ni `growthPerWeek` — nécessaires pour le coût de
      recrutement et la croissance hebdo. Lus de façon optionnelle via un
      cast local (`town/unit-economy.ts`, `UnitEconomyFields`) : absents ⇒
      coût nul / pas de croissance (no-op), jamais d'erreur. À figer sur
      `CombatUnitDef` par la session principale (ou le lot I côté contenu)
      pour que recrutement/croissance produisent un effet réel avec des
      unités de faction.
      **Décision non spécifiée tranchée** : le rejet « garnison/armée pleine
      (7 piles) » en recrutement et en transfert utilise le code
      `invalidAction` (pas `insufficientStock`, réservé au dépassement du
      stock de créatures) — à documenter si un autre lot s'y réfère.
- [x] **Lot I (sonnet) — contenu** : `buildingSchema` + règles croisées
      (prérequis résolubles, coûts en ressources/unités connues, dwellings→
      unités du paquet), `data/core/buildings.json`, `town` dans les manifestes
      test-faction + arcane-hunters (townHall/fort/mageGuild + 1 dwelling),
      `config.newGame.startingTown`, objet `town` sur `proto-01`,
      `content:check` étendu, tests loader. Livré : `schemas.ts`
      (`buildingSchema`/`buildingCatalogSchema`, `manifestSchema.town`,
      `gameConfigSchema.newGame.startingTown`, variant `town` dans
      `mapFileSchema.objects` — `id de bâtiment` accepte camelCase ET
      kebab-case car `data/core/locales/*.json` référençait déjà
      `building.townHall`/`building.mageGuild` avant ce lot, cf. écart
      ci-dessous) ; `loader.ts` (`buildBuildingCatalog`, `resolveStartingTowns`,
      règles croisées prérequis/dwelling dans `loadFactionPack`, cross-check
      ville↔objet carte dans `loadMap`) ; `data/core/buildings.json`
      (townHall 1-4, fort 1-3, mageGuild 1-3, market/tavern/forge `none`) ;
      `data/factions/{test-faction,arcane-hunters}/buildings.json` (1 dwelling
      T1 chacun, 500 or) + `manifest.json` `town` ; `config.newGame.startingTown`
      (ville `test-faction` en (2,4), prebuilt townHall 1 + dwelling T1) ;
      objet `town` sur `proto-01`. 23 tests loader verts, `content:check`
      vert (2 paquets, 8 bâtiments résolus, 1 carte), typecheck/lint verts.
      **Écart constaté** : deux autres lots (H, J) tournaient en parallèle sur
      le même arbre de travail. `data/core/locales/fr.json`/`en.json`
      contenaient déjà des clés `building.townHall`/`building.mageGuild`
      (camelCase) avant que ce lot ne touche `data/core/buildings.json` — la
      consigne initiale du lot suggérait un `idSchema` kebab-case générique
      pour les ids de bâtiment, ce qui aurait cassé cet alignement. Décision
      pragmatique : `buildingIdSchema` dédié acceptant camelCase (communs :
      `townHall`, `fort`, `mageGuild`, `market`, `tavern`, `forge`) ET
      kebab-case (dwellings/spéciaux de faction : `test-faction-dwelling-t1`).
      **Point d'intégration confirmé (rejoint la note du lot H)** : le
      recrutement/croissance a besoin de `unit.cost`/`unit.growthPerWeek` (déjà
      dans `unitSchema`) côté moteur — le lot H lit ces champs en optionnel sur
      `CombatUnitDef` (absent aujourd'hui) via un cast local dans
      `town/unit-economy.ts`. La session principale doit enrichir la
      résolution du `unitCatalog` (contenu → moteur) pour y injecter
      `recruitCost`/`growthPerWeek` depuis `Unit.cost`/`Unit.growthPerWeek`.
      **Nouveau point d'intégration détecté** : `packages/client/src/app/
      game.ts` assigne `ResolvedMap` (contenu) directement au champ `map` de
      `StartGame`, typé `AdventureMapDef` (moteur, `adventure/map.ts`). Le
      variant `town` ajouté à `ResolvedMapObject` par ce lot n'existe pas côté
      `MapObjectDef` (moteur) → `pnpm --filter @heroes/client typecheck`
      échoue (`ResolvedMapObject` non assignable à `MapObjectDef`, propriétés
      `unitId`/`count` manquantes sur le variant `town`). Deux résolutions
      possibles pour l'intégration : (a) ajouter un variant `town` à
      `MapObjectDef` côté moteur (mais l'objet carte n'est pas consommé par le
      pathfinding/fog, seulement par `resolveStartingTowns`/l'écran de ville —
      un variant moteur serait probablement mort) ; (b) filtrer les objets
      `type: 'town'` hors de la liste passée à `StartGame.map.objects` dans
      `game.ts` (les villes vivent dans `GameState.towns`, pas dans les objets
      d'aventure). (b) semble plus propre — à trancher par la session
      principale. Non corrigé ici (`packages/engine` et `packages/client` hors
      périmètre exclusif du lot).
- [x] **Lot J (sonnet) — écran de ville** : `client/src/ui/TownScreen.tsx`
      (+ css) onglets Construire (arbre : construit/disponible/verrouillé, « 1
      bâtiment/jour utilisée »)/Recruter (slider + coût live)/Garnison
      (transfert vers héros), bouton `[Ville]`, toasts revenu/croissance,
      i18n (clés core), hooks de test. Livré : `TownScreen.tsx` + `town.css`,
      bouton `[Ville]` dans `TurnBar` (shell.tsx), 31 clés de locale FR/EN.
      Toasts revenu/croissance/construction/recrutement NON branchés (le
      composant `ToastHost` qui gère l'abonnement eventBus vit dans
      `toasts.tsx`, hors périmètre du lot) — seules les clés `toast.*` sont
      ajoutées, à câbler par l'intégration ou un lot ultérieur. Vérification
      finale bloquée en aval : `typecheck`/`build`/`content:check` échouent
      pour des raisons antérieures au lot (Lot I en cours : `data/core/
      buildings.json` absent, `content/src/loader.ts` référence des fonctions
      non définies `checkUniqueBuildingIds`/`checkBuildingRequires`/
      `resolveStartingTowns`, `FactionPack`/`ResolvedMap` incomplets pour
      `buildings`/objets `town`) — confirmé pré-existant (git status montrait
      déjà ces fichiers modifiés avant le lot J) et hors du périmètre exclusif
      du lot (packages/content, packages/engine interdits). `TownScreen.tsx`
      et `shell.tsx` ne remontent aucune erreur TS/ESLint isolément.
- [x] **Intégration (principal)** : résolution du `buildingCatalog`
      contenu→moteur, ville de départ dans `newGameCommand`, montage écran
      ville, smoke « construire un bâtiment + recruter + transférer → l'armée
      du héros augmente », golden, docs (doc 02 §4 écarts, doc 06 §2 note
      buildings, CLAUDE.md), vérif complète, PR draft.

## Écarts assumés

- `market`/`tavern`/`forge`/bâtiments spéciaux de faction : modélisés
  (prérequis d'arbre) sans effet mécanique en 3.1 ; effets livrés en 3.2
  (sorts/héros) / 3.3–3.4 (spéciaux) / post-MVP (forge, troc).
- Mines productrices, habitations hors-ville, siège/décor de ville, règle de
  défaite « 7 jours », acteur ennemi : phases ultérieures (3.5).
- Vue de ville peinte : 3.6 ; 3.1 = liste (doc 08 §2.2, entrée mobile).

## Écarts constatés en cours de route

- **Intégration** : `CombatUnitDef` enrichi de `recruitCost?`/`growthPerWeek?`
  (surface figée étendue) — le client les peuple depuis `unit.cost`/
  `unit.growthPerWeek` ; le moteur (lot H) les lit pour le débit et la
  croissance. Les objets `town` de la carte de contenu sont filtrés dans
  `newGameCommand` (les villes vivent dans `GameState.towns`). Toasts villes
  branchés dans `ToastHost`.
- **Croissance au démarrage abandonnée** : l'appliquer au `StartGame` cassait
  le modèle pur des tests lot H (double application au jour 8). Le stock ne se
  remplit qu'au passage de semaine ; le smoke avance 7 tours avant de recruter.
- **Lot I** : `buildingIdSchema` accepte camelCase (communs `townHall`/
  `mageGuild`) **et** kebab-case (dwellings de faction) — cohérent avec les
  clés de locale du lot J.
- **Lot H** : `recruitCost`/`growthPerWeek` lus optionnellement (no-op si
  absents) ; garnison/armée pleine rejetée en `invalidAction` ;
  `GarrisonTransfer` sans événement dédié (surface figée).
- **Barre d'actions mobile** : le bouton `[Ville]` faisait déborder la barre
  hors du viewport Pixel 7 (attrapé par le smoke) → `.actions` en `flex-wrap`.
- **Ville non dessinée sur la carte** en 3.1 (accès par `[Ville]`) ; sprite +
  visite = finitions 3.6.
