/**
 * Conditions de victoire/défaite déclaratives (doc 02 §6, plan phase-3.5).
 * Union discriminée — forme figée, partagée avec le contenu (`scenarioSchema`).
 * Le moteur interprète le `type` générique ; aucune connaissance de faction ni
 * de scénario nommé.
 */
export type VictoryCondition =
  | { type: 'eliminateAllEnemies' }
  | { type: 'captureTown'; townId: string }
  | { type: 'defeatHero'; heroId: string }
  | { type: 'surviveDays'; days: number };

/**
 * Objectifs d'un joueur dans un scénario : sa victoire et sa défaite. `defeat`
 * absente (lot LD1) ⇒ seule l'élimination HoMM fait perdre (plus de ville ni de
 * héros, ou plus de `RETAKE_GRACE_DAYS` jours sans ville).
 */
export interface ScenarioObjectives {
  victory: VictoryCondition;
  defeat?: VictoryCondition | undefined;
}

/**
 * Scénario résolu, embarqué dans `GameState` : objectifs par joueur. `null` en
 * partie libre (bac à sable) — aucune évaluation de fin de partie (le golden et
 * les parties proto restent inchangés).
 */
export interface ScenarioState {
  objectives: Record<string, ScenarioObjectives>;
}

/** Issue de la partie du point de vue du joueur local (doc 02 §6). */
export interface GameOutcome {
  status: 'won' | 'lost';
  winnerPlayerId: string;
}
