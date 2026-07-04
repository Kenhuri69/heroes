import { produce } from 'immer';
import { dailyMovementPoints } from '../adventure/config';
import { createFog, revealAround } from '../adventure/fog';
import { inBounds, isAdjacent, samePos, type GridPos } from '../adventure/map';
import { isPassable, stepCost } from '../adventure/path';
import {
  beginGuardianCombat,
  handleAutoCombat,
  handleCombatAction,
  handleStartCombat,
  validateAutoCombat,
  validateCombatAction,
  validateStartCombat,
} from '../combat';
import {
  applyDailyIncome,
  applyWeeklyGrowth,
  handleBuildStructure,
  handleCaptureTown,
  handleGarrisonTransfer,
  handleRecruitUnits,
  resetBuiltToday,
  validateBuildStructure,
  validateCaptureTown,
  validateGarrisonTransfer,
  validateRecruitUnits,
} from '../town';
import { EngineError, type Command, type CommandError } from './commands';
import type { GameEvent } from './events';
import { seedRng } from './rng';
import { RESOURCE_IDS, weekOf, type GameState, type ResourceId } from './state';

export interface EngineResult {
  state: GameState;
  events: GameEvent[];
}

type Draft = GameState;
type Handlers = {
  [K in Command['type']]: (
    draft: Draft,
    cmd: Extract<Command, { type: K }>,
    events: GameEvent[],
  ) => void;
};

/** Règle d'or (doc 07 §2) : fonction pure (état, commande) → état + événements. */
export function apply(state: GameState, cmd: Command): EngineResult {
  const err = validate(state, cmd);
  if (err) throw new EngineError(err);
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    handlers[cmd.type](draft, cmd as never, events);
  });
  return { state: next, events };
}

export function validate(state: GameState, cmd: Command): CommandError | null {
  switch (cmd.type) {
    case 'StartGame': {
      if (state.started)
        return { code: 'gameAlreadyStarted', message: 'la partie est déjà démarrée' };
      if (cmd.players.length === 0)
        return { code: 'noPlayers', message: 'au moins un joueur est requis' };
      if (new Set(cmd.players.map((p) => p.id)).size !== cmd.players.length)
        return { code: 'duplicatePlayerId', message: 'IDs de joueurs en double' };
      for (const p of cmd.players) {
        const army = p.startingArmy ?? [];
        if (army.length > 7)
          return { code: 'invalidArmy', message: `armée de ${p.id} : plus de 7 piles` };
        for (const stack of army) {
          if (!(stack.unitId in cmd.unitCatalog) || stack.count <= 0)
            return { code: 'invalidArmy', message: `armée de ${p.id} : pile invalide '${stack.unitId}'` };
        }
      }
      return validateMap(cmd);
    }
    case 'MoveHero': {
      if (!state.started)
        return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat)
        return { code: 'combatActive', message: 'un combat est en cours' };
      const hero = state.heroes.find((h) => h.id === cmd.heroId);
      if (!hero) return { code: 'unknownHero', message: `héros inconnu '${cmd.heroId}'` };
      const current = state.players[state.currentPlayer];
      if (!current || hero.playerId !== current.id)
        return { code: 'notYourHero', message: `'${cmd.heroId}' n’appartient pas au joueur actif` };
      return validatePath(state, hero.pos, cmd.path, hero.movementPoints, cmd.heroId);
    }
    case 'EndTurn': {
      if (!state.started)
        return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat)
        return { code: 'combatActive', message: 'un combat est en cours' };
      const current = state.players[state.currentPlayer];
      if (!current || current.id !== cmd.playerId)
        return { code: 'notYourTurn', message: `ce n’est pas le tour de ${cmd.playerId}` };
      return null;
    }
    case 'StartCombat': {
      if (!state.started)
        return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat)
        return { code: 'combatActive', message: 'un combat est déjà en cours' };
      return validateStartCombat(state, cmd);
    }
    case 'CombatAction': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateCombatAction(state, cmd);
    }
    case 'AutoCombat': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateAutoCombat(state);
    }
    case 'BuildStructure': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateBuildStructure(state, cmd);
    }
    case 'RecruitUnits': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateRecruitUnits(state, cmd);
    }
    case 'GarrisonTransfer': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateGarrisonTransfer(state, cmd);
    }
    case 'CaptureTown': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateCaptureTown(state, cmd);
    }
  }
}

