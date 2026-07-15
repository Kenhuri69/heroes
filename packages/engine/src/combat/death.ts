import type { GameEvent } from '../core/events';
import { hasAbility, recordRevive, stackLostSoFar } from './state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from './types';

/**
 * Mort de pile CENTRALISÉE (CAP-LIFE.2) — cœur PARTAGÉ par tous les chemins de
 * dégâts. Interprète la capacité générique `rebirth` (renaissance) : une pile qui
 * meurt renaît UNE fois à `pct`% de son effectif d'origine, au lieu d'être retirée.
 * Le moteur ne connaît aucune faction — la capacité est portée par les données.
 */

/** Plan de renaissance d'une unité (`rebirth`), ou `null`. `pct` ∈ ]0,100]. */
export function rebirthPlan(def: CombatUnitDef): { pct: number } | null {
  const ability = def.abilities.find((a) => a.id === 'rebirth');
  if (!ability) return null;
  const pct = Number(ability.params?.['pct'] ?? 50);
  return pct > 0 ? { pct } : null;
}

/**
 * Tente la renaissance d'une pile qui vient d'atteindre 0 : si l'unité a `rebirth`
 * et n'a pas encore renée ce combat, elle revient à `max(1, floor(pct% × effectif
 * d'origine))` créatures (effectif d'origine = pertes cumulées de la pile, comme la
 * résurrection). Retourne `true` (renée, PAS retirée du plateau) ou `false`.
 */
export function tryRebirth(
  combat: CombatState,
  stack: CombatStack,
  def: CombatUnitDef,
  events: GameEvent[],
): boolean {
  const plan = rebirthPlan(def);
  if (!plan) return false;
  if ((combat.rebornStackIds ?? []).includes(stack.id)) return false;
  // Pertes de CETTE pile (B4) — jamais celles d'une autre pile du même unitId —
  // et décrément du ledger : les créatures renées puis retuées comptent une fois.
  const lost = stackLostSoFar(combat, stack);
  const revived = Math.max(1, Math.floor((plan.pct / 100) * lost));
  stack.count = revived;
  stack.firstHp = def.stats.hp;
  recordRevive(combat, stack, revived);
  combat.rebornStackIds = [...(combat.rebornStackIds ?? []), stack.id];
  events.push({ type: 'StackReborn', stackId: stack.id, count: revived });
  return true;
}

/**
 * Retire une pile morte du combat, OU la fait renaître (`rebirth`). Comportement
 * IDENTIQUE aux anciens sites de mort pour une pile sans renaissance (`StackDied`
 * puis splice) ⇒ golden inchangé. À appeler dès que `stack.count <= 0`.
 */
export function handleStackDeath(
  combat: CombatState,
  stack: CombatStack,
  def: CombatUnitDef,
  events: GameEvent[],
): void {
  if (tryRebirth(combat, stack, def, events)) return;
  events.push({ type: 'StackDied', stackId: stack.id });
  // Cimetière (H-SPELLS.4+, résurrection de pile entière) : on garde de quoi
  // relever la pile (unité, camp, slot, position, effectif perdu) AVANT de la
  // retirer du plateau. `warMachine`/tour de tir non relevables (comme la Nécromancie).
  if (!hasAbility(def, 'warMachine')) {
    const maxCount = stackLostSoFar(combat, stack);
    if (maxCount > 0)
      combat.graveyard = [
        ...(combat.graveyard ?? []),
        { id: stack.id, unitId: stack.unitId, side: stack.side, slot: stack.slot, pos: { ...stack.pos }, maxCount },
      ];
  }
  const idx = combat.stacks.findIndex((s) => s.id === stack.id);
  if (idx !== -1) combat.stacks.splice(idx, 1);
}
