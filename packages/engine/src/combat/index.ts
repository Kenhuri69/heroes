import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import type { OffsetPos } from './hex';

/**
 * Points d'entrée du combat appelés par `core/engine.ts` — signatures FIGÉES
 * en cadrage (plan phase-2.4). Lot A : implémentation des règles ici (fichiers
 * frères dans `combat/`), sans toucher à `core/` ni aux signatures.
 */

type Draft = GameState;
type StartCombatCmd = Extract<Command, { type: 'StartCombat' }>;
type CombatActionCmd = Extract<Command, { type: 'CombatAction' }>;

const NOT_IMPLEMENTED: CommandError = {
  code: 'invalidAction',
  message: 'combat non implémenté (lot A en cours)',
};

/* eslint-disable @typescript-eslint/no-unused-vars -- stubs lot A */

export function validateStartCombat(state: GameState, cmd: StartCombatCmd): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function validateCombatAction(state: GameState, cmd: CombatActionCmd): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function validateAutoCombat(state: GameState): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function handleStartCombat(draft: Draft, cmd: StartCombatCmd, events: GameEvent[]): void {
  throw new Error('combat non implémenté (lot A)');
}

export function handleCombatAction(draft: Draft, cmd: CombatActionCmd, events: GameEvent[]): void {
  throw new Error('combat non implémenté (lot A)');
}

export function handleAutoCombat(draft: Draft, events: GameEvent[]): void {
  throw new Error('combat non implémenté (lot A)');
}

/** Estimation min–max pour la prévisualisation OBLIGATOIRE (doc 08 §2.4) — sans RNG. */
export interface DamageEstimate {
  damageMin: number;
  damageMax: number;
  killsMin: number;
  killsMax: number;
  /** Riposte estimée après pertes minimales/maximales — null si pas de riposte. */
  retaliation: { damageMin: number; damageMax: number } | null;
}

export function estimateDamage(
  state: GameState,
  attackerId: string,
  targetId: string,
): DamageEstimate {
  throw new Error('combat non implémenté (lot A)');
}

/** Hexes atteignables par la pile (déplacement seul) — surbrillances UI. */
export function reachableHexes(state: GameState, stackId: string): OffsetPos[] {
  throw new Error('combat non implémenté (lot A)');
}

/** La pile peut-elle tirer (shooter, munitions > 0, pas d'ennemi adjacent) ? */
export function canShoot(state: GameState, stackId: string): boolean {
  throw new Error('combat non implémenté (lot A)');
}

/**
 * Ouvre un combat d'interception héros ↔ gardien — appelé par le handler
 * `MoveHero` (câblage lot D). Le héros n'entre PAS sur la tuile du gardien.
 */
export function beginGuardianCombat(
  draft: Draft,
  heroId: string,
  guardianObjectId: string,
  events: GameEvent[],
): void {
  throw new Error('combat non implémenté (lot A)');
}

/* eslint-enable @typescript-eslint/no-unused-vars */
