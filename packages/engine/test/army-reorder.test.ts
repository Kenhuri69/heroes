import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { ArmyStack } from '../src/combat/types';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * UX-REORDER (doc 08 §2.1/§2.3) — `ReorderArmy` déplace une pile d'un index à un
 * autre dans `hero.army` (l'ordre pèse sur le placement de combat). Le héros de
 * départ est `hero-p1`, doté via `startingArmy`.
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

const A: ArmyStack = { unitId: 'red-grunt', count: 1 };
const B: ArmyStack = { unitId: 'red-archer', count: 2 };
const C: ArmyStack = { unitId: 'blue-wolf', count: 3 };

describe('UX-REORDER — ReorderArmy', () => {
  it('déplace une pile vers un index plus grand (0 → 2)', () => {
    const state = startedGame([A, B, C]);
    const next = apply(state, { type: 'ReorderArmy', heroId: 'hero-p1', from: 0, to: 2 }).state;
    expect(next.heroes[0]?.army).toEqual([B, C, A]);
  });

  it('déplace une pile vers un index plus petit (2 → 0)', () => {
    const state = startedGame([A, B, C]);
    const next = apply(state, { type: 'ReorderArmy', heroId: 'hero-p1', from: 2, to: 0 }).state;
    expect(next.heroes[0]?.army).toEqual([C, A, B]);
  });

  it('from === to est un no-op', () => {
    const state = startedGame([A, B, C]);
    const next = apply(state, { type: 'ReorderArmy', heroId: 'hero-p1', from: 1, to: 1 }).state;
    expect(next.heroes[0]?.army).toEqual([A, B, C]);
  });

  it('rejette un index hors de l’armée (invalidReorder)', () => {
    const state = startedGame([A, B]);
    expect(validate(state, { type: 'ReorderArmy', heroId: 'hero-p1', from: 0, to: 5 })?.code).toBe(
      'invalidReorder',
    );
    expect(validate(state, { type: 'ReorderArmy', heroId: 'hero-p1', from: -1, to: 0 })?.code).toBe(
      'invalidReorder',
    );
  });

  it('rejette le héros d’un autre joueur (notYourHero)', () => {
    const state = startedGame([A, B]);
    // p2 possède `hero-p2` mais ce n’est pas son tour (currentPlayer = p1).
    expect(validate(state, { type: 'ReorderArmy', heroId: 'hero-p2', from: 0, to: 1 })?.code).toBe(
      'notYourHero',
    );
  });

  it('rejette un héros inconnu (unknownHero)', () => {
    const state = startedGame([A, B]);
    expect(validate(state, { type: 'ReorderArmy', heroId: 'ghost', from: 0, to: 1 })?.code).toBe(
      'unknownHero',
    );
  });
});
