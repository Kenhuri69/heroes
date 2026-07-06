import { RESOURCE_IDS, type PlayerState, type Resources } from '../core/state';

/**
 * Petits utilitaires de coût partagés par build.ts et recruit.ts — aucune
 * règle métier ici, juste l'arithmétique. `canAfford`/`payCost` (core-only)
 * servent aux coûts de bâtiment ; `canAffordCost`/`spendCost` (faction-aware)
 * aux coûts de recrutement, qui peuvent inclure une ressource de faction
 * (doc 05 §3.3, l'Essence) — chaque clé est routée vers le bon stock.
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

const CORE_IDS: ReadonlySet<string> = new Set(RESOURCE_IDS);

/** Le joueur peut-il payer un coût mêlant ressources communes et de faction ? */
export function canAffordCost(player: PlayerState, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([id, amount]) => {
    const have = CORE_IDS.has(id)
      ? player.resources[id as keyof Resources]
      : (player.factionResources[id] ?? 0);
    return have >= amount;
  });
}

/** Débite un coût mêlant ressources communes et de faction (routé par clé). */
export function spendCost(player: PlayerState, cost: Record<string, number>): void {
  for (const [id, amount] of Object.entries(cost)) {
    if (!amount) continue;
    if (CORE_IDS.has(id)) player.resources[id as keyof Resources] -= amount;
    else player.factionResources[id] = (player.factionResources[id] ?? 0) - amount;
  }
}

/**
 * Effectif maximal payable d'un coût unitaire (ressources communes ET de
 * faction, même routage que `canAffordCost`) — borne haute `cap`. Coût vide ⇒
 * `cap` (gratuit).
 */
export function maxAffordableCount(
  player: PlayerState,
  cost: Record<string, number>,
  cap: number,
): number {
  let max = cap;
  for (const [id, amount] of Object.entries(cost)) {
    if (!amount) continue;
    const have = CORE_IDS.has(id)
      ? player.resources[id as keyof Resources]
      : (player.factionResources[id] ?? 0);
    max = Math.min(max, Math.floor(have / amount));
  }
  return Math.max(0, max);
}

/** Multiplie un coût unitaire par un effectif (recrutement de `count` créatures). */
export function scaleCost(cost: Record<string, number>, factor: number): Record<string, number> {
  const scaled: Record<string, number> = {};
  for (const [id, amount] of Object.entries(cost)) {
    if (amount) scaled[id] = amount * factor;
  }
  return scaled;
}
