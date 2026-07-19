import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { absorbShield, barrierParams } from '../src/combat/damage';
import { applyStartingBarrier } from '../src/combat/setup';
import { initLedger } from '../src/combat/state-helpers';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState, type PlayerState } from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';

/**
 * Barrière du Honmoon (doc 16 §7, capacité générique `barrier`) : au début du
 * combat, une pile `barrier` projette un bouclier absorbant sur les piles alliées
 * de sa zone, gaté par une ressource de faction. Le bouclier absorbe avant les PV.
 */

const AVATAR: CombatUnitDef = {
  id: 'avatar', groupId: 'g', nativeTerrain: 'grass', stats: { hp: 200, attack: 20, defense: 20, damage: [30, 30], speed: 8 },
  abilities: [{ id: 'barrier', params: { absorb: 30, radius: 2, requiresResource: { id: 'resonance', atLeast: 40 } } }],
};
const CHORISTE: CombatUnitDef = {
  id: 'choriste', groupId: 'g', nativeTerrain: 'grass', stats: { hp: 10, attack: 3, defense: 3, damage: [1, 2], speed: 4 }, abilities: [],
};

function hero(id: string, playerId: string): HeroState {
  return {
    id, playerId, pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: [], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(id: string, unitId: string, col: number): CombatStack {
  return {
    id, side: 'attacker', slot: 0, unitId, count: 1, firstHp: unitId === 'avatar' ? 200 : 10, pos: { col, row: 2 },
    retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0,
    transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
  };
}

/** État de combat : Avatar en (0,2), un choriste proche (1,2), un choriste loin (5,2). */
function makeState(resonance: number): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [stack('attacker-0', 'avatar', 0), stack('attacker-1', 'choriste', 1), stack('attacker-2', 'choriste', 5)],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: 'atk', guardianObjectId: null, townId: null,
    wallDefenseBonus: 0, attackerHeroId: 'atk', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  const player: PlayerState = { ...createEmptyState().players[0]!, id: 'p1', factionResources: { resonance } };
  return {
    ...createEmptyState(), started: true, rng: seedRng(1),
    unitCatalog: { avatar: AVATAR, choriste: CHORISTE }, heroes: [hero('atk', 'p1')], players: [player], combat,
  };
}

function project(resonance: number): { combat: CombatState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(makeState(resonance), (draft) => {
    applyStartingBarrier(draft, draft.combat as CombatState, events);
  });
  return { combat: next.combat as CombatState, events };
}

describe('absorbShield — bouclier absorbant (pur)', () => {
  it('absorbe jusqu’au bouclier puis le supprime à 0', () => {
    const s = { shield: 20 } as CombatStack;
    expect(absorbShield(s, 12)).toBe(12); // absorbe 12, reste 8
    expect(s.shield).toBe(8);
    expect(absorbShield(s, 30)).toBe(8); // absorbe le reste, bouclier épuisé
    expect(s.shield).toBeUndefined(); // supprimé ⇒ pile bit-identique à une non protégée
  });

  it('no-op sans bouclier ou sans dégâts', () => {
    const s = {} as CombatStack;
    expect(absorbShield(s, 50)).toBe(0);
    expect(absorbShield({ shield: 10 } as CombatStack, 0)).toBe(0);
  });
});

describe('barrierParams (pur)', () => {
  it('extrait absorb/radius/gate ; null sans la capacité', () => {
    expect(barrierParams(AVATAR)).toEqual({ absorb: 30, radius: 2, requiresResource: { id: 'resonance', atLeast: 40 } });
    expect(barrierParams(CHORISTE)).toBeNull();
  });
});

describe('applyStartingBarrier — projection au début du combat', () => {
  it('gate atteint : protège les piles alliées DANS le rayon, pas au-delà', () => {
    const { combat, events } = project(40);
    const byId = Object.fromEntries(combat.stacks.map((s) => [s.id, s]));
    expect(byId['attacker-0']!.shield).toBe(30); // l'Avatar lui-même (distance 0)
    expect(byId['attacker-1']!.shield).toBe(30); // choriste proche (distance 1 ≤ 2)
    expect(byId['attacker-2']!.shield).toBeUndefined(); // choriste loin (distance 5 > 2)
    expect(events.some((e) => e.type === 'BarrierProjected' && e.stacks === 2)).toBe(true);
  });

  it('gate NON atteint (résonance < seuil) : aucune barrière', () => {
    const { combat, events } = project(39);
    expect(combat.stacks.every((s) => s.shield === undefined)).toBe(true);
    expect(events.some((e) => e.type === 'BarrierProjected')).toBe(false);
  });
});
