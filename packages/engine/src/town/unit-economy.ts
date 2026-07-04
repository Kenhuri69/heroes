import type { CombatUnitDef } from '../combat/types';
import type { Resources } from '../core/state';

/**
 * Champs d'économie de ville lus sur le catalogue d'unités mais ABSENTS de
 * `CombatUnitDef` (surface figée du combat, phase 2.4) : coût de recrutement
 * et croissance hebdomadaire. Lus ici de façon optionnelle en attendant que
 * la session principale ajoute `recruitCost?`/`growthPerWeek?` à
 * `CombatUnitDef` — voir rapport du lot H. Absents ⇒ coût nul / pas de
 * croissance (no-op), jamais d'erreur.
 */
export interface UnitEconomyFields {
  recruitCost?: Partial<Resources>;
  growthPerWeek?: number;
}

export type UnitWithEconomy = CombatUnitDef & UnitEconomyFields;

/** Lit `def` du catalogue avec les champs d'économie optionnels ; `undefined` si l'unité est inconnue. */
export function unitWithEconomy(
  catalog: Record<string, CombatUnitDef>,
  unitId: string,
): UnitWithEconomy | undefined {
  return catalog[unitId] as UnitWithEconomy | undefined;
}
