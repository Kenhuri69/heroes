import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { DIRECTIONS, samePos, type GridPos } from './map';
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
      if (draft.heroes.some((h) => samePos(h.pos, next))) continue;
      if (draft.towns.some((t) => samePos(t.pos, next))) continue;
      if (map.objects.some((o) => o !== obj && samePos(o.pos, next))) continue;
      const d = chebyshev(target, next);
      if (d < bestDist) {
        bestDist = d;
        bestStep = next;
      }
    }
    if (!bestStep) continue;

    const from = { ...obj.pos };
    obj.pos = { ...bestStep };
    events.push({ type: 'GuardianMoved', objectId: obj.id, from, to: { ...bestStep } });
  }
}
