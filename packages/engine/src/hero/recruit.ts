import { revealAround } from '../adventure/fog';
import type { Command, CommandError } from '../core/commands';
import { heroDailyMovement } from '../core/engine';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import { builtLevelOf } from '../town/helpers';
import { heroManaMax } from './artifacts';
import { heroVisionRadius } from './skills';

type RecruitCmd = Extract<Command, { type: 'RecruitHero' }>;

const DEFAULT_RECRUIT_COST = 2500;
const DEFAULT_MAX_HEROES = 8;

/**
 * id déterministe d'un héros recruté : namespacé par joueur + id de roster
 * (unique). Exporté (M-TAVERN.2) : le client teste « déjà recruté » avec la
 * même convention au lieu de la dupliquer (leçon CL9/R7).
 */
export function recruitedHeroId(playerId: string, heroId: string): string {
  return `hero-${playerId}-${heroId}`;
}

/** La ville a-t-elle une Taverne construite (effet `tavern` au niveau bâti) ? */
function hasTavern(state: GameState, town: GameState['towns'][number]): boolean {
  return Object.keys(town.buildings).some(
    (b) => builtLevelOf(town, state.buildingCatalog, b)?.effect.type === 'tavern',
  );
}

/**
 * Recrutement de héros à la Taverne (M-TAVERN.1, doc 02 §1.5/§4.1) : le joueur
 * actif recrute un héros nommé de SA faction (roster embarqué) contre or, à une
 * ville qu'il possède avec une Taverne. Cap `hero.maxPerPlayer` (8). Le héros
 * apparaît sur la tuile de la ville, armée vide.
 */
export function validateRecruitHero(state: GameState, cmd: RecruitCmd): CommandError | null {
  if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
  const current = state.players[state.currentPlayer];
  if (!current || current.id !== cmd.playerId)
    return { code: 'notYourTurn', message: `ce n’est pas le tour de ${cmd.playerId}` };
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  if (town.ownerPlayerId !== cmd.playerId)
    return { code: 'invalidAction', message: `'${cmd.townId}' n’appartient pas à ${cmd.playerId}` };
  if (!hasTavern(state, town))
    return { code: 'invalidAction', message: `'${cmd.townId}' n’a pas de Taverne` };
  const def = state.heroRoster[cmd.heroId];
  if (!def) return { code: 'invalidAction', message: `héros inconnu '${cmd.heroId}'` };
  // La Taverne d'une ville n'offre que les héros de SA faction (ids opaques).
  if (def.factionId !== town.factionId)
    return { code: 'invalidAction', message: `'${cmd.heroId}' n’est pas de la faction de '${cmd.townId}'` };
  const player = state.players.find((p) => p.id === cmd.playerId);
  if (!player) return { code: 'invalidAction', message: `joueur inconnu '${cmd.playerId}'` };
  const owned = state.heroes.filter((h) => h.playerId === cmd.playerId);
  const max = state.config?.hero?.maxPerPlayer ?? DEFAULT_MAX_HEROES;
  if (owned.length >= max)
    return { code: 'invalidAction', message: `cap de ${max} héros atteint pour ${cmd.playerId}` };
  // Pool exclusif inter-joueurs (M-TAVERN.4, doc 02 §1.5) : un héros du roster ne
  // peut être VIVANT que chez un seul joueur (subsume l'ancien « déjà recruté par
  // ce joueur »). Un héros mort (retiré de `heroes`) libère l'entrée.
  if (state.heroes.some((h) => h.rosterId === cmd.heroId))
    return { code: 'invalidAction', message: `'${cmd.heroId}' déjà en jeu chez un joueur` };
  const cost = state.config?.hero?.recruitCost ?? DEFAULT_RECRUIT_COST;
  if (player.resources.gold < cost)
    return { code: 'cannotAfford', message: `or insuffisant (${cost} requis)` };
  return null;
}

export function handleRecruitHero(draft: GameState, cmd: RecruitCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const def = draft.heroRoster[cmd.heroId];
  const player = draft.players.find((p) => p.id === cmd.playerId);
  if (!town || !def || !player) return; // exclu par validate
  player.resources.gold -= draft.config?.hero?.recruitCost ?? DEFAULT_RECRUIT_COST;
  const id = recruitedHeroId(cmd.playerId, cmd.heroId);
  const hero: HeroState = {
    id,
    playerId: cmd.playerId,
    name: def.name,
    pos: { ...town.pos },
    movementPoints: 0,
    army: [],
    xp: 0,
    level: 1,
    attributes: { ...def.attributes },
    mana: 0,
    manaMax: 0,
    skills: { ...def.startingSkills },
    visitLuck: 0,
    visitMorale: 0,
    spells: [...def.startingSpells],
    artifacts: Array.from({ length: 10 }, () => null),
    backpack: [],
    pendingSkillChoices: [],
    pendingAttributeChoices: [],
    factionId: def.factionId,
    houseId: '',
    houseEffects: [],
    specialtyId: def.specialtyId,
    specialtyEffects: def.specialtyEffects.map((e) => ({ ...e })),
    warMachines: [],
    rosterId: cmd.heroId, // pool exclusif (M-TAVERN.4) : marque l'entrée de roster occupée
  };
  hero.manaMax = heroManaMax(hero, draft.artifactCatalog);
  hero.mana = hero.manaMax;
  // Revue 2026-07 (B29) : le héros recruté dispose de ses PM du jour même —
  // même calcul que StartGame/EndTurn (il restait à 0 jusqu'au lendemain).
  hero.movementPoints = heroDailyMovement(draft, hero);
  // Revue 2026-07 (B24b) : la Maison est un choix par JOUEUR (doc 16 §3.1) — un
  // héros recruté après « Le Choixpeau » hérite de la Maison déjà choisie
  // (effets résolus depuis le catalogue embarqué, copie défensive comme StartGame).
  const chosenHouseId = draft.heroes.find(
    (h) => h.playerId === cmd.playerId && h.houseId !== '',
  )?.houseId;
  if (chosenHouseId) {
    hero.houseId = chosenHouseId;
    hero.houseEffects = (draft.houseCatalog[chosenHouseId]?.effects ?? []).map((e) => ({ ...e }));
  }
  draft.heroes.push(hero);
  // Le héros recruté éclaire aussitôt son voisinage (comme un héros de départ).
  if (draft.map && draft.config)
    revealAround(player.explored, draft.map, hero.pos, heroVisionRadius(hero, draft.config.visionRadius, draft.skillCatalog, draft.artifactCatalog));
  events.push({ type: 'HeroRecruited', playerId: cmd.playerId, heroId: cmd.heroId, newHeroId: id });
}
