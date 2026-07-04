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

- [ ] **Cadrage (principal)** : ce plan + surfaces figées (état/commandes/
      événements/schéma/stubs), golden refigé, vert.
- [ ] **Lot H (sonnet) — moteur town** : `engine/src/town/` (build 1/jour,
      recruit, croissance `WeekStarted`, revenu `DayStarted`, garrison
      transfer, capture) + tests (1 build/jour rejeté au 2ᵉ, recrutement
      plafonné/débité, revenu au bon palier/jour, croissance plafonnée,
      capture sans garnison, property « ressources ≥ 0 »).
- [ ] **Lot I (sonnet) — contenu** : `buildingSchema` + règles croisées
      (prérequis résolubles, coûts en ressources/unités connues, dwellings→
      unités du paquet), `data/core/buildings.json`, `town` dans les manifestes
      test-faction + arcane-hunters (townHall/fort/mageGuild + 1 dwelling),
      `config.newGame.startingTown`, objet `town` sur `proto-01`,
      `content:check` étendu, tests loader.
- [ ] **Lot J (sonnet) — écran de ville** : `client/src/ui/TownScreen.tsx`
      (+ css) onglets Construire (arbre : construit/disponible/verrouillé, « 1
      bâtiment/jour utilisée »)/Recruter (slider + coût live)/Garnison
      (transfert vers héros), bouton `[Ville]`, toasts revenu/croissance,
      i18n (clés core), hooks de test.
- [ ] **Intégration (principal)** : résolution du `buildingCatalog`
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

(à compléter)
