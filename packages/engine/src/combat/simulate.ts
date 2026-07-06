import { apply } from '../core/engine';
import { seedRng } from '../core/rng';
import { createEmptyState } from '../core/state';
import type { AdventureConfig } from '../adventure/config';
import type { ArmyStack, CombatSideId, CombatUnitDef } from './types';

/**
 * Résout un combat en **auto-combat déterministe** et rend le camp vainqueur
 * (doc 11 §3.5). Pur (RNG seedé injecté) : brique de simulation d'équilibrage
 * (outil `faction:sim`, Alpha 4.17). Réutilise l'API publique de commandes
 * (`StartCombat` + `AutoCombat`) — aucune connaissance de faction.
 *
 * `catalog` doit contenir toutes les unités des deux armées ; `terrain` doit
 * exister dans `config.terrains`. Un camp vidé perd ; à effectifs nuls des deux
 * côtés (impossible en pratique), le défenseur est réputé tenir la place.
 */
export function simulateAutoCombat(
  catalog: Record<string, CombatUnitDef>,
  config: AdventureConfig,
  attacker: ArmyStack[],
  defender: ArmyStack[],
  terrain: string,
  seed: number,
): CombatSideId {
  let state = createEmptyState();
  state.started = true;
  state.config = config;
  state.unitCatalog = catalog;
  state.rng = seedRng(seed);
  state = apply(state, { type: 'StartCombat', attacker, defender, terrain }).state;
  const result = apply(state, { type: 'AutoCombat' });
  const ended = result.events.find((e) => e.type === 'CombatEnded');
  return ended && ended.type === 'CombatEnded' ? ended.winner : 'defender';
}
