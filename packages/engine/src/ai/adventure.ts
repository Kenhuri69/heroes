import { runAutoCombat } from '../combat/ai';
import type { GameEvent } from '../core/events';
import { armyStrength } from '../core/power';
import { areAllies, type GameState, type HeroState, type PlayerState } from '../core/state';
import { advanceHeroAlongPath } from '../adventure/movement';
import { resolveTreasure } from '../adventure/treasure';
import { resolveTriggerChoice } from '../adventure/trigger-choice';
import { DIRECTIONS, atLevel, isAdjacent, levelOf, samePos, tileIndex, type GridPos } from '../adventure/map';
import { findPath, isPassable, minStepCost, octileLowerBound, stepCost } from '../adventure/path';
import { heroArmyCap } from '../hero/skills';
import { validateEquipArtifact, handleEquipArtifact } from '../hero/equip';
import { validateCastAdventureSpell, handleCastAdventureSpell } from '../hero';
import { grailRevealedTo } from '../adventure/map';
import { canDigGrail, digGrail } from '../adventure/grail';
import { validateCaptureTown, handleCaptureTown } from '../town';
import { maxAffordableCount } from '../town/resources';
import { unitWithEconomy } from '../town/unit-economy';
import type { TownState } from '../town/types';
import { playTownTurn, tryGarrisonPickup } from './town-ai';

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
 * (1) objet collectable atteignable le plus proche (ressource, trésor résolu
 * en or, artefact, mine à capturer), (2) héros ennemi atteignable « battable »
 * (marge de force ≥ 1,5×, H-VS-H), (3) ma ville dont la garnison en attente
 * vaut le détour, (4) gardien atteignable « battable » (même marge),
 * (5) ville ennemie/neutre capturable (garnison vide) déjà adjacente,
 * (6) sinon un pas vers la tuile inexplorée la plus proche. **Avant** cette
 * liste (lot L4) : la fouille du Graal sur place, la garde d'une ville encore
 * menacée et la Marche forcée ; puis en **priorité 0** le retour vers une ville
 * qui va tomber, et juste après le ramassage la tuile du **Graal révélée**.
 * Faute d'objectif, un sort de **Vision** peut encore en découvrir un avant le
 * repli exploration. Par ville :
 * construit le bâtiment abordable le plus utile, recrute le plus haut tier
 * abordable, améliore ce qui peut l'être et remet la garnison au héros
 * présent (voir `town-ai.ts`).
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
    // Avant même de bouger — et y compris sans point de mouvement : un héros
    // immobile peut être attaqué, ses bonus doivent être portés.
    if (!draft.combat) equipBackpack(draft, hero);
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
/**
 * Marge de force pour attaquer un héros ennemi (H-VS-H). Alignée sur le seuil
 * gardien (arbitrage plan `ai-hero-hunt`) : l'IA n'engage qu'un adversaire
 * qu'elle domine largement, laissant les affrontements équilibrés au joueur.
 */
const ENEMY_HERO_STRENGTH_MARGIN = 1.5;

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

/**
 * Objet « collectable » par un simple déplacement (doc 02 §2.2) : tas de
 * ressource, trésor (résolu en or, cf. `advanceAi`), artefact au sol (si un
 * slot est libre), mine pas encore possédée par ce joueur, ou habitation dont
 * au moins 1 créature est abordable (renforce l'armée). Les lieux de bonus
 * sont ignorés par l'IA (heuristique MVP — écart documenté au plan).
 */
