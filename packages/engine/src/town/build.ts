import { samePos } from '../adventure/map';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { exclusiveRivalId, missingRequirements } from './helpers';
import { learnGuildSpellsAtTown, rollGuildSpells } from './mage-guild';
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
  // Un bâtiment tagué d'une faction ne peut être bâti que dans une ville de cette
  // faction ; les bâtiments core (sans `factionId`) restent universels. Le moteur
  // ne compare que des chaînes opaques — jamais un nom de faction en dur (doc 06).
  if (def.factionId !== undefined && def.factionId !== town.factionId)
    return {
      code: 'wrongFactionBuilding',
      message: `'${cmd.buildingId}' (faction '${def.factionId}') n'est pas constructible dans une ville '${town.factionId}'`,
    };
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
  // Prérequis de bâtiment (helper partagé avec l'UI, remédiation CL9).
  const missing = missingRequirements(town, state.buildingCatalog, cmd.buildingId);
  const firstMissing = missing[0];
  if (firstMissing)
    return {
      code: 'requirementsNotMet',
      message: `prérequis manquant '${firstMissing.building}'@${firstMissing.level}`,
    };
  // Choix exclusif (doc 05 §3.2) : un seul bâtiment par groupe et par ville.
  if (def.exclusiveGroup) {
    const rival = exclusiveRivalId(town, state.buildingCatalog, cmd.buildingId);
    if (rival)
      return {
        code: 'exclusiveChoiceLocked',
        message: `choix exclusif '${def.exclusiveGroup}' déjà pris par '${rival}'`,
      };
  }
  // Revue 2026-07 (B24a) : le choix de Maison est UNIQUE et IRRÉVERSIBLE par
  // JOUEUR (doc 16 §3.1) — l'exclusivité par ville (`exclusiveGroup`) ne suffit
  // pas, une 2ᵉ ville permettait de l'écraser. Refus dès qu'un héros du joueur
  // est déjà stampé d'une Maison.
  if (nextLevel.effect.type === 'houseChoice') {
    const chosen = state.heroes.some((h) => h.playerId === player.id && h.houseId !== '');
    if (chosen)
      return {
        code: 'houseAlreadyChosen',
        message: `une Maison a déjà été choisie par ${player.id} — choix irréversible`,
      };
  }
  // D4 : « un seul Capitole par joueur » (doc 02 §4.1) — niveau `uniquePerPlayer`
  // interdit si une AUTRE ville du joueur porte déjà ce bâtiment à ce niveau.
  const targetLevel = currentLevel + 1;
  if (nextLevel.uniquePerPlayer) {
    const dupe = state.towns.some(
      (t) =>
        t.id !== town.id &&
        t.ownerPlayerId === player.id &&
        (t.buildings[cmd.buildingId] ?? 0) >= targetLevel,
    );
    if (dupe)
      return {
        code: 'uniquePerPlayer',
        message: `'${cmd.buildingId}'@${targetLevel} : un seul par joueur (doc 02 §4.1)`,
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
  // Guilde des mages (G2) : tire le pool de sorts du cercle bâti, puis tout héros
  // du propriétaire présent sur la ville apprend aussitôt ce qu'il peut.
  const effect = nextLevel.effect;
  if (effect.type === 'mageGuild') {
    rollGuildSpells(draft, town, effect.level, effect.spellCount ?? 0);
    for (const hero of draft.heroes) {
      if (hero.playerId === town.ownerPlayerId && samePos(hero.pos, town.pos))
        learnGuildSpellsAtTown(draft, hero, town, events);
    }
  }
  // Bâtiment enseignant (F-BUILDEFF.3, doc 03 §4 — Cloître) : ajoute son sort au
  // pool de la ville (jumeau du bloc mageGuild, sans RNG), puis tout héros du
  // propriétaire présent l'apprend aussitôt s'il le peut.
  if (effect.type === 'grantSpell') {
    if (!town.spellPool.includes(effect.spellId)) town.spellPool.push(effect.spellId);
    for (const hero of draft.heroes) {
      if (hero.playerId === town.ownerPlayerId && samePos(hero.pos, town.pos))
        learnGuildSpellsAtTown(draft, hero, town, events);
    }
  }
  // Choix de Maison (doc 16 §3.1, « Le Choixpeau ») : les héros du propriétaire
  // relèvent de la Maison bâtie. Id opaque résolu dans le catalogue embarqué ;
  // l'exclusivité (`exclusiveGroup`) garantit un seul choix par ville.
  if (effect.type === 'houseChoice') {
    const houseEffects = draft.houseCatalog[effect.houseId]?.effects ?? [];
    for (const hero of draft.heroes) {
      if (hero.playerId !== town.ownerPlayerId) continue;
      hero.houseId = effect.houseId;
      hero.houseEffects = houseEffects.map((e) => ({ ...e }));
    }
  }
}
