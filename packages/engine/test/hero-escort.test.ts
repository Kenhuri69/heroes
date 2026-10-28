import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type PlayerState } from '../src/core/state';
import { sendToReserve } from '../src/combat/leave';
import type { CombatUnitDef } from '../src/combat/types';
import type { ResolvedHeroDef } from '../src/hero/types';
import type { BuildingDef, TownState } from '../src/town/types';
import { testConfig, testMap } from './fixtures';

/** LD3 — escorte de Taverne : budget d'or par emplacement, unité de base du palier. */

const KNIGHT: ResolvedHeroDef = {
  factionId: 'fac-x',
  name: '@loc:hero.knight.name',
  attributes: { attack: 2, defense: 2, power: 1, knowledge: 1 },
  specialtyId: '',
  specialtyEffects: [],
  startingSkills: {},
  startingSpells: [],
};

function unit(id: string, tier: number, gold: number): CombatUnitDef {
  return {
    id, groupId: 'fac-x', nativeTerrain: 'grass', tier, recruitCost: { gold },
    stats: { hp: 5, attack: 1, defense: 1, damage: [1, 1], speed: 5 }, abilities: [],
  };
}

const dwelling = (id: string, tier: number, unitId: string, upgraded?: string): BuildingDef => ({
  id,
  factionId: 'fac-x',
  maxLevel: upgraded ? 2 : 1,
  levels: [
    { cost: {}, requires: [], effect: { type: 'dwelling', tier, unitId } },
    ...(upgraded ? [{ cost: {}, requires: [], effect: { type: 'dwelling' as const, tier, unitId: upgraded } }] : []),
  ],
});

const CATALOG: Record<string, BuildingDef> = {
  tavern: { id: 'tavern', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'tavern' } }] },
  'dw-1': dwelling('dw-1', 1, 'grunt', 'grunt-elite'),
  'dw-2': dwelling('dw-2', 2, 'archer'),
  // Une autre faction a aussi un T3 : jamais pris pour fac-x.
  'dw-other': { ...dwelling('dw-other', 3, 'foreign'), factionId: 'fac-other' },
};

function player(id: string): PlayerState {
  return {
    id, resources: { ...emptyResources(), gold: 10000 }, factionResources: {}, explored: [],
    controller: 'human', eliminated: false, townlessDays: 0, huntContract: null, team: 0,
  };
}

function town(id: string): TownState {
  return { id, ownerPlayerId: 'p1', pos: { x: 5, y: 5 }, factionId: 'fac-x', buildings: { tavern: 1 }, builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {} };
}

function base(seed = 1, escort = true): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.config.hero.retreatToTavern = true;
  if (escort) {
    s.config.hero.tavernEscort = [
      { tier: 1, goldMin: 300, goldMax: 500 },
      { tier: 2, goldMin: 200, goldMax: 350 },
      { tier: 3, goldMin: 150, goldMax: 250 },
    ];
    s.config.hero.reserveEscort = [{ tier: 1, goldMin: 100, goldMax: 150 }];
  }
  s.rng = seedRng(seed);
  s.map = testMap();
  s.players = [player('p1')];
  s.towns = [town('t1')];
  s.buildingCatalog = CATALOG;
  s.unitCatalog = {
    grunt: unit('grunt', 1, 25),
    'grunt-elite': unit('grunt-elite', 1, 40),
    archer: unit('archer', 2, 70),
    foreign: unit('foreign', 3, 100),
  };
  s.heroRoster = { knight: KNIGHT };
  return s;
}

const recruit = (s: GameState): GameState =>
  apply(s, { type: 'RecruitHero', townId: 't1', heroId: 'knight', playerId: 'p1' }).state;

describe('LD3 — escorte de Taverne', () => {
  it('un héros neuf arrive avec une pile de base par palier, effectif dans le budget', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const army = recruit(base(seed)).heroes[0]!.army;
      // T3 absent de la chaîne fac-x ⇒ sauté ; jamais l'élite ni l'unité étrangère.
      expect(army.map((a) => a.unitId)).toEqual(['grunt', 'archer']);
      expect(army[0]!.count).toBeGreaterThanOrEqual(Math.floor(300 / 25));
      expect(army[0]!.count).toBeLessThanOrEqual(Math.floor(500 / 25));
      expect(army[1]!.count).toBeGreaterThanOrEqual(Math.floor(200 / 70));
      expect(army[1]!.count).toBeLessThanOrEqual(Math.floor(350 / 70));
    }
  });

  it('déterministe à graine égale, et ne prélève pas le stock de la ville', () => {
    const a = recruit(base(7));
    expect(recruit(base(7)).heroes[0]!.army).toEqual(a.heroes[0]!.army);
    expect(a.towns[0]!.stock).toEqual({});
  });

  it('effectif plancher à 1 quand le budget ne couvre pas une créature', () => {
    const s = produce(base(), (d) => {
      d.config!.hero.tavernEscort = [{ tier: 2, goldMin: 10, goldMax: 10 }];
    });
    expect(recruit(s).heroes[0]!.army).toEqual([{ unitId: 'archer', count: 1 }]);
  });

  it('retour de réserve : escorte de réserve, jamais une armée vide', () => {
    const s = produce(recruit(base()), (d) => {
      d.heroes[0]!.army = [];
      sendToReserve(d, d.heroes[0]!.id, []);
    });
    const army = recruit(s).heroes[0]!.army;
    expect(army).toHaveLength(1);
    expect(army[0]!.unitId).toBe('grunt');
    expect(army[0]!.count).toBeGreaterThanOrEqual(4);
    expect(army[0]!.count).toBeLessThanOrEqual(6);
  });

  it('règle absente ⇒ armée vide (comportement d’avant)', () => {
    expect(recruit(base(1, false)).heroes[0]!.army).toEqual([]);
  });
});
