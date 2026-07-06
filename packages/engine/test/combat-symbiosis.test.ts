import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/combat/actions';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState } from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Symbiose (doc 14 §2, Beta 5.3) : capacité `symbiosis` générique — bonus Att/Déf
 * cumulatif tant que la pile Défend, remis à 0 sur un déplacement/une attaque
 * volontaire (la riposte ne réinitialise pas), plafonné à `maxStacks`.
 */
function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-group`,
    nativeTerrain: 'mountain',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
    ...over,
  };
}
const SYMB = [{ id: 'symbiosis', params: { attackPerRound: 2, defensePerRound: 2, maxStacks: 4 } }];

function baseState(catalog: Record<string, CombatUnitDef>): GameState {
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog };
}
function stack(
  p: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 10, retaliationsLeft: 1, waited: false, defending: false, ammo: null, marks: 0,
    immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [], ...p,
  };
}
function combatState(stacks: CombatStack[]): CombatState {
  return {
    terrain: 'grass', round: 1, obstacles: [], stacks, activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: null, defenderHeroId: null, heroCastThisRound: false, finished: false, winner: null,
    ledger: [],
  } as unknown as CombatState;
}

/** Dégâts de la frappe (event `StackAttacked`) d'une attaque simple. */
function strikeDamage(catalog: Record<string, CombatUnitDef>, attacker: CombatStack, defender: CombatStack): number {
  const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
  const events: GameEvent[] = [];
  produce(state, (draft) => applyAction(draft, events, attacker.id, { type: 'attack', targetStackId: defender.id }));
  const e = events.find((ev) => ev.type === 'StackAttacked');
  return e && e.type === 'StackAttacked' ? e.damage : -1;
}

describe('Symbiose', () => {
  it('Défendre enracine un palier (plafonné à maxStacks)', () => {
    const catalog = { d: unit({ id: 'd', abilities: SYMB }), a: unit({ id: 'a' }) };
    const s = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'd', count: 1, pos: { col: 2, row: 2 } });
    const o = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'a', count: 1, pos: { col: 8, row: 8 } });
    const events: GameEvent[] = [];
    const next = produce({ ...baseState(catalog), combat: combatState([s, o]) }, (d) =>
      applyAction(d, events, 'attacker-0', { type: 'defend' }),
    );
    expect(next.combat?.stacks.find((x) => x.id === 'attacker-0')?.symbiosisStacks).toBe(1);

    // Au plafond, Défendre ne dépasse pas maxStacks.
    const capped = stack({ ...s, symbiosisStacks: 4 });
    const next2 = produce({ ...baseState(catalog), combat: combatState([capped, o]) }, (d) =>
      applyAction(d, events, 'attacker-0', { type: 'defend' }),
    );
    expect(next2.combat?.stacks.find((x) => x.id === 'attacker-0')?.symbiosisStacks).toBe(4);
  });

  it('bonus d’Attaque : une pile enracinée frappe plus fort, puis se réinitialise', () => {
    const catalog = { a: unit({ id: 'a', abilities: SYMB }), d: unit({ id: 'd' }) };
    // Effectif élevé de part et d'autre : les deux camps survivent à la frappe
    // et à la riposte, donc le combat ne se termine pas (piles conservées).
    const atkPlain = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'a', count: 100, pos: { col: 5, row: 5 } });
    const atkRooted = stack({ ...atkPlain, symbiosisStacks: 3 });
    const def = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'd', count: 100, pos: { col: 6, row: 5 }, firstHp: 10 });
    expect(strikeDamage(catalog, atkRooted, def)).toBeGreaterThan(strikeDamage(catalog, atkPlain, def));

    // Après l'attaque, l'enracinement est dépensé.
    const events: GameEvent[] = [];
    const next = produce({ ...baseState(catalog), combat: combatState([atkRooted, def]) }, (d) =>
      applyAction(d, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' }),
    );
    expect(next.combat?.stacks.find((x) => x.id === 'attacker-0')?.symbiosisStacks).toBe(0);
  });

  it('bonus de Défense : une pile enracinée subit moins de dégâts', () => {
    const catalog = { a: unit({ id: 'a' }), d: unit({ id: 'd', abilities: SYMB }) };
    const atk = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'a', count: 1, pos: { col: 5, row: 5 } });
    const defPlain = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'd', count: 100, pos: { col: 6, row: 5 }, firstHp: 10 });
    const defRooted = stack({ ...defPlain, symbiosisStacks: 3 });
    expect(strikeDamage(catalog, atk, defRooted)).toBeLessThan(strikeDamage(catalog, atk, defPlain));
  });

  it('se déplacer rompt l’enracinement', () => {
    const catalog = { a: unit({ id: 'a', abilities: SYMB }), o: unit({ id: 'o' }) };
    const s = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'a', count: 1, pos: { col: 2, row: 2 }, symbiosisStacks: 3 });
    const o = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'o', count: 1, pos: { col: 8, row: 8 } });
    const events: GameEvent[] = [];
    const next = produce({ ...baseState(catalog), combat: combatState([s, o]) }, (d) =>
      applyAction(d, events, 'attacker-0', { type: 'move', to: { col: 3, row: 2 } }),
    );
    expect(next.combat?.stacks.find((x) => x.id === 'attacker-0')?.symbiosisStacks).toBe(0);
  });

  it('la riposte ne réinitialise PAS l’enracinement du défenseur', () => {
    const catalog = { a: unit({ id: 'a' }), d: unit({ id: 'd', abilities: SYMB }) };
    // Attaquant en nombre : il survit à la riposte, le combat continue.
    const atk = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'a', count: 100, pos: { col: 5, row: 5 } });
    const def = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'd', count: 100, pos: { col: 6, row: 5 }, firstHp: 10, symbiosisStacks: 2 });
    const events: GameEvent[] = [];
    const next = produce({ ...baseState(catalog), combat: combatState([atk, def]) }, (d) =>
      applyAction(d, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' }),
    );
    // Le défenseur a riposté (il survit, count 100) mais garde ses paliers.
    expect(next.combat?.stacks.find((x) => x.id === 'defender-0')?.symbiosisStacks).toBe(2);
  });
});
