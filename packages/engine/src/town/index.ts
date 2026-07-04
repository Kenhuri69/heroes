import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';

/**
 * Points d'entrée du town building appelés par `core/engine.ts` — signatures
 * FIGÉES en cadrage (plan phase-3.1). Lot H : implémentation des règles ici
 * (fichiers frères dans `town/`), sans toucher à `core/` ni aux signatures.
 */

type Draft = GameState;
type BuildCmd = Extract<Command, { type: 'BuildStructure' }>;
type RecruitCmd = Extract<Command, { type: 'RecruitUnits' }>;
type TransferCmd = Extract<Command, { type: 'GarrisonTransfer' }>;
type CaptureCmd = Extract<Command, { type: 'CaptureTown' }>;

const NOT_IMPLEMENTED: CommandError = {
  code: 'invalidAction',
  message: 'town building non implémenté (lot H en cours)',
};

/* eslint-disable @typescript-eslint/no-unused-vars -- stubs lot H */

export function validateBuildStructure(state: GameState, cmd: BuildCmd): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function validateRecruitUnits(state: GameState, cmd: RecruitCmd): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function validateGarrisonTransfer(state: GameState, cmd: TransferCmd): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function validateCaptureTown(state: GameState, cmd: CaptureCmd): CommandError | null {
  return NOT_IMPLEMENTED;
}

export function handleBuildStructure(draft: Draft, cmd: BuildCmd, events: GameEvent[]): void {
  throw new Error('town building non implémenté (lot H)');
}

export function handleRecruitUnits(draft: Draft, cmd: RecruitCmd, events: GameEvent[]): void {
  throw new Error('town building non implémenté (lot H)');
}

export function handleGarrisonTransfer(draft: Draft, cmd: TransferCmd, events: GameEvent[]): void {
  throw new Error('town building non implémenté (lot H)');
}

export function handleCaptureTown(draft: Draft, cmd: CaptureCmd, events: GameEvent[]): void {
  throw new Error('town building non implémenté (lot H)');
}

/** Revenu quotidien des villes du joueur (doc 02 §4.1) — appelé au `DayStarted`. */
export function applyDailyIncome(draft: Draft, events: GameEvent[]): void {
  // stub lot H : aucune ville ne produit encore.
}

/** Croissance hebdomadaire des habitations (doc 02 §4.1) — appelé au `WeekStarted`. */
export function applyWeeklyGrowth(draft: Draft, events: GameEvent[]): void {
  // stub lot H
}

/** Remet `builtToday` à false (1 construction/ville/jour) — appelé au `DayStarted`. */
export function resetBuiltToday(draft: Draft): void {
  for (const town of draft.towns) town.builtToday = false;
}

/* eslint-enable @typescript-eslint/no-unused-vars */
