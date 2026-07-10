import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { heroLuckOf } from '../src/combat/damage';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * C-BADLUCK (doc 02 §5.3) : chance bornée [-3,3] ; un coup de malchance
 * (chance < 0) inflige des demi-dégâts (×0,5), symétrique du coup de chance
 * (×0,5 vs ×2). `luckChancePerPoint` poussé à 1 dans ces tests ⇒ seuil ≥ 100 %
 * ⇒ le jet se déclenche toujours (assertion déterministe).
 */

function unit(id: string): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 1000, attack: 5, defense: 5, damage: [10, 10], speed: 5 },
    abilities: [],
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 1000,
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
    ...partial,
  };
}

function hero(visitLuck: number): HeroState {
  return {
    id: 'hero-a',
    playerId: 'p1',
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    artifacts: Array.from({ length: 10 }, () => null),
    skills: {},
    houseEffects: [],
    visitLuck,
  } as unknown as HeroState;
}

/** État de combat avec un héros attaquant de chance `visitLuck` et jet toujours déclenché. */
function stateWith(visitLuck: number): GameState {
  const config = { ...testConfig(), combat: { ...testConfig().combat, luckChancePerPoint: 1 } };
  const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
  const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 } });
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks: [attacker, defender],
    activeStackId: 'attacker-0',
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    finished: false,
    attackerHeroId: 'hero-a',
    defenderHeroId: null,
    heroCastThisRound: false,
    heroAttackUsed: [],
    winner: null,
  };
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config,
    unitCatalog: { atk: unit('atk'), def: unit('def') },
    heroes: [hero(visitLuck)],
    combat,
  };
}

describe('heroLuckOf — bornes symétriques [-3,3] (C-BADLUCK)', () => {
  it('borne haute : chance excédentaire plafonnée à +3', () => {
    const s = stateWith(10);
    expect(heroLuckOf(s, s.combat as CombatState, 'attacker')).toBe(3);
  });
  it('borne basse : malchance excédentaire plafonnée à -3', () => {
    const s = stateWith(-10);
    expect(heroLuckOf(s, s.combat as CombatState, 'attacker')).toBe(-3);
  });
});

describe('performStrike — coup de malchance ×0,5 (C-BADLUCK)', () => {
  function strikeDamage(state: GameState): Extract<GameEvent, { type: 'StackAttacked' }> {
    const events: GameEvent[] = [];
    produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    return events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
  }

  it('chance neutre (0) : dégâts pleins, ni lucky ni unlucky', () => {
    // diff 0 → mult 1 ; base 10 ; luck 0 ⇒ jet jamais déclenché.
    const strike = strikeDamage(stateWith(0));
    expect(strike.damage).toBe(10);
    expect(strike.lucky).toBe(false);
    expect(strike.unlucky).toBe(false);
  });

  it('malchance (<0) : demi-dégâts, unlucky', () => {
    const strike = strikeDamage(stateWith(-1));
    expect(strike.damage).toBe(5); // round(10 × 0,5)
    expect(strike.unlucky).toBe(true);
    expect(strike.lucky).toBe(false);
  });

  it('chance (>0) : dégâts doublés, lucky', () => {
    const strike = strikeDamage(stateWith(1));
    expect(strike.damage).toBe(20); // round(10 × 2)
    expect(strike.lucky).toBe(true);
    expect(strike.unlucky).toBe(false);
  });
});
