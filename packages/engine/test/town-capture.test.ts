import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

function startedGame(townOverrides: Partial<ReturnType<typeof testTown>> = {}): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources() }];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [{ ...testTown(), ownerPlayerId: null, ...townOverrides }],
  };
  const state = apply(createEmptyState(), cmd).state;
  // E3 : la capture exige un héros du joueur sur/adjacent à la ville (5,5).
  return {
    ...state,
    heroes: state.heroes.map((h) => (h.playerId === 'p1' ? { ...h, pos: { x: 5, y: 4 } } : h)),
  };
}

describe('CaptureTown', () => {
  it('capture immédiatement une ville sans garnison', () => {
    const state = startedGame({ garrison: [] });
    const { state: next, events } = apply(state, {
      type: 'CaptureTown',
      townId: 'town-1',
      playerId: 'p1',
    });
    expect(next.towns[0]?.ownerPlayerId).toBe('p1');
    expect(events).toContainEqual({ type: 'TownCaptured', townId: 'town-1', playerId: 'p1' });
  });

  it('assiéger une ville défendue sans armée est refusé (invalidArmy)', () => {
    // Le héros de départ n'a pas d'armée : impossible d'assiéger une garnison
    // (le siège lui-même est couvert par town-siege.test.ts).
    const state = startedGame({ garrison: [{ unitId: 'red-grunt', count: 3 }] });
    expect(
      validate(state, { type: 'CaptureTown', townId: 'town-1', playerId: 'p1' })?.code,
    ).toBe('invalidArmy');
  });

  it('Revue 2026-07 — B25 : la capture remet le choix de croissance partagée à zéro', () => {
    // Le choix (`sharedGrowthChoice`) appartenait à l'ANCIEN propriétaire : il ne
    // doit pas survivre au changement de main (ids de groupe/unité opaques).
    const state = startedGame({ garrison: [], sharedGrowthChoice: { apex: 'unit-x' } });
    const next = apply(state, { type: 'CaptureTown', townId: 'town-1', playerId: 'p1' }).state;
    expect(next.towns[0]?.ownerPlayerId).toBe('p1');
    expect(next.towns[0]?.sharedGrowthChoice).toEqual({});
  });

  it('rejette une ville inconnue', () => {
    const state = startedGame();
    expect(
      validate(state, { type: 'CaptureTown', townId: 'nope', playerId: 'p1' })?.code,
    ).toBe('unknownTown');
  });

  it('rejette la capture sans héros sur ou adjacent à la ville (E3, non confiance au client)', () => {
    const base = startedGame({ garrison: [] });
    // Éloigne le héros de la ville (5,5) : plus aucun héros de p1 à proximité.
    const state: GameState = {
      ...base,
      heroes: base.heroes.map((h) => (h.playerId === 'p1' ? { ...h, pos: { x: 0, y: 0 } } : h)),
    };
    expect(
      validate(state, { type: 'CaptureTown', townId: 'town-1', playerId: 'p1' })?.code,
    ).toBe('invalidAction');
  });
});
