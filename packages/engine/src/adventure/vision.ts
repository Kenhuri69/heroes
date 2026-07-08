import type { GameState } from '../core/state';
import { revealAround } from './fog';
import type { GridPos } from './map';

/**
 * Vision depuis les structures possédées (F1, doc 02 §2.1). Le brouillard
 * `explored` (bit persistant) est révélé autour des villes et mines d'un joueur,
 * au rayon `config.buildingVisionRadius` (0 si absent ⇒ no-op). Distinct de la
 * vision du héros : appelé au `StartGame` et à chaque capture (ville/mine).
 */

function buildingVisionRadius(draft: GameState): number {
  return draft.config?.buildingVisionRadius ?? 0;
}

/** Révèle le brouillard autour d'une structure possédée, pour son propriétaire. */
export function revealStructure(draft: GameState, ownerPlayerId: string, pos: GridPos): void {
  const radius = buildingVisionRadius(draft);
  if (radius <= 0) return;
  const player = draft.players.find((p) => p.id === ownerPlayerId);
  const map = draft.map;
  if (!player || !map) return;
  revealAround(player.explored, map, pos, radius);
}

/** Révèle autour de TOUTES les villes et mines possédées (au démarrage de partie). */
export function revealOwnedStructures(draft: GameState): void {
  for (const town of draft.towns) {
    if (town.ownerPlayerId) revealStructure(draft, town.ownerPlayerId, town.pos);
  }
  const map = draft.map;
  if (!map) return;
  for (const obj of map.objects) {
    if (obj.type === 'mine' && obj.ownerId) revealStructure(draft, obj.ownerId, obj.pos);
  }
}
