import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { applyWeeklyGrowth } from '../src/town/economy';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { BuildingDef } from '../src/town/types';
import type { CombatUnitDef } from '../src/combat/types';

/**
 * Croissance partagée « apex » (doc 05 §3.1/§8) — point d'extension GÉNÉRIQUE :
 * les membres d'un groupe déclaré (`sharedGrowthGroups`) se partagent UNE seule
 * croissance hebdo ; le joueur choisit le destinataire (`ChooseSharedGrowth`).
 * Le moteur ne connaît aucune faction : groupe et unités sont des ids opaques.
 */

const CATALOG: Record<string, BuildingDef> = {
  'dwelling-a': {
    id: 'dwelling-a',
    maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'dwelling', tier: 7, unitId: 'apex-a' } }],
  },
  'dwelling-b': {
    id: 'dwelling-b',
    maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'dwelling', tier: 8, unitId: 'apex-b' } }],
  },
  'dwelling-c': {
    id: 'dwelling-c',
    maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'dwelling', tier: 1, unitId: 'solo-c' } }],
  },
};

/** Catalogue d'unités avec croissance (champ optionnel lu par `unit-economy`). */
const UNITS = {
  'apex-a': { id: 'apex-a', stats: { hp: 1, attack: 1, defense: 1, damage: [1, 1], speed: 1 }, abilities: [], growthPerWeek: 2 },
  'apex-b': { id: 'apex-b', stats: { hp: 1, attack: 1, defense: 1, damage: [1, 1], speed: 1 }, abilities: [], growthPerWeek: 3 },
  'solo-c': { id: 'solo-c', stats: { hp: 1, attack: 1, defense: 1, damage: [1, 1], speed: 1 }, abilities: [], growthPerWeek: 5 },
} as unknown as Record<string, CombatUnitDef>;

function townState(buildings: Record<string, number>, choice: Record<string, string> = {}): GameState {
  const s = createEmptyState();
  s.buildingCatalog = CATALOG;
  s.unitCatalog = UNITS;
  s.growthGroups = { apex: ['apex-a', 'apex-b'] };
  s.players = [
    {
      id: 'p1',
      resources: emptyResources(),
      factionResources: {},
      explored: [],
      controller: 'human',
      eliminated: false,
      townlessDays: 0,
      huntContract: null,
      team: 0,
    },
  ];
  s.currentPlayer = 0;
  s.towns = [
    {
      id: 't1',
      ownerPlayerId: 'p1',
      pos: { x: 0, y: 0 },
      factionId: '',
      buildings,
      builtToday: false,
      garrison: [],
      stock: {},
      spellPool: [],
      sharedGrowthChoice: choice,
    },
  ];
  return s;
}

describe('croissance partagée (apex)', () => {
  it('un seul membre du groupe grossit — par défaut le 1er déclaré', () => {
    const s = townState({ 'dwelling-a': 1, 'dwelling-b': 1, 'dwelling-c': 1 });
    const events: GameEvent[] = [];
    applyWeeklyGrowth(s, events);
    const stock = s.towns[0]!.stock;
    expect(stock['apex-a']).toBe(2); // destinataire par défaut (1er membre)
    expect(stock['apex-b'] ?? 0).toBe(0); // l'autre membre ne grossit pas
    expect(stock['solo-c']).toBe(5); // unité hors groupe : inchangée
  });

  it('le choix du joueur redirige la croissance vers l’autre membre', () => {
    const s = townState({ 'dwelling-a': 1, 'dwelling-b': 1 }, { apex: 'apex-b' });
    applyWeeklyGrowth(s, []);
    expect(s.towns[0]!.stock['apex-b']).toBe(3);
    expect(s.towns[0]!.stock['apex-a'] ?? 0).toBe(0);
  });

  it('un seul membre bâti : il grossit normalement (pas de partage)', () => {
    const s = townState({ 'dwelling-a': 1 }); // T8 pas encore construit
    applyWeeklyGrowth(s, []);
    expect(s.towns[0]!.stock['apex-a']).toBe(2);
  });

  it('choix invalide (membre non bâti) : repli sur le 1er membre présent', () => {
    const s = townState({ 'dwelling-b': 1 }, { apex: 'apex-a' }); // choix apex-a mais non bâti
    applyWeeklyGrowth(s, []);
    expect(s.towns[0]!.stock['apex-b']).toBe(3); // seul présent ⇒ grossit
  });
});

describe('ChooseSharedGrowth', () => {
  it('pose la préférence et émet SharedGrowthChosen', () => {
    const s = townState({ 'dwelling-a': 1, 'dwelling-b': 1 });
    s.started = true;
    const { state, events } = apply(s, {
      type: 'ChooseSharedGrowth',
      townId: 't1',
      groupId: 'apex',
      unitId: 'apex-b',
    });
    expect(state.towns[0]!.sharedGrowthChoice['apex']).toBe('apex-b');
    expect(events).toContainEqual({
      type: 'SharedGrowthChosen',
      townId: 't1',
      groupId: 'apex',
      unitId: 'apex-b',
    });
  });

  it('rejette un groupe inconnu', () => {
    const s = townState({ 'dwelling-a': 1, 'dwelling-b': 1 });
    s.started = true;
    expect(() =>
      apply(s, { type: 'ChooseSharedGrowth', townId: 't1', groupId: 'nope', unitId: 'apex-a' }),
    ).toThrowError(/unknownGrowthGroup/);
  });

  it('rejette une unité hors du groupe', () => {
    const s = townState({ 'dwelling-a': 1, 'dwelling-b': 1 });
    s.started = true;
    expect(() =>
      apply(s, { type: 'ChooseSharedGrowth', townId: 't1', groupId: 'apex', unitId: 'solo-c' }),
    ).toThrowError(/invalidAction/);
  });

  it('rejette un membre sans dwelling bâti', () => {
    const s = townState({ 'dwelling-a': 1 }); // apex-b pas bâti
    s.started = true;
    expect(() =>
      apply(s, { type: 'ChooseSharedGrowth', townId: 't1', groupId: 'apex', unitId: 'apex-b' }),
    ).toThrowError(/notRecruitable/);
  });
});
