import { RESOURCE_IDS, type Resources } from '../core/state';

/**
 * Petits utilitaires de coût partagés par build.ts et recruit.ts — aucune
 * règle métier ici, juste l'arithmétique sur `Partial<Resources>`.
 */

export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_IDS.every((id) => resources[id] >= (cost[id] ?? 0));
}

export function payCost(resources: Resources, cost: Partial<Resources>): void {
  for (const id of RESOURCE_IDS) {
    const amount = cost[id];
    if (amount) resources[id] -= amount;
  }
}

/** Multiplie un coût unitaire par un effectif (recrutement de `count` créatures). */
export function scaleCost(cost: Partial<Resources>, factor: number): Partial<Resources> {
  const scaled: Partial<Resources> = {};
  for (const id of RESOURCE_IDS) {
    const amount = cost[id];
    if (amount) scaled[id] = amount * factor;
  }
  return scaled;
}
