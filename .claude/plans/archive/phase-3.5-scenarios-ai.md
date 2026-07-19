# Plan — Phase 3.5 : Scénarios & IA d'aventure

Réf : doc 11 §Phase 3.5 ; doc 02 §2–§4 (carte, temps, villes) ; doc 09
(roadmap). Objectif : un **adversaire IA jouable** sur la carte + des
**conditions de victoire/défaite data-driven** + **3 scénarios solo**, dont un
tutoriel gagnable contre l'IA. Déterministe, moteur pur (RNG seedé, sans rendu).

## Périmètre resserré (MVP jouable)

1. **Conditions de victoire/défaite déclaratives** (moteur) évaluées après les
   transitions (fin de tour, combat, capture) : types
   `eliminateAllEnemies`, `captureTown`, `defeatHero`, `surviveDays`.
2. **Élimination de joueur** : un joueur sans ville ni héros est éliminé
   (grâce des « 7 jours » du doc 02 §4 différée — élimination immédiate au MVP,
   documentée). Dernier joueur non éliminé ⇒ `eliminateAllEnemies`.
3. **IA d'aventure** déterministe : à son tour, l'IA joue chaque héros
   (explore / ramasse / attaque gardien battable / capture ville), construit
   1 bâtiment abordable par ville, recrute l'abordable, puis finit le tour.
4. **Scénarios** : `data/scenarios/<id>.scenario.json` (référence une carte +
   joueurs {faction, contrôleur, dotation} + conditions). 3 scénarios solo.
5. **Triggers de carte** (`onVisit`/`onDay`) : **différés** (écart documenté) —
   le tutoriel « gagner contre l'IA » repose sur conditions + IA, pas triggers.

## Décisions préalables

1. **`PlayerState.controller: 'human' | 'ai'`** + `PlayerSetup.controller?`
   (défaut `'human'`). L'IA ne joue que les joueurs `'ai'`.
2. **`GameState.outcome: { status: 'won' | 'lost'; winnerPlayerId: string } | null`**
   (null = en cours). Du point de vue du joueur local (`player-1`) : `won` si
   sa condition de victoire est remplie / tous les ennemis éliminés ; `lost` si
   sa condition de défaite est remplie / il est éliminé. Événement `GameEnded
   { status, winnerPlayerId }`. `PlayerState.eliminated: boolean`.
3. **Conditions** portées par `StartGame.scenario?: { objectives: Record<
   playerId, { victory: VictoryCondition; defeat: VictoryCondition }> }` (résolu
   par le contenu). `VictoryCondition` = union discriminée (`eliminateAllEnemies`
   | `captureTown {townId}` | `defeatHero {heroId}` | `surviveDays {days}`).
   Défaut (pas de scénario) : `eliminateAllEnemies` / élimination — golden et
   parties libres inchangés tant qu'aucun scénario n'est fourni.
4. **Évaluation** : une fonction pure `evaluateOutcome(draft)` appelée en fin de
   `EndTurn` (après la bascule de jour) et après `applyConsequences`/capture ;
   pose `draft.outcome` + émet `GameEnded` une seule fois. Les commandes sont
   refusées si `outcome !== null` (partie finie).
