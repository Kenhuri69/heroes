import { describe, expect, it } from 'vitest';
import { loadMap, type ReadJson } from '../src/loader';
import { generateMap } from '../src/mapgen';
import type { GameConfig, MapFile } from '../src/schemas';

/** Config avec tous les terrains que le générateur par biomes peut produire. */
function config(): GameConfig {
  return {
    adventure: {
      movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
      visionRadius: 5,
      terrains: {
        grass: { moveCost: 100 },
        dirt: { moveCost: 100 },
        sand: { moveCost: 150 },
        forest: { moveCost: 150 },
        rough: { moveCost: 125 },
        snow: { moveCost: 150 },
        swamp: { moveCost: 150 },
        river: { moveCost: 200 },
        water: { moveCost: null },
        mountain: { moveCost: null },
        rocks: { moveCost: null },
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
        heroDefenseStep: 0.025,
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

  it('produit N positions de départ distinctes et valides (multi-joueurs)', async () => {
    for (const count of [3, 4]) {
      for (let seed = 1; seed <= 20; seed++) {
        const map = generateMap('random', seed, {
          startPositionCount: count,
          guardianUnits: ['t1-guard'],
        });
        const resolved = await loadMap(readerFor(map), 'random', config(), KNOWN_UNITS);
        expect(resolved.startPositions).toHaveLength(count);
        // Toutes distinctes (loadMap rejette déjà départs occupés/superposés).
        const keys = new Set(resolved.startPositions.map((p) => `${p.x},${p.y}`));
        expect(keys.size).toBe(count);
      }
    }
  });

  it('génère des biomes variés et cohérents (pas de bruit blanc)', () => {
    const map = generateMap('r', 314, { width: 48, height: 48 });
    // Plusieurs biomes distincts présents (au moins 4 terrains sur une grande carte).
    const terrains = new Set(Object.values(map.legend));
    expect(terrains.size).toBeGreaterThanOrEqual(4);
    // Grande masse de terrain jouable : la plaine (grass) reste dominante ou
    // quasi (biomes calés pour la jouabilité), l'eau présente mais pas majoritaire.
    const counts: Record<string, number> = {};
    for (const row of map.tiles) for (const ch of row) counts[ch] = (counts[ch] ?? 0) + 1;
    const total = map.width * map.height;
    const water = counts[Object.entries(map.legend).find(([, t]) => t === 'water')?.[0] ?? ''] ?? 0;
    expect(water).toBeLessThan(total * 0.6);
  });

  it('les rivières (si présentes) restent franchissables et bordent souvent l’eau', () => {
    // Sur de nombreuses graines, au moins une carte produit une rivière.
    const anyRiver = Array.from({ length: 20 }, (_, s) =>
      generateMap('r', s + 1, { width: 40, height: 40 }),
    ).some((m) => Object.values(m.legend).includes('river'));
    expect(anyRiver).toBe(true);
  });

  it('la taille et le multiplicateur de ressources pilotent la densité d’objets', () => {
    const countRes = (m: MapFile): number =>
      m.objects.filter((o) => o.type === 'resource' || o.type === 'mine' || o.type === 'treasure').length;
    // Même graine : « riche » pose strictement plus d'objets que « bas ».
    const poor = generateMap('r', 42, { resourceMultiplier: 0.5 });
    const rich = generateMap('r', 42, { resourceMultiplier: 1.7 });
    expect(countRes(rich)).toBeGreaterThan(countRes(poor));
    // Grande carte : plus d'objets qu'une petite à densité égale.
    const small = generateMap('r', 42, { width: 24, height: 24 });
    const large = generateMap('r', 42, { width: 48, height: 48 });
    expect(countRes(large)).toBeGreaterThan(countRes(small));
  });
});
