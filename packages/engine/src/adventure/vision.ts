import type { GameState } from '../core/state';
import { heroVisionRadius } from '../hero/skills';
import { revealAround } from './fog';
import { levelOf, type GridPos } from './map';

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

/** Une source de vision courante : centre + rayon (Tchebychev, même couche). */
export interface Sighting {
  pos: GridPos;
  radius: number;
}

/**
 * Vision COURANTE d'un joueur (revue 2026-09, M14) : ses héros (rayon de héros)
 * et, si `config.buildingVisionRadius` > 0, ses villes et mines. Distinct du bit
 * persistant `explored` (« déjà vu un jour ») : c'est ce qu'il VOIT maintenant —
 * la seule information légitime sur les entités MOBILES (héros adverses). Source
 * unique partagée par le rendu (héros dessinés, brouillard) et l'IA.
 */
export function playerSightings(state: GameState, playerId: string): Sighting[] {
  const { map, config } = state;
  if (!map || !config) return [];
  const sightings: Sighting[] = state.heroes
    .filter((h) => h.playerId === playerId)
    .map((h) => ({ pos: h.pos, radius: heroVisionRadius(h, config.visionRadius, state.skillCatalog, state.artifactCatalog) }));
  const buildingRadius = config.buildingVisionRadius ?? 0;
  if (buildingRadius > 0) {
    for (const town of state.towns) {
      if (town.ownerPlayerId === playerId) sightings.push({ pos: town.pos, radius: buildingRadius });
    }
    for (const obj of map.objects) {
      if (obj.type === 'mine' && obj.ownerId === playerId) sightings.push({ pos: obj.pos, radius: buildingRadius });
    }
  }
  return sightings;
}

/** `pos` est-elle dans la vision courante de `playerId` ? (même couche, Tchebychev) */
export function isInPlayerVision(state: GameState, playerId: string, pos: GridPos): boolean {
  return playerSightings(state, playerId).some(
    (s) =>
      levelOf(s.pos) === levelOf(pos) &&
      Math.max(Math.abs(s.pos.x - pos.x), Math.abs(s.pos.y - pos.y)) <= s.radius,
  );
}

/** Révèle autour de TOUTES les villes et mines possédées (au démarrage de partie). */
export function revealOwnedStructures(draft: GameState): void {
  for (const town of draft.towns) {
    if (town.ownerPlayerId) revealStructure(draft, town.ownerPlayerId, town.pos);
  }
  const map = draft.map;
  if (!map) return;
  for (const obj of map.objects) {
    // Structures possédées : mine (F1) + habitation capturée (M-DWELLOWN).
    if ((obj.type === 'mine' || obj.type === 'dwelling') && obj.ownerId)
      revealStructure(draft, obj.ownerId, obj.pos);
  }
}
