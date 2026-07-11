import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import {
  applyAction,
  attackableTargets,
  canShootTarget,
  hasLineOfSight,
  validateCombatAction,
} from '../src/combat/actions';
import { hexDistance, hexLine, type OffsetPos } from '../src/combat/hex';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * C-LOS (doc 02 §5.4) : la ligne de vue d'un tireur est bloquée par les
 * OBSTACLES seuls (jamais par les piles) ; sans ligne de vue, tir interdit ⇒
 * mêlée forcée. Couvre `hexLine`, `hasLineOfSight`, `canShootTarget` et
 * l'intégration `validateCombatAction`/`applyAction`.
 */

function unit(id: string, abilities: CombatUnitDef['abilities'] = []): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 100, attack: 5, defense: 5, damage: [4, 4], speed: 6 },
    abilities,
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 100,
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
    ...partial,
  };
}

function stateWith(stacks: CombatStack[], obstacles: OffsetPos[], activeStackId: string): GameState {
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles,
    stacks,
    activeStackId,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    finished: false,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: false,
    heroAttackUsed: [],
    winner: null,
  };
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config: testConfig(),
    unitCatalog: { shooter: unit('shooter', [{ id: 'shooter', params: { ammo: 5 } }]), foe: unit('foe') },
    combat,
  };
}

describe('hexLine', () => {
  it('longueur = distance + 1, extrémités incluses', () => {
    const a = { col: 2, row: 5 };
    const b = { col: 6, row: 5 };
    const line = hexLine(a, b);
    expect(line).toHaveLength(hexDistance(a, b) + 1);
    expect(line[0]).toEqual(a);
    expect(line[line.length - 1]).toEqual(b);
  });

  it('pas > 1 impossible : hexes consécutifs adjacents', () => {
    const line = hexLine({ col: 1, row: 1 }, { col: 7, row: 4 });
    for (let i = 1; i < line.length; i++) {
      expect(hexDistance(line[i - 1] as OffsetPos, line[i] as OffsetPos)).toBe(1);
    }
  });

  it('sur place : un seul hex', () => {
    expect(hexLine({ col: 3, row: 3 }, { col: 3, row: 3 })).toEqual([{ col: 3, row: 3 }]);
  });
});

describe('hasLineOfSight', () => {
  it('obstacle sur le segment ⇒ vue bloquée', () => {
    const combat = stateWith([], [{ col: 4, row: 5 }], 'x').combat as CombatState;
    expect(hasLineOfSight(combat, { col: 2, row: 5 }, { col: 6, row: 5 })).toBe(false);
  });

  it('aucun obstacle ⇒ vue dégagée', () => {
    const combat = stateWith([], [], 'x').combat as CombatState;
    expect(hasLineOfSight(combat, { col: 2, row: 5 }, { col: 6, row: 5 })).toBe(true);
  });

  it('les piles ne bloquent pas la vue (obstacles seuls, décision C-LOS)', () => {
    // Une pile occupe l'hex intermédiaire, mais aucun OBSTACLE : vue dégagée.
    const midStack = stack({ id: 'mid', side: 'defender', slot: 9, unitId: 'foe', count: 1, pos: { col: 4, row: 5 } });
    const combat = stateWith([midStack], [], 'x').combat as CombatState;
    expect(hasLineOfSight(combat, { col: 2, row: 5 }, { col: 6, row: 5 })).toBe(true);
  });

  it('obstacle hors segment ⇒ vue dégagée', () => {
    const combat = stateWith([], [{ col: 4, row: 8 }], 'x').combat as CombatState;
    expect(hasLineOfSight(combat, { col: 2, row: 5 }, { col: 6, row: 5 })).toBe(true);
  });
});

describe('canShootTarget & tir bloqué (C-LOS)', () => {
  const shooterPos = { col: 2, row: 5 };
  const targetPos = { col: 6, row: 5 };
  const blockPos = { col: 4, row: 5 };

  function scenario(obstacles: OffsetPos[]): GameState {
    const shooter = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'shooter', count: 1, ammo: 5, pos: shooterPos });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: targetPos });
    return stateWith([shooter, target], obstacles, 'attacker-0');
  }

  it('ligne de vue dégagée : tir possible', () => {
    expect(canShootTarget(scenario([]), 'attacker-0', 'defender-0')).toBe(true);
  });

  it('obstacle sur la ligne : tir interdit', () => {
    expect(canShootTarget(scenario([blockPos]), 'attacker-0', 'defender-0')).toBe(false);
  });

  it('validateCombatAction : tir bloqué + cible distante sans `from` ⇒ rejet', () => {
    const state = scenario([blockPos]);
    const err = validateCombatAction(state, { action: { type: 'attack', targetStackId: 'defender-0' } });
    expect(err?.code).toBe('invalidAction');
  });

  it('validateCombatAction : ligne dégagée ⇒ tir accepté sans `from`', () => {
    const state = scenario([]);
    expect(validateCombatAction(state, { action: { type: 'attack', targetStackId: 'defender-0' } })).toBeNull();
  });

  it('applyAction : ligne dégagée ⇒ tir (munitions décrémentées, ranged)', () => {
    const state = scenario([]);
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.ranged).toBe(true);
    expect(next.combat?.stacks.find((s) => s.id === 'attacker-0')?.ammo).toBe(4);
  });

  it('applyAction : tir bloqué ⇒ mêlée forcée (munitions intactes, ranged false)', () => {
    const state = scenario([blockPos]);
    const events: GameEvent[] = [];
    // Le tireur doit se déplacer au contact (from adjacent à la cible).
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', {
        type: 'attack',
        targetStackId: 'defender-0',
        from: { col: 5, row: 5 },
      });
    });
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.ranged).toBe(false);
    expect(next.combat?.stacks.find((s) => s.id === 'attacker-0')?.ammo).toBe(5); // pas de tir
  });

  it('attackableTargets : cible bloquée reste attaquable (par mêlée, cible atteignable)', () => {
    // Cible à portée de mêlée mais masquée par un obstacle : toujours listée
    // (elle sera frappée en mêlée), la LoS ne la retire pas si elle est atteignable.
    const ids = attackableTargets(scenario([blockPos]), 'attacker-0').map((s) => s.id);
    expect(ids).toContain('defender-0');
  });
});
