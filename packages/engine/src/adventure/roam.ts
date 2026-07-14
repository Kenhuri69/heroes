import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { DIRECTIONS, type GridPos } from './map';
import { isPassable } from './path';

/** Distance Chebyshev — cohérente avec la grille 8 directions (doc 02 §2.1). */
function chebyshev(a: GridPos, b: GridPos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Gardiens errants (doc 02 §2.2) — appelés au changement de jour : chaque
 * gardien doté d'un `roamRadius` fait UN pas (8 directions) vers le héros le
 * plus proche à portée, sur une tuile franchissable et libre (ni héros, ni
 * objet, ni ville). Il s'arrête au contact (distance 1) : l'interception reste
 * déclenchée par le mouvement du héros, jamais par le gardien. Déterministe :
 * ordre du tableau d'objets, héros départagés par ordre du tableau, directions
 * par ordre fixe de `DIRECTIONS`.
 */
export function roamGuardians(draft: GameState, events: GameEvent[]): void {
  const { map, config } = draft;
  if (!map || !config) return;
  // F6 (revue 2026-07) : l'occupation (héros/villes/objets) est précalculée en
  // COMPTEURS par tuile — les 8 voisins de chaque gardien se testent en O(1) au
  // lieu de rebalayer héros + villes + tous les objets (O(gardiens × 8 × N) à
  // chaque bascule de jour). Compteur (pas Set) : deux objets peuvent partager
  // une tuile — le départ d'un gardien ne doit pas « libérer » la tuile d'un
  // objet qui y reste. Mis à jour au fil des déplacements (mêmes décisions).
  const key = (p: GridPos): number => p.y * map.width + p.x;
  const occupied = new Map<number, number>();
  const occupy = (k: number): void => void occupied.set(k, (occupied.get(k) ?? 0) + 1);
  const vacate = (k: number): void => {
    const n = (occupied.get(k) ?? 0) - 1;
    if (n <= 0) occupied.delete(k);
    else occupied.set(k, n);
  };
  for (const h of draft.heroes) occupy(key(h.pos));
  for (const t of draft.towns) occupy(key(t.pos));
  for (const o of map.objects) occupy(key(o.pos));
  for (const obj of map.objects) {
    if (obj.type !== 'guardian' || !obj.roamRadius) continue;

    let target: GridPos | null = null;
    let best = Infinity;
    for (const hero of draft.heroes) {
      const d = chebyshev(hero.pos, obj.pos);
      if (d < best) {
        best = d;
        target = hero.pos;
      }
    }
    if (!target || best > obj.roamRadius || best <= 1) continue;

    let bestStep: GridPos | null = null;
    let bestDist = best;
    for (const dir of DIRECTIONS) {
      const next = { x: obj.pos.x + dir.x, y: obj.pos.y + dir.y };
      if (!isPassable(config, map, next)) continue;
      // `next` ≠ obj.pos (dir non nul) ⇒ le compteur équivaut aux trois
      // balayages historiques (dont l'exemption `o !== obj`).
      if (occupied.has(key(next))) continue;
      const d = chebyshev(target, next);
      if (d < bestDist) {
        bestDist = d;
        bestStep = next;
      }
    }
    if (!bestStep) continue;

    const from = { ...obj.pos };
    vacate(key(from));
    occupy(key(bestStep));
    obj.pos = { ...bestStep };
    events.push({ type: 'GuardianMoved', objectId: obj.id, from, to: { ...bestStep } });
  }
}
