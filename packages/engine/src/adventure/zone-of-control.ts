import type { AdventureConfig } from './config';
import { DIRECTIONS, inBounds, levelOf, type AdventureMapDef, type GridPos } from './map';

/**
 * Zone de contrôle des gardiens (LE3 A1, doc 02 §2.2 — HoMM II/III) : les
 * 8 voisines d'un gardien, sur sa couche. Y poser le pied est une interception
 * (`advanceHeroAlongPath`) ; l'A* peut y entrer mais pas la traverser
 * (`findPath`). Rend, pour la couche `level`, index 2D `y × largeur + x` → ids
 * des gardiens qui la contrôlent, triés (le premier par id engage). `null`
 * quand la règle est éteinte (`adventure.guardianZoneOfControl` absent ou faux).
 */
export function guardianZone(
  config: AdventureConfig,
  map: AdventureMapDef,
  level: number,
): Map<number, string[]> | null {
  if (config.guardianZoneOfControl !== true) return null;
  const guards = map.objects
    .filter((o) => o.type === 'guardian' && levelOf(o.pos) === level)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const guardTiles = new Set(guards.map((g) => g.pos.y * map.width + g.pos.x));
  const zone = new Map<number, string[]>();
  for (const g of guards) {
    for (const d of DIRECTIONS) {
      const p: GridPos = { x: g.pos.x + d.x, y: g.pos.y + d.y };
      if (!inBounds(map, p)) continue;
      const key = p.y * map.width + p.x;
      if (guardTiles.has(key)) continue; // la tuile d'un gardien reste la sienne
      const ids = zone.get(key);
      if (ids) ids.push(g.id);
      else zone.set(key, [g.id]);
    }
  }
  return zone;
}
