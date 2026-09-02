import type { GameState } from '../core/state';
import type { ArmyStack, CombatSideId, CombatState } from './types';

/**
 * Reconstruction d'une armée de héros depuis les survivants d'un combat —
 * helper PARTAGÉ (revue 2026-09, amélioration B) par les quatre sorties d'un
 * combat : victoire (`applyConsequences`), héros-vs-héros, abandon et reddition.
 * Trois copies divergeaient : seule la victoire routait par propriétaire (coop),
 * aucune ne fusionnait les doublons ni n'excluait les invocations.
 *
 * Règles (doc 02 §5) :
 *  - machines de guerre exclues (elles vivent sur `hero.warMachines`) ;
 *  - créatures INVOQUÉES exclues (M2) : une invocation ne survit pas à la
 *    bataille — sinon un sort d'invocation par combat offrait des troupes
 *    gratuites, permanentes et cumulatives (mana remplie à chaque combat) ;
 *  - fusion par `unitId` (M3) : un renfort ou une pile scindée ne crée pas deux
 *    entrées du même `unitId` (les transferts fusionnent par `find`, et le cap
 *    de 7 piles serait dépassé) ; l'ordre est celui de première apparition.
 * Pure et déterministe ; aucune notion de faction.
 */

/** Ids d'unité INVOQUÉES par un sort `summon` du catalogue — dérivé, jamais sérialisé. */
export function summonedUnitIds(state: Pick<GameState, 'spellCatalog'>): Set<string> {
  const ids = new Set<string>();
  for (const spell of Object.values(state.spellCatalog)) {
    if (spell.kind === 'summon' && spell.summon) ids.add(spell.summon.unit.id);
  }
  return ids;
}

/**
 * Héros PROPRIÉTAIRES des piles vivantes d'un camp (coop E4.2) : le lead
 * (`leadHeroId`, dont les piles n'ont pas d'`ownerHeroId`) plus tout allié dont
 * une pile a survécu. Hors coop ⇒ juste le lead (comportement historique).
 */
export function sideOwnerHeroIds(combat: CombatState, side: CombatSideId, leadHeroId: string | null): Set<string> {
  const owners = new Set<string>();
  if (leadHeroId) owners.add(leadHeroId);
  for (const s of combat.stacks) {
    if (s.side === side && s.count > 0 && s.ownerHeroId) owners.add(s.ownerHeroId);
  }
  return owners;
}

/**
 * Armée reconstruite d'UN héros propriétaire depuis les survivants de `side`.
 * `leadHeroId` = héros dont les piles sont sans `ownerHeroId` (le lead) ;
 * `warMachines` = machines du héros reconstruit (exclues).
 */
export function rebuildArmyFromSurvivors(
  state: Pick<GameState, 'spellCatalog'>,
  combat: CombatState,
  side: CombatSideId,
  ownerHeroId: string,
  leadHeroId: string | null,
  warMachines: readonly string[],
): ArmyStack[] {
  const summoned = summonedUnitIds(state);
  const merged: ArmyStack[] = [];
  for (const s of combat.stacks) {
    if (s.side !== side || s.count <= 0) continue;
    if ((s.ownerHeroId ?? leadHeroId) !== ownerHeroId) continue;
    if (warMachines.includes(s.unitId) || summoned.has(s.unitId)) continue;
    const existing = merged.find((m) => m.unitId === s.unitId);
    if (existing) existing.count += s.count;
    else merged.push({ unitId: s.unitId, count: s.count });
  }
  return merged;
}
