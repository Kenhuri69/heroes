import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import { samePos } from '../adventure/map';
import { builtLevelOf } from './helpers';
import { canAffordCost, spendCost } from './resources';
import { unitWithEconomy } from './unit-economy';
import type { BuildingDef, TownState } from './types';

type BuyCmd = Extract<Command, { type: 'BuyWarMachine' }>;

/**
 * Machines de guerre (doc 02 §5, Alpha 4.12) : achetées à un bâtiment vendeur
 * (`warMachineVendor`, la Forge) par le héros présent, elles rejoignent son camp
 * en combat. **Générique** : le vendeur DÉCLARE les machines vendues (`units`) ;
 * le moteur ne connaît aucune faction. Coût = `recruitCost` du catalogue.
 */

/** Un bâtiment vendeur construit vend-il `unitId` dans cette ville ? */
function vendorSells(town: TownState, catalog: Record<string, BuildingDef>, unitId: string): boolean {
  for (const buildingId of Object.keys(town.buildings)) {
    const effect = builtLevelOf(town, catalog, buildingId)?.effect;
    if (effect?.type === 'warMachineVendor' && effect.units.includes(unitId)) return true;
  }
  return false;
}

/** Héros du joueur actif présent sur la tuile de la ville, ou `undefined`. */
function heroAtTown(draft: GameState, town: TownState, playerId: string): HeroState | undefined {
  return draft.heroes.find((h) => h.playerId === playerId && samePos(h.pos, town.pos));
}

export function validateBuyWarMachine(state: GameState, cmd: BuyCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return { code: 'notYourTown', message: `la ville '${cmd.townId}' n'appartient pas au joueur actif` };
  const hero = heroAtTown(state, town, player.id);
  if (!hero)
    return { code: 'warMachineUnavailable', message: `aucun héros présent à '${cmd.townId}'` };
  if (!vendorSells(town, state.buildingCatalog, cmd.unitId))
    return { code: 'warMachineUnavailable', message: `'${cmd.unitId}' non vendue à '${cmd.townId}'` };
  if (hero.warMachines.includes(cmd.unitId))
    return { code: 'warMachineUnavailable', message: `machine '${cmd.unitId}' déjà possédée` };
  const cost = unitWithEconomy(state.unitCatalog, cmd.unitId)?.recruitCost;
  if (cost && !canAffordCost(player, cost))
    return { code: 'cannotAfford', message: `ressources insuffisantes pour '${cmd.unitId}'` };
  return null;
}

export function handleBuyWarMachine(draft: GameState, cmd: BuyCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  if (!town || !player) return; // exclu par validate
  const hero = heroAtTown(draft, town, player.id);
  if (!hero) return;
  const cost = unitWithEconomy(draft.unitCatalog, cmd.unitId)?.recruitCost;
  if (cost) spendCost(player, cost);
  hero.warMachines.push(cmd.unitId);
  events.push({ type: 'WarMachineBought', townId: town.id, heroId: hero.id, unitId: cmd.unitId });
}
