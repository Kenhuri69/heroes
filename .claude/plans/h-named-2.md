# Lot H-NAMED.2 — Choix du héros nommé de départ

> Plan vivant (guidelines §5). Source : doc 02 §1.1/§1.2, backlog H-NAMED.

## Objectif

À « Nouvelle partie » et « Escarmouche », chaque **siège humain** choisit son
**héros nommé** dans le roster de sa faction (`startingHeroId`, déjà supporté
moteur). Défaut = **aléatoire seedé** (RNG moteur, jamais `Math.random`).

## Invariants (guidelines §8)

- Zéro faction moteur (garde-fou CI) — `startingHeroId` est un id opaque.
- RNG **seedé** uniquement pour le tirage aléatoire.
- Moteur sans rendu.
- **Zéro diff moteur** ⇒ **pas de bump save, golden inchangé** (le moteur résout
  déjà `startingHeroId` via `heroRoster` à `StartGame`).

## Décisions / arbitrages

- Un siège humain avec héros choisi/tiré : `PlayerSetup.startingHeroId` posé,
  **on OMET `startingAttributes`/`startingName`** ⇒ le roster fournit
  nom/attributs/spécialité/compétences. On **garde** `startingSpells` (loadout
  MVP générique cercle ≤ 3) pour ne pas nerfer les héros might à 0 sort.
- **Sièges IA** : inchangés (héros générique, `startingHeroId` absent) — la tâche
  scope le choix aux humains.
- **Unicité de pool** : au sein d'un `StartGame`, chaque héros nommé n'est
  attribué qu'une fois (dedupe `taken`) — un tirage aléatoire évite un héros déjà
  pris ; un doublon explicite (hot-seat même faction) retombe sur un libre.
- Faction sans héros de roster jouable ⇒ repli générique (`startingHeroId` '').

## Étapes

1. `game.ts` : `rosterHeroesFor(roster, factionId)` (liste id+nom triée) ;
   `pickStartingHero(roster, factionId, pick, rng, taken)` (résolution seedée +
   dedupe). SkirmishConfig += `humanHeroId?`. NewGameSlot += `heroId` ;
   NewGameSeat += `heroId`. `resolveNewGameConfig(raw, factionIds, roster, seed)`
   résout heroId par siège humain. `skirmishStartCommand`/`newGameStartCommand`
   posent `startingHeroId` (+ omission attributs/nom) sur les sièges humains.
2. Store : `heroRoster` (id→{factionId,name}) exposé au bootstrap.
3. `SkirmishScreen` : `<select>` héros de la faction humaine (+ « Aléatoire »),
   réinitialisé au changement de faction.
4. `NewGameScreen` : `<select>` héros par siège humain.
5. Locales FR/EN (`skirmish.hero`, `newgame.hero`, réutiliser « Aléatoire »).
6. Smoke : escarmouche avec `humanHeroId` explicite ⇒ le héros de départ porte le
   nom/attributs/rosterId du héros choisi.
7. Docs : doc 02 §1.2 (état livré), backlog. Vérif complète + PR + merge.

## Journal

- Zéro diff moteur (startingHeroId déjà supporté) ⇒ pas de bump save, golden intact.
- `game.ts` : `rosterHeroesFor` + `pickStartingHero` (seedé, dedupe) ;
  SkirmishConfig.humanHeroId ; NewGameSlot.heroId + NewGameSeat.heroId ;
  `resolveNewGameConfig` prend le roster et résout heroId par siège humain (RNG
  après les autres tirages = séquence stable) ; `skirmish/newGameStartCommand`
  posent `startingHeroId` (+ omission attributs/nom) sur les sièges humains.
- Store `rosterHeroes` (bootstrap). SkirmishScreen + NewGameScreen : `<select>`
  héros par siège humain (reset au changement de faction). Locale `skirmish.hero`.
- Smoke : Escarmouche UI, faction haven + héros « anton » ⇒ le héros de départ
  porte rosterId/nom du roster. Desktop + mobile verts.