5. **Pilotage des tours IA** : un driver `runAiTurn(draft, playerId, events)`
   (moteur, `ai/adventure.ts`) applique les décisions du joueur IA puis
   l'équivalent d'un `EndTurn`. Côté client et property test, une boucle
   « tant que le joueur courant est `ai` et la partie n'est pas finie, jouer le
   tour IA ». Déterministe (RNG de l'état).
6. **Heuristique IA MVP** (simple mais fonctionnelle, déterministe) : par héros,
   cibler le meilleur objectif atteignable (ressource au sol > gardien battable
   selon une estimation de force > ville ennemie/ neutre) via A* déjà en place ;
   avancer d'un déplacement/jour ; à défaut, explorer vers l'inexploré. Par
   ville IA : construire le premier bâtiment abordable et prérequis satisfaits,
   recruter ce qui est abordable en garnison. Pas de gestion de sorts/combat
   tactique (auto-combat déjà déterministe).

## Surfaces figées (cadrage — faites par la session principale avant les lots)

- **Moteur** : `PlayerState.controller`/`eliminated` ; `PlayerSetup.controller?` ;
  `GameState.outcome` ; `StartGame.scenario?` ; type `VictoryCondition` +
  `ScenarioObjectives` ; événement `GameEnded` ; stubs `evaluateOutcome` /
  `runAiTurn`. Golden refixé si la forme d'état change (nouveaux champs).
- **Contenu** : `scenarioSchema` + `data/scenarios/*` + loader
  `buildScenario`/`loadScenarios`.
- **Client** : sélection de scénario (menu), overlay victoire/défaite, boucle
  de pilotage des tours IA après le tour du joueur.

## Lots

- [x] **Cadrage (principal)** : plan + surfaces figées (state/commands/events/
      types + stubs `evaluateOutcome`/`runAiTurn`), golden refixé
      `211e3cfd`→`48073225` (nouveaux champs, simulation inchangée). Vert.
- [x] **Lot R (sonnet) — moteur conditions** : `evaluateOutcome`
      (4 conditions + élimination + dernier debout), câblage EndTurn/combat/
      capture, refus de commande `gameOver` si partie finie, `GameEnded`/
      `PlayerEliminated`, 12 tests. Golden intact.
- [x] **Lot S (sonnet) — moteur IA d'aventure** : `runAiTurn` + `town-ai.ts`
      (héros : objectif A* + ramassage/gardien battable/capture ; ville :
      build+recruit ; ne pousse pas EndTurn — driver s'en charge), 5 tests dont
      property « IA vs IA se termine (< 200 jours) » + déterminisme. 175 tests.
- [x] **Lot T (sonnet) — contenu scénarios** : `scenarioSchema` +
      `victoryConditionSchema`, loader `loadScenarios`/`buildScenarioObjectives`,
      3 scénarios (`tutorial`/`survival`/`conquest` sur proto-01), locales,
      `content:check` étendu, 53 tests contenu.
- [x] **Intégration moteur (principal)** : commande `AiTurn` (runAiTurn + fin
      de tour), pilotable par le client ; golden intact `48073225`.
- [x] **Lot U (sonnet) — client** : `scenarioStartCommand(report, scenario,
      seed, map)` (multi-joueurs, joueurs ordonnés par `startPositionIndex` ;
      `map` pré-résolue — écart de signature assumé, cf. note ci-dessous) +
      `startScenario` (main.ts) ; boucle de pilotage des tours IA dans
      `app/dispatch.ts` (après tout dispatch réussi, garde-fou 200 tours) ;
      overlay victoire/défaite (`OutcomeOverlay.tsx`, i18n `outcome.won/lost/
      backToMenu`) + toast `GameEnded` optionnel ; menu → section « Scénarios »
      (`appStore.scenarios`, aucun id en dur) ; hook `__HEROES_TEST__.
      startScenario` ; 2 tests smoke (« l'IA joue son tour » sur `tutorial` via
      clic menu, « gagner » sur `survival` via hook + boucle `EndTurn`).
      Vérif complète verte (typecheck/lint/build/smoke desktop+mobile 34/34).
      Écart de signature : `scenarioStartCommand` prend `map: ResolvedMap` déjà
      résolue (comme `newGameCommand`) plutôt que de fetcher elle-même — la
      résolution async (`loadScenarioMap`, `app/content.ts`) reste hors de
      `game.ts` (builders purs, aucun I/O), cohérent avec le pattern existant.
- [x] **Intégration finale (principal)** : docs (02 §6 État 3.5, CLAUDE.md),
      garde-fou, vérif globale, PR, merge.

## Écarts assumés

- Triggers de carte `onVisit`/`onDay`/`onFlagCaptured` différés (post-3.5).
- Grâce de 7 jours avant défaite (doc 02 §4) : élimination immédiate au MVP.
- IA sans magie ni micro-combat tactique (auto-combat déterministe) ; pas de
  diplomatie ni d'échange ; heuristique « gloutonne » simple (pas de planif
  multi-tours) — suffisante pour un adversaire de tutoriel.
- Sièges/murs, obélisques/Graal, marché : hors périmètre (déjà différés).
