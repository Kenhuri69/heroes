import type { MapFile } from './schemas';

/**
 * Générateur de cartes aléatoires (doc 09, Phase 4 Live) — fonction PURE et
 * DÉTERMINISTE : même graine ⇒ même carte. PRNG seedé auto-contenu (mulberry32)
 * — jamais `Math.random` (déterminisme, comme le moteur). Produit un `MapFile`
 * **valide par construction** (schéma + règles croisées de `loadMap`) : tuiles de
 * départ/objet forcées franchissables, ids uniques, bornes, trésor à gain > 0.
 * Vit dans `@heroes/content`, à côté de `loadMap` — zéro diff moteur.
 */

export interface MapGenOptions {
  /** Largeur (défaut 24, min 12). */
  width?: number;
  /** Hauteur (défaut 24, min 12). */
  height?: number;
  /** Terrain de base franchissable (défaut 'grass'). */
  baseTerrain?: string;
  /** Terrains d'obstacle infranchissables posés en amas (défaut ['water','mountain']). */
  obstacleTerrains?: string[];
  /** Palette d'unités connues pour les gardiens (vide ⇒ aucun gardien). */
  guardianUnits?: string[];
}

/** PRNG déterministe mulberry32 — retourne un flottant dans [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chars de légende distincts (tuiles ≠ routes '0'/'1'). */
const CHAR_POOL = 'gwmskpz';
const RESOURCE_IDS = ['gold', 'wood', 'ore', 'crystal', 'gems'] as const;

export function generateMap(id: string, seed: number, opts: MapGenOptions = {}): MapFile {
  const width = Math.max(12, opts.width ?? 24);
  const height = Math.max(12, opts.height ?? 24);
  const baseTerrain = opts.baseTerrain ?? 'grass';
  const obstacleTerrains = opts.obstacleTerrains ?? ['water', 'mountain'];
  const guardianUnits = opts.guardianUnits ?? [];

  const rand = mulberry32(seed);
  const randInt = (n: number): number => Math.floor(rand() * n);
  const randBetween = (min: number, max: number): number => min + randInt(max - min + 1);

  // Légende : base + obstacles → chars distincts du pool.
  const terrainIds = [baseTerrain, ...obstacleTerrains];
  const legend: Record<string, string> = {};
  const charOf: Record<string, string> = {};
  terrainIds.forEach((tid, i) => {
    const ch = CHAR_POOL[i]!;
    legend[ch] = tid;
    charOf[tid] = ch;
  });
  const baseChar = charOf[baseTerrain]!;

  // Grille de terrain : base, puis amas d'obstacles (disques aléatoires).
  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => baseChar),
  );
  const blobs = Math.max(2, Math.floor((width * height) / 130));
  for (const tid of obstacleTerrains) {
    for (let b = 0; b < blobs; b++) {
      const cx = randInt(width);
      const cy = randInt(height);
      const r = 1 + randInt(3);
      for (let y = Math.max(0, cy - r); y <= Math.min(height - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(width - 1, cx + r); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) grid[y]![x] = charOf[tid]!;
        }
      }
    }
  }

  // Positions de départ opposées, forcées franchissables.
  const mid = Math.floor(height / 2);
  const startPositions = [
    { x: 2, y: mid },
    { x: width - 3, y: mid },
  ];
  for (const s of startPositions) grid[s.y]![s.x] = baseChar;

  // Objets : placés sur des tuiles libres, forcées franchissables, uniques.
  const objects: MapFile['objects'] = [];
  const occupied = new Set(startPositions.map((s) => `${s.x},${s.y}`));
  const place = (make: (x: number, y: number, i: number) => MapFile['objects'][number]): void => {
    for (let tries = 0; tries < 60; tries++) {
      const x = randInt(width);
      const y = randInt(height);
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      grid[y]![x] = baseChar; // garantit la franchissabilité
      objects.push(make(x, y, objects.length));
      return;
    }
  };

  const resAmount = (res: string): number => (res === 'gold' ? randBetween(200, 900) : randBetween(2, 6));
  for (let i = 0; i < randBetween(4, 6); i++) {
    place((x, y, n) => {
      const resource = RESOURCE_IDS[randInt(RESOURCE_IDS.length)]!;
      return { id: `res-${n}`, type: 'resource', x, y, resource, amount: resAmount(resource) };
    });
  }
  for (let i = 0; i < randBetween(2, 3); i++) {
    place((x, y, n) => {
      const resource = RESOURCE_IDS[randInt(RESOURCE_IDS.length)]!;
      return {
        id: `mine-${n}`,
        type: 'mine',
        x,
        y,
        resource,
        amount: resource === 'gold' ? randBetween(100, 400) : randBetween(1, 3),
      };
    });
  }
  for (let i = 0; i < randBetween(1, 2); i++) {
    place((x, y, n) => ({
      id: `chest-${n}`,
      type: 'treasure',
      x,
      y,
      gold: randBetween(500, 1500),
      xp: randBetween(200, 600),
    }));
  }
  place((x, y, n) => ({
    id: `fountain-${n}`,
    type: 'visitable',
    x,
    y,
    effect: { kind: 'luck', amount: 1 },
    frequency: 'oncePerHeroPerWeek',
  }));
  if (guardianUnits.length > 0) {
    for (let i = 0; i < randBetween(1, 3); i++) {
      place((x, y, n) => ({
        id: `guard-${n}`,
        type: 'guardian',
        x,
        y,
        unitId: guardianUnits[randInt(guardianUnits.length)]!,
        count: randBetween(5, 20),
      }));
    }
  }

  const zeros = '0'.repeat(width);
  return {
    id,
    schemaVersion: 1,
    width,
    height,
    legend,
    tiles: grid.map((row) => row.join('')),
    roads: Array.from({ length: height }, () => zeros),
    objects,
    startPositions,
  };
}
