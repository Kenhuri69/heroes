import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef } from '../src/hero/types';
import { estimateSpell } from '../src/hero';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot F-SCHOOLS.3 — sort mange-Marques (`marksDamagePct`, doc 05 §6 « Volée de
 * Dagues Spectrales ») : le sort de dégâts gagne un bonus %/charge de Marque de
 * la cible (en plus du bonus passif de Marque), PUIS consomme les Marques.
 * IDs génériques (`dagues`/`ally`/`foe`) — aucun nom de faction dans le moteur.
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
    slot: 0, firstHp: 10, retaliationsLeft: 1, waited: false, defending: false, ammo: null,
    spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0,
    acted: false, statuses: [], ...over,
  };
}

// base 20, perPower 0 ⇒ 20 dégâts de base ; marksDamagePct 50 ⇒ +50 %/charge.
const DAGGERS: SpellDef = {
  id: 'dagues', school: 'traque', circle: 3, manaCost: 5, kind: 'damage', base: 20, perPower: 0,
  marksDamagePct: 50,
};

function stateWith(marks: number): GameState {
  const hero = {
    id: 'hero-a', playerId: 'p1', spells: ['dagues'], mana: 30,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, skills: {}, houseEffects: [],
    name: '', specialtyId: '', specialtyEffects: [], artifacts: Array.from({ length: 10 }, () => null),
  } as unknown as HeroState;
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 5, pos: { col: 0, row: 2 } }),
      // Cible : 100 PV (10×10) pour ne pas mourir, avec `marks` charges de Marque.
      stack({ id: 'foe-0', side: 'defender', unitId: 'foe', count: 10, pos: { col: 5, row: 4 }, firstHp: 10, marks }),
    ],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: 'hero-a', guardianObjectId: null,
    townId: null, wallDefenseBonus: 0, attackerHeroId: 'hero-a', defenderHeroId: null,
    heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog: { dagues: DAGGERS },
    heroes: [hero], combat,
  };
}

const remainingHp = (s: CombatStack, hp = 10) => (s.count - 1) * hp + s.firstHp;

describe('F-SCHOOLS.3 — Volée de Dagues Spectrales (sort mange-Marques)', () => {
  it('sans Marque : dégâts de base, rien à consommer', () => {
    const { state: next } = apply(stateWith(0), { type: 'CastSpell', spellId: 'dagues', targetStackId: 'foe-0' });
    const foe = next.combat!.stacks.find((s) => s.id === 'foe-0')!;
    // 100 PV − 20 = 80.
    expect(remainingHp(foe)).toBe(80);
    expect(foe.marks).toBe(0);
  });

  it('avec Marques : dégâts amplifiés (+50 %/charge en plus du passif) puis Marques consommées', () => {
    const { state: next } = apply(stateWith(2), { type: 'CastSpell', spellId: 'dagues', targetStackId: 'foe-0' });
    const foe = next.combat!.stacks.find((s) => s.id === 'foe-0')!;
    // markBonusPerStack (testConfig) × 2 + 0,5 × 2 = passif + 1,0. testConfig
    // markBonusPerStack = 0,08 ⇒ (1 + 0,16 + 1,0) = 2,16 × 20 = 43,2 → 43.
    expect(remainingHp(foe)).toBe(100 - 43);
    // Marques consommées.
    expect(foe.marks).toBe(0);
  });

  it('la prévisualisation reflète le bonus de consommation (sans muter l’état)', () => {
    const s = stateWith(2);
    const est = estimateSpell(s, 'dagues', 'foe-0');
    expect(est.kind).toBe('damage');
    expect(est.amount).toBe(43);
    // Préviz pure : les Marques de l'état ne sont pas consommées.
    expect(s.combat!.stacks.find((x) => x.id === 'foe-0')!.marks).toBe(2);
  });
});
