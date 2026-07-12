import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef } from '../src/hero/types';
import { estimateSpell } from '../src/hero';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * H-SPELLS.1 — Sorts de masse (`area: 'all'`) : l'effet touche **toutes** les
 * piles vivantes du camp de la cible (le camp visé = celui de la pile choisie).
 * Un buff sur une pile alliée profite à tout son camp ; un debuff/dégâts sur une
 * pile ennemie frappe tout le camp adverse, sans toucher l'autre camp.
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

function stack(
  over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    slot: 0,
    firstHp: 10,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null,
    spellCharges: 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...over,
  };
}

const MASS_BLESS: SpellDef = {
  id: 'mass-bless',
  school: 'water',
  circle: 3,
  manaCost: 5,
  kind: 'buff',
  base: 0,
  perPower: 0,
  attackMod: 3,
  area: 'all',
};

const MASS_SLOW: SpellDef = {
  id: 'mass-slow',
  school: 'air',
  circle: 3,
  manaCost: 5,
  kind: 'debuff',
  base: 0,
  perPower: 0,
  speedMod: -3,
  area: 'all',
};

const MASS_BOLT: SpellDef = {
  id: 'mass-bolt',
  school: 'neutral',
  circle: 3,
  manaCost: 5,
  kind: 'damage',
  base: 20,
  perPower: 0,
  area: 'all',
};

function stateWith(): GameState {
  const hero = {
    id: 'hero-a',
    playerId: 'p1',
    spells: ['mass-bless', 'mass-slow', 'mass-bolt'],
    mana: 60,
    attributes: { attack: 0, defense: 0, power: 1, knowledge: 0 },
    skills: {},
    houseEffects: [],
    name: '',
    specialtyId: '',
    specialtyEffects: [],
    artifacts: Array.from({ length: 10 }, () => null),
  } as unknown as HeroState;
  const combat: CombatState = {
    terrain: 'grass',
    phase: 'battle',
    round: 1,
    obstacles: [],
    stacks: [
      stack({ id: 'ally-0', side: 'attacker', unitId: 'ally', count: 5, pos: { col: 0, row: 2 } }),
      stack({ id: 'ally-1', side: 'attacker', unitId: 'ally', count: 5, pos: { col: 0, row: 6 } }),
      stack({ id: 'foe-0', side: 'defender', unitId: 'foe', count: 5, pos: { col: 8, row: 2 } }),
      stack({ id: 'foe-1', side: 'defender', unitId: 'foe', count: 5, pos: { col: 8, row: 6 } }),
    ],
    activeStackId: 'ally-0',
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
    unitCatalog: { ally: unit('ally'), foe: unit('foe') },
    spellCatalog: { 'mass-bless': MASS_BLESS, 'mass-slow': MASS_SLOW, 'mass-bolt': MASS_BOLT },
    heroes: [hero],
    combat,
  };
}

describe('H-SPELLS.1 — sorts de masse (area: all)', () => {
  it('un buff sur un allié profite à TOUTES les piles alliées, pas aux ennemis', () => {
    const { state: next } = apply(stateWith(), {
      type: 'CastSpell',
      spellId: 'mass-bless',
      targetStackId: 'ally-0',
    });
    const by = (id: string) => next.combat?.stacks.find((s) => s.id === id);
    expect(by('ally-0')?.statuses.some((s) => s.attackMod === 3)).toBe(true);
    expect(by('ally-1')?.statuses.some((s) => s.attackMod === 3)).toBe(true);
    // Aucun ennemi affecté.
    expect(by('foe-0')?.statuses.length).toBe(0);
    expect(by('foe-1')?.statuses.length).toBe(0);
  });

  it('un debuff sur un ennemi frappe TOUT le camp adverse, pas les alliés', () => {
    const { state: next } = apply(stateWith(), {
      type: 'CastSpell',
      spellId: 'mass-slow',
      targetStackId: 'foe-0',
    });
    const by = (id: string) => next.combat?.stacks.find((s) => s.id === id);
    expect(by('foe-0')?.statuses.some((s) => s.speedMod === -3)).toBe(true);
    expect(by('foe-1')?.statuses.some((s) => s.speedMod === -3)).toBe(true);
    expect(by('ally-0')?.statuses.length).toBe(0);
    expect(by('ally-1')?.statuses.length).toBe(0);
  });

  it('un sort de dégâts de masse touche toutes les piles du camp ciblé', () => {
    const { state: next } = apply(stateWith(), {
      type: 'CastSpell',
      spellId: 'mass-bolt',
      targetStackId: 'foe-0',
    });
    const by = (id: string) => next.combat?.stacks.find((s) => s.id === id);
    // 20 dégâts sur 5×10 PV ⇒ 2 tués → 3 restants sur chaque pile ennemie.
    expect(by('foe-0')?.count).toBe(3);
    expect(by('foe-1')?.count).toBe(3);
    // Alliés intacts.
    expect(by('ally-0')?.count).toBe(5);
    expect(by('ally-1')?.count).toBe(5);
  });

  it('la prévisualisation agrège les dégâts de toutes les piles du camp', () => {
    const est = estimateSpell(stateWith(), 'mass-bolt', 'foe-0');
    // 2 piles × 20 dégâts = 40 ; 2×2 = 4 tués.
    expect(est.kind).toBe('damage');
    expect(est.amount).toBe(40);
    expect(est.kills).toBe(4);
  });
});
