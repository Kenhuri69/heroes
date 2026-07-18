import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { BuildingDef } from '../src/town/types';
import type { AdventureMapDef } from '../src/adventure/map';
import { testConfig } from './fixtures';

/**
 * Chantier naval (A3.3, doc 18 A3) : une ville dotée d'un `shipyard` construit un
 * bateau sur une tuile d'eau navigable adjacente, contre le `boatCost` de l'effet.
 */
const SHIPYARD: BuildingDef = {
  id: 'shipyard',
  maxLevel: 1,
  levels: [{ cost: {}, requires: [], effect: { type: 'shipyard', boatCost: { gold: 1000 } } }],
};

// Config où l'eau est navigable (A3.1).
const navalConfig = {
  ...testConfig(),
  terrains: { ...testConfig().terrains, water: { moveCost: null, navalCost: 100 } },
};

/** Carte 5×5 d'herbe avec (optionnellement) de l'eau en (2,3), sous la ville (2,2). */
function map(withWater: boolean): AdventureMapDef {
  const terrain = Array<string>(25).fill('grass');
  if (withWater) terrain[3 * 5 + 2] = 'water'; // (2,3)
  return {
    id: 'm',
    width: 5,
    height: 5,
    terrain,
    road: Array<boolean>(25).fill(false),
    triggers: [],
    objects: [],
    startPositions: [{ x: 0, y: 0 }],
  };
}

function stateWithShipyard(gold = 2000, withWater = true): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = navalConfig;
  s.rng = seedRng(7);
  s.currentPlayer = 0;
  s.map = map(withWater);
  s.players = [
    {
      id: 'p1',
      resources: { ...emptyResources(), gold },
      factionResources: {},
      explored: [],
      controller: 'human',
      eliminated: false,
      townlessDays: 0,
      huntContract: null,
      team: 0,
    },
  ];
  s.towns = [
    {
      id: 't1',
      ownerPlayerId: 'p1',
      pos: { x: 2, y: 2 },
      factionId: '',
      buildings: { shipyard: 1 },
      builtToday: false,
      garrison: [],
      stock: {},
      spellPool: [],
      sharedGrowthChoice: {},
    },
  ];
  s.buildingCatalog = { shipyard: SHIPYARD };
  return s;
}

describe('BuildBoat (chantier naval)', () => {
  it('construit un bateau sur l’eau adjacente, débite le coût, émet BoatBuilt', () => {
    const { state: next, events } = apply(stateWithShipyard(2000), { type: 'BuildBoat', townId: 't1' });
    const boat = next.map?.objects.find((o) => o.type === 'boat');
    expect(boat?.pos).toEqual({ x: 2, y: 3 });
    expect(next.players[0]?.resources.gold).toBe(2000 - 1000);
    expect(events).toContainEqual({ type: 'BoatBuilt', townId: 't1', boatId: boat!.id, pos: { x: 2, y: 3 } });
  });

  it('rejette sans chantier naval construit (noShipyard)', () => {
    const s = stateWithShipyard();
    s.towns[0]!.buildings = {}; // pas de shipyard
    expect(validate(s, { type: 'BuildBoat', townId: 't1' })?.code).toBe('noShipyard');
  });

  it('rejette sans eau adjacente (noAdjacentWater)', () => {
    expect(validate(stateWithShipyard(2000, false), { type: 'BuildBoat', townId: 't1' })?.code).toBe(
      'noAdjacentWater',
    );
  });

  it('rejette si l’unique eau adjacente est déjà occupée par un bateau (noAdjacentWater)', () => {
    const s = stateWithShipyard();
    s.map!.objects.push({ id: 'boat@2,3', type: 'boat', pos: { x: 2, y: 3 } });
    expect(validate(s, { type: 'BuildBoat', townId: 't1' })?.code).toBe('noAdjacentWater');
  });

  it('rejette si l’or manque (cannotAfford)', () => {
    expect(validate(stateWithShipyard(100), { type: 'BuildBoat', townId: 't1' })?.code).toBe(
      'cannotAfford',
    );
  });
});
