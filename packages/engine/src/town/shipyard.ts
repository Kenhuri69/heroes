import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, Resources } from '../core/state';
import { DIRECTIONS, inBounds, samePos, terrainAt, type GridPos } from '../adventure/map';
import { builtLevelOf } from './helpers';
import { canAfford, payCost } from './resources';
import type { BuildingDef, TownState } from './types';

type BuildCmd = Extract<Command, { type: 'BuildBoat' }>;

/**
 * Chantier naval (A3.3, doc 18 A3) : une ville dotée d'un bâtiment `shipyard`
 * construit un bateau sur une tuile d'eau **navigable** adjacente (contre le
 * `boatCost` porté par l'effet). Générique : le moteur ne connaît aucune faction ;
 * « eau » = terrain à `navalCost` défini (doc 02 §1.5).
 */

/** Coût d'un bateau si la ville possède un chantier naval construit, sinon `undefined`. */
function shipyardCost(town: TownState, catalog: Record<string, BuildingDef>): Partial<Resources> | undefined {
  for (const buildingId of Object.keys(town.buildings)) {
    const effect = builtLevelOf(town, catalog, buildingId)?.effect;
    if (effect?.type === 'shipyard') return effect.boatCost;
  }
  return undefined;
}

/** Une tuile est-elle une eau navigable (domaine naval), dans les limites de la carte ? */
function isNavigableWater(state: GameState, pos: GridPos): boolean {
  const map = state.map;
  if (!map || !inBounds(map, pos)) return false;
  return state.config?.terrains[terrainAt(map, pos)]?.navalCost != null;
}

/** Tuile occupée par un héros ou un bateau existant ? */
function tileTaken(state: GameState, pos: GridPos): boolean {
  return (
    state.heroes.some((h) => samePos(h.pos, pos)) ||
    (state.map?.objects.some((o) => o.type === 'boat' && samePos(o.pos, pos)) ?? false)
  );
}

/** Première tuile d'eau navigable libre adjacente à la ville (ordre `DIRECTIONS`), ou `undefined`. */
function freeAdjacentWater(state: GameState, town: TownState): GridPos | undefined {
  for (const dir of DIRECTIONS) {
    const pos = { x: town.pos.x + dir.x, y: town.pos.y + dir.y };
    if (isNavigableWater(state, pos) && !tileTaken(state, pos)) return pos;
  }
  return undefined;
}

export function validateBuildBoat(state: GameState, cmd: BuildCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return { code: 'notYourTown', message: `la ville '${cmd.townId}' n'appartient pas au joueur actif` };
  const cost = shipyardCost(town, state.buildingCatalog);
  if (!cost) return { code: 'noShipyard', message: `aucun chantier naval à '${cmd.townId}'` };
  if (!freeAdjacentWater(state, town))
    return { code: 'noAdjacentWater', message: `aucune eau libre adjacente à '${cmd.townId}'` };
  if (!canAfford(player.resources, cost))
    return { code: 'cannotAfford', message: `ressources insuffisantes pour un bateau à '${cmd.townId}'` };
  return null;
}

export function handleBuildBoat(draft: GameState, cmd: BuildCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  if (!town || !player || !draft.map) return; // exclu par validate
  const cost = shipyardCost(town, draft.buildingCatalog);
  const pos = freeAdjacentWater(draft, town);
  if (!cost || !pos) return;
  payCost(player.resources, cost);
  const boatId = `boat@${pos.x},${pos.y}`;
  draft.map.objects.push({ id: boatId, type: 'boat', pos });
  events.push({ type: 'BoatBuilt', townId: town.id, boatId, pos });
}
