import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import {
  applyAction,
  attackableTargets,
  canShoot,
  meleeOriginsFor,
  reachableHexes,
  validateCombatAction as validateAction,
} from './actions';
import { runAiIfNeeded, runAutoCombat } from './ai';
import { estimateDamage as estimateDamageCore } from './damage';
import {
  beginGuardianCombat as beginGuardianCombatImpl,
  handleStartCombat as handleStartCombatImpl,
  validateStartCombat as validateStartCombatImpl,
} from './setup';

/**
 * Points d'entrée du combat appelés par `core/engine.ts` — signatures FIGÉES
 * en cadrage (plan phase-2.4). Implémentation (lot A) déléguée aux fichiers
 * frères : `setup.ts` (mise en place), `actions.ts` (déplacement/attaque/
 * attendre/défendre, reachableHexes/canShoot), `damage.ts` (dégâts,
 * estimateDamage), `turns.ts` (ordre de jeu, fin de combat), `ai.ts` (IA de
 * base + auto-combat), `state-helpers.ts` (moral, vitesse, bilan de pertes).
 */

type Draft = GameState;
type StartCombatCmd = Extract<Command, { type: 'StartCombat' }>;
type CombatActionCmd = Extract<Command, { type: 'CombatAction' }>;

export function validateStartCombat(state: GameState, cmd: StartCombatCmd): CommandError | null {
  return validateStartCombatImpl(state, cmd);
}

export function validateCombatAction(state: GameState, cmd: CombatActionCmd): CommandError | null {
  return validateAction(state, cmd);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature figée (plan phase-2.4)
export function validateAutoCombat(state: GameState): CommandError | null {
  return null; // `core/engine.ts` a déjà vérifié qu'un combat est en cours
}

export function handleStartCombat(draft: Draft, cmd: StartCombatCmd, events: GameEvent[]): void {
  handleStartCombatImpl(draft, cmd, events);
}

export function handleCombatAction(draft: Draft, cmd: CombatActionCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat || !combat.activeStackId) return; // exclu par validate
  applyAction(draft, events, combat.activeStackId, cmd.action);
  runAiIfNeeded(draft, events);
}

export function handleAutoCombat(draft: Draft, events: GameEvent[]): void {
  runAutoCombat(draft, events);
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
  return estimateDamageCore(state, attackerId, targetId);
}

/** Hexes atteignables par la pile (déplacement seul) — surbrillances UI. */
export { reachableHexes };

/** La pile peut-elle tirer (shooter, munitions > 0, pas d'ennemi adjacent) ? */
export { canShoot };

/** Cibles attaquables + hex d'origine de mêlée — surbrillances/ciblage UI (CL9). */
export { attackableTargets, meleeOriginsFor };

/** Ordre de passage projeté du round (lot UX M1) — bandeau d'initiative UI. */
export { initiativeSpeed, roundActionOrder, type RoundActionOrder } from './state-helpers';

/** Auto-combat déterministe → camp vainqueur (brique de `faction:sim`, Alpha 4.17). */
export { simulateAutoCombat } from './simulate';

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
  beginGuardianCombatImpl(draft, heroId, guardianObjectId, events);
}
