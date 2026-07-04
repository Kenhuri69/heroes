import type { AdventureConfig } from '../src/adventure/config';
import type { AdventureMapDef } from '../src/adventure/map';

/** Config d'équilibrage de test — mêmes valeurs de départ que data/core/config.json. */
export function testConfig(): AdventureConfig {
  return {
    movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
    visionRadius: 5,
    terrains: {
      grass: { moveCost: 100 },
      swamp: { moveCost: 150 },
      water: { moveCost: null },
      mountain: { moveCost: null },
    },
  };
}

/**
 * Carte de test 10×10 lisible en ASCII : g=herbe, s=marais, w=eau, m=montagne.
 * `roads` marque la rangée y=8 comme route. 8 positions de départ (max joueurs).
 */
export function testMap(): AdventureMapDef {
  const rows = [
    'gggggggggg',
    'gggggmgggg',
    'gggggmgggg',
    'gggggmgggg',
    'ggsssmgggg',
    'ggsssmgggg',
    'ggsssggggg',
    'gwwggggggg',
    'gggggggggg',
    'gggggggggg',
  ];
  const legend: Record<string, string> = { g: 'grass', s: 'swamp', w: 'water', m: 'mountain' };
  const terrain = rows.flatMap((row) => [...row].map((c) => legend[c] as string));
  const road = terrain.map((_, i) => Math.floor(i / 10) === 8);
  return {
    id: 'test-map',
    width: 10,
    height: 10,
    terrain,
    road,
    objects: [
      { id: 'gold-1', type: 'resource', pos: { x: 3, y: 0 }, resource: 'gold', amount: 500 },
    ],
    startPositions: [
      { x: 0, y: 0 },
      { x: 9, y: 9 },
      { x: 0, y: 9 },
      { x: 9, y: 0 },
      { x: 4, y: 9 },
      { x: 9, y: 4 },
      { x: 0, y: 4 },
      { x: 4, y: 0 },
    ],
  };
}
