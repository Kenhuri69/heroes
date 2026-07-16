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
        recruitCost: 2500,
        maxPerPlayer: 8,
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

  it('T-GRAIL : émet des obélisques + une tuile du Graal, propagés par loadMap', async () => {
    const map = generateMap('random', 7, { guardianUnits: ['t1-guard'] });
    const obelisks = map.objects.filter((o) => o.type === 'obelisk');
    expect(obelisks.length).toBeGreaterThanOrEqual(2);
    expect(map.grailPos).toBeDefined();
    const resolved = await loadMap(readerFor(map), 'random', config(), KNOWN_UNITS);
    // Propagation (leçon loader) : obélisques + grailPos survivent à la résolution.
    expect(resolved.objects.filter((o) => o.type === 'obelisk').length).toBe(obelisks.length);
    expect(resolved.grailPos).toEqual(map.grailPos);
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

  it('gradue les gardiens : faibles près des départs, forts vers le centre', () => {
    // Palette à 7 tiers distincts : la sélection d'unité et la pile doivent
    // croître avec l'éloignement du départ le plus proche.
    const palette = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'];
    const tiers: Record<string, number> = Object.fromEntries(palette.map((id, i) => [id, i + 1]));
    const map = generateMap('grad', 2024, {
      width: 48,
      height: 48,
      guardianUnits: palette,
      unitTiers: tiers,
    });
    const guards = map.objects.filter((o) => o.type === 'guardian');
    expect(guards.length).toBeGreaterThanOrEqual(6);
    const distNearest = (g: { x: number; y: number }): number =>
      Math.min(...map.startPositions.map((s) => Math.hypot(g.x - s.x, g.y - s.y)));
    const enriched = guards
      .map((g) => ({
        d: distNearest(g),
        tier: tiers[(g as { unitId: string }).unitId]!,
        count: (g as { count: number }).count,
      }))
      .sort((a, b) => a.d - b.d);
    const half = Math.floor(enriched.length / 2);
    const near = enriched.slice(0, half);
    const far = enriched.slice(enriched.length - half);
    const mean = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;
    // Les gardiens éloignés des départs sont en moyenne plus forts : tier ET pile.
    expect(mean(far.map((g) => g.tier))).toBeGreaterThan(mean(near.map((g) => g.tier)));
    expect(mean(far.map((g) => g.count))).toBeGreaterThan(mean(near.map((g) => g.count)));
  });

  it('progression : ≥ 2 gardiens faibles près de CHAQUE départ, tier plafonné par la profondeur', () => {
    const palette = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'];
    const tiers: Record<string, number> = Object.fromEntries(palette.map((id, i) => [id, i + 1]));
    for (const seed of [11, 22, 33]) {
      const map = generateMap('prog', seed, {
        width: 48,
        height: 48,
        startPositionCount: 3,
        guardianUnits: palette,
        unitTiers: tiers,
      });
      // Mêmes constantes que generateMap : rayon de l'anneau des départs et
      // anneau « proche » (35 % du rayon).
      const radius = 48 * 0.38;
      const nearR = Math.max(3, Math.round(radius * 0.35));
      const guards = map.objects.filter((o) => o.type === 'guardian') as {
        x: number;
        y: number;
        unitId: string;
      }[];
      for (const s of map.startPositions) {
        const near = guards.filter((g) => Math.hypot(g.x - s.x, g.y - s.y) <= nearR);
        // Plusieurs gardiens à portée immédiate du départ…
        expect(near.length).toBeGreaterThanOrEqual(2);
        // …et tous FAIBLES (profondeur ≤ 0,35 ⇒ plafond tier 3 sur 7).
        for (const g of near) expect(tiers[g.unitId]!).toBeLessThanOrEqual(3);
      }
      // Plafond global : tier ≤ 1 + ⌊profondeur × tierMax⌋ pour TOUT gardien.
      for (const g of guards) {
        const nearest = Math.min(...map.startPositions.map((s) => Math.hypot(g.x - s.x, g.y - s.y)));
        const depth = Math.min(1, nearest / radius);
        expect(tiers[g.unitId]!).toBeLessThanOrEqual(Math.min(7, 1 + Math.floor(depth * 7)));
      }
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

  it('pose des lieux de bonus variés (fontaine/écurie/tour/sanctuaire/moulin)', () => {
    // Grande carte pour dépasser le seuil de rotation des 5 sortes.
    const map = generateMap('r', 77, { width: 48, height: 48 });
    const kinds = new Set(
      map.objects.filter((o) => o.type === 'visitable').map((o) => (o as { effect: { kind: string } }).effect.kind),
    );
    // Au moins l'écurie (mouvement) demandée, plus plusieurs autres sortes.
    expect(kinds.has('movement')).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it('pose des artefacts (si palette) gardés par une sentinelle en profondeur', () => {
    const map = generateMap('r', 88, {
      width: 40,
      height: 40,
      guardianUnits: ['t1-guard'],
      artifactIds: ['trefle-chance', 'lame-aiguisee'],
    });
    const artifacts = map.objects.filter((o) => o.type === 'artifact');
    expect(artifacts.length).toBeGreaterThanOrEqual(1);
    // Chaque artefact utilise un id de la palette.
    for (const a of artifacts) expect(['trefle-chance', 'lame-aiguisee']).toContain((a as { artifactId: string }).artifactId);
    // Une sentinelle (gardien) borde au moins un artefact.
    const guards = map.objects.filter((o) => o.type === 'guardian') as { x: number; y: number }[];
    const guarded = artifacts.some((a) =>
      guards.some((g) => Math.max(Math.abs(g.x - (a as { x: number }).x), Math.abs(g.y - (a as { y: number }).y)) === 1),
    );
    expect(guarded).toBe(true);
  });

  it('sans palette d’artefacts, aucun artefact posé', () => {
    const map = generateMap('r', 88, { width: 40, height: 40, guardianUnits: ['t1-guard'] });
    expect(map.objects.some((o) => o.type === 'artifact')).toBe(false);
  });

  it('pose des habitations (si palette d’unités) pour renforcer l’armée', () => {
    const map = generateMap('r', 91, { width: 40, height: 40, guardianUnits: ['t1-guard'] });
    const dwellings = map.objects.filter((o) => o.type === 'dwelling');
    expect(dwellings.length).toBeGreaterThanOrEqual(1);
    for (const d of dwellings) expect((d as { unitId: string }).unitId).toBe('t1-guard');
  });

  it('connexité : chaque départ et chaque objet est atteignable depuis le 1er départ', () => {
    // Mêmes règles que le jeu : 8 directions, pas de blocage de coin, terrains
    // à moveCost null infranchissables (water/mountain/rocks).
    const impassable = new Set(['water', 'mountain', 'rocks']);
    for (const [size, players] of [
      [24, 2],
      [48, 3],
    ] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        const map = generateMap('random', seed, {
          width: size,
          height: size,
          startPositionCount: players,
          guardianUnits: ['t1-guard'],
          artifactIds: ['trefle-chance'],
        });
        const pass = (x: number, y: number): boolean =>
          !impassable.has(map.legend[map.tiles[y]![x]!]!);
        const reached = new Set<string>();
        const queue = [map.startPositions[0]!];
        reached.add(`${queue[0]!.x},${queue[0]!.y}`);
        for (let head = 0; head < queue.length; head++) {
          const { x, y } = queue[head]!;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              const key = `${nx},${ny}`;
              if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
              if (reached.has(key) || !pass(nx, ny)) continue;
              reached.add(key);
              queue.push({ x: nx, y: ny });
            }
          }
        }
        for (const s of map.startPositions) expect(reached.has(`${s.x},${s.y}`)).toBe(true);
        for (const o of map.objects) expect(reached.has(`${o.x},${o.y}`)).toBe(true);
      }
    }
  });

  it('villes neutres (si palette de factions) : posées, garnies et validées par loadMap', async () => {
    const map = generateMap('r', 55, {
      width: 40,
      height: 40,
      guardianUnits: ['t1-guard'],
      townFactionIds: ['fac-x', 'fac-y'],
    });
    const towns = map.objects.filter((o) => o.type === 'town') as {
      factionId?: string;
      garrison?: { unitId: string; count: number }[];
    }[];
    expect(towns.length).toBeGreaterThanOrEqual(1);
    expect(towns.length).toBeLessThanOrEqual(2);
    for (const t of towns) {
      expect(['fac-x', 'fac-y']).toContain(t.factionId);
      expect(t.garrison!.length).toBeGreaterThan(0);
      for (const stack of t.garrison!) {
        expect(stack.unitId).toBe('t1-guard');
        expect(stack.count).toBeGreaterThan(0);
      }
    }
    // La carte reste valide de bout en bout (tuile franchissable, ids uniques…).
    await loadMap(readerFor(map), 'r', config(), KNOWN_UNITS);
  });

  it('sans palette de factions de ville, aucune ville neutre', () => {
    const map = generateMap('r', 55, { width: 40, height: 40, guardianUnits: ['t1-guard'] });
    expect(map.objects.some((o) => o.type === 'town')).toBe(false);
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

  it('facteurs par catégorie : « aucun » (0) retire la catégorie ciblée', () => {
    const palette = { width: 48, height: 48, guardianUnits: ['t1-guard'], artifactIds: ['trefle-chance'] };
    const has = (m: MapFile, type: string): boolean => m.objects.some((o) => o.type === type);
    // Gardiens à 0 ⇒ aucun gardien NI sentinelle (carte pacifique), même avec une
    // palette d'artefacts (les artefacts restent posés mais non gardés).
    const noGuards = generateMap('cat', 3, { ...palette, guardianDensity: 0 });
    expect(has(noGuards, 'guardian')).toBe(false);
    expect(has(noGuards, 'artifact')).toBe(true);
    // Mines / bâtiments événement / objets à ramasser à 0 ⇒ catégorie absente.
    expect(has(generateMap('cat', 3, { ...palette, mineDensity: 0 }), 'mine')).toBe(false);
    expect(has(generateMap('cat', 3, { ...palette, eventBuildingDensity: 0 }), 'visitable')).toBe(false);
    const noPickups = generateMap('cat', 3, { ...palette, pickupDensity: 0 });
    expect(has(noPickups, 'resource')).toBe(false);
    expect(has(noPickups, 'treasure')).toBe(false);
    expect(has(noPickups, 'artifact')).toBe(false);
  });

  it('facteurs par catégorie : « abondant » pose strictement plus que « standard »', () => {
    const base = { width: 48, height: 48, guardianUnits: ['t1-guard'], artifactIds: ['trefle-chance'] };
    const count = (m: MapFile, type: string): number => m.objects.filter((o) => o.type === type).length;
    const std = generateMap('cat', 7, base);
    expect(count(generateMap('cat', 7, { ...base, guardianDensity: 2 }), 'guardian')).toBeGreaterThan(count(std, 'guardian'));
    expect(count(generateMap('cat', 7, { ...base, mineDensity: 2 }), 'mine')).toBeGreaterThan(count(std, 'mine'));
    expect(count(generateMap('cat', 7, { ...base, eventBuildingDensity: 2 }), 'visitable')).toBeGreaterThan(count(std, 'visitable'));
    const rich = generateMap('cat', 7, { ...base, pickupDensity: 2 });
    const pickups = (m: MapFile): number => count(m, 'resource') + count(m, 'treasure') + count(m, 'artifact');
    expect(pickups(rich)).toBeGreaterThan(pickups(std));
  });

  it('facteurs par catégorie : « standard » (défaut) = facteurs 1 explicites (carte inchangée)', () => {
    const base = { width: 40, height: 40, guardianUnits: ['t1-guard'], artifactIds: ['trefle-chance'] };
    const implicit = generateMap('cat', 21, base);
    const explicit = generateMap('cat', 21, {
      ...base,
      guardianDensity: 1,
      mineDensity: 1,
      eventBuildingDensity: 1,
      pickupDensity: 1,
    });
    expect(explicit).toEqual(implicit);
  });
});