function isCollectible(
  draft: GameState,
  obj: NonNullable<GameState['map']>['objects'][number],
  hero: HeroState,
  player: PlayerState,
  /** Ids d'objets encore sur la carte (B30) — un butin `guardedBy` une sentinelle vivante est inerte. */
  presentObjectIds: ReadonlySet<string>,
): boolean {
  // B30 (revue 2026-07) : l'IA ciblait un butin gardé (M-GUARDLINK) qu'elle ne
  // peut pas ramasser — PM du jour gaspillés en boucle, en priorité 1.
  if ('guardedBy' in obj && obj.guardedBy !== undefined && presentObjectIds.has(obj.guardedBy))
    return false;
  if (obj.type === 'resource' || obj.type === 'treasure') return true;
  // Obélisque (T-GRAIL) : une visite par joueur, et seulement tant que le Graal
  // n'est pas trouvé — sans ces visites l'IA ne se le voyait jamais révélé.
  if (obj.type === 'obelisk')
    return !player.hasGrail && !(player.obelisksVisited ?? []).includes(obj.id);
  if (obj.type === 'artifact') return hero.artifacts.includes(null);
  if (obj.type === 'mine') {
    if (obj.ownerId === player.id) return false;
    // B26 : la mine d'un ALLIÉ n'est pas une cible (sinon ping-pong de drapeaux
    // entre coéquipiers — cohérent avec la capture en passant côté moteur).
    const owner = obj.ownerId ? draft.players.find((p) => p.id === obj.ownerId) : undefined;
    return !(owner && areAllies(player, owner));
  }
  if (obj.type === 'dwelling') {
    if (obj.stock <= 0) return false;
    if (!hero.army.some((s) => s.unitId === obj.unitId) && hero.army.length >= heroArmyCap(hero)) return false;
    const cost = unitWithEconomy(draft.unitCatalog, obj.unitId)?.recruitCost ?? {};
    return maxAffordableCount(player, cost, obj.stock) > 0;
  }
  return false;
}

/** Objet collectable le plus proche atteignable dans les PM du jour (priorité 1). */
function pickResourceTarget(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  blocked: GridPos[],
  minStep: number,
): PathTarget | null {
  const { map, config } = draft;
  if (!map || !config) return null;
  const presentObjectIds = new Set(map.objects.map((o) => o.id));
  let best: (PathTarget & { id: string }) | null = null;
  for (const obj of map.objects) {
    // B31 (décision revue 2026-07) : l'IA ne cible que ce que son joueur a
    // EXPLORÉ — elle routait vers des ressources jamais vues (triche d'info).
    if (player.explored[tileIndex(map, obj.pos)] === 0) continue;
    if (!isCollectible(draft, obj, hero, player, presentObjectIds)) continue;
    // Pré-filtre O(1) : hors de portée du jour à vol d'oiseau ⇒ pas d'A* (perf).
    if (octileLowerBound(minStep, hero.pos, obj.pos) > hero.movementPoints) continue;
    // F7 : budget de PM passé à l'A* — une cible proche mais inatteignable
    // n'épuise plus toute la composante (décision inchangée : cost > PM rejeté).
    const path = findPath(config, map, hero.pos, obj.pos, blocked, false, hero.movementPoints);
    if (!path) continue;
    const cost = totalPathCost(config, map, hero.pos, path);
    if (cost > hero.movementPoints) continue;
    if (!best || cost < best.cost || (cost === best.cost && obj.id < best.id)) {
      best = { id: obj.id, path, cost };
    }
  }
  return best;
}

/** Gardien atteignable que l'armée du héros domine largement (priorité 3). */
function pickGuardianTarget(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  blocked: GridPos[],
  guardianPos: GridPos[],
  minStep: number,
): PathTarget | null {
  const { map, config, unitCatalog } = draft;
  if (!map || !config) return null;
  const heroStrength = armyStrength(hero.army, unitCatalog);
  if (heroStrength <= 0) return null;
  let best: (PathTarget & { id: string }) | null = null;
  for (const obj of map.objects) {
    if (obj.type !== 'guardian') continue;
    // B31 : jamais un gardien sous brouillard (force lue = triche d'info).
    if (player.explored[tileIndex(map, obj.pos)] === 0) continue;
    const guardStrength = armyStrength([{ unitId: obj.unitId, count: obj.count }], unitCatalog);
    if (guardStrength <= 0 || heroStrength < GUARDIAN_STRENGTH_MARGIN * guardStrength) continue;
    // Pré-filtre O(1) : hors de portée du jour à vol d'oiseau ⇒ pas d'A* (perf).
    if (octileLowerBound(minStep, hero.pos, obj.pos) > hero.movementPoints) continue;
    // Bloque les AUTRES gardiens (pas la cible) : on ne traverse pas un gardien
    // non ciblé pour en atteindre un autre.
    const pathBlocked = [...blocked, ...guardianPos.filter((p) => !samePos(p, obj.pos))];
    const path = findPath(config, map, hero.pos, obj.pos, pathBlocked, false, hero.movementPoints); // F7
    if (!path) continue;
    const cost = totalPathCost(config, map, hero.pos, path);
    if (cost > hero.movementPoints) continue;
    if (!best || cost < best.cost || (cost === best.cost && obj.id < best.id)) {
      best = { id: obj.id, path, cost };
    }
  }
  return best;
}

