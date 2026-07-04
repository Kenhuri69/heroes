import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { unitIsRecruitable } from './helpers';
import { canAfford, payCost, scaleCost } from './resources';
import { unitWithEconomy } from './unit-economy';

type RecruitCmd = Extract<Command, { type: 'RecruitUnits' }>;

/** Capacité de garnison (doc 02 §4.1, §5.1) : au plus 7 piles distinctes. */
const MAX_GARRISON_STACKS = 7;

/**
 * Recrutement (doc 02 §4.1) — débite le stock accumulé de la ville et ajoute
 * la pile à la garnison de la ville (le transfert vers le héros se fait via
 * `GarrisonTransfer`). Le coût unitaire vit sur le catalogue d'unités via le
 * champ optionnel `recruitCost` (voir `unit-economy.ts` — absent ⇒ coût nul,
 * en attendant l'ajout du champ à `CombatUnitDef`, signalé au rapport).
 */
export function validateRecruitUnits(state: GameState, cmd: RecruitCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return {
      code: 'notYourTown',
      message: `la ville '${cmd.townId}' n'appartient pas au joueur actif`,
    };
  if (cmd.count <= 0)
    return { code: 'invalidAction', message: 'effectif à recruter non positif' };
  if (!unitIsRecruitable(town, state.buildingCatalog, cmd.unitId))
    return {
      code: 'notRecruitable',
      message: `'${cmd.unitId}' n'est recrutable dans aucun dwelling de '${cmd.townId}'`,
    };
  const stock = town.stock[cmd.unitId] ?? 0;
  if (cmd.count > stock)
    return { code: 'insufficientStock', message: `stock insuffisant de '${cmd.unitId}'` };
  const existingSlot = town.garrison.some((s) => s.unitId === cmd.unitId);
  if (!existingSlot && town.garrison.length >= MAX_GARRISON_STACKS)
    return { code: 'invalidAction', message: `garnison de '${cmd.townId}' pleine (7 piles max)` };
  const { recruitCost } = unitWithEconomy(state.unitCatalog, cmd.unitId) ?? {};
  if (recruitCost && !canAfford(player.resources, scaleCost(recruitCost, cmd.count)))
    return { code: 'cannotAfford', message: `ressources insuffisantes pour recruter '${cmd.unitId}'` };
  return null;
}

export function handleRecruitUnits(draft: GameState, cmd: RecruitCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  if (!town || !player) return; // exclu par validate
  town.stock[cmd.unitId] = (town.stock[cmd.unitId] ?? 0) - cmd.count;
  const { recruitCost } = unitWithEconomy(draft.unitCatalog, cmd.unitId) ?? {};
  if (recruitCost) payCost(player.resources, scaleCost(recruitCost, cmd.count));
  const existing = town.garrison.find((s) => s.unitId === cmd.unitId);
  if (existing) existing.count += cmd.count;
  else town.garrison.push({ unitId: cmd.unitId, count: cmd.count });
  events.push({ type: 'UnitsRecruited', townId: town.id, unitId: cmd.unitId, count: cmd.count });
}
