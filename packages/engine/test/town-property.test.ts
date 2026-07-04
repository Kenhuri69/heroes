import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { RESOURCE_IDS, createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

const BUILDING_IDS = ['townHall', 'fort', 'dwelling1'];

function start(): GameState {
  const players: PlayerSetup[] = [
    {
      id: 'p1',
      startingResources: {
        ...emptyResources(),
        gold: 50000,
        wood: 5000,
        ore: 500,
        gems: 100,
        crystal: 100,
      },
    },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [testTown()],
  };
  return apply(createEmptyState(), cmd).state;
}

/** Un pas d'action légale ou d'attente (EndTurn) — jamais de commande invalide envoyée à `apply`. */
function step(state: GameState, action: 'build' | 'recruit' | 'end'): GameState {
  if (action === 'build') {
    for (const buildingId of BUILDING_IDS) {
      const cmd: Command = { type: 'BuildStructure', townId: 'town-1', buildingId };
      if (validate(state, cmd) === null) return apply(state, cmd).state;
    }
    return state;
  }
  if (action === 'recruit') {
    const stock = state.towns[0]?.stock['red-grunt'] ?? 0;
    const count = Math.min(3, stock);
    if (count > 0) {
      const cmd: Command = { type: 'RecruitUnits', townId: 'town-1', unitId: 'red-grunt', count };
      if (validate(state, cmd) === null) return apply(state, cmd).state;
    }
    return state;
  }
  return apply(state, { type: 'EndTurn', playerId: 'p1' }).state;
}

describe('propriétés du town building', () => {
  it('enchaînement aléatoire de commandes légales ⇒ ressources ≥ 0, stock ≥ 0, ≤ 7 piles en garnison', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<'build' | 'recruit' | 'end'>('build', 'recruit', 'end'), {
          minLength: 1,
          maxLength: 40,
        }),
        (actions) => {
          let s = start();
          for (const action of actions) {
            s = step(s, action);
            for (const player of s.players) {
              for (const id of RESOURCE_IDS) expect(player.resources[id]).toBeGreaterThanOrEqual(0);
            }
            const town = s.towns[0];
            if (town) {
              for (const count of Object.values(town.stock)) expect(count).toBeGreaterThanOrEqual(0);
              expect(town.garrison.length).toBeLessThanOrEqual(7);
              for (const stack of town.garrison) expect(stack.count).toBeGreaterThan(0);
            }
          }
        },
      ),
    );
  });
});
