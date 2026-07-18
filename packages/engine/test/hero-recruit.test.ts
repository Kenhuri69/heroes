import { describe, expect, it } from 'vitest';
import { dailyMovementPoints } from '../src/adventure/config';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
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

  it('Revue 2026-07 — B29 : le héros recruté a ses PM du jour même (comme StartGame)', () => {
    const { state: next } = apply(state(), recruit);
    const hero = next.heroes.find((h) => h.id === 'hero-p1-knight');
    // Même calcul que StartGame/EndTurn (armée vide ⇒ base seule, sans bonus).
    expect(hero?.movementPoints).toBe(dailyMovementPoints(testConfig(), [], {}));
    expect(hero?.movementPoints ?? 0).toBeGreaterThan(0); // il restait à 0 avant B29
  });
});

describe('Revue 2026-07 — B24b : héritage de la Maison du joueur au recrutement', () => {
  // Ids de Maison FICTIFS (garde-fou CI « zéro nom de faction dans le moteur »).
  function existingHero(houseId: string): HeroState {
    return {
      id: 'h-old', playerId: 'p1', name: '', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [],
      xp: 0, level: 1, attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
      mana: 0, manaMax: 0, skills: {}, visitLuck: 0, visitMorale: 0, spells: [],
      artifacts: Array.from({ length: 10 }, () => null), backpack: [], pendingSkillChoices: [],
      pendingAttributeChoices: [], factionId: '', houseId,
      houseEffects: houseId ? [{ goldPerDay: 250 }] : [], specialtyId: '', specialtyEffects: [],
      warMachines: [], rosterId: '',
    };
  }

  it('le héros recruté hérite de la Maison déjà choisie (effets résolus du catalogue)', () => {
    const s = state();
    s.houseCatalog = { 'house-lion': { effects: [{ goldPerDay: 250 }] } };
    s.heroes = [existingHero('house-lion')];
    const hero = apply(s, recruit).state.heroes.find((h) => h.id === 'hero-p1-knight');
    expect(hero?.houseId).toBe('house-lion');
    expect(hero?.houseEffects).toEqual([{ goldPerDay: 250 }]);
  });

  it('sans Maison choisie : le héros recruté naît sans Maison', () => {
    const s = state();
    s.heroes = [existingHero('')];
    const hero = apply(s, recruit).state.heroes.find((h) => h.id === 'hero-p1-knight');
    expect(hero?.houseId).toBe('');
    expect(hero?.houseEffects).toEqual([]);
  });
});
