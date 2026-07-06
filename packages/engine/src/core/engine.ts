import { produce } from 'immer';
import { dailyMovementPoints } from '../adventure/config';
import { createFog, revealAround } from '../adventure/fog';
import { inBounds, isAdjacent, samePos, type GridPos } from '../adventure/map';
import { advanceHeroAlongPath } from '../adventure/movement';
import { isPassable, stepCost } from '../adventure/path';
import {
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
  assignHuntContracts,
  handleBuildStructure,
  handleCaptureTown,
  handleGarrisonTransfer,
  handleRecruitUnits,
  handleTradeResources,
  resetBuiltToday,
  validateBuildStructure,
  validateCaptureTown,
  validateGarrisonTransfer,
  validateRecruitUnits,
  validateTradeResources,
  validateUpgradeUnits,
  handleUpgradeUnits,
} from '../town';
import {
  handleCastSpell,
  handleChooseSkill,
  validateCastSpell,
  validateChooseSkill,
} from '../hero';
import { heroManaMax } from '../hero/artifacts';
import { heroGoldPerDay, heroMovementBonus, heroVisionBonus } from '../hero/skills';
import { evaluateOutcome, tickTownGrace } from '../scenario/outcome';
import { fireDayTriggers } from '../adventure/triggers';
import { runAiTurn } from '../ai/adventure';
import { EngineError, type Command, type CommandError } from './commands';
import type { GameEvent } from './events';
import { seedRng } from './rng';
import { RESOURCE_IDS, weekOf, type GameState } from './state';

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

/**
 * PM quotidiens du héros : base (doc 02 §1.5) modulés par la Logistique
 * (`movementBonusPct`, compétence — décision plan phase-3.2 #5). Sans
 * compétence : bonus 0 ⇒ valeur de base inchangée (golden intact).
 */
function heroDailyMovement(draft: Draft, hero: GameState['heroes'][number]): number {
  if (!draft.config) return 0;
  const base = dailyMovementPoints(draft.config, hero.army, draft.unitCatalog);
  return Math.round(base * (1 + heroMovementBonus(hero, draft.skillCatalog) / 100));
}

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

/** Commandes de jeu bloquées une fois `outcome` posé (doc 02 §6) — `StartGame` reste autorisé. */
const GAME_OVER_BLOCKED = new Set<Command['type']>([
  'MoveHero',
  'EndTurn',
  'StartCombat',
  'CombatAction',
  'AutoCombat',
  'BuildStructure',
  'RecruitUnits',
  'UpgradeUnits',
  'GarrisonTransfer',
  'CaptureTown',
  'TradeResources',
  'CastSpell',
  'ChooseSkill',
  'AiTurn',
]);

