import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';

/**
 * Points d'entrée héros (sorts en combat + choix de compétence) appelés par
 * `core/engine.ts` — signatures FIGÉES en cadrage (plan phase-3.2). Lot K :
 * implémentation ici (fichiers frères dans `hero/`), sans toucher aux
 * signatures ni à `core/`.
 */

type Draft = GameState;
type CastSpellCmd = Extract<Command, { type: 'CastSpell' }>;
type ChooseSkillCmd = Extract<Command, { type: 'ChooseSkill' }>;

const NOT_IMPLEMENTED: CommandError = {
  code: 'invalidAction',
  message: 'sorts/compétences non implémentés (lot K en cours)',
};

/* eslint-disable @typescript-eslint/no-unused-vars -- stubs lot K */

export function validateCastSpell(state: GameState, cmd: CastSpellCmd): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function validateChooseSkill(state: GameState, cmd: ChooseSkillCmd): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function handleCastSpell(draft: Draft, cmd: CastSpellCmd, events: GameEvent[]): void {
  throw new Error('sorts non implémentés (lot K)');
}

export function handleChooseSkill(draft: Draft, cmd: ChooseSkillCmd, events: GameEvent[]): void {
  throw new Error('compétences non implémentées (lot K)');
}

/**
 * Estimation min/max d'un sort SANS RNG (doc 08 §2.4) — prévisualisation
 * obligatoire, utilisée par l'UI et l'IA future.
 */
export interface SpellEstimate {
  amount: number;
  kills: number;
  kind: 'damage' | 'heal' | 'buff' | 'debuff';
}

export function estimateSpell(
  state: GameState,
  spellId: string,
  targetStackId: string,
): SpellEstimate {
  throw new Error('estimateSpell non implémenté (lot K)');
}

/* eslint-enable @typescript-eslint/no-unused-vars */