/**
 * Héros ENNEMI atteignable ce tour que l'armée du héros domine largement
 * (H-VS-H, doc 02 §1.5/§5). Modèle exact de `pickGuardianTarget` : même seuil
 * de marge, même exclusion de la cible du `blocked`. La branche « héros ennemi »
 * de `advanceHeroAlongPath` ouvrira `beginHeroCombat` (résolu par `runAutoCombat`).
 */
function pickEnemyHeroTarget(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  blocked: GridPos[],
  minStep: number,
): PathTarget | null {
  const { map, config, unitCatalog } = draft;
  if (!map || !config) return null;
  const heroStrength = armyStrength(hero.army, unitCatalog);
  if (heroStrength <= 0) return null;
  let best: (PathTarget & { id: string }) | null = null;
  for (const enemy of draft.heroes) {
    if (enemy.id === hero.id || enemy.playerId === player.id) continue;
    // B31 : un héros ennemi sous brouillard n'est ni vu ni évalué.
    if (map && player.explored[tileIndex(map, enemy.pos)] === 0) continue;
    const enemyPlayer = draft.players.find((p) => p.id === enemy.playerId);
    if (enemyPlayer && areAllies(player, enemyPlayer)) continue;
    const enemyStrength = armyStrength(enemy.army, unitCatalog);
    if (heroStrength < ENEMY_HERO_STRENGTH_MARGIN * enemyStrength) continue;
    // Pré-filtre O(1) : hors de portée du jour à vol d'oiseau ⇒ pas d'A* (perf).
    if (octileLowerBound(minStep, hero.pos, enemy.pos) > hero.movementPoints) continue;
    // Route vers la tuile du héros ciblé : elle NE doit PAS être bloquée
    // (contrairement aux autres héros, qui restent des obstacles).
    const pathBlocked = blocked.filter((p) => !samePos(p, enemy.pos));
    const path = findPath(config, map, hero.pos, enemy.pos, pathBlocked, false, hero.movementPoints); // F7
    if (!path) continue;
    const cost = totalPathCost(config, map, hero.pos, path);
    if (cost > hero.movementPoints) continue;
    if (!best || cost < best.cost || (cost === best.cost && enemy.id < best.id)) {
      best = { id: enemy.id, path, cost };
    }
  }
  return best;
}

/**
 * Fraction de l'armée du héros à partir de laquelle une garnison qui l'attend
 * vaut le détour — en dessous, le renfort ne paie pas les PM du voyage.
 */
const GARRISON_PICKUP_RATIO = 0.25;

/** Distance de Tchebychev à laquelle un héros ennemi menace une de mes villes. */
const TOWN_THREAT_RADIUS = 8;
/**
 * Hystérésis de la garde : on rentre quand la menace dépasse la défense, on
 * **reste** tant qu'elle en atteint cette fraction. Sans ce palier, le héros
 * rentrant renforçait la défense, la menace passait sous le seuil, il repartait
 * — et la ville redevenait vulnérable le tour suivant (aller-retour perpétuel).
 */
const TOWN_HOLD_RATIO = 0.75;

/** Force du plus menaçant héros ennemi VISIBLE à portée d'une de mes villes (0 si aucun). */
function threatAt(draft: GameState, town: TownState, player: PlayerState): number {
  const { map, unitCatalog } = draft;
  if (!map) return 0;
  let worst = 0;
  for (const enemy of draft.heroes) {
    if (enemy.playerId === player.id) continue;
    const owner = draft.players.find((p) => p.id === enemy.playerId);
    if (owner && areAllies(player, owner)) continue;
    // B31 : jamais d'information sous brouillard — un ennemi non exploré n'existe pas.
    if (player.explored[tileIndex(map, enemy.pos)] === 0) continue;
    const dist = Math.max(Math.abs(enemy.pos.x - town.pos.x), Math.abs(enemy.pos.y - town.pos.y));
    if (dist > TOWN_THREAT_RADIUS) continue;
    worst = Math.max(worst, armyStrength(enemy.army, unitCatalog));
  }
  return worst;
}

