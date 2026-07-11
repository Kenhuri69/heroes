import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef } from '../src/hero/types';
import { hexDistance } from '../src/combat/hex';
import { estimateSpell } from '../src/hero';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * C7 — Sorts de zone (`area: 'splash'`) : la pile ciblée + les piles adjacentes
 * du même camp sont touchées ; une pile éloignée ne l'est pas.
 */

function unit(id: string): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0,
    firstHp: 10,
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

const FIREBALL: SpellDef = {
  id: 'fireball',
  school: 'fire',
  circle: 3,
  manaCost: 5,
  kind: 'damage',
  base: 20,
  perPower: 0,
  area: 'splash',
};

function stateWith(): GameState {
  const hero = {
    id: 'hero-a',
    playerId: 'p1',
    spells: ['fireball'],
    mana: 30,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    skills: {},
    houseEffects: [],
    name: '',
    specialtyId: '',
    specialtyEffects: [],
    artifacts: Array.from({ length: 10 }, () => null),
  } as unknown as HeroState;
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 5, pos: { col: 0, row: 2 } }),
      stack({ id: 'center', side: 'defender', unitId: 'foe', count: 5, pos: { col: 5, row: 4 } }),
      stack({ id: 'adjacent', side: 'defender', unitId: 'foe', count: 5, pos: { col: 5, row: 5 } }),
      stack({ id: 'far', side: 'defender', unitId: 'foe', count: 5, pos: { col: 5, row: 8 } }),
    ],
    activeStackId: 'attacker-0',
    playerSide: 'attacker',
    heroId: 'hero-a',
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
    config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') },
    spellCatalog: { fireball: FIREBALL },
    heroes: [hero],
    combat,
  };
}

describe('C7 — sort de zone (splash)', () => {
  it('la géométrie de test est correcte (adjacent à distance 1, far à distance 3)', () => {
    const c = { col: 5, row: 4 };
    expect(hexDistance(c, { col: 5, row: 5 })).toBe(1);
    expect(hexDistance(c, { col: 5, row: 8 })).toBeGreaterThan(1);
  });

  it('touche la cible + les piles adjacentes, épargne les éloignées', () => {
    const { state: next } = apply(stateWith(), { type: 'CastSpell', spellId: 'fireball', targetStackId: 'center' });
    const by = (id: string) => next.combat?.stacks.find((s) => s.id === id);
    // 20 dégâts sur 5×10 PV ⇒ 2 tués → 3 restants (cible + adjacente).
    expect(by('center')?.count).toBe(3);
    expect(by('adjacent')?.count).toBe(3);
    // Pile éloignée intacte.
    expect(by('far')?.count).toBe(5);
  });

  it('la prévisualisation agrège la zone (dégâts + tués des piles touchées)', () => {
    const est = estimateSpell(stateWith(), 'fireball', 'center');
    // 2 piles touchées (cible + adjacente) × 20 dégâts = 40 ; 2×2 = 4 tués.
    expect(est.kind).toBe('damage');
    expect(est.amount).toBe(40);
    expect(est.kills).toBe(4);
  });
});