export function validate(state: GameState, cmd: Command): CommandError | null {
  if (state.outcome !== null && GAME_OVER_BLOCKED.has(cmd.type))
    return { code: 'gameOver', message: 'la partie est terminée' };
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
      const pathErr = validatePath(state, hero.pos, cmd.path, hero.movementPoints, cmd.heroId);
      if (pathErr) return pathErr;
      // Remédiation R1 (E1) : engager un gardien avec une armée vide fait
      // boucler puis planter l'IA de combat (`beginGuardianCombat` n'a pas le
      // garde-fou de `validateStartCombat`). Refus explicite en amont — le pas
      // gardé n'est autorisé qu'en dernière position (cf. `validatePath`).
      const last = cmd.path[cmd.path.length - 1];
      const engagesGuardian =
        !!last && (state.map?.objects.some((o) => o.type === 'guardian' && samePos(o.pos, last)) ?? false);
      if (engagesGuardian && hero.army.reduce((n, s) => n + s.count, 0) === 0)
        return { code: 'invalidArmy', message: 'armée vide : impossible d’engager un gardien' };
      return null;
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
    case 'UpgradeUnits': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateUpgradeUnits(state, cmd);
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
    case 'TradeResources': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateTradeResources(state, cmd);
    }
    case 'CastSpell': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateCastSpell(state, cmd);
    }
    case 'ChooseSkill': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateChooseSkill(state, cmd);
    }
    case 'AiTurn': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      const current = state.players[state.currentPlayer];
      if (!current || current.id !== cmd.playerId)
        return { code: 'notYourTurn', message: `ce n’est pas le tour de ${cmd.playerId}` };
      if (current.controller !== 'ai')
        return { code: 'invalidAction', message: `'${cmd.playerId}' n’est pas un joueur IA` };
      return null;
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
    draft.spellCatalog = cmd.spellCatalog ?? {};
    draft.skillCatalog = cmd.skillCatalog ?? {};
    draft.artifactCatalog = cmd.artifactCatalog ?? {};
    draft.factionCatalog = cmd.factionCatalog ?? {};
    draft.scenario = cmd.scenario ?? null;
    draft.outcome = null;
    draft.towns = (cmd.towns ?? []).map((t) => ({
      ...t,
      buildings: { ...t.buildings },
      garrison: t.garrison.map((s) => ({ ...s })),
      stock: { ...t.stock },
    }));
    draft.players = cmd.players.map((p) => ({
      id: p.id,
      resources: { ...p.startingResources },
      factionResources: {},
      explored: createFog(cmd.map),
      controller: p.controller ?? 'human',
      eliminated: false,
      // Minuteur de reprise désarmé (-1) tant que le joueur n'a pas de ville de
      // départ ; 0 (armé, possède) sinon (doc 02 §4.1).
      townlessDays: (cmd.towns ?? []).some((t) => t.ownerPlayerId === p.id) ? 0 : -1,
      huntContract: null,
    }));
    // Un héros par joueur à sa position de départ, armée de scénario (doc 02 §1.5, §5.1).
    draft.heroes = cmd.players.map((p, i) => ({
      id: `hero-${p.id}`,
      playerId: p.id,
      pos: cmd.map.startPositions[i] as GridPos,
      // PM/mana posés dans la boucle suivante (nécessitent l'objet héros complet).
      movementPoints: 0,
      army: (p.startingArmy ?? []).map((s) => ({ ...s })),
      // Progression (doc 02 §1.2) — attributs de base fournis par le scénario (défaut 0).
      xp: 0,
      level: 1,
      attributes: p.startingAttributes
        ? { ...p.startingAttributes }
        : { attack: 0, defense: 0, power: 0, knowledge: 0 },
      // Magie/compétences/artefacts (doc 02 §1.1–§1.4) — mana = Savoir × 10 + artefacts.
      mana: 0,
      manaMax: 0,
      skills: {},
      // Sorts connus d'emblée (cercle ≤ Guilde MVP), résolus par le contenu (décision 3.2 #7).
      spells: p.startingSpells ? [...p.startingSpells] : [],
      artifacts: Array.from({ length: 10 }, (_, i) => (cmd.startingArtifacts ?? [])[i] ?? null),
      pendingSkillChoices: [],
      factionId: p.startingFactionId ?? '',
    }));
    for (const hero of draft.heroes) {
      hero.manaMax = heroManaMax(hero, draft.artifactCatalog);
      hero.mana = hero.manaMax;
      hero.movementPoints = heroDailyMovement(draft, hero);
      const player = draft.players.find((p) => p.id === hero.playerId);
      if (player)
        revealAround(
          player.explored,
          cmd.map,
          hero.pos,
          cmd.config.visionRadius + heroVisionBonus(hero, draft.skillCatalog),
        );
    }
    events.push({ type: 'GameStarted', seed: cmd.seed, playerIds: cmd.players.map((p) => p.id) });
    events.push({ type: 'DayStarted', day: 1 });
    events.push({ type: 'WeekStarted', week: 1 });
    // Stock des habitations et revenu ne s'appliquent qu'aux transitions
    // (WeekStarted / DayStarted) via EndTurn — l'état de départ est « vide ».
  },

  MoveHero(draft, cmd, events) {
    const hero = draft.heroes.find((h) => h.id === cmd.heroId);
    const player = draft.players.find((p) => hero && p.id === hero.playerId);
    if (!hero || !player || !draft.map || !draft.config) return; // exclu par validate
    // Logique de pas partagée avec l'IA d'aventure (cf. `adventure/movement`).
    // Le joueur humain ne résout pas le combat de gardien ici : l'interception
    // laisse `draft.combat` posé pour un combat interactif.
    advanceHeroAlongPath(draft, hero, player, cmd.path, events);
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

  UpgradeUnits(draft, cmd, events) {
    handleUpgradeUnits(draft, cmd, events);
  },

  GarrisonTransfer(draft, cmd, events) {
    handleGarrisonTransfer(draft, cmd, events);
  },

  CaptureTown(draft, cmd, events) {
    handleCaptureTown(draft, cmd, events);
  },

  TradeResources(draft, cmd, events) {
    handleTradeResources(draft, cmd, events);
  },

  CastSpell(draft, cmd, events) {
    handleCastSpell(draft, cmd, events);
  },

  ChooseSkill(draft, cmd, events) {
    handleChooseSkill(draft, cmd, events);
  },

  EndTurn(draft, cmd, events) {
    events.push({ type: 'TurnEnded', playerId: cmd.playerId });
    draft.currentPlayer += 1;
    if (draft.currentPlayer >= draft.players.length) {
      // Un jour = un tour de chaque joueur (doc 02 §2.3).
      draft.currentPlayer = 0;
      draft.calendar.day += 1;
      if (draft.config) {
        // Points de mouvement quotidiens restaurés (doc 02 §1.5), modulés Logistique.
        for (const hero of draft.heroes) {
          hero.movementPoints = heroDailyMovement(draft, hero);
        }
      }
      events.push({ type: 'DayStarted', day: draft.calendar.day });
      // Économie des villes : 1 build/jour réarmé, revenu quotidien (doc 02 §4.1).
      resetBuiltToday(draft);
      applyDailyIncome(draft, events);
      // Économie (compétence héros, décision plan phase-3.2 #5) : or/jour supplémentaire.
      for (const hero of draft.heroes) {
        const gold = heroGoldPerDay(hero, draft.skillCatalog);
        if (gold <= 0) continue;
        const player = draft.players.find((p) => p.id === hero.playerId);
        if (!player) continue;
        player.resources.gold += gold;
        events.push({ type: 'TownIncome', playerId: player.id, resource: 'gold', amount: gold });
      }
      const week = weekOf(draft.calendar.day);
      if (week !== weekOf(draft.calendar.day - 1)) {
        events.push({ type: 'WeekStarted', week });
        applyWeeklyGrowth(draft, events); // croissance hebdo des habitations
        // Contrats de chasse (doc 05 §3.3) : cible neutre hebdomadaire assignée
        // au propriétaire d'un bâtiment `huntContract`.
        assignHuntContracts(draft, events);
      }
      // Triggers de carte « onDay » (doc 02 §2.1) puis avancée de la grâce de
      // reprise de ville (doc 02 §4.1) — une fois par jour, avant l'évaluation.
      fireDayTriggers(draft, events);
      tickTownGrace(draft);
    }
    // Conditions de victoire/défaite (doc 02 §6, plan phase-3.5) — no-op hors scénario.
    evaluateOutcome(draft, events);
  },

  AiTurn(draft, cmd, events) {
    // L'IA joue toutes ses actions (héros + villes, combats résolus en auto),
    // puis le tour est passé comme un EndTurn normal (doc 11 §3.5). Le driver
    // (client / test) reboucle tant que le joueur courant est une IA.
    runAiTurn(draft, cmd.playerId, events);
    if (draft.combat || draft.outcome) return; // sécurité : combat resté ouvert / partie finie
    handlers.EndTurn(draft, { type: 'EndTurn', playerId: cmd.playerId }, events);
  },
};
