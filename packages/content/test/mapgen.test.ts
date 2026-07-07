import { describe, expect, it } from 'vitest';
import { loadMap, type ReadJson } from '../src/loader';
import { generateMap } from '../src/mapgen';
import type { GameConfig, MapFile } from '../src/schemas';

/** Config minimale avec les 4 terrains dont le générateur se sert par défaut. */
function config(): GameConfig {
  return {
    adventure: {
      movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
      visionRadius: 5,
      terrains: {
        grass: { moveCost: 100 },
        swamp: { moveCost: 150 },
        water: { moveCost: null },
        mountain: { moveCost: null },
      },
      market: { sellRate: 25, buyRate: 50 },
      hero: {
        xpPerHpKilled: 1,
        levelCurve: { base: 1000, exponent: 1.9 },
        maxLevel: 30,
        attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 },
      },
      combat: {
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
      },
    },
    newGame: { map: 'mini', startingResources: { gold: 2000 }, startingArmy: [] },
    display: { strengthBands: [{ max: null, key: 'legion' }] },
  };
}

const KNOWN_UNITS = new Set(['t1-guard']);

/** `ReadJson` qui ne sert que la carte générée (validation en mémoire). */
function readerFor(map: MapFile): ReadJson {
  return (path) =>
    path === `maps/${map.id}.map.json`
      ? Promise.resolve(map)
      : Promise.reject(new Error(`lecture inattendue : ${path}`));
}

describe('generateMap', () => {
  it('produit une carte TOUJOURS valide (loadMap) sur de nombreuses graines', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const map = generateMap('random', seed, { guardianUnits: ['t1-guard'] });
      const resolved = await loadMap(readerFor(map), 'random', config(), KNOWN_UNITS);
      expect(resolved.width).toBe(map.width);
      expect(resolved.height).toBe(map.height);
      expect(resolved.startPositions).toHaveLength(2);
      // Départs distincts.
      const [a, b] = resolved.startPositions;
      expect(a).not.toEqual(b);
    }
  });

  it('est déterministe : même graine ⇒ carte identique', () => {
    const a = generateMap('r', 123, { guardianUnits: ['t1-guard'] });
    const b = generateMap('r', 123, { guardianUnits: ['t1-guard'] });
    expect(a).toEqual(b);
  });

  it('graines différentes ⇒ cartes différentes', () => {
    const a = generateMap('r', 1);
    const b = generateMap('r', 2);
    expect(a.tiles).not.toEqual(b.tiles);
  });

  it('sans palette de gardiens, aucun gardien (unité inconnue évitée)', () => {
    const map = generateMap('r', 7);
    expect(map.objects.some((o) => o.type === 'guardian')).toBe(false);
  });

  it('avec palette, les gardiens n’utilisent que des unités de la palette', () => {
    const map = generateMap('r', 9, { guardianUnits: ['t1-guard'] });
    for (const o of map.objects) {
      if (o.type === 'guardian') expect(o.unitId).toBe('t1-guard');
    }
  });
});
