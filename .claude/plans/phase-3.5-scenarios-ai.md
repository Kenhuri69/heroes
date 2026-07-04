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

- [ ] **Cadrage (principal)** : ce plan + surfaces figées (state/commands/
      events/types + stubs) + golden refixé, vert.
- [ ] **Lot R (sonnet) — moteur conditions** : `evaluateOutcome`
      (4 conditions + élimination + dernier debout), câblage EndTurn/combat/
      capture, refus de commande si partie finie, `GameEnded`, tests tabulaires.
- [ ] **Lot S (sonnet) — moteur IA d'aventure** : `runAiTurn` (héros :
      objectif A* + ramassage/gardien/capture ; ville : build+recruit ; puis
      fin de tour), property « IA vs IA se termine (< N jours) » + déterminisme,
      golden d'un scénario scripté.
- [ ] **Lot T (sonnet) — contenu scénarios** : `scenarioSchema`, loader,
      3 scénarios (`data/scenarios/`), `content:check` étendu, tests.
- [ ] **Lot U (sonnet) — client** : menu de sélection de scénario, overlay
      victoire/défaite (i18n), boucle de pilotage des tours IA, toasts.
- [ ] **Intégration (principal)** : câblage scénario→StartGame (joueur IA),
      smoke « gagner le scénario tutoriel contre l'IA », golden scripté, docs
      (doc 02 conditions/§6, doc 09), CLAUDE.md, garde-fou, PR, merge.

## Écarts assumés

- Triggers de carte `onVisit`/`onDay`/`onFlagCaptured` différés (post-3.5).
- Grâce de 7 jours avant défaite (doc 02 §4) : élimination immédiate au MVP.
- IA sans magie ni micro-combat tactique (auto-combat déterministe) ; pas de
  diplomatie ni d'échange ; heuristique « gloutonne » simple (pas de planif
  multi-tours) — suffisante pour un adversaire de tutoriel.
- Sièges/murs, obélisques/Graal, marché : hors périmètre (déjà différés).
