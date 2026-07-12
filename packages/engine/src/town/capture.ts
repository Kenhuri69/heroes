import { isAdjacent, samePos } from '../adventure/map';
import { revealStructure } from '../adventure/vision';
import { beginTownCombat } from '../combat/setup';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import { areAllies, type GameState, type HeroState } from '../core/state';
import { townHouseField } from '../hero/skills';
import { townBuildingAura } from './economy';
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

/**
 * Bonus de défense « murs » d'une ville au siège : niveau de Fort (doc 02 §4.1)
 * + Maison town-scoped du défenseur (F-HOUSES, doc 16 §3.1 — Le Blaireau
 * `garrisonDefense`, apportée par un héros du propriétaire présent) + aura de
 * **bâtiment** `garrisonDefense` (F-BUILDEFF.4, doc 05 §3.2 — Cercle Vigile).
 * 0 si aucune de ces sources.
 */
function wallDefenseBonus(state: GameState, town: TownState): number {
  const fort = (town.buildings['fort'] ?? 0) * WALL_DEFENSE_PER_FORT_LEVEL;
  if (!town.ownerPlayerId) return fort;
  const house = townHouseField(state.heroes, town.ownerPlayerId, town.pos, 'garrisonDefense');
  const building = townBuildingAura(state, town.ownerPlayerId, town.pos, 'garrisonDefense');
  return fort + house + building;
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
  // On n'assiège pas la ville d'un allié (doc 02 §6).
  const owner = state.players.find((p) => p.id === town.ownerPlayerId);
  const self = state.players.find((p) => p.id === cmd.playerId);
  if (owner && self && areAllies(owner, self))
    return { code: 'invalidAction', message: `'${cmd.townId}' appartient à un allié de ${cmd.playerId}` };
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
    // C-SIEGE2 : le niveau de Fort dresse un rempart sur la grille de siège.
    const fortLevel = town.buildings['fort'] ?? 0;
    if (hero) beginTownCombat(draft, hero.id, town.id, wallDefenseBonus(draft, town), fortLevel, events);
    return;
  }
  town.ownerPlayerId = cmd.playerId;
  events.push({ type: 'TownCaptured', townId: town.id, playerId: cmd.playerId });
  revealStructure(draft, cmd.playerId, town.pos); // F1 : la ville capturée éclaire son voisinage
  // Une ville peut changer de main (élimination de l'ancien propriétaire) :
  // conditions de victoire/défaite (doc 02 §6, plan phase-3.5) — no-op hors scénario.
  evaluateOutcome(draft, events);
}
