import { DIRECTIONS, atLevel, levelOf, samePos, type GridPos } from '../adventure/map';
import { isPassable } from '../adventure/path';
import type { GameState } from '../core/state';

/**
 * B4 / revue 2026-09 (M10) — tuile d'arrivée d'un héros à une ville sans
 * superposer deux héros : la tuile de la ville si elle est franchissable et
 * libre, sinon la 1ʳᵉ voisine (8 dir) franchissable et libre ; `null` si aucune.
 * Partagé par le portail de ville (`townPortal`) et le recrutement à la Taverne
 * (le héros du joueur est souvent en VISITE sur la ville au moment de recruter).
 * Pure ; `heroId` = héros à ignorer dans le test d'occupation (lui-même). La
 * tuile CIBLE (une ville) est toujours « tenable » : seule son occupation compte ;
 * les voisines doivent être franchissables ET libres.
 */
export function landingTileFor(state: GameState, target: GridPos, heroId: string): GridPos | null {
  const map = state.map;
  const config = state.config;
  if (!map || !config) return null;
  const unoccupied = (p: GridPos): boolean => !state.heroes.some((h) => h.id !== heroId && samePos(h.pos, p));
  if (unoccupied(target)) return target;
  for (const d of DIRECTIONS) {
    const p = atLevel({ x: target.x + d.x, y: target.y + d.y }, levelOf(target));
    if (isPassable(config, map, p) && unoccupied(p)) return p;
  }
  return null;
}
