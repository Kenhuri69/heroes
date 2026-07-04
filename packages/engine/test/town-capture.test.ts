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
  return apply(createEmptyState(), cmd).state;
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

  it('rejette la capture d’une ville défendue (garnison non vide)', () => {
    const state = startedGame({ garrison: [{ unitId: 'red-grunt', count: 3 }] });
    expect(
      validate(state, { type: 'CaptureTown', townId: 'town-1', playerId: 'p1' })?.code,
    ).toBe('invalidAction');
  });

  it('rejette une ville inconnue', () => {
    const state = startedGame();
    expect(
      validate(state, { type: 'CaptureTown', townId: 'nope', playerId: 'p1' })?.code,
    ).toBe('unknownTown');
  });
});
