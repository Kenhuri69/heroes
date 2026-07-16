import { produce } from 'immer';
import { dailyMovementPoints } from '../adventure/config';
import { createFog, revealAround } from '../adventure/fog';
import { inBounds, isAdjacent, samePos, type GridPos } from '../adventure/map';
import { advanceHeroAlongPath } from '../adventure/movement';
import { revealOwnedStructures } from '../adventure/vision';
import { handleHeroAttack, validateHeroAttack } from '../combat/hero-attack';
import { handleHeroRally, validateHeroRally } from '../combat/hero-rally';
import {
  handleFinishPlacement,
  handlePlaceStack,
  validateFinishPlacement,
  validatePlaceStack,
} from '../combat/setup';
import { handleAbandon, handleRetreat, handleSurrender, validateAbandon, validateRetreat, validateSurrender } from '../combat/leave';
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
  townBuildingAura,
  handleBuildStructure,
  handleCaptureTown,
  handleGarrisonTransfer,
  handleSendCaravan,
  tickCaravans,
  handleRecruitUnits,
  handleTradeResources,
  resetBuiltToday,
  validateBuildStructure,
  validateCaptureTown,
  validateGarrisonTransfer,
  validateSendCaravan,
  validateRecruitUnits,
  validateTradeResources,
  validateUpgradeUnits,
  handleUpgradeUnits,
  validateBuyWarMachine,
  handleBuyWarMachine,
  validateChooseSharedGrowth,
  handleChooseSharedGrowth,
} from '../town';
import { learnGuildSpellsAtTown, rollGuildSpells } from '../town/mage-guild';
import {
  handleCastSpell,
  handleCastAdventureSpell,
  handleChooseSkill,
  handleChooseAttribute,
  handleReorderArmy,
  handleSplitStack,
  validateCastSpell,
  validateCastAdventureSpell,
  validateChooseSkill,
  validateChooseAttribute,
  validateReorderArmy,
  validateSplitStack,
} from '../hero';
import { heroArtifactBonus, heroManaMax } from '../hero/artifacts';
import { validateRecruitHero, handleRecruitHero } from '../hero/recruit';
import { validateTransferBetweenHeroes, handleTransferBetweenHeroes } from '../hero/transfer';
import {
  validateEquipArtifact,
  validateUnequipArtifact,
  applyEquipArtifact,
  applyUnequipArtifact,
} from '../hero/equip';
import { heroGoldPerDay, heroMovementBonus, heroVisionRadius } from '../hero/skills';
import { resolveTreasure } from '../adventure/treasure';
import { roamGuardians } from '../adventure/roam';
import { evaluateOutcome, tickTownGrace } from '../scenario/outcome';
import { evaluateQuests } from '../quest/evaluate';
import { validateAddQuests, handleAddQuests } from '../quest/add';
import { fireDayTriggers } from '../adventure/triggers';
import { runAiTurn } from '../ai/adventure';
import { EngineError, type Command, type CommandError } from './commands';
import type { GameEvent } from './events';
import { seedRng } from './rng';
import { rollWeekEvent } from '../adventure/calendar';
import { grantXp } from '../adventure/experience';
import { RESOURCE_IDS, weekOf, monthOf, areAllies, type GameState, type ResourceId } from './state';

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
 * (`movementBonusPct`, compétence — décision plan phase-3.2 #5), puis bonus plat
 * d'**aura de bâtiment** (F-BUILDEFF.1, doc 03 §4 — Écuries : +PM/jour au héros
 * qui commence son tour dans la ville). Sans compétence ni aura : bonus 0 ⇒
 * valeur de base inchangée (golden intact). Exporté (revue 2026-07, B29) : le
 * recrutement de héros à la Taverne pose les PM du jour avec le même calcul.
 */
