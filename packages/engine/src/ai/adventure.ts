import { runAutoCombat } from '../combat/ai';
import type { ArmyStack, CombatUnitDef } from '../combat/types';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState, PlayerState } from '../core/state';
import { advanceHeroAlongPath } from '../adventure/movement';
import { DIRECTIONS, isAdjacent, tileIndex, type GridPos } from '../adventure/map';
import { findPath, isPassable, stepCost } from '../adventure/path';
import { validateCaptureTown, handleCaptureTown } from '../town';
import type { TownState } from '../town/types';
import { playTownTurn } from './town-ai';

/**
 * Joue le tour d'aventure d'un joueur IA (doc 11 §3.5, plan phase-3.5) :
 * déplace ses héros vers le meilleur objectif atteignable (ramassage / gardien
 * battable / capture), construit + recrute dans ses villes, puis termine son
 * tour. Déterministe (RNG de l'état). Ne joue QUE si le joueur est `'ai'`.
 *
 * CONTRAT (décision plan phase-3.5 #5) : `runAiTurn` joue uniquement les
 * actions du joueur IA (héros + villes) — elle ne pousse JAMAIS `EndTurn` :
 * le passage au joueur suivant reste la responsabilité du driver (client,
 * property test) qui boucle « tant que le joueur courant est `ai` et la
 * partie n'est pas finie : `runAiTurn` puis `apply(EndTurn)` ».
 *
 * Heuristique gloutonne MVP (un seul objectif par héros par tour, pas de
 * planification multi-tours) : par héros, dans l'ordre de priorité —
 * (1) ressource au sol atteignable la plus proche, (2) gardien atteignable
 * « battable » (marge de force ≥ 1,5×), (3) ville ennemie/neutre capturable
 * (garnison vide) déjà adjacente, (4) sinon un pas vers la tuile inexplorée
 * la plus proche. Par ville : construit le premier bâtiment abordable dont
 * les prérequis sont satisfaits, puis recrute le plus haut tier abordable
 * (voir `town-ai.ts`).
 */
export function runAiTurn(draft: GameState, playerId: string, events: GameEvent[]): void {
  const player = draft.players.find((p) => p.id === playerId);
  if (!player || player.controller !== 'ai' || player.eliminated || draft.outcome) return;
  // Les commandes réutilisées (BuildStructure/RecruitUnits) valident contre
  // `players[currentPlayer]` — l'IA ne doit agir que pour le joueur actif.
  if (draft.players[draft.currentPlayer]?.id !== playerId) return;

  for (const heroId of draft.heroes.filter((h) => h.playerId === playerId).map((h) => h.id)) {
    if (draft.outcome) return;
    const hero = draft.heroes.find((h) => h.id === heroId);
    if (!hero) continue; // mort en combat plus tôt dans ce même tour
    playHeroTurn(draft, hero, player, events);
  }

  if (draft.outcome) return;
  for (const townId of draft.towns.filter((t) => t.ownerPlayerId === playerId).map((t) => t.id)) {
    if (draft.outcome) return;
    const town = draft.towns.find((t) => t.id === townId);
    if (!town) continue;
    playTownTurn(draft, town, player, events);
  }
}

// ——— Héros : choix d'objectif + déplacement ———

const GUARDIAN_STRENGTH_MARGIN = 1.5;

interface PathTarget {
  path: GridPos[];
  cost: number;
}

/** Coût total d'un chemin déjà calculé (A* renvoie les pas SANS la case de départ). */
function totalPathCost(config: GameState['config'], map: GameState['map'], from: GridPos, path: GridPos[]): number {
  if (!config || !map) return Infinity;
  let prev = from;
  let total = 0;
  for (const step of path) {
    total += stepCost(config, map, prev, step);
    prev = step;
  }
  return total;
}

/** Force brute d'une armée : Σ effectif × (PV + attaque + défense) — estimation simple. */
function armyStrength(army: ArmyStack[], catalog: Record<string, CombatUnitDef>): number {
  let total = 0;
  for (const stack of army) {
    const def = catalog[stack.unitId];
    if (!def) continue;
    total += stack.count * (def.stats.hp + def.stats.attack + def.stats.defense);
  }
  return total;
}

/** Ressource au sol la plus proche atteignable dans les PM du jour (priorité 1). */
function pickResourceTarget(draft: GameState, hero: HeroState, blocked: GridPos[]): PathTarget | null {
  const { map, config } = draft;
  if (!map || !config) return null;
  let best: (PathTarget & { id: string }) | null = null;
  for (const obj of map.objects) {
    if (obj.type !== 'resource') continue;
    const path = findPath(config, map, hero.pos, obj.pos, blocked);
    if (!path) continue;
    const cost = totalPathCost(config, map, hero.pos, path);
    if (cost > hero.movementPoints) continue;
    if (!best || cost < best.cost || (cost === best.cost && obj.id < best.id)) {
      best = { id: obj.id, path, cost };
    }
  }
  return best;
}

