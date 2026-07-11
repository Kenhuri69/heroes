import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { surrenderCost } from '../src/combat/leave';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * C3 — Reddition & fuite. Fuite : le héros survit, armée abandonnée, combat perdu.
 * Reddition : or débité (valeur d'armée), armée conservée, héros survit.
 */

function unit(id: string, goldCost: number): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
    ...(goldCost > 0 ? { recruitCost: { gold: goldCost } } : {}),
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0,
    firstHp: 10,
    pos: { col: 0, row: 0 },
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null, spellCharges: 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...over,
  };
}

function stateWith(gold: number): GameState {
  const hero = {
    id: 'hero-a',
    playerId: 'p1',
    army: [{ unitId: 'ally', count: 5 }],
    warMachines: [],
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    artifacts: Array.from({ length: 10 }, () => null),
  } as unknown as HeroState;
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 5, pos: { col: 0, row: 2 } }),
      stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 10 }),
    ],
    activeStackId: 'attacker-0',
    playerSide: 'attacker',
    heroId: 'hero-a',
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId: 'hero-a',
    defenderHeroId: null,
    heroCastThisRound: [],
    heroAttackUsed: [],
    finished: false,
    winner: null,
  };
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config: testConfig(),
    unitCatalog: { ally: unit('ally', 10), foe: unit('foe', 0) },
    heroes: [hero],
    players: [{ ...createEmptyState().players[0], id: 'p1', resources: { ...emptyResources(), gold } } as never],
    combat,
  };
}

describe('C3 — fuite (Retreat)', () => {
  it('le héros survit, abandonne son armée, le combat est perdu', () => {
    const { state: next, events } = apply(stateWith(0), { type: 'Retreat' });
    expect(next.combat).toBeNull();
    const hero = next.heroes.find((h) => h.id === 'hero-a');
    expect(hero).toBeDefined(); // survit (pas retiré comme une défaite normale)
    expect(hero?.army).toEqual([]); // armée abandonnée
    expect(events).toContainEqual({ type: 'CombatLeft', mode: 'retreat', heroId: 'hero-a' });
    expect(events.some((e) => e.type === 'CombatEnded' && e.winner === 'defender')).toBe(true);
  });
});

describe('C3 — reddition (Surrender)', () => {
  it('coût = valeur en or de l’armée survivante', () => {
    const state = stateWith(1000);
    expect(surrenderCost(state, state.combat as CombatState)).toBe(50); // 5 × 10 or
  });

  it('or débité, armée conservée, héros survit', () => {
    const { state: next } = apply(stateWith(1000), { type: 'Surrender' });
    expect(next.combat).toBeNull();
    const hero = next.heroes.find((h) => h.id === 'hero-a');
    expect(hero?.army).toEqual([{ unitId: 'ally', count: 5 }]); // armée gardée
    expect(next.players[0]?.resources.gold).toBe(950); // 1000 − 50
  });

  it('refuse si l’or est insuffisant (cannotAfford)', () => {
    expect(() => apply(stateWith(10), { type: 'Surrender' })).toThrowError(/cannotAfford/);
  });
});
