import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { ArmyStack } from '../src/combat/types';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * UX-SPLIT (doc 08 §2.1/§2.3) — `SplitStack` retire `count` créatures d'une pile
 * et crée une nouvelle pile du même unitId ajoutée en fin d'`army` (compact ≤ 7).
 * Le héros de départ est `hero-p1`, doté via `startingArmy`.
 */
function startedGame(startingArmy: ArmyStack[]): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy },
    { id: 'p2', startingResources: emptyResources() },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [{ ...testTown(), pos: { x: 0, y: 0 } }],
  };
  return apply(createEmptyState(), cmd).state;
}

describe('UX-SPLIT — SplitStack', () => {
  it('sépare une pile en deux (nouvelle pile ajoutée en fin)', () => {
    const state = startedGame([{ unitId: 'red-grunt', count: 20 }]);
    const next = apply(state, { type: 'SplitStack', heroId: 'hero-p1', from: 0, count: 8 }).state;
    expect(next.heroes[0]?.army).toEqual([
      { unitId: 'red-grunt', count: 12 },
      { unitId: 'red-grunt', count: 8 },
    ]);
  });

  it('rejette count ≥ effectif de la source (invalidSplit)', () => {
    const state = startedGame([{ unitId: 'red-grunt', count: 5 }]);
    expect(validate(state, { type: 'SplitStack', heroId: 'hero-p1', from: 0, count: 5 })?.code).toBe(
      'invalidSplit',
    );
    expect(validate(state, { type: 'SplitStack', heroId: 'hero-p1', from: 0, count: 6 })?.code).toBe(
      'invalidSplit',
    );
  });

  it('rejette count < 1 (invalidSplit)', () => {
    const state = startedGame([{ unitId: 'red-grunt', count: 5 }]);
    expect(validate(state, { type: 'SplitStack', heroId: 'hero-p1', from: 0, count: 0 })?.code).toBe(
      'invalidSplit',
    );
  });

  it('rejette une pile source hors bornes (invalidSplit)', () => {
    const state = startedGame([{ unitId: 'red-grunt', count: 5 }]);
    expect(validate(state, { type: 'SplitStack', heroId: 'hero-p1', from: 3, count: 1 })?.code).toBe(
      'invalidSplit',
    );
  });

  it('rejette une armée pleine (7 piles, invalidSplit)', () => {
    const full: ArmyStack[] = Array.from({ length: 7 }, () => ({ unitId: 'red-grunt', count: 4 }));
    const state = startedGame(full);
    expect(validate(state, { type: 'SplitStack', heroId: 'hero-p1', from: 0, count: 2 })?.code).toBe(
      'invalidSplit',
    );
  });

  it('rejette le héros d’un autre joueur (notYourHero)', () => {
    const state = startedGame([{ unitId: 'red-grunt', count: 5 }]);
    expect(validate(state, { type: 'SplitStack', heroId: 'hero-p2', from: 0, count: 1 })?.code).toBe(
      'notYourHero',
    );
  });

  it('rejette un héros inconnu (unknownHero)', () => {
    const state = startedGame([{ unitId: 'red-grunt', count: 5 }]);
    expect(validate(state, { type: 'SplitStack', heroId: 'ghost', from: 0, count: 1 })?.code).toBe(
      'unknownHero',
    );
  });
});