/** Défense en place d'une ville : garnison + armées de mes héros postés dessus. */
function defenseAt(draft: GameState, town: TownState, player: PlayerState): number {
  const { unitCatalog } = draft;
  let total = armyStrength(town.garrison, unitCatalog);
  for (const h of draft.heroes) {
    if (h.playerId === player.id && samePos(h.pos, town.pos)) total += armyStrength(h.army, unitCatalog);
  }
  return total;
}

/**
 * Ma ville menacée la plus proche, atteignable ce tour (priorité 0). Un héros
 * posté sur la tuile d'une ville **intercepte** l'assaillant (combat
 * héros-vs-héros avant toute capture, `adventure/movement`) : c'est la seule
 * défense mobile dont l'IA dispose, et elle ne s'en servait jamais.
 */
function pickTownDefenseTarget(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  blocked: GridPos[],
  minStep: number,
): PathTarget | null {
  const { map, config } = draft;
  if (!map || !config) return null;
  let best: (PathTarget & { id: string }) | null = null;
  for (const town of draft.towns) {
    if (town.ownerPlayerId !== player.id) continue;
    if (samePos(hero.pos, town.pos)) continue; // déjà en garde : traité en amont
    if (threatAt(draft, town, player) <= defenseAt(draft, town, player)) continue;
    if (octileLowerBound(minStep, hero.pos, town.pos) > hero.movementPoints) continue;
    const pathBlocked = blocked.filter((p) => !samePos(p, town.pos));
    const path = findPath(config, map, hero.pos, town.pos, pathBlocked, false, hero.movementPoints);
    if (!path) continue;
    const cost = totalPathCost(config, map, hero.pos, path);
    if (cost > hero.movementPoints) continue;
    if (!best || cost < best.cost || (cost === best.cost && town.id < best.id)) {
      best = { id: town.id, path, cost };
    }
  }
  return best;
}

/** Le héros tient-il une ville à lui encore sous la menace (hystérésis) ? */
function holdsThreatenedTown(draft: GameState, hero: HeroState, player: PlayerState): boolean {
  const town = draft.towns.find((t) => t.ownerPlayerId === player.id && samePos(t.pos, hero.pos));
  if (!town) return false;
  return threatAt(draft, town, player) >= TOWN_HOLD_RATIO * defenseAt(draft, town, player);
}

/**
 * Part de mana que le héros garde pour le combat : la mana d'aventure et celle
 * des sorts de bataille sont la MÊME réserve — vider le réservoir sur la carte
 * laisserait le héros muet au premier affrontement.
 */
const AI_MANA_COMBAT_RESERVE = 0.5;

/**
 * Lance le premier sort d'aventure connu dont l'effet est de l'un des types
 * demandés (choisi par **type d'effet déclaratif**, jamais par id de sort), si
 * la réserve de combat le permet. Rend `true` si un sort a été lancé.
 */
function tryCastAdventureSpell(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  wanted: readonly string[],
  events: GameEvent[],
): boolean {
  for (const spellId of [...(hero.spells ?? [])].sort()) {
    const spell = draft.spellCatalog[spellId];
    const type = spell?.adventure?.type;
    if (!spell || !type || !wanted.includes(type)) continue;
    if (hero.mana - spell.manaCost < hero.manaMax * AI_MANA_COMBAT_RESERVE) continue;
    const cmd = { type: 'CastAdventureSpell' as const, heroId: hero.id, spellId, playerId: player.id };
    if (validateCastAdventureSpell(draft, cmd)) continue;
    handleCastAdventureSpell(draft, cmd, events);
    return true;
  }
  return false;
}

/**
 * Tuile du Graal RÉVÉLÉE à ce joueur (obélisques complets) et pas encore
 * fouillée — cible de déplacement, puis `Dig` à l'arrivée.
 */
function pickGrailTarget(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  blocked: GridPos[],
  minStep: number,
): PathTarget | null {
  const { map, config } = draft;
  if (!map || !config || player.hasGrail) return null;
  if (!grailRevealedTo(map, player.obelisksVisited)) return null;
  const target = map.grailPos;
  if (!target || samePos(hero.pos, target)) return null;
  if (octileLowerBound(minStep, hero.pos, target) > hero.movementPoints) return null;
  const path = findPath(config, map, hero.pos, target, blocked, false, hero.movementPoints);
  if (!path) return null;
  const cost = totalPathCost(config, map, hero.pos, path);
  if (cost > hero.movementPoints) return null;
  return { path, cost };
}

