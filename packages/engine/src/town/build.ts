import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { canAfford, payCost } from './resources';

type BuildCmd = Extract<Command, { type: 'BuildStructure' }>;

/**
 * Construction (doc 02 §4.1) — 1 construction par ville et par jour, un
 * bâtiment gradué se construit niveau par niveau (`levels[0]` = niveau 1).
 */
export function validateBuildStructure(state: GameState, cmd: BuildCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return {
      code: 'notYourTown',
      message: `la ville '${cmd.townId}' n'appartient pas au joueur actif`,
    };
  if (town.builtToday)
    return {
      code: 'alreadyBuiltToday',
      message: `une construction a déjà eu lieu aujourd'hui dans '${cmd.townId}'`,
    };
  const def = state.buildingCatalog[cmd.buildingId];
  if (!def) return { code: 'unknownBuilding', message: `bâtiment inconnu '${cmd.buildingId}'` };
  const currentLevel = town.buildings[cmd.buildingId] ?? 0;
  if (currentLevel >= def.maxLevel)
    return {
      code: 'buildingMaxLevel',
      message: `'${cmd.buildingId}' est déjà à son niveau maximum`,
    };
  const nextLevel = def.levels[currentLevel];
  if (!nextLevel)
    return {
      code: 'buildingMaxLevel',
      message: `aucun niveau suivant défini pour '${cmd.buildingId}'`,
    };
  for (const req of nextLevel.requires) {
    const have = town.buildings[req.building] ?? 0;
    if (have < req.level)
      return {
        code: 'requirementsNotMet',
        message: `prérequis manquant '${req.building}'@${req.level}`,
      };
  }
  if (!canAfford(player.resources, nextLevel.cost))
    return { code: 'cannotAfford', message: `ressources insuffisantes pour '${cmd.buildingId}'` };
  return null;
}

export function handleBuildStructure(draft: GameState, cmd: BuildCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  if (!town || !player) return; // exclu par validate
  const def = draft.buildingCatalog[cmd.buildingId];
  const currentLevel = town.buildings[cmd.buildingId] ?? 0;
  const nextLevel = def?.levels[currentLevel];
  if (!def || !nextLevel) return; // exclu par validate
  payCost(player.resources, nextLevel.cost);
  const builtLevel = currentLevel + 1;
  town.buildings[cmd.buildingId] = builtLevel;
  town.builtToday = true;
  events.push({ type: 'TownBuilt', townId: town.id, buildingId: cmd.buildingId, level: builtLevel });
}
