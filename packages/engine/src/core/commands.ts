import type { AdventureConfig } from '../adventure/config';
import type { AdventureMapDef, GridPos } from '../adventure/map';
import type { ArmyStack, CombatActionInput, CombatUnitDef } from '../combat/types';
import type { Resources } from './state';

export interface PlayerSetup {
  id: string;
  /** Ressources de départ — fournies par le scénario/les données, jamais en dur. */
  startingResources: Resources;
  /** Armée de départ du héros (≤ 7 piles) — données de scénario. */
  startingArmy?: ArmyStack[];
}

/**
 * Union des commandes — petites et sérialisables : c'est le format de replay
 * et le futur protocole réseau (doc 07 §3). `StartGame` embarque carte,
 * constantes et catalogue d'unités résolus (validés par le pipeline de
 * contenu) : le moteur ne fetch jamais rien. En combat, seul le camp du
 * joueur est commandé — le camp IA est joué par le moteur (le journal ne
 * contient que les décisions du joueur).
 */
export type Command =
  | {
      type: 'StartGame';
      seed: number;
      players: PlayerSetup[];
      map: AdventureMapDef;
      config: AdventureConfig;
      unitCatalog: Record<string, CombatUnitDef>;
    }
  | {
      /** Chemin calculé par A* côté client ; le moteur revalide chaque pas. */
      type: 'MoveHero';
      heroId: string;
      path: GridPos[];
    }
  | { type: 'EndTurn'; playerId: string }
  | {
      /** Ouvre un combat hors aventure (arène `/#arena`, tests). */
      type: 'StartCombat';
      attacker: ArmyStack[];
      defender: ArmyStack[];
      terrain: string;
    }
  | { type: 'CombatAction'; action: CombatActionInput }
  | {
      /** L'IA joue le camp du joueur jusqu'à la fin du combat (doc 02 §5.5). */
      type: 'AutoCombat';
    };

export interface CommandError {
  code:
    | 'gameAlreadyStarted'
    | 'gameNotStarted'
    | 'noPlayers'
    | 'duplicatePlayerId'
    | 'notYourTurn'
    | 'invalidMap'
    | 'unknownHero'
    | 'notYourHero'
    | 'invalidPath'
    | 'noMovementPoints'
    | 'combatActive'
    | 'noCombat'
    | 'invalidArmy'
    | 'invalidAction';
  message: string;
}

export class EngineError extends Error {
  constructor(readonly detail: CommandError) {
    super(`${detail.code}: ${detail.message}`);
    this.name = 'EngineError';
  }
}