/** Fouille si le héros est sur la tuile du Graal révélée, avec des PM (T-GRAIL lot 2). */
function tryDigGrail(draft: GameState, hero: HeroState, player: PlayerState, events: GameEvent[]): void {
  if (canDigGrail(draft, hero, player)) digGrail(draft, hero, player, events);
}

/**
 * Ma ville la plus proche dont la garnison vaut le détour (priorité 3). Les
 * recrues de l'IA s'entassent en **garnison** (`RecruitUnits` les y dépose) :
 * sans ce retour au bercail, son armée ne grossissait jamais. Le ramassage
 * lui-même est joué par le tour de ville (`town-ai`), qui suit les héros dans
 * `runAiTurn` — arriver sur la tuile suffit.
 */
function pickGarrisonPickupTarget(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  blocked: GridPos[],
  minStep: number,
): PathTarget | null {
  const { map, config, unitCatalog } = draft;
  if (!map || !config) return null;
  const heroStrength = armyStrength(hero.army, unitCatalog);
  let best: (PathTarget & { id: string }) | null = null;
  for (const town of draft.towns) {
    if (town.ownerPlayerId !== player.id || town.garrison.length === 0) continue;
    if (samePos(hero.pos, town.pos)) continue; // déjà sur place : le tour de ville ramasse
    const waiting = armyStrength(town.garrison, unitCatalog);
    if (waiting <= 0 || waiting < GARRISON_PICKUP_RATIO * heroStrength) continue;
    // Pré-filtre O(1) puis A* borné par les PM du jour — même patron que les
    // autres pickers (une ville hors de portée du jour n'est pas une cible).
    if (octileLowerBound(minStep, hero.pos, town.pos) > hero.movementPoints) continue;
    const pathBlocked = blocked.filter((p) => !samePos(p, town.pos));
    const path = findPath(config, map, hero.pos, town.pos, pathBlocked, false, hero.movementPoints);
    if (!path) continue;
    const cost = totalPathCost(config, map, hero.pos, path);
    if (cost > hero.movementPoints) continue;
    if (!best || cost < best.cost || (cost === best.cost && town.id < best.id)) {
      best = { id: town.id, path, cost };
    }
  }
  return best;
}

