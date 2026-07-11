import type { MapFile } from './schemas';

/**
 * Générateur de cartes aléatoires (doc 09, Phase 4 Live) — fonction PURE et
 * DÉTERMINISTE : même graine ⇒ même carte. PRNG seedé auto-contenu (mulberry32)
 * + bruit de valeur seedé — jamais `Math.random` (déterminisme, comme le moteur).
 * Produit un `MapFile` **valide par construction** (schéma + règles croisées de
 * `loadMap`) : tuiles de départ/objet forcées franchissables, ids uniques, bornes,
 * trésor à gain > 0. Vit dans `@heroes/content`, à côté de `loadMap` — zéro diff moteur.
 *
 * Génération **par biomes** (pas de simple bruit blanc) : trois champs de bruit
 * fractal (élévation, humidité, température) classent chaque tuile en un terrain
 * cohérent — mers/lacs en creux, plages de sable au rivage, forêts en zones humides
 * d'altitude moyenne, marais en creux humides, rough en hauteurs sèches, neige au
 * froid, montagnes/rochers en altitude — puis des **rivières** descendent en pente
 * jusqu'à l'eau (terrain franchissable). Les terrains produits doivent exister dans
 * `config.adventure.terrains` (validé au load).
 */

export interface MapGenOptions {
  /** Largeur (défaut 24, min 12). */
  width?: number;
  /** Hauteur (défaut 24, min 12). */
  height?: number;
  /** Terrain de base franchissable imposé sous les départs/objets (défaut 'grass'). */
  baseTerrain?: string;
  /** Palette d'unités connues pour les gardiens (vide ⇒ aucun gardien). */
  guardianUnits?: string[];
  /**
   * Tier (1–8) de chaque unité de la palette (id → tier). Sert à **graduer** la
   * force des gardiens selon l'éloignement des départs (faible près des départs,
   * fort au centre). Absent ⇒ tier 1 par défaut : seule la taille de pile gradue.
   */
  unitTiers?: Record<string, number>;
  /** Nombre de positions de départ à répartir (défaut 2, min 2) — une par joueur. */
  startPositionCount?: number;
  /**
   * Multiplicateur de densité de ressources/mines/trésors (défaut 1). Sert au
   * réglage « bas / riche » : < 1 = carte pauvre, > 1 = carte riche. La densité
   * de base est aussi mise à l'échelle par l'aire de la carte (grandes cartes =
   * plus d'objets à densité constante).
   */
  resourceMultiplier?: number;
  /**
   * Palette d'artefacts connus posables au sol (vide ⇒ aucun artefact, comme
   * `guardianUnits`). Les artefacts sont placés **en profondeur** et gardés par
   * une sentinelle — la récompense premium de la carte.
   */
  artifactIds?: string[];
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

/**
 * Bruit de valeur 2D lissé, déterministe et sans état (hash entier seedé) → [0,1).
 * Résolution-indépendant : ne dépend que des coordonnées entières environnantes,
 * donc reproductible quelle que soit la taille de carte.
 */
function makeValueNoise(seed: number): (x: number, y: number) => number {
  const hash = (ix: number, iy: number): number => {
    let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ (seed | 0)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number): number => t * t * (3 - 2 * t); // smoothstep
  return (x: number, y: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const n00 = hash(x0, y0);
    const n10 = hash(x0 + 1, y0);
    const n01 = hash(x0, y0 + 1);
    const n11 = hash(x0 + 1, y0 + 1);
    const nx0 = n00 + (n10 - n00) * fx;
    const nx1 = n01 + (n11 - n01) * fx;
    return nx0 + (nx1 - nx0) * fy;
  };
}

/** Bruit fractal (fBm) : somme d'octaves → champ organique normalisé dans ~[0,1]. */
function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  freq: number,
  octaves = 4,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** Char de légende stable par terrain (distinct de '0'/'1' réservés aux routes). */
const TERRAIN_CHARS: Record<string, string> = {
  grass: 'g',
  dirt: 'd',
  sand: 'a',
  forest: 'f',
  rough: 'r',
  snow: 'n',
  swamp: 's',
  river: 'v',
  water: 'w',
  mountain: 'm',
  rocks: 'k',
};

const RESOURCE_IDS = ['gold', 'wood', 'ore', 'crystal', 'gems'] as const;

// Seuils de classification (sur des champs fBm centrés ~0,5). Réglés pour une
// carte majoritairement jouable (plaines dominantes), de l'eau notable, des
// reliefs formant des chaînes plutôt que du bruit.
const SEA = 0.34; // sous ce niveau d'élévation : eau
const BEACH = SEA + 0.03; // frange côtière : sable
const ROCK = 0.68; // contreforts rocheux
const MOUNTAIN = 0.74; // sommets infranchissables
const WET = 0.6; // humidité forêt/marais
const DRY = 0.34; // aridité rough/sable
const COLD = 0.3; // froid → neige

/** Classe une tuile de TERRE en biome selon élévation/humidité/température. */
function landBiome(e: number, m: number, t: number, detail: number): string {
  if (t < COLD) return 'snow';
  if (m > WET) return e < SEA + 0.1 ? 'swamp' : 'forest';
  if (m < DRY) return e < SEA + 0.1 ? 'sand' : 'rough';
  return detail > 0.66 ? 'dirt' : 'grass'; // plaine, quelques plaques de terre
}

export function generateMap(id: string, seed: number, opts: MapGenOptions = {}): MapFile {
  const width = Math.max(12, opts.width ?? 24);
  const height = Math.max(12, opts.height ?? 24);
  const baseTerrain = opts.baseTerrain ?? 'grass';
  const guardianUnits = opts.guardianUnits ?? [];
  const unitTiers = opts.unitTiers ?? {};
  const startPositionCount = Math.max(2, opts.startPositionCount ?? 2);
  const resourceMultiplier = opts.resourceMultiplier ?? 1;
  const artifactIds = opts.artifactIds ?? [];
  // Densité constante quelle que soit la taille : les compteurs d'objets calés
  // sur une carte de base 24×24 sont mis à l'échelle par l'aire, puis par le
  // réglage bas/riche. Au moins 1 objet des catégories principales.
  const areaFactor = (width * height) / (24 * 24);
  const density = areaFactor * resourceMultiplier;
  const scaled = (base: number, min = 1): number => Math.max(min, Math.round(base * density));

  const rand = mulberry32(seed);
  const randInt = (n: number): number => Math.floor(rand() * n);
  const randBetween = (min: number, max: number): number => min + randInt(max - min + 1);

  // ── Champs de bruit (fréquences calées sur la plus grande dimension pour un
  // rendu comparable quelle que soit la taille) et classification en biomes. ──
  const elevNoise = makeValueNoise(seed);
  const moistNoise = makeValueNoise(seed ^ 0x9e3779b9);
  const tempNoise = makeValueNoise(seed ^ 0x85ebca6b);
  const detailNoise = makeValueNoise(seed ^ 0xc2b2ae35);
  const maxDim = Math.max(width, height);
  const fE = 4 / maxDim; // ~4 grands massifs de relief en travers de la carte
  const fM = 5 / maxDim;
  const fT = 3 / maxDim;
  const fD = 14 / maxDim; // détail fin (plaques de terre)

  const elevation: number[] = new Array(width * height);
  const grid: string[][] = Array.from({ length: height }, () => new Array<string>(width));
  const charOf = (tid: string): string => TERRAIN_CHARS[tid] ?? 'g';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const e = fbm(elevNoise, x, y, fE);
      elevation[y * width + x] = e;
      let terrain: string;
      if (e < SEA) terrain = 'water';
      else if (e < BEACH) terrain = 'sand';
      else if (e >= MOUNTAIN) terrain = 'mountain';
      else if (e >= ROCK) terrain = 'rocks';
      else {
        const m = fbm(moistNoise, x, y, fM);
        const t = fbm(tempNoise, x, y, fT);
        const d = detailNoise(x * fD, y * fD);
        terrain = landBiome(e, m, t, d);
      }
      grid[y]![x] = charOf(terrain);
    }
  }

  // ── Rivières : depuis une source d'altitude, descente en pente (8 voisins) vers
  // l'eau ; le tracé devient un terrain « river » FRANCHISSABLE (des corridors qui
  // aident aussi la connexité). Nombre modéré, croissant en √(aire). ──
  const riverChar = TERRAIN_CHARS.river!;
  const waterChar = TERRAIN_CHARS.water!;
  const riverCount = Math.max(1, Math.round(2 * Math.sqrt(areaFactor)));
  const eAt = (x: number, y: number): number => elevation[y * width + x]!;
  for (let r = 0; r < riverCount; r++) {
    // Source = la plus haute parmi quelques candidats aléatoires (biais montagne).
    let sx = randInt(width);
    let sy = randInt(height);
    for (let k = 0; k < 5; k++) {
      const cx = randInt(width);
      const cy = randInt(height);
      if (eAt(cx, cy) > eAt(sx, sy)) {
        sx = cx;
        sy = cy;
      }
    }
    let x = sx;
    let y = sy;
    const maxSteps = width + height;
    for (let step = 0; step < maxSteps; step++) {
      if (grid[y]![x] === waterChar) break; // arrivé à la mer/lac
      grid[y]![x] = riverChar;
      // Voisin de plus basse élévation (8 directions).
      let bx = x;
      let by = y;
      let best = eAt(x, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (eAt(nx, ny) < best) {
            best = eAt(nx, ny);
            bx = nx;
            by = ny;
          }
        }
      }
      if (bx === x && by === y) break; // minimum local (mare) : on s'arrête
      x = bx;
      y = by;
    }
  }

  // ── Positions de départ réparties en anneau autour du centre (angles réguliers),
  // forcées franchissables avec une poche 3×3 dégagée (évite un héros piégé par
  // l'eau/le relief), et distinctes. Repli par balayage en cas de collision. ──
  const baseChar = charOf(baseTerrain);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const radius = Math.min(width, height) * 0.38;
  const clampX = (x: number): number => Math.min(width - 2, Math.max(1, x));
  const clampY = (y: number): number => Math.min(height - 2, Math.max(1, y));
  const startPositions: { x: number; y: number }[] = [];
  const startKeys = new Set<string>();
  for (let i = 0; i < startPositionCount; i++) {
    const angle = (2 * Math.PI * i) / startPositionCount + Math.PI; // i=0 ⇒ gauche
    let x = clampX(Math.round(cx + radius * Math.cos(angle)));
    let y = clampY(Math.round(cy + radius * Math.sin(angle)));
    let step = 1;
    while (startKeys.has(`${x},${y}`)) {
      x = clampX(x + (step % 2 === 0 ? step : 0));
      y = clampY(y + (step % 2 === 1 ? step : 0));
      step++;
    }
    startKeys.add(`${x},${y}`);
    startPositions.push({ x, y });
  }
  for (const s of startPositions) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = s.x + dx;
        const ny = s.y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) grid[ny]![nx] = baseChar;
      }
    }
  }

  // ── Objets : placés sur des tuiles libres, forcées franchissables, uniques. ──
  type PlacedObject = MapFile['objects'][number];
  const objects: PlacedObject[] = [];
  const occupied = new Set(startPositions.map((s) => `${s.x},${s.y}`));

  // « Profondeur » d'une tuile = distance au départ le PLUS PROCHE, normalisée
  // par `radius` (rayon de l'anneau des départs). 0 ⇒ collé à un départ ; 1 ⇒ au
  // centre / zones profondes. Pilote toute la progression : richesse des trésors,
  // tier des habitations, force des gardiens (faible aux abords, fort au centre).
  const depthAt = (x: number, y: number): number => {
    let nearest = Infinity;
    for (const s of startPositions) nearest = Math.min(nearest, Math.hypot(x - s.x, y - s.y));
    return Math.min(1, nearest / radius);
  };
  // Palette de gardiens triée par tier croissant (sert aux gardiens de champ, aux
  // sentinelles d'objets premium et au choix d'unité des habitations).
  const byTier = [...guardianUnits].sort((a, b) => (unitTiers[a] ?? 1) - (unitTiers[b] ?? 1));
  const clampIdx = (i: number): number => Math.min(byTier.length - 1, Math.max(0, i));

  // Sélectionne une tuile libre ; `preferDeep` échantillonne et retient la plus
  // PROFONDE des candidats vus (récompenses premium loin des départs), sans
  // jamais échouer en silence (repli sur la meilleure tuile échantillonnée).
  const freeTile = (preferDeep: boolean): { x: number; y: number } | null => {
    let best: { x: number; y: number; d: number } | null = null;
    for (let tries = 0; tries < 60; tries++) {
      const x = randInt(width);
      const y = randInt(height);
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;
      if (!preferDeep) {
        occupied.add(key);
        grid[y]![x] = baseChar;
        return { x, y };
      }
      const d = depthAt(x, y);
      if (best === null || d > best.d) best = { x, y, d };
    }
    if (best) {
      occupied.add(`${best.x},${best.y}`);
      grid[best.y]![best.x] = baseChar; // garantit la franchissabilité
      return { x: best.x, y: best.y };
    }
    return null;
  };
  const place = (
    make: (x: number, y: number, i: number) => PlacedObject,
    preferDeep = false,
  ): { x: number; y: number } | null => {
    const t = freeTile(preferDeep);
    if (!t) return null;
    objects.push(make(t.x, t.y, objects.length));
    return t;
  };

  // Sentinelle : gardien posé sur une tuile adjacente libre à un objet premium
  // (habitation/artefact), force graduée par la profondeur — matérialise « la
  // récompense est gardée » (garde best-effort, pas un encerclement complet).
  const neighborOffsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
  const placeSentinel = (ax: number, ay: number): void => {
    if (byTier.length === 0) return;
    for (const [dx, dy] of neighborOffsets) {
      const nx = ax + dx;
      const ny = ay + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const key = `${nx},${ny}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      grid[ny]![nx] = baseChar;
      const depth = depthAt(nx, ny);
      const idx = clampIdx(Math.round(depth * (byTier.length - 1)));
      const count = Math.max(2, Math.round(6 + depth * 40) + randBetween(-3, 3));
      objects.push({ id: `sentinel-${objects.length}`, type: 'guardian', x: nx, y: ny, unitId: byTier[idx]!, count });
      return;
    }
  };

  const resAmount = (res: string): number => (res === 'gold' ? randBetween(200, 900) : randBetween(2, 6));
  for (let i = 0; i < scaled(randBetween(4, 6)); i++) {
    place((x, y, n) => {
      const resource = RESOURCE_IDS[randInt(RESOURCE_IDS.length)]!;
      return { id: `res-${n}`, type: 'resource', x, y, resource, amount: resAmount(resource) };
    });
  }
  for (let i = 0; i < scaled(randBetween(2, 3)); i++) {
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
  // Trésors : montants gradués par la profondeur (jusqu'à ×2 au centre) — les
  // coffres loin des départs sont plus riches.
  for (let i = 0; i < scaled(randBetween(1, 2)); i++) {
    place((x, y, n) => {
      const depth = depthAt(x, y);
      return {
        id: `chest-${n}`,
        type: 'treasure',
        x,
        y,
        gold: Math.round(randBetween(500, 1500) * (1 + depth)),
        xp: Math.round(randBetween(200, 600) * (1 + depth)),
      };
    });
  }

  // Lieux de bonus variés (doc 02 §2.2) : fontaine (chance), écurie (mouvement),
  // tour de guet (vision), sanctuaire (niveau), moulin (ressource) — tirés en
  // rotation pour garantir la variété. `levelXp` = une fois par héros ; le reste
  // récurrent (une fois par héros et par semaine).
  const visitableMakers: ((x: number, y: number, n: number) => PlacedObject)[] = [
    (x, y, n) => ({ id: `fountain-${n}`, type: 'visitable', x, y, effect: { kind: 'luck', amount: 1 }, frequency: 'oncePerHeroPerWeek' }),
    (x, y, n) => ({ id: `stable-${n}`, type: 'visitable', x, y, effect: { kind: 'movement', amount: 300 + randInt(4) * 100 }, frequency: 'oncePerHeroPerWeek' }),
    (x, y, n) => ({ id: `watchtower-${n}`, type: 'visitable', x, y, effect: { kind: 'vision', amount: randBetween(4, 7) }, frequency: 'oncePerHeroPerWeek' }),
    (x, y, n) => ({ id: `shrine-${n}`, type: 'visitable', x, y, effect: { kind: 'levelXp' }, frequency: 'oncePerHero' }),
    (x, y, n) => ({
      id: `mill-${n}`,
      type: 'visitable',
      x,
      y,
      effect: { kind: 'resource', resource: RESOURCE_IDS[randInt(RESOURCE_IDS.length)]!, amount: randBetween(1, 3) },
      frequency: 'oncePerHeroPerWeek',
    }),
  ];
  const visitableCount = scaled(randBetween(3, 5));
  for (let i = 0; i < visitableCount; i++) {
    const maker = visitableMakers[i % visitableMakers.length]!;
    place((x, y, n) => maker(x, y, n));
  }

  // Habitations hors ville (renfort d'armée) : tier gradué par la profondeur (bas
  // tier près des départs, haut tier au centre), placées en profondeur et gardées.
  if (byTier.length > 0) {
    for (let i = 0; i < scaled(randBetween(1, 2)); i++) {
      const t = place((x, y, n) => {
        const depth = depthAt(x, y);
        const idx = clampIdx(Math.round(depth * (byTier.length - 1)));
        const unitId = byTier[idx]!;
        const tier = unitTiers[unitId] ?? idx + 1;
        return { id: `dwelling-${n}`, type: 'dwelling', x, y, unitId, stock: Math.max(1, 9 - tier) };
      }, true);
      if (t) placeSentinel(t.x, t.y);
    }
  }

  // Artefacts : récompense premium, posée en profondeur et gardée par une sentinelle.
  if (artifactIds.length > 0) {
    for (let i = 0; i < scaled(randBetween(1, 2)); i++) {
      const t = place(
        (x, y, n) => ({ id: `artifact-${n}`, type: 'artifact', x, y, artifactId: artifactIds[randInt(artifactIds.length)]! }),
        true,
      );
      if (t) placeSentinel(t.x, t.y);
    }
  }

  // Gardiens de champ : gradués tier/pile selon la profondeur (doc 02 §2.2) —
  // faibles autour des départs, forts vers le centre (léger jitter = variété).
  if (guardianUnits.length > 0) {
    const guardianCount = Math.max(2, Math.round(randBetween(2, 4) * areaFactor));
    for (let i = 0; i < guardianCount; i++) {
      place((x, y, n) => {
        const depth = depthAt(x, y);
        const idx = clampIdx(Math.round(depth * (byTier.length - 1)) + randBetween(-1, 1));
        const count = Math.max(2, Math.round(4 + depth * 36) + randBetween(-3, 3));
        return { id: `guard-${n}`, type: 'guardian', x, y, unitId: byTier[idx]!, count };
      });
    }
  }

  // ── Connexité (plan map-design-issues P2) : le bruit d'élévation peut fermer
  // des poches (montagnes/rochers/eau) contenant des départs ou des objets. On
  // relie tout ce qui compte à la composante du premier départ en CREUSANT des
  // corridors de terrain de base — déterministe, jamais de relocalisation
  // silencieuse. L'A* du jeu autorise le pas diagonal dès que la tuile d'arrivée
  // est franchissable (pas de blocage de coin) : un flood-fill 8 directions
  // reflète donc exactement l'atteignabilité réelle. ──
  const blockedChars = new Set([waterChar, TERRAIN_CHARS.mountain!, TERRAIN_CHARS.rocks!]);
  const tileIdx = (x: number, y: number): number => y * width + x;
  const inMain = new Uint8Array(width * height); // 1 = composante du 1er départ
  const grow = (sx: number, sy: number): void => {
    if (inMain[tileIdx(sx, sy)] === 1 || blockedChars.has(grid[sy]![sx]!)) return;
    const qx: number[] = [sx];
    const qy: number[] = [sy];
    inMain[tileIdx(sx, sy)] = 1;
    for (let head = 0; head < qx.length; head++) {
      const x = qx[head]!;
      const y = qy[head]!;
      for (const [dx, dy] of neighborOffsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (inMain[tileIdx(nx, ny)] === 1 || blockedChars.has(grid[ny]![nx]!)) continue;
        inMain[tileIdx(nx, ny)] = 1;
        qx.push(nx);
        qy.push(ny);
      }
    }
  };
  const firstStart = startPositions[0]!;
  grow(firstStart.x, firstStart.y);
  const connect = (tx: number, ty: number): void => {
    if (inMain[tileIdx(tx, ty)] === 1) return;
    // Tuile de la composante la plus proche (balayage ligne à ligne : premier
    // minimum rencontré ⇒ départage déterministe).
    let bx = firstStart.x;
    let by = firstStart.y;
    let bestD = Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (inMain[tileIdx(x, y)] !== 1) continue;
        const d = Math.max(Math.abs(x - tx), Math.abs(y - ty)); // distance 8 dir
        if (d < bestD) {
          bestD = d;
          bx = x;
          by = y;
        }
      }
    }
    // Corridor en pas 8 directions de (tx,ty) vers (bx,by) : chaque tuile
    // bloquante traversée devient du terrain de base.
    let x = tx;
    let y = ty;
    while (x !== bx || y !== by) {
      if (blockedChars.has(grid[y]![x]!)) grid[y]![x] = baseChar;
      x += Math.sign(bx - x);
      y += Math.sign(by - y);
    }
    grow(tx, ty); // fusionne la poche désormais ouverte dans la composante
  };
  for (const s of startPositions.slice(1)) connect(s.x, s.y);
  for (const o of objects) connect(o.x, o.y);

  // Légende : uniquement les terrains réellement présents dans la grille.
  const usedChars = new Set<string>();
  for (const row of grid) for (const ch of row) usedChars.add(ch);
  const legend: Record<string, string> = {};
  for (const [tid, ch] of Object.entries(TERRAIN_CHARS)) {
    if (usedChars.has(ch)) legend[ch] = tid;
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
