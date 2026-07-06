import type { Resources } from '../core/state';
import type { VictoryCondition } from '../scenario/types';

/**
 * Conditions de quête (doc 13 §5.2) — catalogue **fermé et générique**, comme
 * les capacités de combat. Le moteur interprète le `type` ; il ne connaît ni
 * texte, ni dialogue, ni quête nommée. Superset des `VictoryCondition` (doc 13
 * §6.2 : une seule notion d'« objectif ») plus les conditions propres aux
 * quêtes. Toutes évaluables **purement** depuis `GameState` (aucun compteur
 * d'action → déterministe, insensible au replay).
 */
export type QuestCondition =
  | VictoryCondition
  | { type: 'buildStructure'; buildingId: string }
  | { type: 'ownUnits'; unitId: string; count: number }
  | { type: 'defeatGuardian'; objectId: string }
  | { type: 'visitTile'; x: number; y: number };

/** Une étape ordonnée d'une quête : une condition observable. */
export interface QuestStep {
  id: string;
  condition: QuestCondition;
}

/** Récompense de complétion — mappée sur des mutations d'état existantes. */
export type QuestReward =
  | { type: 'resources'; resources: Partial<Resources> }
  | { type: 'artifact'; artifactId: string }
  | { type: 'units'; unitId: string; count: number };

/**
 * Définition de quête résolue, embarquée dans `GameState` (le titre/description/
 * dialogues sont des clés CÔTÉ CLIENT — hors moteur, doc 13 §6.2). `playerId`
 * optionnel : par défaut le joueur humain.
 */
export interface QuestDef {
  id: string;
  playerId?: string;
  steps: QuestStep[];
  rewards: QuestReward[];
}

/** Progression d'une quête en cours de partie. */
export interface QuestRuntime {
  def: QuestDef;
  /** Index de l'étape courante ; `= steps.length` quand toutes sont franchies. */
  stepIndex: number;
  status: 'active' | 'completed';
}

/**
 * État des quêtes embarqué dans `GameState` (doc 13 §6.2) — `null` hors
 * campagne : aucune évaluation (golden et parties libres inchangés).
 */
export interface QuestState {
  quests: QuestRuntime[];
}
