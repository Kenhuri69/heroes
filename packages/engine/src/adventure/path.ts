import type { AdventureConfig } from './config';
import {
  DIRECTIONS,
  inBounds,
  isDiagonal,
  samePos,
  terrainAt,
  tileIndex,
  type AdventureMapDef,
  type GridPos,
} from './map';

/** Coût d'un pas `from → to` (tuiles adjacentes) : terrain d'arrivée × route × diagonale. */
export function stepCost(
  config: AdventureConfig,
  map: AdventureMapDef,
  from: GridPos,
  to: GridPos,
): number {
  const rule = config.terrains[terrainAt(map, to)];
  if (!rule || rule.moveCost === null) {
    throw new RangeError(`pas vers une tuile infranchissable (${to.x},${to.y})`);
  }
  let cost = rule.moveCost;
  if (map.road[tileIndex(map, to)]) cost *= config.movement.roadMultiplier;
  if (isDiagonal(from, to)) cost *= config.movement.diagonalMultiplier;
  return Math.round(cost);
}

export function isPassable(config: AdventureConfig, map: AdventureMapDef, pos: GridPos): boolean {
  if (!inBounds(map, pos)) return false;
  const rule = config.terrains[terrainAt(map, pos)];
  return rule !== undefined && rule.moveCost !== null;
}

/**
 * A* 8 directions (doc 02 §1.5) — pur et déterministe (tas binaire avec
 * départage par ordre d'insertion). Retourne les pas SANS la case de départ,
 * ou null si aucun chemin. `blocked` : tuiles occupées (autres héros).
 */
export function findPath(
  config: AdventureConfig,
  map: AdventureMapDef,
  from: GridPos,
  to: GridPos,
  blocked: readonly GridPos[] = [],
  /** true : autorise une destination occupée (attaque d'un gardien — doc 02 §5). */
  allowBlockedGoal = false,
): GridPos[] | null {
  if (!inBounds(map, from) || !isPassable(config, map, to) || samePos(from, to)) return null;
  const blockedSet = new Set(blocked.map((p) => p.y * map.width + p.x));
  if (!allowBlockedGoal && blockedSet.has(to.y * map.width + to.x)) return null;

  // Heuristique octile admissible : distance × coût de pas minimal possible.
  let minCost = Infinity;
  for (const rule of Object.values(config.terrains)) {
    if (rule.moveCost !== null) minCost = Math.min(minCost, rule.moveCost);
  }
  minCost = Math.round(minCost * Math.min(1, config.movement.roadMultiplier));
  const h = (p: GridPos): number => {
    const dx = Math.abs(p.x - to.x);
    const dy = Math.abs(p.y - to.y);
    return minCost * Math.max(dx, dy);
  };

  const size = map.width * map.height;
  const gScore = new Array<number>(size).fill(Infinity);
  const cameFrom = new Array<number>(size).fill(-1);
  const heap = new MinHeap();
  const start = from.y * map.width + from.x;
  const goal = to.y * map.width + to.x;
  gScore[start] = 0;
  heap.push(start, h(from));

  while (heap.size > 0) {
    const current = heap.pop();
    if (current === goal) break;
    const cur: GridPos = { x: current % map.width, y: Math.floor(current / map.width) };
    for (const dir of DIRECTIONS) {
      const next: GridPos = { x: cur.x + dir.x, y: cur.y + dir.y };
      if (!isPassable(config, map, next)) continue;
      const nextIdx = next.y * map.width + next.x;
      if (nextIdx !== goal && blockedSet.has(nextIdx)) continue;
      const g = (gScore[current] ?? Infinity) + stepCost(config, map, cur, next);
      if (g < (gScore[nextIdx] ?? Infinity)) {
        gScore[nextIdx] = g;
        cameFrom[nextIdx] = current;
        heap.push(nextIdx, g + h(next));
      }
    }
  }

  if (cameFrom[goal] === -1) return null;
  const path: GridPos[] = [];
  for (let idx = goal; idx !== start; idx = cameFrom[idx] ?? -1) {
    path.push({ x: idx % map.width, y: Math.floor(idx / map.width) });
  }
  return path.reverse();
}

/**
 * Coût de pas minimal possible sur cette carte (terrain le moins cher × meilleur
 * multiplicateur de route, arrondi) — base de l'heuristique octile de `findPath`
 * et borne inférieure admissible du coût d'un chemin (cf. `octileLowerBound`).
 */
export function minStepCost(config: AdventureConfig): number {
  let min = Infinity;
  for (const rule of Object.values(config.terrains)) {
    if (rule.moveCost !== null) min = Math.min(min, rule.moveCost);
  }
  return Math.round(min * Math.min(1, config.movement.roadMultiplier));
}

/**
 * Borne INFÉRIEURE admissible du coût d'un chemin `from → to` : distance octile
 * (Chebyshev) × coût de pas minimal. Si elle dépasse le budget de PM, aucune
 * route n'y arrive dans le budget — inutile de lancer `findPath` (A\*). Ce
 * pré-filtre `O(1)` évite le fan-out `O(objets × A\*)` de l'IA sur grande carte,
 * qui gelait l'onglet (plan `.claude/plans/ai-turn-non-blocking.md`). Le résultat
 * étant l'heuristique même de l'A\*, écarter une cible ici est EXACTEMENT
 * équivalent à obtenir `cost > budget` de l'A\* : zéro changement de décision.
 */
export function octileLowerBound(minStep: number, from: GridPos, to: GridPos): number {
  return minStep * Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}

/** Tas binaire min avec départage FIFO — l'ordre d'exploration est stable. */
class MinHeap {
  private keys: number[] = [];
  private prios: number[] = [];
  private orders: number[] = [];
  private counter = 0;

  get size(): number {
    return this.keys.length;
  }

  push(key: number, prio: number): void {
    this.keys.push(key);
    this.prios.push(prio);
    this.orders.push(this.counter++);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.keys[0] as number;
    const last = this.keys.length - 1;
    this.swap(0, last);
    this.keys.pop();
    this.prios.pop();
    this.orders.pop();
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < this.keys.length && this.less(left, smallest)) smallest = left;
      if (right < this.keys.length && this.less(right, smallest)) smallest = right;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
    return top;
  }

  private less(a: number, b: number): boolean {
    const pa = this.prios[a] as number;
    const pb = this.prios[b] as number;
    if (pa !== pb) return pa < pb;
    return (this.orders[a] as number) < (this.orders[b] as number);
  }

  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b] as number, this.keys[a] as number];
    [this.prios[a], this.prios[b]] = [this.prios[b] as number, this.prios[a] as number];
    [this.orders[a], this.orders[b]] = [this.orders[b] as number, this.orders[a] as number];
  }
}