/** Cohérence de la carte embarquée — le contenu a déjà validé, le moteur re-vérifie le minimum. */
function validateMap(cmd: Extract<Command, { type: 'StartGame' }>): CommandError | null {
  const { map, config, players } = cmd;
  const bad = (message: string): CommandError => ({ code: 'invalidMap', message });
  const size = map.width * map.height;
  if (map.width <= 0 || map.height <= 0 || map.terrain.length !== size || map.road.length !== size)
    return bad(`dimensions incohérentes (${map.width}×${map.height})`);
  for (const id of map.terrain) {
    if (!(id in config.terrains)) return bad(`terrain inconnu de la config '${id}'`);
  }
  if (map.startPositions.length < players.length)
    return bad(`${players.length} joueurs pour ${map.startPositions.length} positions de départ`);
  for (const pos of map.startPositions) {
    if (!isPassable(config, map, pos))
      return bad(`position de départ infranchissable (${pos.x},${pos.y})`);
  }
  const objectIds = new Set<string>();
  for (const obj of map.objects) {
    if (!inBounds(map, obj.pos)) return bad(`objet '${obj.id}' hors carte`);
    if (objectIds.has(obj.id)) return bad(`ID d'objet en double '${obj.id}'`);
    objectIds.add(obj.id);
    if (obj.type === 'resource') {
      if (!(RESOURCE_IDS as readonly string[]).includes(obj.resource))
        return bad(`objet '${obj.id}' : ressource inconnue '${obj.resource}'`);
      if (obj.amount <= 0) return bad(`objet '${obj.id}' : montant non positif`);
    } else {
      if (!(obj.unitId in cmd.unitCatalog))
        return bad(`gardien '${obj.id}' : unité inconnue du catalogue '${obj.unitId}'`);
      if (obj.count <= 0) return bad(`gardien '${obj.id}' : effectif non positif`);
    }
  }
  return null;
}

/** Chaque pas doit être adjacent (8 dir), franchissable et libre — le moteur ne fait pas confiance au client. */
function validatePath(
  state: GameState,
  start: GridPos,
  path: GridPos[],
  movementPoints: number,
  heroId: string,
): CommandError | null {
  const { map, config } = state;
  if (!map || !config) return { code: 'gameNotStarted', message: 'carte absente de l’état' };
  if (path.length === 0) return { code: 'invalidPath', message: 'chemin vide' };
  let prev = start;
  for (const step of path) {
    if (!isAdjacent(prev, step))
      return { code: 'invalidPath', message: `pas non adjacent (${step.x},${step.y})` };
    if (!isPassable(config, map, step))
      return { code: 'invalidPath', message: `tuile infranchissable (${step.x},${step.y})` };
    if (state.heroes.some((h) => h.id !== heroId && samePos(h.pos, step)))
      return { code: 'invalidPath', message: `tuile occupée (${step.x},${step.y})` };
    // Gardien : uniquement en DERNIER pas (attaque ⇒ interception, doc 02 §5).
    if (
      map.objects.some((o) => o.type === 'guardian' && samePos(o.pos, step)) &&
      step !== path[path.length - 1]
    )
      return { code: 'invalidPath', message: `tuile gardée (${step.x},${step.y})` };
    prev = step;
  }
  const first = path[0];
  if (first && stepCost(config, map, start, first) > movementPoints)
    return { code: 'noMovementPoints', message: 'points de mouvement insuffisants' };
  return null;
}

