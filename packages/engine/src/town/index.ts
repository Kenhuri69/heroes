import type { GameState } from '../core/state';

/**
 * Points d'entrée du town building appelés par `core/engine.ts` — signatures
 * FIGÉES en cadrage (plan phase-3.1). Lot H : les règles vivent dans les
 * fichiers frères (`build.ts`, `recruit.ts`, `transfer.ts`, `capture.ts`,
 * `economy.ts`) ; ce fichier ne fait que ré-exporter sous les noms figés.
 */

export { validateBuildStructure, handleBuildStructure } from './build';
export { validateRecruitUnits, handleRecruitUnits } from './recruit';
export { validateUpgradeUnits, handleUpgradeUnits, upgradedUnitFor, upgradeCost } from './upgrade';
export { validateGarrisonTransfer, handleGarrisonTransfer } from './transfer';
export { validateCaptureTown, handleCaptureTown } from './capture';
export { validateTradeResources, handleTradeResources, tradeQuote } from './market';
export { applyDailyIncome, applyWeeklyGrowth } from './economy';
// Helpers purs consommés par le client (remédiation CL9) — le client cesse de
// réimplémenter les règles de coût / prérequis / dwellings du moteur.
export {
  builtDwellings,
  builtLevelOf,
  buildStatus,
  exclusiveRivalId,
  missingRequirements,
  unitIsRecruitable,
  type BuildRequirement,
  type BuildStatus,
} from './helpers';
export { scaleCost } from './resources';

type Draft = GameState;

/** Remet `builtToday` à false (1 construction/ville/jour) — appelé au `DayStarted`. */
export function resetBuiltToday(draft: Draft): void {
  for (const town of draft.towns) town.builtToday = false;
}
