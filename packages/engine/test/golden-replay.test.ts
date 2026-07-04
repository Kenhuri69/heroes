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
  ],
  startPositions: [
    { x: 0, y: 0 },
    { x: 7, y: 7 },
  ],
};

const GOLDEN_JOURNAL: Command[] = [
  {
    type: 'StartGame',
    seed: 20260704,
    players: [
      {
        id: 'player-red',
        startingResources: { ...emptyResources(), gold: 2500, wood: 5, ore: 5 },
      },
      {
        id: 'player-blue',
        startingResources: { ...emptyResources(), gold: 2500, wood: 5, ore: 5 },
      },
    ],
    map: GOLDEN_MAP,
    config: GOLDEN_CONFIG,
    unitCatalog: {},
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
  // 8 jours complets supplémentaires — traverse un début de semaine (jour 8).
  ...Array.from(
    { length: 16 },
    (_, i): Command => ({
      type: 'EndTurn',
      playerId: i % 2 === 0 ? 'player-red' : 'player-blue',
    }),
  ),
];

const GOLDEN_HASH = 'a84c80fd';

describe('golden replay', () => {
  it('le journal scripté produit toujours le même état final', () => {
    let state = createEmptyState();
    for (const cmd of GOLDEN_JOURNAL) state = apply(state, cmd).state;
    expect(state.calendar.day).toBe(11);
    // Effets attendus du script (lisibilité) : ressources ramassées, positions finales.
    expect(state.players[0]?.resources.wood).toBe(9);
    expect(state.players[1]?.resources.gold).toBe(3250);
    expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 4 });
    expect(state.heroes[1]?.pos).toEqual({ x: 2, y: 5 });
    expect(hashState(state)).toBe(GOLDEN_HASH);
  });
});
