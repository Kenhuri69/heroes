import { apply } from '../core/engine';
import { seedRng } from '../core/rng';
import { createEmptyState } from '../core/state';
import type { GameEvent } from '../core/events';
import type { HeroState, PlayerState } from '../core/state';
import type { FactionBonus } from '../faction/types';
import type { AdventureConfig } from '../adventure/config';
import { runAutoCombat } from './ai';
import { beginHeroCombat } from './setup';
import type { ArmyStack, CombatSideId, CombatUnitDef } from './types';

/**
 * Résout un combat en **auto-combat déterministe** et rend le camp vainqueur
 * (doc 11 §3.5). Pur (RNG seedé injecté) : brique de simulation d'équilibrage
 * (outil `faction:sim`, Alpha 4.17). Réutilise l'API publique de commandes
 * (`StartCombat` + `AutoCombat`) — aucune connaissance de faction.
 *
 * `catalog` doit contenir toutes les unités des deux armées ; `terrain` doit
 * exister dans `config.terrains`. Un camp vidé perd ; à effectifs nuls des deux
 * côtés (impossible en pratique), le défenseur est réputé tenir la place.
 */
export function simulateAutoCombat(
  catalog: Record<string, CombatUnitDef>,
  config: AdventureConfig,
  attacker: ArmyStack[],
  defender: ArmyStack[],
  terrain: string,
  seed: number,
): CombatSideId {
  let state = createEmptyState();
  state.started = true;
  state.config = config;
  state.unitCatalog = catalog;
  state.rng = seedRng(seed);
  state = apply(state, { type: 'StartCombat', attacker, defender, terrain }).state;
  const result = apply(state, { type: 'AutoCombat' });
  const ended = result.events.find((e) => e.type === 'CombatEnded');
  return ended && ended.type === 'CombatEnded' ? ended.winner : 'defender';
}

/** Un camp d'un combat héros-vs-héros simulé : armée + faction (id opaque). */
export interface HeroCombatSide {
  army: ArmyStack[];
  /** Id de faction opaque — pilote les effets déclaratifs post-victoire (`factionCatalog`). */
  factionId: string;
}

/** Issue d'un combat héros-vs-héros simulé (F-SIM.2). */
export interface HeroCombatResult {
  winner: CombatSideId;
  /**
   * Armée RECONSTRUITE du challenger (attaquant) s'il l'emporte : survivants **+
   * relève de faction post-victoire** (nécromancie appliquée par
   * `applyHeroVsHeroConsequences`). `[]` si le challenger est vaincu — permet de
   * chaîner des vagues d'attrition en reportant l'armée d'un combat au suivant.
   */
  challengerArmy: ArmyStack[];
}

/** Héros de simulation minimal mais valide (aucune progression, aucun artefact). */
function simHero(id: string, playerId: string, factionId: string, army: ArmyStack[]): HeroState {
  return {
    id,
    playerId,
    name: '',
    pos: { x: 0, y: 0 },
    movementPoints: 0,
    army: army.map((s) => ({ ...s })),
    xp: 0,
    level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0,
    manaMax: 0,
    skills: {},
    visitLuck: 0,
    visitMorale: 0,
    spells: [],
    artifacts: Array.from({ length: 10 }, () => null),
    backpack: [],
    pendingSkillChoices: [],
    pendingAttributeChoices: [],
    factionId,
    houseId: '',
    houseEffects: [],
    specialtyId: '',
    specialtyEffects: [],
    warMachines: [],
    rosterId: '',
  };
}

/** Joueur de simulation minimal (ressources vides, aucune ville). */
function simPlayer(id: string): PlayerState {
  return {
    id,
    resources: { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 },
    factionResources: {},
    explored: [],
    controller: 'ai',
    eliminated: false,
    townlessDays: -1,
    huntContract: null,
    team: 0,
  };
}

/**
 * Résout **un combat héros-vs-héros** en auto-combat déterministe (F-SIM.2, plan
 * `faction-sim-fidelity`). Contrairement à `simulateAutoCombat` (duel d'armées
 * sans héros), les DEUX camps portent un héros lié à un joueur, si bien que les
 * **effets de faction post-victoire** (nécromancie `raiseUndeadOnVictory`,
 * ressource de faction) s'appliquent réellement et que l'armée du vainqueur est
 * reconstruite (survivants + relève). Générique : le moteur ne lit que des
 * `factionId` opaques via `factionCatalog` — jamais un nom de faction.
 *
 * Sert de brique aux mesures d'**attrition** et de **gauntlet** de `faction:sim`
 * (report d'armée d'une vague à l'autre) — c'est le seul moyen de valoriser des
 * mécaniques inter-combat (nécromancie) qu'un duel unique ne peut mesurer.
 */
export function simulateHeroCombat(
  catalog: Record<string, CombatUnitDef>,
  config: AdventureConfig,
  factionCatalog: Record<string, { bonuses: FactionBonus[] }>,
  challenger: HeroCombatSide,
  opponent: HeroCombatSide,
  seed: number,
): HeroCombatResult {
  // État ad hoc PLAT (fraîchement créé, jamais partagé) : on mute directement,
  // sans proxy Immer (perf F3 — c'est la brique chaude de `faction:sim`).
  const draft = createEmptyState();
  draft.started = true;
  draft.config = config;
  draft.unitCatalog = catalog;
  draft.factionCatalog = factionCatalog;
  draft.rng = seedRng(seed);
  draft.players = [simPlayer('p-att'), simPlayer('p-def')];
  draft.heroes = [
    simHero('h-att', 'p-att', challenger.factionId, challenger.army),
    simHero('h-def', 'p-def', opponent.factionId, opponent.army),
  ];

  const events: GameEvent[] = [];
  beginHeroCombat(draft, 'h-att', 'h-def', events);
  runAutoCombat(draft, events);

  const ended = events.find((e) => e.type === 'CombatEnded');
  const winner: CombatSideId = ended && ended.type === 'CombatEnded' ? ended.winner : 'defender';
  const att = draft.heroes.find((h) => h.id === 'h-att');
  const challengerArmy =
    winner === 'attacker' && att ? att.army.map((s) => ({ unitId: s.unitId, count: s.count })) : [];
  return { winner, challengerArmy };
}