const handlers: Handlers = {
  StartGame(draft, cmd, events) {
    draft.started = true;
    draft.rng = seedRng(cmd.seed);
    draft.calendar.day = 1;
    draft.currentPlayer = 0;
    draft.config = cmd.config;
    draft.map = cmd.map;
    draft.unitCatalog = cmd.unitCatalog;
    draft.buildingCatalog = cmd.buildingCatalog ?? {};
    draft.towns = (cmd.towns ?? []).map((t) => ({
      ...t,
      buildings: { ...t.buildings },
      garrison: t.garrison.map((s) => ({ ...s })),
      stock: { ...t.stock },
    }));
    draft.players = cmd.players.map((p) => ({
      id: p.id,
      resources: { ...p.startingResources },
      explored: createFog(cmd.map),
    }));
    // Un héros par joueur à sa position de départ, armée de scénario (doc 02 §1.5, §5.1).
    draft.heroes = cmd.players.map((p, i) => ({
      id: `hero-${p.id}`,
      playerId: p.id,
      pos: cmd.map.startPositions[i] as GridPos,
      movementPoints: dailyMovementPoints(cmd.config, p.startingArmy ?? [], cmd.unitCatalog),
      army: (p.startingArmy ?? []).map((s) => ({ ...s })),
      // Progression (doc 02 §1.2) — attributs de base par classe : MVP.
      xp: 0,
      level: 1,
      attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    }));
    for (const hero of draft.heroes) {
      const player = draft.players.find((p) => p.id === hero.playerId);
      if (player) revealAround(player.explored, cmd.map, hero.pos, cmd.config.visionRadius);
    }
    events.push({ type: 'GameStarted', seed: cmd.seed, playerIds: cmd.players.map((p) => p.id) });
    events.push({ type: 'DayStarted', day: 1 });
    events.push({ type: 'WeekStarted', week: 1 });
    // Stock des habitations et revenu ne s'appliquent qu'aux transitions
    // (WeekStarted / DayStarted) via EndTurn — l'état de départ est « vide ».
  },

  MoveHero(draft, cmd, events) {
    const hero = draft.heroes.find((h) => h.id === cmd.heroId);
    const map = draft.map;
    const config = draft.config;
    const player = draft.players.find((p) => hero && p.id === hero.playerId);
    if (!hero || !map || !config || !player) return; // exclu par validate
    for (const step of cmd.path) {
      const cost = stepCost(config, map, hero.pos, step);
      // Le chemin peut couvrir plusieurs jours (prévisualisation) : on
      // s'arrête quand les points du jour ne suffisent plus (doc 02 §1.5).
      if (cost > hero.movementPoints) break;
      // Gardien sur le pas : interception ⇒ combat, le héros n'entre PAS sur
      // la tuile (décision plan phase-2.4) mais paie le pas d'engagement.
      const guardian = map.objects.find((o) => o.type === 'guardian' && samePos(o.pos, step));
      if (guardian) {
        hero.movementPoints -= cost;
        beginGuardianCombat(draft, hero.id, guardian.id, events);
        return;
      }
      const from = { ...hero.pos };
      hero.movementPoints -= cost;
      hero.pos = { ...step };
      revealAround(player.explored, map, hero.pos, config.visionRadius);
      events.push({
        type: 'MoveStepped',
        heroId: hero.id,
        from,
        to: { ...step },
        movementPointsLeft: hero.movementPoints,
      });
      // Interception = arrêt standard HoMM (doc 08 §2.1) — ramassage instantané (doc 02 §2.2).
      const objIndex = map.objects.findIndex(
        (o) => o.type === 'resource' && samePos(o.pos, hero.pos),
      );
      if (objIndex !== -1) {
        const obj = map.objects[objIndex];
        if (obj && obj.type === 'resource') {
          player.resources[obj.resource as ResourceId] += obj.amount;
          map.objects.splice(objIndex, 1);
          events.push({
            type: 'ResourcePicked',
            heroId: hero.id,
            playerId: player.id,
            objectId: obj.id,
            resource: obj.resource,
            amount: obj.amount,
            pos: { ...hero.pos },
          });
        }
        break;
      }
    }
  },

  StartCombat(draft, cmd, events) {
    handleStartCombat(draft, cmd, events);
  },

  CombatAction(draft, cmd, events) {
    handleCombatAction(draft, cmd, events);
  },

  AutoCombat(draft, _cmd, events) {
    handleAutoCombat(draft, events);
  },

  BuildStructure(draft, cmd, events) {
    handleBuildStructure(draft, cmd, events);
  },

  RecruitUnits(draft, cmd, events) {
    handleRecruitUnits(draft, cmd, events);
  },

  GarrisonTransfer(draft, cmd, events) {
    handleGarrisonTransfer(draft, cmd, events);
  },

  CaptureTown(draft, cmd, events) {
    handleCaptureTown(draft, cmd, events);
  },

  EndTurn(draft, cmd, events) {
    events.push({ type: 'TurnEnded', playerId: cmd.playerId });
    draft.currentPlayer += 1;
    if (draft.currentPlayer < draft.players.length) return;
    // Un jour = un tour de chaque joueur (doc 02 §2.3).
    draft.currentPlayer = 0;
    draft.calendar.day += 1;
    if (draft.config) {
      // Points de mouvement quotidiens restaurés (doc 02 §1.5).
      for (const hero of draft.heroes) {
        hero.movementPoints = dailyMovementPoints(draft.config, hero.army, draft.unitCatalog);
      }
    }
    events.push({ type: 'DayStarted', day: draft.calendar.day });
    // Économie des villes : 1 build/jour réarmé, revenu quotidien (doc 02 §4.1).
    resetBuiltToday(draft);
    applyDailyIncome(draft, events);
    const week = weekOf(draft.calendar.day);
    if (week !== weekOf(draft.calendar.day - 1)) {
      events.push({ type: 'WeekStarted', week });
      applyWeeklyGrowth(draft, events); // croissance hebdo des habitations
    }
  },
};
