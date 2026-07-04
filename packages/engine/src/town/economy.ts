import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { builtLevelOf } from './helpers';
import { unitWithEconomy } from './unit-economy';

/**
 * Revenu quotidien (doc 02 §4.1, décision plan phase-3.1 point 5) — appelé au
 * `DayStarted` (`core/engine.ts`). Chaque bâtiment construit dont l'effet du
 * NIVEAU CONSTRUIT est `income` crédite son propriétaire.
 */
export function applyDailyIncome(draft: GameState, events: GameEvent[]): void {
  for (const town of draft.towns) {
    if (!town.ownerPlayerId) continue;
    const player = draft.players.find((p) => p.id === town.ownerPlayerId);
    if (!player) continue;
    for (const buildingId of Object.keys(town.buildings)) {
      const level = builtLevelOf(town, draft.buildingCatalog, buildingId);
      if (!level || level.effect.type !== 'income') continue;
      const { resource, amount } = level.effect;
      player.resources[resource] += amount;
      events.push({ type: 'TownIncome', playerId: player.id, resource, amount });
    }
  }
}

/**
 * Croissance hebdomadaire (doc 02 §4.1, décision plan phase-3.1 point 6) —
 * appelée au `WeekStarted`. La croissance/le coût des créatures vivent dans
 * les données d'unité (`growthPerWeek?`, absent de `CombatUnitDef` figé — lu
 * optionnellement via `unit-economy.ts`, no-op si absent).
 */
export function applyWeeklyGrowth(draft: GameState, events: GameEvent[]): void {
  for (const town of draft.towns) {
    if (!town.ownerPlayerId) continue;
    let bonusFort = 0;
    for (const buildingId of Object.keys(town.buildings)) {
      const level = builtLevelOf(town, draft.buildingCatalog, buildingId);
      if (level?.effect.type === 'growthBonus') bonusFort += level.effect.percent / 100;
    }
    for (const buildingId of Object.keys(town.buildings)) {
      const level = builtLevelOf(town, draft.buildingCatalog, buildingId);
      if (!level || level.effect.type !== 'dwelling') continue;
      const unitId = level.effect.unitId;
      const growth = unitWithEconomy(draft.unitCatalog, unitId)?.growthPerWeek;
      if (!growth) continue; // pas de donnée de croissance connue : no-op
      const added = Math.floor(growth * (1 + bonusFort));
      if (added <= 0) continue;
      const cap = 2 * added;
      const current = town.stock[unitId] ?? 0;
      town.stock[unitId] = Math.min(current + added, cap);
      events.push({ type: 'TownGrowth', townId: town.id, unitId, added });
    }
  }
}
