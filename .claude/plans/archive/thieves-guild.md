# Plan — Lot 3.3 (doc 18) : guilde des voleurs (E3)

> **Statut** : ✅ livré (2026-07-17).
> Écart couvert : **E3** (doc 18 §2.E) — « seuls comparatifs : pré-combat et
> fin de partie ; manque un panneau de classement EN PARTIE (villes, force,
> revenus — précision graduée façon thieves guild, gaté par la Taverne) ».

## 0. Objectif & critère de sortie

Une section **« Guilde des voleurs »** dans l'onglet Taverne (fidélité HoMM :
la guilde vit à la taverne) : tableau comparatif de TOUS les joueurs actifs —
villes, héros, force d'armée totale, or/jour — avec **précision graduée** par
le nombre de Tavernes possédées : 1 Taverne = **rangs seulement** (1ᵉʳ, 2ᵉ…),
≥ 2 Tavernes = **valeurs exactes**.

**Critère de sortie mesurable** : Taverne construite ⇒ la section apparaît
avec une ligne par joueur actif (« Vous » marqué), rangs seuls à 1 Taverne ;
un joueur éliminé est grisé.

## 1. Périmètre & décisions

- **Client pur** — zéro diff moteur : `armyStrength`/`dailyIncome` exportés,
  tout le reste est projection d'état. Helper de présentation pur
  `thievesGuildRows(game)` dans `app/game.ts` (testable via le smoke, pas de
  harnais unitaire client).
- Gate naturel = onglet Taverne (déjà conditionné au bâtiment) ; le NIVEAU de
  guilde = nombre de villes du joueur humain actif avec Taverne construite.
- Identité des joueurs : n° de siège + pastille couleur (`playerColor`) + nom
  de contrôleur (« Vous » / « IA ») — jamais la couleur seule (doc 08).
- Hot-seat : chaque humain voit la guilde selon SES Tavernes (l'info adverse
  graduée est le but — l'espionnage HoMM).
- Force totale = somme des `armyStrength` des armées de héros du joueur (les
  garnisons restent secrètes — choix : la guilde HoMM révèle la « meilleure
  armée », pas les défenses).

## 2. État des lieux (points d'ancrage vérifiés)

- `TownScreen.tsx` : `TavernTab` (`:639`), gate `hasBuiltEffect(town,
  catalog, 'tavern')` (`:132`) ; testids `town-panel-tavern`, onglets.
- Smoke existant « taverne : construire ⇒ recruter » (`smoke.spec.ts:2051`) —
  même démarrage à étendre par `test.step` (leçon test-authoring).
- `playerColor` (`render/playerColors.ts`), `humanId`, `armyStrength`,
  `dailyIncome` — tous disponibles.

## 3. Étapes

- [ ] a. **Helper pur** (`app/game.ts`) : `thievesGuildRows(game)` →
      `{ playerId, seat, controller, eliminated, towns, heroes, strength,
      goldPerDay }[]` (ordre des sièges) + `rankOf` par métrique (rang 1 =
      meilleur ; ex æquo partagent le rang).
- [ ] b. **UI** (`TownScreen.tsx → TavernTab`) : section
      `town-thieves-guild` sous le roster — niveau de guilde affiché
      (« Guilde niv. N »), tableau (Villes / Héros / Force / Or-jour) ;
      niveau 1 ⇒ rangs (`#1`, `#2`…), niveau ≥ 2 ⇒ valeurs exactes ;
      ligne du joueur marquée « Vous », éliminés grisés + libellé.
- [ ] c. **CSS** (`town.css`) : tableau compact, cibles ≥ 44 px non requises
      (lecture seule), `rem`, scroll horizontal conteneurisé si étroit.
- [ ] d. **Locales FR/EN** : `town.thievesGuild.*` (titre, niveau, colonnes,
      vous, éliminé).
- [ ] e. **Doc** : doc 02 §4.1 (Taverne — état guilde des voleurs livrée,
      précision graduée) ; renvoi doc 18 E3.
- [ ] f. **Tests** : étendre le smoke taverne existant (MÊME démarrage,
      `test.step`) — après construction : section visible, 1 ligne (« Vous »),
      rang `#1` (1 Taverne ⇒ rangs seuls). Pas de nouveau smoke.
- [ ] g. **Vérifs standard** : typecheck, lint, moteur (inchangé), contenu,
      garde-fou faction, budget, smoke `@core` + taverne.

## 4. Hors périmètre

- Meilleure créature / artefacts / Graal dans le tableau (colonnes HoMM
  additionnelles — extensibles en données de présentation plus tard) ;
  classement PvP serveur (E2) ; niveau de guilde par BÂTIMENT gradué
  (la Taverne n'a qu'un niveau — on gradue par le NOMBRE de Tavernes).

## 5. Risques

| Risque | Mitigation |
|---|---|
| Fuite d'info en hot-seat | c'est la mécanique (espionnage gradué) ; rangs seuls au niveau 1 ; garnisons jamais révélées |
| Coût de calcul à chaque render | projection O(joueurs × héros) triviale, calculée au render de l'onglet seulement |
| Dérive CI | zéro nouveau smoke — extension du test taverne existant |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] a→e implémentés — `thievesGuildRows`/`thievesGuildRank` (helpers purs
      de présentation, `app/game.ts`, sur `armyStrength`/`dailyIncome`
      moteur), section `ThievesGuild` de `TavernTab` (niveau = nb de Tavernes
      possédées, rangs vs valeurs exactes, éliminés grisés hors classement,
      pastille couleur + n° de siège + « Vous »/« IA »), CSS tableau à scroll
      conteneurisé, 12 clés FR/EN, doc 02 §4.1 (note M-TAVERN étendue).
- [x] f tests verts — smoke taverne existant étendu d'un `test.step`
      (même démarrage) : section visible, ligne joueur, rang `#1` à 1 Taverne.
- [x] g vérifs — typecheck ✅ lint ✅ moteur 861/861 (zéro diff moteur) ✅
      contenu 152/152 ✅ garde-fou faction ✅ budget 330 Ko/800 Ko ✅ smoke
      `@core` 19/19 + taverne (2/2) ✅.
