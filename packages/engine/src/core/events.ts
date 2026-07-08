import type { GridPos, TriggerEffect, VisitableEffect } from '../adventure/map';
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
  // ——— Objets de carte (doc 02 §2.2) : mines, trésors, artefacts au sol ———
  /** Mine capturée en foulant sa tuile — `playerId` = nouveau propriétaire, `amount` = revenu/jour. */
  | {
      type: 'MineCaptured';
      playerId: string;
      objectId: string;
      resource: string;
      amount: number;
      pos: GridPos;
    }
  /** Revenu quotidien d'une mine possédée (appliqué au `DayStarted`). */
  | { type: 'MineIncome'; playerId: string; objectId: string; resource: string; amount: number }
  /** Trésor foulé : le choix or/XP est en attente (`ResolveTreasure`). */
  | {
      type: 'TreasureFound';
      heroId: string;
      playerId: string;
      objectId: string;
      gold: number;
      xp: number;
      pos: GridPos;
    }
  /** Choix du trésor résolu — `amount` = or crédité ou XP accordée selon `choice`. */
  | {
      type: 'TreasureTaken';
      heroId: string;
      playerId: string;
      objectId: string;
      choice: 'gold' | 'xp';
      amount: number;
    }
  /** Artefact ramassé au sol vers le 1er slot libre du héros. */
  | {
      type: 'ArtifactPicked';
      heroId: string;
      playerId: string;
      objectId: string;
      artifactId: string;
      pos: GridPos;
    }
  /** Lieu de bonus visité (doc 02 §2.2) — `amount` = gain effectif appliqué. */
  | {
      type: 'BonusVisited';
      heroId: string;
      playerId: string;
      objectId: string;
      effect: VisitableEffect;
      amount: number;
    }
  /** Recrutement à une habitation hors ville (doc 02 §2.2). */
  | {
      type: 'DwellingRecruited';
      heroId: string;
      playerId: string;
      objectId: string;
      unitId: string;
      count: number;
    }
  /** Gardien errant : un pas quotidien vers le héros le plus proche (doc 02 §2.2). */
  | { type: 'GuardianMoved'; objectId: string; from: GridPos; to: GridPos }
  /**
   * Trigger de carte déclenché (doc 02 §2.1) — l'UI notifie/journalise selon
   * `effect`. `playerId` = joueur affecté (visite / octroi), `null` pour un
   * message global (`onDay`).
   */
  | { type: 'TriggerFired'; triggerId: string; playerId: string | null; effect: TriggerEffect }
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
  /** Charges de Marque consommées par une capacité `consumeMarks` (doc 05 §3.1). */
  | { type: 'MarksConsumed'; strikerId: string; targetId: string; consumed: number }
  /** Ressource de faction gagnée post-victoire (doc 05 §3.3, effet déclaratif). */
  | { type: 'FactionResourceGained'; playerId: string; resource: string; amount: number }
  /** Pile immobilisée (doc 05 §3.1 `pinningShot`) : son tour est sauté. */
  | { type: 'StackImmobilized'; stackId: string }
  /** Bascule en forme démon (doc 05 §4 `demonform`) : perd la résistance, gagne des dégâts. */
  | { type: 'StackTransformed'; stackId: string }
  | {
      type: 'CombatEnded';
      winner: CombatSideId;
      /** Camp joué par le joueur (doc 02 §5) — l'UI en déduit victoire/défaite (R7c). */
      playerSide: CombatSideId;
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
  /** Amélioration d'une pile de garnison (doc 02 §4.1, Alpha 4.11). */
  | { type: 'UnitsUpgraded'; townId: string; fromUnitId: string; toUnitId: string; count: number }
  /** Achat d'une machine de guerre par le héros présent (doc 02 §5, Alpha 4.12). */
  | { type: 'WarMachineBought'; townId: string; heroId: string; unitId: string }
  | { type: 'TownIncome'; playerId: string; resource: string; amount: number }
  | { type: 'TownGrowth'; townId: string; unitId: string; added: number }
  | { type: 'TownCaptured'; townId: string; playerId: string }
  // ——— Contrats de chasse (doc 05 §3.3) — cible neutre hebdomadaire ———
  | { type: 'HuntContractAssigned'; playerId: string; targetObjectId: string }
  | { type: 'HuntContractCompleted'; playerId: string; gold: number; resource: string; amount: number }
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
  /** Sorts appris à la guilde des mages d'une ville visitée (doc 02 §4.1, G2). */
  | { type: 'SpellsLearned'; heroId: string; spellIds: string[] }
  // ——— Sort d'aventure (doc 02 §1.4, Alpha 4.16) : effet hors combat sur la carte ———
  | { type: 'AdventureSpellCast'; heroId: string; spellId: string; pos: GridPos }
  // ——— Effets de faction déclaratifs (doc 06 §4) — surface figée lot O 3.4 ———
  /** Nécromancie et effets de faction analogues (raiseUndeadOnVictory). */
  | { type: 'UndeadRaised'; heroId: string; unitId: string; count: number }
  // ——— Scénarios & fin de partie (doc 02 §6) — surface figée cadrage 3.5 ———
  | { type: 'PlayerEliminated'; playerId: string }
  | { type: 'GameEnded'; status: 'won' | 'lost'; winnerPlayerId: string }
  // ——— Quêtes de campagne (doc 13 §6.2, N2a) — le moteur émet, le client lit ———
  /** Une quête embarquée devient active (à `StartGame`). */
  | { type: 'QuestStarted'; questId: string }
  /** Une étape franchie (le client peut y attacher un `dialogBefore`). */
  | { type: 'QuestAdvanced'; questId: string; stepId: string }
  /** Toutes les étapes franchies : récompenses appliquées. */
  | { type: 'QuestCompleted'; questId: string };
