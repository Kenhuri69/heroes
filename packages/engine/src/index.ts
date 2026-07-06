export { apply, validate, type EngineResult } from './core/engine';
export { EngineError, type Command, type CommandError, type PlayerSetup } from './core/commands';
export type { GameEvent } from './core/events';
export {
  createEmptyState,
  emptyResources,
  weekOf,
  humanPlayerId,
  CURRENT_SAVE_VERSION,
  RESOURCE_IDS,
  type Calendar,
  type GameState,
  type HeroState,
  type PlayerState,
  type ResourceId,
  type Resources,
} from './core/state';
export { armyStrength, playerPower } from './core/power';
export { seedRng, nextU32, rollRange, type RngState } from './core/rng';
export {
  serializeState,
  deserializeState,
  readSaveVersion,
  hashState,
  stableStringify,
} from './core/serialize';
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
  attackableTargets,
  canShoot,
  estimateDamage,
  meleeOriginsFor,
  reachableHexes,
  type DamageEstimate,
} from './combat';
export {
  dailyMovementPoints,
  type AdventureConfig,
  type CombatRulesConfig,
  type HeroProgressionConfig,
  type TerrainRule,
} from './adventure/config';
export type { HeroAttributes } from './core/state';
export type {
  BuildingDef,
  BuildingEffect,
  BuildingLevel,
  TownState,
} from './town/types';
// Helpers purs de ville consommés par le client (remédiation CL9).
export {
  buildStatus,
  builtDwellings,
  missingRequirements,
  scaleCost,
  tradeQuote,
  unitIsRecruitable,
  upgradedUnitFor,
  upgradeCost,
  type BuildRequirement,
  type BuildStatus,
} from './town';
export type {
  SpellDef,
  SpellSchool,
  SpellKind,
  AdventureEffect,
  SpellStatus,
  HeroSkillDef,
  SkillRankEffect,
  ArtifactDef,
} from './hero/types';
export { estimateSpell, type SpellEstimate } from './hero';
export type { FactionBonus } from './faction/types';
export type {
  VictoryCondition,
  ScenarioObjectives,
  ScenarioState,
  GameOutcome,
} from './scenario/types';
export { evaluateOutcome } from './scenario/outcome';
export { runAiTurn } from './ai/adventure';
export { findPath, isPassable, stepCost } from './adventure/path';
export { createFog, revealAround } from './adventure/fog';
export { xpForLevel } from './adventure/experience';