export function heroDailyMovement(draft: GameState, hero: GameState['heroes'][number]): number {
  if (!draft.config) return 0;
  const base = dailyMovementPoints(draft.config, hero.army, draft.unitCatalog);
  const scaled = Math.round(base * (1 + heroMovementBonus(hero, draft.skillCatalog) / 100));
  // H-ARTEQUIP (doc 02 §1.5) : bottes de vitesse — PM plats d'artefacts équipés.
  const artifactMove = heroArtifactBonus(hero, draft.artifactCatalog).movementFlat;
  return scaled + townBuildingAura(draft, hero.playerId, hero.pos, 'movementBonusFlat') + artifactMove;
}

/** Règle d'or (doc 07 §2) : fonction pure (état, commande) → état + événements. */
export function apply(state: GameState, cmd: Command): EngineResult {
  const err = validate(state, cmd);
  if (err) throw new EngineError(err);
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    handlers[cmd.type](draft, cmd as never, events);
    // Point d'appel unique des quêtes (doc 13 §6.2, N2a) : toute commande qui
    // change l'état fait avancer les quêtes actives. No-op hors campagne.
    evaluateQuests(draft, events);
  });
  return { state: next, events };
}

/** Commandes de jeu bloquées une fois `outcome` posé (doc 02 §6) — `StartGame` reste autorisé. */
const GAME_OVER_BLOCKED = new Set<Command['type']>([
  'MoveHero',
  'EndTurn',
  'Dig',
  'StartCombat',
  'CombatAction',
  'AutoCombat',
  'BuildStructure',
  'RecruitUnits',
  'ChooseSharedGrowth',
  'UpgradeUnits',
  'BuyWarMachine',
  'GarrisonTransfer',
  'ReorderArmy',
  'SplitStack',
  'TransferBetweenHeroes',
  'EquipArtifact',
  'UnequipArtifact',
  'SendCaravan',
  'CaptureTown',
  'RecruitHero',
  'TradeResources',
  'CastSpell',
  'HeroAttack',
  'HeroRally',
  'PlaceStack',
  'FinishPlacement',
  'Retreat',
  'Surrender',
  'CastAdventureSpell',
  'ChooseSkill',
  'ChooseAttribute',
  'ResolveTreasure',
  'AiTurn',
  'AddQuests',
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
      // Revue 2026-07 (B28) : un héros du roster ne peut être vivant que chez un
      // seul joueur (invariant M-TAVERN.4, `rosterId` exclusif) — deux sièges ne
      // partagent pas un même `startingHeroId` nommé (vide/absent = générique, libre).
      const namedIds = cmd.players.map((p) => p.startingHeroId).filter((id): id is string => !!id);
      if (new Set(namedIds).size !== namedIds.length)
        return { code: 'duplicateStartingHero', message: 'startingHeroId en double entre joueurs' };
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
      if (state.pendingTreasure)
        return { code: 'treasurePending', message: 'un trésor attend son choix or/XP' };
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
      // H-VS-H : engager un héros ennemi avec une armée vide plante l'IA de combat
      // (`beginHeroCombat` = jumeau de `beginGuardianCombat`) — même garde-fou.
      const engagesEnemyHero =
        !!last && state.heroes.some((h) => h.id !== cmd.heroId && samePos(h.pos, last));
      if ((engagesGuardian || engagesEnemyHero) && hero.army.reduce((n, s) => n + s.count, 0) === 0)
        return { code: 'invalidArmy', message: 'armée vide : impossible d’engager un combat' };
      return null;
    }
    case 'EndTurn': {
      if (!state.started)
        return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat)
        return { code: 'combatActive', message: 'un combat est en cours' };
      if (state.pendingTreasure)
        return { code: 'treasurePending', message: 'un trésor attend son choix or/XP' };
      const current = state.players[state.currentPlayer];
      if (!current || current.id !== cmd.playerId)
        return { code: 'notYourTurn', message: `ce n’est pas le tour de ${cmd.playerId}` };
      return null;
    }
    case 'Dig': {
      // Fouille du Graal (T-GRAIL lot 2) : le héros du joueur actif, posé sur la
      // tuile du Graal et disposant encore de mouvement, obtient le Graal.
      if (!state.started)
        return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      if (state.pendingTreasure)
        return { code: 'treasurePending', message: 'un trésor attend son choix or/XP' };
      const hero = state.heroes.find((h) => h.id === cmd.heroId);
      if (!hero) return { code: 'unknownHero', message: `héros inconnu '${cmd.heroId}'` };
      const current = state.players[state.currentPlayer];
      if (!current || hero.playerId !== current.id)
        return { code: 'notYourHero', message: `'${cmd.heroId}' n’appartient pas au joueur actif` };
      if (current.hasGrail) return { code: 'alreadyHasGrail', message: 'le Graal est déjà possédé' };
      if (!state.map?.grailPos || !samePos(hero.pos, state.map.grailPos))
        return { code: 'notOnGrail', message: 'le héros n’est pas sur la tuile du Graal' };
      if (hero.movementPoints <= 0)
        return { code: 'noMovement', message: 'plus de mouvement pour fouiller aujourd’hui' };
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
      // Lot M4 : bornage de rounds optionnel — entier ≥ 1 quand présent.
      if (cmd.rounds !== undefined && (!Number.isInteger(cmd.rounds) || cmd.rounds < 1))
        return { code: 'invalidRounds', message: 'rounds doit être un entier ≥ 1' };
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
    case 'ChooseSharedGrowth': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateChooseSharedGrowth(state, cmd);
    }
    case 'UpgradeUnits': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateUpgradeUnits(state, cmd);
    }
    case 'BuyWarMachine': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateBuyWarMachine(state, cmd);
    }
    case 'GarrisonTransfer': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateGarrisonTransfer(state, cmd);
    }
    case 'ReorderArmy': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateReorderArmy(state, cmd);
    }
    case 'SplitStack': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateSplitStack(state, cmd);
    }
    case 'TransferBetweenHeroes': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateTransferBetweenHeroes(state, cmd);
    }
    case 'EquipArtifact': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateEquipArtifact(state, cmd);
    }
    case 'UnequipArtifact': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateUnequipArtifact(state, cmd);
    }
    case 'SendCaravan': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
      return validateSendCaravan(state, cmd);
    }
    case 'CaptureTown': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateCaptureTown(state, cmd);
    }
    case 'RecruitHero': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateRecruitHero(state, cmd);
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
    case 'HeroAttack': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateHeroAttack(state, cmd);
    }
    case 'HeroRally': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateHeroRally(state, cmd);
    }
    case 'PlaceStack': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validatePlaceStack(state, cmd);
    }
    case 'FinishPlacement': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateFinishPlacement(state);
    }
    case 'Retreat': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateRetreat(state);
    }
    case 'Surrender': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateSurrender(state);
    }
    case 'AbandonCombat': {
      if (!state.combat) return { code: 'noCombat', message: 'aucun combat en cours' };
      return validateAbandon(state);
    }
    case 'CastAdventureSpell': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateCastAdventureSpell(state, cmd);
    }
    case 'ChooseSkill': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateChooseSkill(state, cmd);
    }
    case 'ChooseAttribute': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      return validateChooseAttribute(state, cmd);
    }
    case 'ResolveTreasure': {
      if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      if (!state.pendingTreasure)
        return { code: 'noPendingChoice', message: 'aucun trésor en attente' };
      if (state.pendingTreasure.heroId !== cmd.heroId)
        return {
          code: 'invalidTarget',
          message: `le trésor en attente n’appartient pas à '${cmd.heroId}'`,
        };
      return null;
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
    case 'AddQuests':
      return validateAddQuests(state);
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
    if (obj.type === 'resource' || obj.type === 'mine') {
      if (!(RESOURCE_IDS as readonly string[]).includes(obj.resource))
        return bad(`objet '${obj.id}' : ressource inconnue '${obj.resource}'`);
      if (obj.amount <= 0) return bad(`objet '${obj.id}' : montant non positif`);
    } else if (obj.type === 'treasure') {
      if (obj.gold < 0 || obj.xp < 0 || obj.gold + obj.xp <= 0)
        return bad(`trésor '${obj.id}' : montants or/XP invalides`);
    } else if (obj.type === 'artifact') {
      if (!(obj.artifactId in (cmd.artifactCatalog ?? {})))
        return bad(`objet '${obj.id}' : artefact inconnu du catalogue '${obj.artifactId}'`);
    } else if (obj.type === 'visitable') {
      const e = obj.effect;
      if ((e.kind === 'luck' || e.kind === 'movement') && e.amount <= 0)
        return bad(`lieu '${obj.id}' : montant non positif`);
      if (e.kind === 'resource') {
        if (!(RESOURCE_IDS as readonly string[]).includes(e.resource))
          return bad(`lieu '${obj.id}' : ressource inconnue '${e.resource}'`);
        if (e.amount <= 0) return bad(`lieu '${obj.id}' : montant non positif`);
      }
    } else if (obj.type === 'dwelling') {
      if (!(obj.unitId in cmd.unitCatalog))
        return bad(`habitation '${obj.id}' : unité inconnue du catalogue '${obj.unitId}'`);
      if (obj.stock < 0) return bad(`habitation '${obj.id}' : stock négatif`);
    } else if (obj.type === 'monolith') {
      // Monolithe apparié (M-NAV a) : l'appariement 2-à-2 est validé au load du
      // contenu (`loadMap`) ; le moteur n'a rien de plus à vérifier ici.
    } else if (obj.type === 'obelisk') {
      // Obélisque (T-GRAIL) : objet neutre sans donnée à valider.
    } else {
      if (!(obj.unitId in cmd.unitCatalog))
        return bad(`gardien '${obj.id}' : unité inconnue du catalogue '${obj.unitId}'`);
      if (obj.count <= 0) return bad(`gardien '${obj.id}' : effectif non positif`);
      if (obj.roamRadius !== undefined && obj.roamRadius <= 0)
        return bad(`gardien '${obj.id}' : roamRadius non positif`);
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
  const mover = state.heroes.find((h) => h.id === heroId);
  const moverPlayer = state.players.find((p) => p.id === mover?.playerId);
  let prev = start;
  for (const step of path) {
    if (!isAdjacent(prev, step))
      return { code: 'invalidPath', message: `pas non adjacent (${step.x},${step.y})` };
    if (!isPassable(config, map, step))
      return { code: 'invalidPath', message: `tuile infranchissable (${step.x},${step.y})` };
    // Héros occupant : un héros ENNEMI (autre joueur, non allié) est ciblable en
    // DERNIER pas (combat héros-vs-héros, doc 02 §5, H-VS-H) ; un allié ou soi
    // bloque toujours (pas de superposition).
    const occupant = state.heroes.find((h) => h.id !== heroId && samePos(h.pos, step));
    if (occupant) {
      const occPlayer = state.players.find((p) => p.id === occupant.playerId);
      const enemy =
        !!moverPlayer &&
        !!occPlayer &&
        occupant.playerId !== mover?.playerId &&
        !areAllies(moverPlayer, occPlayer);
      if (!(enemy && step === path[path.length - 1]))
        return { code: 'invalidPath', message: `tuile occupée (${step.x},${step.y})` };
    }
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
    draft.calendar.weekEventId = null;
    draft.currentPlayer = 0;
    draft.config = cmd.config;
    // La commande EST le format de replay (doc 07 §3) — copie profonde
    // obligatoire : la carte embarquée est mutée dès ce handler
    // (`fireDayTriggers` pose `fired`), puis en jeu (gardiens, mines,
    // visites) ; sans copie, ces écritures muteraient `cmd.map` et
    // l'autoFreeze d'immer gèlerait la commande de l'appelant.
    draft.map = structuredClone(cmd.map);
    draft.unitCatalog = cmd.unitCatalog;
    draft.buildingCatalog = cmd.buildingCatalog ?? {};
    draft.spellCatalog = cmd.spellCatalog ?? {};
    draft.skillCatalog = cmd.skillCatalog ?? {};
    draft.artifactCatalog = cmd.artifactCatalog ?? {};
    draft.factionCatalog = cmd.factionCatalog ?? {};
    draft.houseCatalog = cmd.houseCatalog ?? {};
    draft.heroRoster = cmd.heroRoster ?? {};
    draft.growthGroups = cmd.growthGroups
      ? Object.fromEntries(Object.entries(cmd.growthGroups).map(([g, m]) => [g, [...m]]))
      : {};
    draft.scenario = cmd.scenario ?? null;
    draft.outcome = null;
    draft.pendingTreasure = null;
    draft.caravans = [];
    // Quêtes de campagne (doc 13 §6.2, N2a) — embarquées et actives d'emblée ;
    // le chaînage/déclencheurs viennent au lot contenu N2b.
    draft.quests = cmd.quests ?? null;
    if (draft.quests) {
      for (const q of draft.quests.quests) events.push({ type: 'QuestStarted', questId: q.def.id });
    }
    draft.towns = (cmd.towns ?? []).map((t) => ({
      ...t,
      buildings: { ...t.buildings },
      garrison: t.garrison.map((s) => ({ ...s })),
      stock: { ...t.stock },
      spellPool: t.spellPool ? [...t.spellPool] : [],
      sharedGrowthChoice: t.sharedGrowthChoice ? { ...t.sharedGrowthChoice } : {},
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
      team: p.team ?? 0,
    }));
    // Un héros par joueur à sa position de départ, armée de scénario (doc 02 §1.5, §5.1).
    draft.heroes = cmd.players.map((p, i) => {
      // Héros nommé du roster (H-NAMED.1, doc 02 §1.2) : identité par défaut (nom,
      // attributs, spécialité, compétences/sorts de départ). Les champs explicites
      // du PlayerSetup (report de campagne) la priment via `??`.
      const named = p.startingHeroId ? cmd.heroRoster?.[p.startingHeroId] : undefined;
      return {
      id: `hero-${p.id}`,
      playerId: p.id,
      // Identité (H-NAMED, doc 02 §1.1) — nom opaque fourni par les données/roster.
      name: p.startingName ?? named?.name ?? '',
      pos: cmd.map.startPositions[i] as GridPos,
      // PM/mana posés dans la boucle suivante (nécessitent l'objet héros complet).
      movementPoints: 0,
      army: (p.startingArmy ?? []).map((s) => ({ ...s })),
      // Progression (doc 02 §1.2) — attributs de base fournis par le scénario (défaut 0).
      // Report de campagne (doc 13 §4.1, N3a) : niveau/XP/compétences repris si fournis.
      xp: p.startingXp ?? 0,
      level: p.startingLevel ?? 1,
      attributes: p.startingAttributes
        ? { ...p.startingAttributes }
        : named
          ? { ...named.attributes }
          : { attack: 0, defense: 0, power: 0, knowledge: 0 },
      // Magie/compétences/artefacts (doc 02 §1.1–§1.4) — mana = Savoir × 10 + artefacts.
      mana: 0,
      manaMax: 0,
      skills: p.startingSkills ? { ...p.startingSkills } : named ? { ...named.startingSkills } : {},
      visitLuck: 0,
      visitMorale: 0,
      // Sorts connus d'emblée (cercle ≤ Guilde MVP), résolus par le contenu (décision 3.2 #7).
      spells: p.startingSpells ? [...p.startingSpells] : named ? [...named.startingSpells] : [],
      // Artefacts : report par joueur (campagne) sinon dotation globale du scénario.
      artifacts: Array.from(
        { length: 10 },
        (_, i) => (p.startingArtifacts ?? cmd.startingArtifacts ?? [])[i] ?? null,
      ),
      backpack: [],
      pendingSkillChoices: [],
      pendingAttributeChoices: [],
      factionId: p.startingFactionId ?? '',
      // Allégeance de Maison (doc 16 §3.1) : effets résolus depuis le catalogue
      // embarqué (copie défensive), agrégés comme des compétences dans skills.ts.
      houseId: p.startingHouseId ?? '',
      houseEffects: ((cmd.houseCatalog ?? {})[p.startingHouseId ?? '']?.effects ?? []).map((e) => ({
        ...e,
      })),
      // Spécialité (H-NAMED, doc 02 §1.2) : effets résolus depuis le catalogue
      // embarqué (copie défensive), agrégés comme la Maison dans skills.ts. Le
      // roster de héros nommés fournit la spécialité de signature par défaut.
      specialtyId: p.startingSpecialtyId || named?.specialtyId || '',
      specialtyEffects: p.startingSpecialtyId
        ? ((cmd.specialtyCatalog ?? {})[p.startingSpecialtyId]?.effects ?? []).map((e) => ({ ...e }))
        : (named?.specialtyEffects ?? []).map((e) => ({ ...e })),
      warMachines: [],
      // Origine roster (M-TAVERN.4) : un héros de DÉPART nommé occupe l'entrée de
      // pool correspondante (exclusivité inter-joueurs). '' pour un héros générique.
      rosterId: p.startingHeroId ?? '',
      };
    });
    for (const hero of draft.heroes) {
      // Spécialité EXACTE Alwin (H-COND-EXACT, doc 05 §7) : familier de départ —
      // les bonus d'armée déclaratifs (Maison + spécialité) rejoignent l'armée à
      // la création (empilés si l'unité est déjà présente, sinon nouvelle pile si
      // < 7). Générique : `unitId` opaque, aucun nom de faction/héros.
      for (const effect of [...hero.houseEffects, ...hero.specialtyEffects]) {
        const bonus = effect.startingArmyBonus;
        if (!bonus || bonus.count <= 0) continue;
        const existing = hero.army.find((s) => s.unitId === bonus.unitId);
        if (existing) existing.count += bonus.count;
        else if (hero.army.length < 7) hero.army.push({ unitId: bonus.unitId, count: bonus.count });
      }
      hero.manaMax = heroManaMax(hero, draft.artifactCatalog);
      hero.mana = hero.manaMax;
      hero.movementPoints = heroDailyMovement(draft, hero);
      const player = draft.players.find((p) => p.id === hero.playerId);
      if (player)
        revealAround(
          player.explored,
          cmd.map,
          hero.pos,
          heroVisionRadius(hero, cmd.config.visionRadius, draft.skillCatalog, draft.artifactCatalog),
        );
    }
    // Guilde des mages (G2) : tire le pool des niveaux de guilde PRÉBÂTIS (chaque
    // niveau ≤ construit), puis chaque héros posé sur sa ville apprend ce qu'il peut.
    for (const town of draft.towns) {
      for (const [buildingId, builtLevel] of Object.entries(town.buildings)) {
        const def = draft.buildingCatalog[buildingId];
        if (!def) continue;
        for (let lvl = 1; lvl <= builtLevel; lvl++) {
          const effect = def.levels[lvl - 1]?.effect;
          if (effect?.type === 'mageGuild') rollGuildSpells(draft, town, effect.level, effect.spellCount ?? 0);
        }
      }
    }
    for (const hero of draft.heroes) {
      for (const town of draft.towns) {
        if (town.ownerPlayerId === hero.playerId && samePos(town.pos, hero.pos))
          learnGuildSpellsAtTown(draft, hero, town, events);
      }
    }
    // F1 : le voisinage des villes/mines possédées est révélé d'emblée.
    revealOwnedStructures(draft);
    events.push({ type: 'GameStarted', seed: cmd.seed, playerIds: cmd.players.map((p) => p.id) });
    events.push({ type: 'DayStarted', day: 1 });
    events.push({ type: 'WeekStarted', week: 1 });
    // A11 : les triggers `onDay` du jour 1 (le schéma accepte `day ≥ 1`) ne se
    // déclenchaient jamais — `fireDayTriggers` n'était appelé qu'aux bascules de
    // jour, pas à `StartGame`. On les déclenche ici (calendar.day = 1 déjà posé).
    fireDayTriggers(draft, events);
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

  Dig(draft, cmd, events) {
    const hero = draft.heroes.find((h) => h.id === cmd.heroId);
    const player = draft.players.find((p) => hero && p.id === hero.playerId);
    if (!hero || !player) return; // exclu par validate
    player.hasGrail = true;
    hero.movementPoints = 0; // la fouille consomme la journée (fidélité HoMM)
    events.push({ type: 'GrailFound', playerId: player.id, heroId: hero.id, pos: { ...hero.pos } });
  },

  StartCombat(draft, cmd, events) {
    handleStartCombat(draft, cmd, events);
  },

  CombatAction(draft, cmd, events) {
    handleCombatAction(draft, cmd, events);
  },

  AutoCombat(draft, cmd, events) {
    handleAutoCombat(draft, events, cmd.rounds);
  },

  BuildStructure(draft, cmd, events) {
    handleBuildStructure(draft, cmd, events);
  },

  RecruitUnits(draft, cmd, events) {
    handleRecruitUnits(draft, cmd, events);
  },

  ChooseSharedGrowth(draft, cmd, events) {
    handleChooseSharedGrowth(draft, cmd, events);
  },

  UpgradeUnits(draft, cmd, events) {
    handleUpgradeUnits(draft, cmd, events);
  },

  BuyWarMachine(draft, cmd, events) {
    handleBuyWarMachine(draft, cmd, events);
  },

  GarrisonTransfer(draft, cmd, events) {
    handleGarrisonTransfer(draft, cmd, events);
  },

  ReorderArmy(draft, cmd, events) {
    handleReorderArmy(draft, cmd, events);
  },

  SplitStack(draft, cmd, events) {
    handleSplitStack(draft, cmd, events);
  },

  TransferBetweenHeroes(draft, cmd, events) {
    handleTransferBetweenHeroes(draft, cmd, events);
  },

  EquipArtifact(draft, cmd, events) {
    applyEquipArtifact(draft, cmd, events);
  },

  UnequipArtifact(draft, cmd, events) {
    applyUnequipArtifact(draft, cmd, events);
  },

  SendCaravan(draft, cmd, events) {
    handleSendCaravan(draft, cmd, events);
  },

  CaptureTown(draft, cmd, events) {
    handleCaptureTown(draft, cmd, events);
  },

  RecruitHero(draft, cmd, events) {
    handleRecruitHero(draft, cmd, events);
  },

  TradeResources(draft, cmd, events) {
    handleTradeResources(draft, cmd, events);
  },

  CastSpell(draft, cmd, events) {
    handleCastSpell(draft, cmd, events);
  },

  HeroAttack(draft, cmd, events) {
    handleHeroAttack(draft, cmd, events);
  },

  HeroRally(draft, cmd, events) {
    handleHeroRally(draft, cmd, events);
  },

  PlaceStack(draft, cmd, events) {
    handlePlaceStack(draft, cmd, events);
  },

  FinishPlacement(draft, _cmd, events) {
    handleFinishPlacement(draft, events);
  },

  Retreat(draft, cmd, events) {
    handleRetreat(draft, cmd, events);
  },

  Surrender(draft, cmd, events) {
    handleSurrender(draft, cmd, events);
  },

  AbandonCombat(draft, cmd, events) {
    handleAbandon(draft, cmd, events);
  },

  CastAdventureSpell(draft, cmd, events) {
    handleCastAdventureSpell(draft, cmd, events);
  },

  ChooseSkill(draft, cmd, events) {
    handleChooseSkill(draft, cmd, events);
  },

  ChooseAttribute(draft, cmd, events) {
    handleChooseAttribute(draft, cmd, events);
  },

  ResolveTreasure(draft, cmd, events) {
    resolveTreasure(draft, cmd.choice, events);
  },

  EndTurn(draft, cmd, events) {
    events.push({ type: 'TurnEnded', playerId: cmd.playerId });
    // B27 (revue 2026-07) : la rotation SAUTE les sièges éliminés — sans ça, un
    // humain éliminé en hot-seat était re-sollicité chaque jour pour un tour
    // vide, et une IA éliminée recevait un `AiTurn` complet. La bascule de jour
    // reste « on repasse par l'index 0 » ; le garde-fou borne la boucle si tous
    // les sièges sont éliminés (l'outcome est alors déjà posé).
    let hops = 0;
    do {
      advanceSeat(draft, events);
    } while (draft.players[draft.currentPlayer]?.eliminated && ++hops < draft.players.length);
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

  AddQuests(draft, cmd, events) {
    handleAddQuests(draft, cmd, events);
  },
};

/** Avance d'UN siège ; au retour à l'index 0, bascule le jour (doc 02 §2.3). */
function advanceSeat(draft: Draft, events: GameEvent[]): void {
    draft.currentPlayer += 1;
    if (draft.currentPlayer >= draft.players.length) {
      // Un jour = un tour de chaque joueur (doc 02 §2.3).
      draft.currentPlayer = 0;
      draft.calendar.day += 1;
      if (draft.config) {
        // Points de mouvement quotidiens restaurés (doc 02 §1.5), modulés Logistique.
        // Mana quotidienne restaurée aussi (doc 02 §1.4, Alpha 4.16) : les sorts
        // d'aventure puisent dans cette réserve, rechargée chaque jour.
        for (const hero of draft.heroes) {
          hero.movementPoints = heroDailyMovement(draft, hero);
          hero.manaMax = heroManaMax(hero, draft.artifactCatalog);
          hero.mana = hero.manaMax;
        }
      }
      events.push({ type: 'DayStarted', day: draft.calendar.day });
      // Économie des villes : 1 build/jour réarmé, revenu quotidien (doc 02 §4.1).
      resetBuiltToday(draft);
      applyDailyIncome(draft, events);
      // Caravanes inter-villes (T-CARAVAN, doc 02 §4.1) : un jour de trajet en
      // moins, dépôt en garnison à l'arrivée.
      tickCaravans(draft, events);
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
        // Événement de calendrier (M-CALENDAR, doc 02 §2.3) : tiré AVANT la
        // croissance (il la module via `weekGrowthFactor`). No-op hors calendrier.
        const calEvent = rollWeekEvent(draft);
        if (calEvent) {
          events.push({
            type: 'CalendarEventStarted',
            eventId: calEvent.id,
            week,
            month: monthOf(draft.calendar.day),
          });
          // Semaine de ruée (M-CALENDAR) : crédit d'une ressource commune à TOUS
          // les joueurs (générique — la donnée décide de la ressource/montant).
          const grant = calEvent.resourceGrant;
          if (grant) {
            for (const p of draft.players) {
              p.resources[grant.resource as ResourceId] += grant.amount;
              events.push({
                type: 'CalendarResourceGranted',
                playerId: p.id,
                resource: grant.resource,
                amount: grant.amount,
              });
            }
          }
          // Semaine du savoir (M-CALENDAR) : XP à CHAQUE héros (tous joueurs) —
          // générique, la donnée décide du montant. `grantXp` gère les montées.
          const xpGrant = calEvent.heroXpGrant;
          if (xpGrant) {
            // Copie des ids AVANT de muter (grantXp n'ajoute/retire aucun héros).
            for (const { id: heroId, playerId } of draft.heroes.map((h) => ({ id: h.id, playerId: h.playerId }))) {
              grantXp(draft, events, heroId, xpGrant.amount);
              events.push({ type: 'CalendarXpGranted', playerId, heroId, amount: xpGrant.amount });
            }
          }
        }
        applyWeeklyGrowth(draft, events); // croissance hebdo des habitations
        // Contrats de chasse (doc 05 §3.3) : cible neutre hebdomadaire assignée
        // au propriétaire d'un bâtiment `huntContract`.
        assignHuntContracts(draft, events);
      }
      // Triggers de carte « onDay » (doc 02 §2.1) puis avancée de la grâce de
      // reprise de ville (doc 02 §4.1) — une fois par jour, avant l'évaluation.
      fireDayTriggers(draft, events);
      // Gardiens errants (doc 02 §2.2) : un pas quotidien vers le héros le plus
      // proche à portée — après les triggers, avant l'évaluation de fin.
      roamGuardians(draft, events);
      tickTownGrace(draft);
    }
}
