import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { ResolvedHeroDef } from '../src/hero/types';
import type { BuildingDef, TownState } from '../src/town/types';
import { testConfig, testMap } from './fixtures';

/**
 * Lot M-TAVERN.1 — recrutement de héros à la Taverne. Roster/faction GÉNÉRIQUES.
 * Le joueur actif recrute un héros nommé de SA faction (roster embarqué) contre
 * or, à une ville possédée avec Taverne ; cap 8 ; héros apparaît armée vide.
 */

const KNIGHT: ResolvedHeroDef = {
  factionId: 'fac-x',
  name: '@loc:hero.knight.name',
  attributes: { attack: 2, defense: 2, power: 1, knowledge: 1 },
  specialtyId: 'meneur',
  specialtyEffects: [{ moraleBonus: 1 }],
  startingSkills: { leadership: 1 },
  startingSpells: [],
};

const CATALOG: Record<string, BuildingDef> = {
  tavern: { id: 'tavern', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'tavern' } }] },
};

function state(over: { buildings?: Record<string, number>; gold?: number; factionId?: string } = {}): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(1);
  s.map = testMap();
  s.currentPlayer = 0;
  s.players = [
    { id: 'p1', resources: { ...emptyResources(), gold: over.gold ?? 5000 }, factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
  ];
  const town: TownState = {
    id: 't1', ownerPlayerId: 'p1', pos: { x: 5, y: 5 }, factionId: over.factionId ?? 'fac-x',
    buildings: over.buildings ?? { tavern: 1 }, builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {},
  };
  s.towns = [town];
  s.buildingCatalog = CATALOG;
  s.heroRoster = { knight: KNIGHT };
  return s;
}

const recruit = { type: 'RecruitHero' as const, townId: 't1', heroId: 'knight', playerId: 'p1' };

describe('M-TAVERN.1 — RecruitHero', () => {
  it('recrute le héros : il apparaît à la ville avec l’identité du roster, or décompté', () => {
    const { state: next, events } = apply(state(), recruit);
    const hero = next.heroes.find((h) => h.id === 'hero-p1-knight');
    expect(hero).toBeDefined();
    expect(hero?.pos).toEqual({ x: 5, y: 5 });
    expect(hero?.name).toBe('@loc:hero.knight.name');
    expect(hero?.attributes).toEqual({ attack: 2, defense: 2, power: 1, knowledge: 1 });
    expect(hero?.specialtyId).toBe('meneur');
    expect(hero?.army).toEqual([]);
    expect(next.players[0]?.resources.gold).toBe(2500); // 5000 − 2500
    expect(events).toContainEqual({ type: 'HeroRecruited', playerId: 'p1', heroId: 'knight', newHeroId: 'hero-p1-knight' });
  });

  it('sans Taverne construite : refusé', () => {
    expect(validate(state({ buildings: {} }), recruit)?.code).toBe('invalidAction');
  });

  it('or insuffisant : refusé', () => {
    expect(validate(state({ gold: 100 }), recruit)?.code).toBe('cannotAfford');
  });

  it('héros d’une autre faction que la ville : refusé', () => {
    expect(validate(state({ factionId: 'fac-y' }), recruit)?.code).toBe('invalidAction');
  });

  it('déjà recruté : refusé', () => {
    const after = apply(state(), recruit).state;
    expect(validate(after, recruit)?.code).toBe('invalidAction');
  });

  it('cap de héros atteint : refusé', () => {
    const s = state();
    s.config = { ...testConfig(), hero: { ...testConfig().hero, maxPerPlayer: 0 } };
    expect(validate(s, recruit)?.code).toBe('invalidAction');
  });
});
