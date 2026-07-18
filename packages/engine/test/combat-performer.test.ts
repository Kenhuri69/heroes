import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/combat/actions';
import { applyPerformerResonance } from '../src/faction/effects';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import {
  createEmptyState,
  emptyResources,
  type GameState,
  type HeroState,
  type PlayerState,
} from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot F-RESON.2 — génération de ressource de faction intra-combat par la
 * capacité générique `performer` (doc 16 §3.2). IDs de test génériques
 * (`fac-x` / `res-x`) — aucun nom de faction/ressource réel dans le moteur.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 20, attack: 5, defense: 5, damage: [4, 4], speed: 6 },
    abilities: [],
    ...over,
  };
}

const PERFORMER = unit({
  id: 'singer',
  abilities: [{ id: 'performer', params: { resource: 'res-x', amount: 3 } }],
});
const PLAIN = unit({ id: 'grunt' });
const CATALOG: Record<string, CombatUnitDef> = { singer: PERFORMER, grunt: PLAIN };

function stack(partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId'> & Partial<CombatStack>): CombatStack {
  return {
    count: 5, firstHp: 20, pos: { col: partial.slot === 0 ? 0 : 1, row: 0 }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...partial,
  };
}

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-1', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    visitMorale: 0,
    pendingAttributeChoices: [], factionId: 'fac-x', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '', ...over,
  };
}

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human',
    eliminated: false, townlessDays: 0, huntContract: null, team: 0, ...over,
  };
}

function combatState(over: Partial<CombatState> = {}): CombatState {
  return {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks: [], activeStackId: null,
    playerSide: 'attacker', heroId: 'hero-1', guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-1', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [],
    finished: false, winner: null, ...over,
  };
}

// Cap de la ressource `res-x` = 12 (estampillé sur le bonus de gain, F-RESON.1).
const CAPPED_CATALOG = {
  'fac-x': { bonuses: [{ type: 'gainFactionResourceOnVictory' as const, resource: 'res-x', amount: 10, cap: 12 }] },
};

function baseState(over: Partial<GameState> = {}): GameState {
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: CATALOG, ...over };
}

const resonated = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackResonated') as Extract<GameEvent, { type: 'StackResonated' }>[];

describe('F-RESON.2 — applyPerformerResonance (crédit direct)', () => {
  it('crédite le joueur du héros du camp de la pile et émet StackResonated', () => {
    const perf = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'singer' });
    const combat = combatState({ stacks: [perf], activeStackId: 'attacker-0' });
    const events: GameEvent[] = [];
    const next = produce(baseState({ heroes: [hero()], players: [player()], combat }), (draft) => {
      applyPerformerResonance(draft, draft.combat as CombatState, draft.combat!.stacks[0]!, events);
    });
    expect(next.players[0]!.factionResources['res-x']).toBe(3);
    const ev = resonated(events)[0];
    expect(ev?.amount).toBe(3);
    expect(ev?.playerId).toBe('p1');
    expect(ev?.resource).toBe('res-x');
  });

  it('plafonne le gain au cap de la ressource (F-RESON.1 partagé)', () => {
    const perf = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'singer' });
    const combat = combatState({ stacks: [perf], activeStackId: 'attacker-0' });
    const events: GameEvent[] = [];
    // 11 + 3 = 14, plafonné à 12 ⇒ gain effectif 1.
    const next = produce(
      baseState({ heroes: [hero()], players: [player({ factionResources: { 'res-x': 11 } })], combat, factionCatalog: CAPPED_CATALOG }),
      (draft) => applyPerformerResonance(draft, draft.combat as CombatState, draft.combat!.stacks[0]!, events),
    );
    expect(next.players[0]!.factionResources['res-x']).toBe(12);
    expect(resonated(events)[0]?.amount).toBe(1);
  });

  it('ne crédite rien sans héros lié au camp (arène/gardien)', () => {
    const perf = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'singer' });
    const combat = combatState({ stacks: [perf], activeStackId: 'attacker-0', attackerHeroId: null, heroId: null });
    const events: GameEvent[] = [];
    const next = produce(baseState({ heroes: [], players: [player()], combat }), (draft) =>
      applyPerformerResonance(draft, draft.combat as CombatState, draft.combat!.stacks[0]!, events),
    );
    expect(next.players[0]!.factionResources['res-x']).toBeUndefined();
    expect(resonated(events)).toHaveLength(0);
  });

  it('ne crédite rien pour une unité non-performeuse', () => {
    const plain = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt' });
    const combat = combatState({ stacks: [plain], activeStackId: 'attacker-0' });
    const events: GameEvent[] = [];
    produce(baseState({ heroes: [hero()], players: [player()], combat }), (draft) =>
      applyPerformerResonance(draft, draft.combat as CombatState, draft.combat!.stacks[0]!, events),
    );
    expect(resonated(events)).toHaveLength(0);
  });
});

describe('F-RESON.2 — génération via le tour de combat (afterAction)', () => {
  function runAction(state: GameState, action: Parameters<typeof applyAction>[3]) {
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => applyAction(draft, events, 'attacker-0', action));
    return { events, next };
  }

  it('Défendre (tour réel) crédite une fois la Résonance', () => {
    const perf = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'singer' });
    const foe = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'grunt' });
    const combat = combatState({ stacks: [perf, foe], activeStackId: 'attacker-0' });
    const { events, next } = runAction(baseState({ heroes: [hero()], players: [player()], combat }), { type: 'defend' });
    expect(next.players[0]!.factionResources['res-x']).toBe(3);
    expect(resonated(events)).toHaveLength(1);
  });

  it('Attendre ne crédite pas (le tour n’est pas consommé)', () => {
    const perf = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'singer' });
    const foe = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'grunt' });
    const combat = combatState({ stacks: [perf, foe], activeStackId: 'attacker-0' });
    const { events, next } = runAction(baseState({ heroes: [hero()], players: [player()], combat }), { type: 'wait' });
    expect(next.players[0]!.factionResources['res-x']).toBeUndefined();
    expect(resonated(events)).toHaveLength(0);
  });
});
