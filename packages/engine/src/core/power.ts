import type { ArmyStack, CombatUnitDef } from '../combat/types';
import type { GameState } from './state';

/**
 * Force brute d'une armée (doc 08 §2.5) : Σ effectif × (PV + attaque + défense) —
 * estimation simple, cohérente avec la valuation de l'IA d'aventure. Helper PUR,
 * partagé (IA + graphique de puissance de fin de partie).
 */
export function armyStrength(army: ArmyStack[], catalog: Record<string, CombatUnitDef>): number {
  let total = 0;
  for (const stack of army) {
    const def = catalog[stack.unitId];
    if (!def) continue;
    total += stack.count * (def.stats.hp + def.stats.attack + def.stats.defense);
  }
  return total;
}

/**
 * Puissance d'un joueur (doc 08 §2.5) : force de toutes ses armées de héros +
 * garnisons de ville. Alimente le graphique de puissance de l'écran de fin de
 * partie. Pur et déterministe (aucune dépendance rendu).
 */
export function playerPower(state: GameState, playerId: string): number {
  const catalog = state.unitCatalog;
  let total = 0;
  for (const hero of state.heroes) {
    if (hero.playerId === playerId) total += armyStrength(hero.army, catalog);
  }
  for (const town of state.towns) {
    if (town.ownerPlayerId === playerId) total += armyStrength(town.garrison, catalog);
  }
  return total;
}
