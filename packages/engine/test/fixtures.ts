import type { AdventureConfig } from '../src/adventure/config';
import type { AdventureMapDef } from '../src/adventure/map';
import type { CombatUnitDef } from '../src/combat/types';

/** Catalogue d'unités de test — deux groupes pour couvrir le malus multi-groupes. */
export function testCatalog(): Record<string, CombatUnitDef> {
  return {
    'red-grunt': {
      id: 'red-grunt',
      groupId: 'red-pack',
      nativeTerrain: 'grass',
      stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 },
      abilities: [],
    },
    'red-archer': {
      id: 'red-archer',
      groupId: 'red-pack',
      nativeTerrain: 'grass',
      stats: { hp: 8, attack: 5, defense: 2, damage: [2, 4], speed: 5 },
      abilities: [{ id: 'shooter', params: { ammo: 10 } }],
    },
    'blue-wolf': {
      id: 'blue-wolf',
      groupId: 'blue-pack',
      nativeTerrain: 'swamp',
      stats: { hp: 10, attack: 4, defense: 3, damage: [2, 3], speed: 6 },
      abilities: [],
    },
  };
}

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
    combat: testCombatRules(),
    hero: {
      xpPerHpKilled: 1,
      levelCurve: { base: 1000, exponent: 1.9 },
      maxLevel: 30,
      attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 },
    },
  };
}

export function testCombatRules(): AdventureConfig['combat'] {
  return {
    attackDefenseStep: 0.05,
    damageBonusMax: 0.6,
    damageReductionMax: 0.7,
    defendDefenseMultiplier: 1.3,
    rangedMeleePenalty: 0.5,
    moraleChancePerPoint: 0.04,
    luckChancePerPoint: 0.04,
    markBonusPerStack: 0.08,
    marksMax: 3,
    obstaclesMin: 2,
    obstaclesMax: 5,
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
