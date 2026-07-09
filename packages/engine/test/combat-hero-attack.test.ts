import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { heroAttackDamage } from '../src/combat/hero-attack';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * C1 — Attaque du héros : frappe directe sur une pile ennemie, 1×/combat,
 * `base + perPower×Pouvoir + perAttack×Attaque` (déterministe, sans RNG).
 */

function unit(id: string, hp: number): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
  };
}

function hero(attack: number, power: number): HeroState {
  return {
    id: 'hero-a',
    playerId: 'p1',
    attributes: { attack, defense: 0, power, knowledge: 0 },
    artifacts: Array.from({ length: 10 }, () => null),
  } as unknown as HeroState;
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0,
    firstHp: 10,
    pos: { col: 0, row: 0 },
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...over,
  };
}

function stateWith(heroAttackCfg: { base: number; perPower: number; perAttack: number } | undefined): GameState {
  const config = { ...testConfig(), combat: { ...testConfig().combat, heroAttack: heroAttackCfg } };
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 5, pos: { col: 0, row: 2 } }),
    stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 10, firstHp: 10 }),
  ];
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: 'attacker-0',
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId: 'hero-a',
    defenderHeroId: null,
    heroCastThisRound: false,
    heroAttackUsed: [],
    finished: false,
    winner: null,
  };
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config,
    unitCatalog: { ally: unit('ally', 10), foe: unit('foe', 10) },
    heroes: [hero(3, 4)],
    combat,
  };
}

describe('C1 — attaque du héros', () => {
  it('dégâts = base + perPower×Pouvoir + perAttack×Attaque (déterministe)', () => {
    const state = stateWith({ base: 8, perPower: 6, perAttack: 2 });
    // hero(attack 3, power 4) ⇒ 8 + 6×4 + 2×3 = 38.
    expect(heroAttackDamage(state, state.combat as CombatState, 'attacker')).toBe(38);
  });

  it('la frappe réduit la pile ennemie, marque le camp et émet HeroStruck', () => {
    const state = stateWith({ base: 8, perPower: 6, perAttack: 2 });
    const { state: next, events } = apply(state, { type: 'HeroAttack', targetStackId: 'defender-0' });
    const foe = next.combat?.stacks.find((s) => s.id === 'defender-0');
    // 38 dégâts sur une pile 10×10 PV ⇒ 3 tués (30 PV), reste 7 unités.
    expect(foe?.count).toBe(7);
    expect(next.combat?.heroAttackUsed).toContain('attacker');
    expect(events).toContainEqual({
      type: 'HeroStruck',
      side: 'attacker',
      targetId: 'defender-0',
      amount: 38,
      kills: 3,
    });
  });

  it('refuse une 2ᵉ attaque le même combat (heroAttackUsed)', () => {
    const first = apply(stateWith({ base: 8, perPower: 6, perAttack: 2 }), {
      type: 'HeroAttack',
      targetStackId: 'defender-0',
    }).state;
    expect(() => apply(first, { type: 'HeroAttack', targetStackId: 'defender-0' })).toThrowError(
      /heroAttackUsed/,
    );
  });

  it('refuse si la feature est désactivée (config heroAttack absente)', () => {
    expect(() =>
      apply(stateWith(undefined), { type: 'HeroAttack', targetStackId: 'defender-0' }),
    ).toThrowError(/heroAttackUnavailable/);
  });

  it('refuse une cible alliée', () => {
    expect(() =>
      apply(stateWith({ base: 8, perPower: 6, perAttack: 2 }), {
        type: 'HeroAttack',
        targetStackId: 'attacker-0',
      }),
    ).toThrowError(/invalidTarget/);
  });
});
