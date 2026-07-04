export { apply, validate, type EngineResult } from './core/engine';
export { EngineError, type Command, type CommandError, type PlayerSetup } from './core/commands';
export type { GameEvent } from './core/events';
export {
  createEmptyState,
  emptyResources,
  weekOf,
  RESOURCE_IDS,
  type Calendar,
  type GameState,
  type HeroState,
  type PlayerState,
  type ResourceId,
  type Resources,
} from './core/state';
export { seedRng, nextU32, rollRange, type RngState } from './core/rng';
export { serializeState, deserializeState, hashState, stableStringify } from './core/serialize';
export {
  DIRECTIONS,
  inBounds,
  isAdjacent,
  isDiagonal,
  samePos,
  terrainAt,
  tileIndex,
  type AdventureMapDef,
  type GridPos,
  type GuardianObjectDef,
  type MapObjectDef,
  type ResourceObjectDef,
} from './adventure/map';
export {
  COMBAT_COLS,
  COMBAT_ROWS,
  axialToOffset,
  hexDistance,
  hexNeighbors,
  hexRound,
  inCombatBounds,
  offsetToAxial,
  sameHex,
  type AxialPos,
  type OffsetPos,
} from './combat/hex';
export type {
  ArmyStack,
  CombatActionInput,
  CombatSideId,
  CombatStack,
  CombatState,
  CombatUnitDef,
} from './combat/types';
export {
  canShoot,
  estimateDamage,
  reachableHexes,
  type DamageEstimate,
} from './combat';
export {
  dailyMovementPoints,
  type AdventureConfig,
  type CombatRulesConfig,
  type TerrainRule,
} from './adventure/config';
export { findPath, isPassable, stepCost } from './adventure/path';
export { createFog, revealAround } from './adventure/fog';
