import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import type { BuildingDef, TownState } from './types';
import { builtDwellings, unitIsRecruitable } from './helpers';

type ChooseCmd = Extract<Command, { type: 'ChooseSharedGrowth' }>;

/**
 * Croissance partagée « apex » (doc 05 §3.1/§8) — point d'extension GÉNÉRIQUE :
 * un groupe d'unités déclaré dans les données (`sharedGrowthGroups`) partage UNE
 * seule croissance hebdomadaire ; le joueur choisit le destinataire par ville.
 * Le moteur ne connaît que des ids opaques (aucun nom de faction).
 */

/**
 * Résout, pour une ville, le destinataire de la croissance de chaque groupe de
 * croissance partagée. Un membre est « présent » s'il a un dwelling bâti dans la
 * ville. Destinataire = le choix du joueur s'il est présent, sinon le 1er membre
 * présent (ordre de déclaration du groupe). Renvoie deux index : `groupOf`
 * (unité → son groupe, pour tous les membres) et `recipientOf` (groupe →
 * unité qui grossit cette semaine ; absent si aucun membre présent).
 */
export function sharedGrowthRecipients(
  town: TownState,
  growthGroups: Record<string, string[]>,
  buildingCatalog: Record<string, BuildingDef>,
): { groupOf: Map<string, string>; recipientOf: Map<string, string> } {
  const groupOf = new Map<string, string>();
  const recipientOf = new Map<string, string>();
  const built = new Set(builtDwellings(town, buildingCatalog));
  for (const [groupId, members] of Object.entries(growthGroups)) {
    for (const member of members) groupOf.set(member, groupId);
    const present = members.filter((m) => built.has(m));
    const first = present[0];
    if (first === undefined) continue;
    const choice = town.sharedGrowthChoice[groupId];
    recipientOf.set(groupId, choice && present.includes(choice) ? choice : first);
  }
  return { groupOf, recipientOf };
}

/**
 * `ChooseSharedGrowth` (doc 05 §3.1/§8) — pose la préférence permanente du joueur
 * pour le destinataire d'un groupe de croissance partagée dans une ville. Prend
 * effet au prochain passage de semaine. Ville du joueur actif ; groupe connu ;
 * unité membre du groupe ET recrutable (dwelling bâti) dans la ville.
 */
export function validateChooseSharedGrowth(state: GameState, cmd: ChooseCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return {
      code: 'notYourTown',
      message: `la ville '${cmd.townId}' n'appartient pas au joueur actif`,
    };
  const members = state.growthGroups[cmd.groupId];
  if (!members)
    return { code: 'unknownGrowthGroup', message: `groupe de croissance inconnu '${cmd.groupId}'` };
  if (!members.includes(cmd.unitId))
    return { code: 'invalidAction', message: `'${cmd.unitId}' hors du groupe '${cmd.groupId}'` };
  if (!unitIsRecruitable(town, state.buildingCatalog, cmd.unitId))
    return {
      code: 'notRecruitable',
      message: `'${cmd.unitId}' n'a pas de dwelling bâti dans '${cmd.townId}'`,
    };
  return null;
}

export function handleChooseSharedGrowth(draft: GameState, cmd: ChooseCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  if (!town) return; // exclu par validate
  town.sharedGrowthChoice[cmd.groupId] = cmd.unitId;
  events.push({
    type: 'SharedGrowthChosen',
    townId: town.id,
    groupId: cmd.groupId,
    unitId: cmd.unitId,
  });
}