/** Ville ennemie/neutre non défendue déjà adjacente au héros (priorité 4, pas de déplacement). */
function pickAdjacentCapturableTown(draft: GameState, hero: HeroState, player: PlayerState): TownState | null {
  let best: TownState | null = null;
  for (const town of draft.towns) {
    if (town.ownerPlayerId === player.id) continue;
    // Ne pas assiéger la ville d'un allié (doc 02 §6) — cohérent avec `validateCaptureTown`.
    const owner = draft.players.find((p) => p.id === town.ownerPlayerId);
    if (owner && areAllies(owner, player)) continue;
    if (town.garrison.length > 0) continue;
    // M1 : une ville occupée par un héros adverse ouvrirait un combat H-vs-H, pas
    // une capture — hors de cette heuristique (la chasse aux héros a son picker).
    if (draft.heroes.some((h) => h.playerId !== player.id && samePos(h.pos, town.pos))) continue;
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
      const next = atLevel({ x: cur.x + dir.x, y: cur.y + dir.y }, levelOf(from));
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

/**
 * Bouche de téléporteur menant à de l'INEXPLORÉ (L10.5) — ce qui fait descendre
 * l'IA au souterrain sans que le moteur connaisse la notion d'escalier : un
 * escalier n'est qu'une paire de monolithes dont les extrémités changent de
 * couche. On ne considère qu'une bouche déjà EXPLORÉE (même règle que les
 * autres cibles de l'IA : pas de connaissance sous le brouillard), et on ne
 * l'emprunte que si la couche d'arrivée garde des tuiles à découvrir.
 */
function unexploredThroughTeleport(
  map: NonNullable<GameState['map']>,
  explored: number[],
  from: GridPos,
): GridPos | null {
  const level = levelOf(from);
  const size = map.width * map.height;
  const hasUnexplored = (lvl: number): boolean => {
    for (let i = lvl * size; i < (lvl + 1) * size; i++) if (explored[i] === 0) return true;
    return false;
  };
  let best: GridPos | null = null;
  for (const obj of map.objects) {
    if (obj.type !== 'monolith') continue;
    if (levelOf(obj.pos) !== level) continue;
    if (explored[tileIndex(map, obj.pos)] === 0) continue;
    const exit = map.objects.find(
      (o) => o.type === 'monolith' && o.pairId === obj.pairId && o.id !== obj.id,
    );
    if (!exit || levelOf(exit.pos) === level) continue;
    if (!hasUnexplored(levelOf(exit.pos))) continue;
    // Départage déterministe : la bouche la plus proche, puis l'id le plus petit.
    const d = Math.max(Math.abs(obj.pos.x - from.x), Math.abs(obj.pos.y - from.y));
    const bestD = best ? Math.max(Math.abs(best.x - from.x), Math.abs(best.y - from.y)) : Infinity;
    if (d < bestD) best = { ...obj.pos };
  }
  return best;
}

/** Un pas vers l'inexploré le plus proche, si abordable (priorité 5, exploration). */
function pickExplorationStep(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  blocked: GridPos[],
): GridPos[] | null {
  const { map, config } = draft;
  if (!map || !config) return null;
  // La couche du héros d'abord ; à défaut, une bouche de téléporteur qui mène
  // à une couche encore sous le brouillard (L10.5).
  const target =
    nearestUnexploredTile(map, config, player.explored, hero.pos) ??
    unexploredThroughTeleport(map, player.explored, hero.pos);
  if (!target) return null;
  const path = findPath(config, map, hero.pos, target, blocked);
  const first = path?.[0];
  if (!first || stepCost(config, map, hero.pos, first) > hero.movementPoints) return null;
  return [first];
}

/**
 * L'IA d'aventure résout le combat de gardien immédiatement (IA vs IA,
 * déterministe) : elle passe `runAutoCombat` en `onCombatEngaged` à la
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
    onCombatEngaged: () => runAutoCombat(draft, events),
    // L'IA résout le trésor sur-le-champ : toujours l'or (déterministe, MVP).
    onTreasureFound: () => resolveTreasure(draft, 'gold', events),
    // L'IA résout un message à choix sur-le-champ : option 0 (déterministe, MVP).
    onTriggerChoice: () => resolveTriggerChoice(draft, 0, events),
  });
}

function captureTown(draft: GameState, town: TownState, player: PlayerState, events: GameEvent[]): void {
  const cmd = { type: 'CaptureTown' as const, townId: town.id, playerId: player.id };
  if (validateCaptureTown(draft, cmd)) return; // garde-fou : ne devrait jamais être invalide ici
  handleCaptureTown(draft, cmd, events);
  // B7 (revue 2026-07) : une ville à garnison vide mais Fort ≥ 3 (tour de tir)
  // ouvre quand même un siège — l'IA le résout sur-le-champ, comme le chemin de
  // déplacement (`advanceAi`). Sans ça, `AiTurn` sortait par la garde
  // `if (draft.combat)` SANS `EndTurn` et laissait son combat au joueur humain.
  if (draft.combat) runAutoCombat(draft, events);
}

/**
 * Équipe ce que le héros traîne dans son sac (H-ARTEQUIP) : le butin y est
 * routé au ramassage, et l'IA ne l'en sortait jamais — elle collectionnait des
 * artefacts sans en tirer un seul bonus. Parcours des cases de la dernière à la
 * première (les indices restants restent valides après retrait) ; un artefact
 * refusé (emplacement typé déjà pris, 10 slots pleins) n'empêche pas les autres.
 */
function equipBackpack(draft: GameState, hero: HeroState): void {
  for (let index = (hero.backpack?.length ?? 0) - 1; index >= 0; index--) {
    const cmd = { type: 'EquipArtifact' as const, heroId: hero.id, index };
    if (validateEquipArtifact(draft, cmd)) continue;
    handleEquipArtifact(draft, cmd);
  }
}

function playHeroTurn(draft: GameState, hero: HeroState, player: PlayerState, events: GameEvent[]): void {
  if (!draft.map || !draft.config || hero.movementPoints <= 0 || draft.combat) return;
  // Le héros embarque d'abord la garnison de la ville où il se trouve : il part
  // en campagne avec les recrues de la veille plutôt que de les laisser dormir.
  const homeTown = draft.towns.find((t) => t.ownerPlayerId === player.id && samePos(t.pos, hero.pos));
  if (homeTown) tryGarrisonPickup(draft, homeTown, events);
  // Fouille sur place avant tout déplacement (la journée y passe).
  tryDigGrail(draft, hero, player, events);
  if (hero.movementPoints <= 0) return;
  // Garde : tant que la ville qu'il occupe reste menacée, le héros ne bouge pas —
  // il en est le seul rempart mobile (l'assaillant doit le battre avant de capturer).
  if (holdsThreatenedTown(draft, hero, player)) return;
  // Marche forcée & co : plus de PM AVANT de choisir un objectif (les pickers
  // écartent les cibles hors de portée du jour).
  tryCastAdventureSpell(draft, hero, player, ['movementBonus'], events);
  const blocked = draft.heroes.filter((h) => h.id !== hero.id).map((h) => h.pos);
  // B5 : les gardiens NON ciblés sont des obstacles de pathfinding — l'IA ne route
  // pas au travers (sinon interceptions non planifiées à marge < 1,5×).
  const guardianPos = draft.map.objects.filter((o) => o.type === 'guardian').map((o) => o.pos);
  // Coût de pas minimal de la carte, calculé UNE fois : sert de borne inférieure
  // O(1) aux pré-filtres des pickers pour écarter les cibles hors de portée du
  // jour AVANT tout A* — évite le fan-out `O(cibles × A*)` qui gelait l'onglet
  // sur grande carte (plan `.claude/plans/ai-turn-non-blocking.md`).
  const minStep = minStepCost(draft.config);

  // Priorité 0 : une ville à moi va tomber — rien ne passe avant.
  const defense = pickTownDefenseTarget(draft, hero, player, [...blocked, ...guardianPos], minStep);
  if (defense) {
    advanceAi(draft, hero, player, defense.path, events);
    return;
  }

  const resource = pickResourceTarget(draft, hero, player, [...blocked, ...guardianPos], minStep);
  if (resource) {
    advanceAi(draft, hero, player, resource.path, events);
    return;
  }

  // Le Graal révélé vaut mieux qu'un gardien : le bâtiment qu'il ouvre pèse sur
  // toute la partie. Le déplacement y mène, la fouille suit (au tour d'après si
  // le voyage a mangé tous les PM).
  const grail = pickGrailTarget(draft, hero, player, [...blocked, ...guardianPos], minStep);
  if (grail) {
    advanceAi(draft, hero, player, grail.path, events);
    tryDigGrail(draft, hero, player, events);
    return;
  }

  // Priorité 2 (H-VS-H) : marcher sur un héros ennemi battable ⇒ combat auto.
  const enemyHero = pickEnemyHeroTarget(draft, hero, player, [...blocked, ...guardianPos], minStep);
  if (enemyHero) {
    advanceAi(draft, hero, player, enemyHero.path, events);
    return;
  }

  // Priorité 3 : rentrer chercher la garnison qui s'accumule dans ma ville.
  const pickup = pickGarrisonPickupTarget(draft, hero, player, [...blocked, ...guardianPos], minStep);
  if (pickup) {
    advanceAi(draft, hero, player, pickup.path, events);
    return;
  }

  const guardian = pickGuardianTarget(draft, hero, player, blocked, guardianPos, minStep);
  if (guardian) {
    advanceAi(draft, hero, player, guardian.path, events);
    return;
  }

  const town = pickAdjacentCapturableTown(draft, hero, player);
  if (town) {
    captureTown(draft, town, player, events);
    return;
  }

  // Plus aucun objectif : ce n'est pas forcément qu'il n'y a rien — l'IA ne cible
  // que ce qu'elle a exploré (B31). Vision/Cartographie ouvrent le brouillard, et
  // on redonne UNE chance au ramassage avant de se rabattre sur l'exploration.
  if (tryCastAdventureSpell(draft, hero, player, ['vision', 'revealMap'], events)) {
    const revealed = pickResourceTarget(draft, hero, player, [...blocked, ...guardianPos], minStep);
    if (revealed) {
      advanceAi(draft, hero, player, revealed.path, events);
      return;
    }
  }

  const exploreStep = pickExplorationStep(draft, hero, player, [...blocked, ...guardianPos]);
  if (exploreStep) advanceAi(draft, hero, player, exploreStep, events);
}
