import { isAdjacent, samePos } from '../adventure/map';
import { beginTownCombat } from '../combat/setup';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import type { TownState } from './types';
import { evaluateOutcome } from '../scenario/outcome';

type CaptureCmd = Extract<Command, { type: 'CaptureTown' }>;

/** Bonus de défense « murs » par niveau de Fort construit (doc 02 §4.1, Alpha 4.13). */
const WALL_DEFENSE_PER_FORT_LEVEL = 3;

/** Héros du joueur sur ou adjacent à la ville (attaquant), ou `undefined`. */
function attackingHero(state: GameState, town: TownState, playerId: string): HeroState | undefined {
  return state.heroes.find(
    (h) => h.playerId === playerId && (samePos(h.pos, town.pos) || isAdjacent(h.pos, town.pos)),
  );
}

/** Bonus de mur d'une ville selon son niveau de Fort (0 si pas de Fort). */
function wallDefenseBonus(town: TownState): number {
  return (town.buildings['fort'] ?? 0) * WALL_DEFENSE_PER_FORT_LEVEL;
}

/**
 * Capture (doc 02 §4.1) : ville **sans** garnison prise immédiatement ; ville
 * **défendue** ⇒ **combat de siège** contre la garnison (Alpha 4.13), la capture
 * suit la victoire (`applyConsequences`). Exige hors combat, joueur actif, un
 * héros du joueur sur/adjacent à la ville (remédiation R1 E3).
 */
export function validateCaptureTown(state: GameState, cmd: CaptureCmd): CommandError | null {
  if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
  const current = state.players[state.currentPlayer];
  if (!current || current.id !== cmd.playerId)
    return { code: 'notYourTurn', message: `ce n’est pas le tour de ${cmd.playerId}` };
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  if (town.ownerPlayerId === cmd.playerId)
    return { code: 'invalidAction', message: `'${cmd.townId}' appartient déjà à ${cmd.playerId}` };
  const hero = attackingHero(state, town, cmd.playerId);
  if (!hero)
    return {
      code: 'invalidAction',
      message: `aucun héros de ${cmd.playerId} sur ou adjacent à '${cmd.townId}'`,
    };
  // Ville défendue : le héros a besoin d'une armée pour l'assiéger.
  if (town.garrison.length > 0 && hero.army.length === 0)
    return { code: 'invalidArmy', message: `armée vide : impossible d'assiéger '${cmd.townId}'` };
  return null;
}

export function handleCaptureTown(draft: GameState, cmd: CaptureCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  if (!town) return; // exclu par validate
  if (town.garrison.length > 0) {
    // Ville défendue ⇒ siège : combat contre la garnison. La capture est
    // appliquée à la victoire (doc 02 §4.1, `applyConsequences`).
    const hero = attackingHero(draft, town, cmd.playerId);
    if (hero) beginTownCombat(draft, hero.id, town.id, wallDefenseBonus(town), events);
    return;
  }
  town.ownerPlayerId = cmd.playerId;
  events.push({ type: 'TownCaptured', townId: town.id, playerId: cmd.playerId });
  // Une ville peut changer de main (élimination de l'ancien propriétaire) :
  // conditions de victoire/défaite (doc 02 §6, plan phase-3.5) — no-op hors scénario.
  evaluateOutcome(draft, events);
}
