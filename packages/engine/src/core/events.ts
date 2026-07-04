import type { GridPos } from '../adventure/map';
import type { CombatSideId } from '../combat/types';
import type { OffsetPos } from '../combat/hex';

/**
 * Événements descriptifs émis par `apply` : la présentation (Pixi, sons,
 * toasts) les consomme pour animer ; aucun n'est nécessaire à la correction
 * des règles (doc 07 §3).
 */
export type GameEvent =
  | { type: 'GameStarted'; seed: number; playerIds: string[] }
  | { type: 'TurnEnded'; playerId: string }
  | { type: 'DayStarted'; day: number }
  | { type: 'WeekStarted'; week: number }
  /** Un pas de héros — le rendu anime tuile par tuile (doc 07 §3). */
  | { type: 'MoveStepped'; heroId: string; from: GridPos; to: GridPos; movementPointsLeft: number }
  | {
      type: 'ResourcePicked';
      heroId: string;
      playerId: string;
      objectId: string;
      resource: string;
      amount: number;
      pos: GridPos;
    }
  // ——— Combat (doc 02 §5) — surface figée en cadrage phase 2.4 ———
  | {
      type: 'CombatStarted';
      terrain: string;
      heroId: string | null;
      guardianObjectId: string | null;
    }
  | { type: 'CombatRoundStarted'; round: number }
  | { type: 'CombatTurnStarted'; stackId: string }
  | { type: 'StackMoved'; stackId: string; from: OffsetPos; to: OffsetPos }
  /** Une frappe (attaque, 2ᵉ frappe doubleAttack ou riposte). */
  | {
      type: 'StackAttacked';
      attackerId: string;
      targetId: string;
      damage: number;
      kills: number;
      /** Coup de chance : dégâts doublés (doc 02 §5.3). */
      lucky: boolean;
      retaliation: boolean;
    }
  | { type: 'StackDied'; stackId: string }
  /** Moral : tour bonus (positive) ou tour sauté (doc 02 §5.3 + décision n°8). */
  | { type: 'MoraleTriggered'; stackId: string; positive: boolean }
  | { type: 'MarkApplied'; targetId: string; marks: number }
  | {
      type: 'CombatEnded';
      winner: CombatSideId;
      /** Pertes par camp et unité — l'UI affiche le bilan. */
      casualties: { side: CombatSideId; unitId: string; lost: number }[];
    }
  // ——— Progression du héros (doc 02 §1.2) — surface figée en cadrage 2.5 ———
  | { type: 'XpGained'; heroId: string; amount: number; xp: number }
  | {
      type: 'HeroLevelUp';
      heroId: string;
      level: number;
      attribute: 'attack' | 'defense' | 'power' | 'knowledge';
    }
  // ——— Villes (doc 02 §4) — surface figée en cadrage 3.1 ———
  | { type: 'TownBuilt'; townId: string; buildingId: string; level: number }
  | { type: 'UnitsRecruited'; townId: string; unitId: string; count: number }
  | { type: 'TownIncome'; playerId: string; resource: string; amount: number }
  | { type: 'TownGrowth'; townId: string; unitId: string; added: number }
  | { type: 'TownCaptured'; townId: string; playerId: string }
  // ——— Héros : sorts & compétences (doc 02 §1.2–§1.4) — surface figée 3.2 ———
  | {
      type: 'SpellCast';
      heroId: string;
      spellId: string;
      targetId: string;
      /** Dégâts infligés / PV soignés (0 pour un buff/debuff pur). */
      amount: number;
      kills: number;
    }
  | { type: 'SkillLearned'; heroId: string; skillId: string; rank: number }
  // ——— Effets de faction déclaratifs (doc 06 §4) — surface figée lot O 3.4 ———
  /** Nécromancie et effets de faction analogues (raiseUndeadOnVictory). */
  | { type: 'UndeadRaised'; heroId: string; unitId: string; count: number };