/** Gardien atteignable que l'armée du héros domine largement (priorité 2). */
function pickGuardianTarget(draft: GameState, hero: HeroState, blocked: GridPos[]): PathTarget | null {
  const { map, config, unitCatalog } = draft;
  if (!map || !config) return null;
  const heroStrength = armyStrength(hero.army, unitCatalog);
  if (heroStrength <= 0) return null;
  let best: (PathTarget & { id: string }) | null = null;
  for (const obj of map.objects) {
    if (obj.type !== 'guardian') continue;
    const guardStrength = armyStrength([{ unitId: obj.unitId, count: obj.count }], unitCatalog);
    if (guardStrength <= 0 || heroStrength < GUARDIAN_STRENGTH_MARGIN * guardStrength) continue;
    const path = findPath(config, map, hero.pos, obj.pos, blocked);
    if (!path) continue;
    const cost = totalPathCost(config, map, hero.pos, path);
    if (cost > hero.movementPoints) continue;
    if (!best || cost < best.cost || (cost === best.cost && obj.id < best.id)) {
      best = { id: obj.id, path, cost };
    }
  }
  return best;
}

/** Ville ennemie/neutre non défendue déjà adjacente au héros (priorité 3, pas de déplacement). */
function pickAdjacentCapturableTown(draft: GameState, hero: HeroState, player: PlayerState): TownState | null {
  let best: TownState | null = null;
  for (const town of draft.towns) {
    if (town.ownerPlayerId === player.id) continue;
    if (town.garrison.length > 0) continue;
    if (!isAdjacent(hero.pos, town.pos)) continue;
    if (!best || town.id < best.id) best = town;
  }
  return best;
}

/** Tuile inexplorée la plus proche (BFS sur le graphe franchissable, déterministe). */
function nearestUnexploredTile(
  map: NonNullable<GameState['map']>,
  config: NonNullable<GameState['config']>,
  explored: number[],
  from: GridPos,
): GridPos | null {
  const visited = new Set<number>([tileIndex(map, from)]);
  const queue: GridPos[] = [from];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++] as GridPos;
    for (const dir of DIRECTIONS) {
      const next = { x: cur.x + dir.x, y: cur.y + dir.y };
      if (!isPassable(config, map, next)) continue;
      const idx = tileIndex(map, next);
      if (visited.has(idx)) continue;
      visited.add(idx);
      if (explored[idx] === 0) return next;
      queue.push(next);
    }
  }
  return null;
}

/** Un pas vers l'inexploré le plus proche, si abordable (priorité 4, exploration). */
function pickExplorationStep(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  blocked: GridPos[],
): GridPos[] | null {
  const { map, config } = draft;
  if (!map || !config) return null;
  const target = nearestUnexploredTile(map, config, player.explored, hero.pos);
  if (!target) return null;
  const path = findPath(config, map, hero.pos, target, blocked);
  const first = path?.[0];
  if (!first || stepCost(config, map, hero.pos, first) > hero.movementPoints) return null;
  return [first];
}

/**
 * L'IA d'aventure résout le combat de gardien immédiatement (IA vs IA,
 * déterministe) : elle passe `runAutoCombat` en `onGuardianEngaged` à la
 * routine de pas partagée avec le handler humain (`adventure/movement`).
 */
function advanceAi(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  path: GridPos[],
  events: GameEvent[],
): void {
  advanceHeroAlongPath(draft, hero, player, path, events, {
    onGuardianEngaged: () => runAutoCombat(draft, events),
  });
}

function captureTown(draft: GameState, town: TownState, player: PlayerState, events: GameEvent[]): void {
  const cmd = { type: 'CaptureTown' as const, townId: town.id, playerId: player.id };
  if (validateCaptureTown(draft, cmd)) return; // garde-fou : ne devrait jamais être invalide ici
  handleCaptureTown(draft, cmd, events);
}

function playHeroTurn(draft: GameState, hero: HeroState, player: PlayerState, events: GameEvent[]): void {
  if (!draft.map || !draft.config || hero.movementPoints <= 0 || draft.combat) return;
  const blocked = draft.heroes.filter((h) => h.id !== hero.id).map((h) => h.pos);

  const resource = pickResourceTarget(draft, hero, blocked);
  if (resource) {
    advanceAi(draft, hero, player, resource.path, events);
    return;
  }

  const guardian = pickGuardianTarget(draft, hero, blocked);
  if (guardian) {
    advanceAi(draft, hero, player, guardian.path, events);
    return;
  }

  const town = pickAdjacentCapturableTown(draft, hero, player);
  if (town) {
    captureTown(draft, town, player, events);
    return;
  }

  const exploreStep = pickExplorationStep(draft, hero, player, blocked);
  if (exploreStep) advanceAi(draft, hero, player, exploreStep, events);
}
