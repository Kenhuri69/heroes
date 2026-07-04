import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command } from '../src/core/commands';
import type { AdventureConfig } from '../src/adventure/config';
import type { AdventureMapDef } from '../src/adventure/map';
import { createEmptyState, emptyResources } from '../src/core/state';
import { hashState } from '../src/core/serialize';

/**
 * Golden test de replay (doc 07 §7) : une partie scriptée est rejouée à chaque
 * commit ; toute divergence de simulation (RNG non seedé, règle modifiée par
 * accident, ordre d'itération instable…) casse ce test.
 *
 * Carte et config sont INLINE (pas les fixtures partagées) : le journal golden
 * est autonome, seul un changement volontaire des règles doit changer le hash.
 *
 * Si une évolution VOULUE des règles change le hash : mettre à jour la valeur
 * dans le même commit, en l'expliquant dans le message.
 */
const GOLDEN_CONFIG: AdventureConfig = {
  movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
  visionRadius: 5,
  terrains: {
    grass: { moveCost: 100 },
    swamp: { moveCost: 150 },
    water: { moveCost: null },
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
};

const GOLDEN_ROWS = [
  'gggggggg',
  'ggggwggg',
  'ggggwggg',
  'ggssgggg',
  'ggssgggg',
  'gggggggg',
  'gggggggg',
  'gggggggg',
];

const GOLDEN_MAP: AdventureMapDef = {
  id: 'golden-8x8',
  width: 8,
  height: 8,
  terrain: GOLDEN_ROWS.flatMap((row) =>
    [...row].map((c) => ({ g: 'grass', s: 'swamp', w: 'water' })[c] as string),
  ),
  road: Array.from({ length: 64 }, (_, i) => Math.floor(i / 8) === 5),
  objects: [
    { id: 'wood-1', type: 'resource', pos: { x: 2, y: 0 }, resource: 'wood', amount: 4 },
    { id: 'gold-1', type: 'resource', pos: { x: 5, y: 5 }, resource: 'gold', amount: 750 },
    { id: 'guard-1', type: 'guardian', pos: { x: 5, y: 2 }, unitId: 'golden-grunt', count: 5 },
  ],
  startPositions: [
    { x: 0, y: 0 },
    { x: 7, y: 7 },
  ],
};

/** Catalogue inline : mêlée + tireur, terrain natif herbe (bonus exercé en combat). */
const GOLDEN_CATALOG = {
  'golden-grunt': {
    id: 'golden-grunt',
    groupId: 'golden-pack',
    nativeTerrain: 'grass',
    stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2] as [number, number], speed: 4 },
    abilities: [],
  },
  'golden-archer': {
    id: 'golden-archer',
    groupId: 'golden-pack',
    nativeTerrain: 'grass',
    stats: { hp: 8, attack: 5, defense: 2, damage: [2, 4] as [number, number], speed: 5 },
    abilities: [{ id: 'shooter', params: { ammo: 10 } }],
  },
};

const GOLDEN_JOURNAL: Command[] = [
  {
    type: 'StartGame',
    seed: 20260704,
    players: [
      {
        id: 'player-red',
        startingResources: { ...emptyResources(), gold: 2500, wood: 5, ore: 5 },
        startingArmy: [
          { unitId: 'golden-grunt', count: 15 },
          { unitId: 'golden-archer', count: 8 },
        ],
      },
      {
        id: 'player-blue',
        startingResources: { ...emptyResources(), gold: 2500, wood: 5, ore: 5 },
      },
    ],
    map: GOLDEN_MAP,
    config: GOLDEN_CONFIG,
    unitCatalog: GOLDEN_CATALOG,
  },
  // Jour 1 : red ramasse le bois (arrêt dessus), blue descend vers la route.
  {
    type: 'MoveHero',
    heroId: 'hero-player-red',
    path: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  },
  { type: 'EndTurn', playerId: 'player-red' },
  {
    type: 'MoveHero',
    heroId: 'hero-player-blue',
    path: [
      { x: 6, y: 6 },
      { x: 5, y: 5 },
    ],
  },
  { type: 'EndTurn', playerId: 'player-blue' },
  // Jour 2 : red traverse le marais, blue longe la route.
  {
    type: 'MoveHero',
    heroId: 'hero-player-red',
    path: [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 4 },
    ],
  },
  { type: 'EndTurn', playerId: 'player-red' },
  {
    type: 'MoveHero',
    heroId: 'hero-player-blue',
    path: [
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ],
  },
  { type: 'EndTurn', playerId: 'player-blue' },
  // Jour 3 : red attaque le gardien (5,2) — interception ⇒ combat hex complet
  // auto-résolu (obstacles, initiative, dégâts, moral : tout passe par le RNG).
  {
    type: 'MoveHero',
    heroId: 'hero-player-red',
    path: [
      { x: 4, y: 3 },
      { x: 5, y: 2 },
    ],
  },
  { type: 'AutoCombat' },
  { type: 'EndTurn', playerId: 'player-red' },
  { type: 'EndTurn', playerId: 'player-blue' },
  // 7 jours complets supplémentaires — traverse un début de semaine (jour 8).
  ...Array.from(
    { length: 14 },
    (_, i): Command => ({
      type: 'EndTurn',
      playerId: i % 2 === 0 ? 'player-red' : 'player-blue',
    }),
  ),
];

const GOLDEN_HASH = '80e09415';

describe('golden replay', () => {
  it('le journal scripté produit toujours le même état final', () => {
    let state = createEmptyState();
    for (const cmd of GOLDEN_JOURNAL) state = apply(state, cmd).state;
    expect(state.calendar.day).toBe(11);
    // Effets attendus du script (lisibilité) : ressources ramassées, positions
    // finales, victoire contre le gardien (retiré, armée survivante).
    expect(state.players[0]?.resources.wood).toBe(9);
    expect(state.players[1]?.resources.gold).toBe(3250);
    expect(state.heroes[0]?.pos).toEqual({ x: 4, y: 3 }); // arrêté par l'interception
    expect(state.heroes[1]?.pos).toEqual({ x: 2, y: 5 });
    expect(state.combat).toBeNull();
    expect(state.map?.objects.some((o) => o.id === 'guard-1')).toBe(false);
    const army = state.heroes[0]?.army.reduce((sum, s) => sum + s.count, 0) ?? 0;
    expect(army).toBeGreaterThan(0);
    expect(army).toBeLessThanOrEqual(23);
    expect(hashState(state)).toBe(GOLDEN_HASH);
  });
});
