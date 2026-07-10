import type { GameEvent } from '../core/events';
import type { GameState, ResourceId } from '../core/state';
import { heroGoldPerDay } from '../hero/skills';
import { weekGrowthFactor } from '../adventure/calendar';
import { builtLevelOf } from './helpers';
import { sharedGrowthRecipients } from './shared-growth';
import { unitWithEconomy } from './unit-economy';

/**
 * Revenu quotidien PROJETÉ d'un joueur (lot UX M6, C8) — miroir **sans
 * mutation** de `applyDailyIncome` + or/jour de la compétence Économie de ses
 * héros. Sert la fiche ressource du HUD (stock + « +X/j »). Retourne les seules
 * ressources à revenu non nul.
 */
/**
 * Revenu quotidien d'UNE ville (lot UX M7, C21) — bâtiments à effet `income`
 * du niveau construit. Pur ; sert l'en-tête de ville (« or/jour »).
 */
export function townIncome(
  town: GameState['towns'][number],
  buildingCatalog: GameState['buildingCatalog'],
): Partial<Record<ResourceId, number>> {
  const income: Partial<Record<ResourceId, number>> = {};
  for (const buildingId of Object.keys(town.buildings)) {
    const level = builtLevelOf(town, buildingCatalog, buildingId);
    if (!level || level.effect.type !== 'income') continue;
    const { resource, amount } = level.effect;
    if (amount !== 0) income[resource] = (income[resource] ?? 0) + amount;
  }
  return income;
}

export function dailyIncome(state: GameState, playerId: string): Partial<Record<ResourceId, number>> {
  const income: Partial<Record<ResourceId, number>> = {};
  const add = (resource: ResourceId, amount: number): void => {
    if (amount === 0) return;
    income[resource] = (income[resource] ?? 0) + amount;
  };
  for (const town of state.towns) {
    if (town.ownerPlayerId !== playerId) continue;
    for (const buildingId of Object.keys(town.buildings)) {
      const level = builtLevelOf(town, state.buildingCatalog, buildingId);
      if (!level || level.effect.type !== 'income') continue;
      add(level.effect.resource, level.effect.amount);
    }
  }
  for (const obj of state.map?.objects ?? []) {
    if (obj.type !== 'mine' || obj.ownerId !== playerId) continue;
    add(obj.resource as ResourceId, obj.amount);
  }
  for (const hero of state.heroes) {
    if (hero.playerId !== playerId) continue;
    add('gold', heroGoldPerDay(hero, state.skillCatalog));
  }
  return income;
}

/**
 * Revenu quotidien (doc 02 §4.1, décision plan phase-3.1 point 5) — appelé au
 * `DayStarted` (`core/engine.ts`). Chaque bâtiment construit dont l'effet du
 * NIVEAU CONSTRUIT est `income` crédite son propriétaire, puis chaque **mine**
 * de la carte possédée (doc 02 §2.2) crédite le sien.
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
  for (const obj of draft.map?.objects ?? []) {
    if (obj.type !== 'mine' || obj.ownerId === null) continue;
    const player = draft.players.find((p) => p.id === obj.ownerId);
    if (!player || player.eliminated) continue;
    player.resources[obj.resource as ResourceId] += obj.amount;
    events.push({
      type: 'MineIncome',
      playerId: player.id,
      objectId: obj.id,
      resource: obj.resource,
      amount: obj.amount,
    });
  }
}

/**
 * Croissance hebdomadaire (doc 02 §4.1, décision plan phase-3.1 point 6) —
 * appelée au `WeekStarted`. La croissance/le coût des créatures vivent dans
 * les données d'unité (`growthPerWeek?`, absent de `CombatUnitDef` figé — lu
 * optionnellement via `unit-economy.ts`, no-op si absent).
 */
export function applyWeeklyGrowth(draft: GameState, events: GameEvent[]): void {
  // Événement de calendrier de la semaine (M-CALENDAR, doc 02 §2.3) : module la
  // croissance (peste ÷2, abondance ×2…). 1 hors calendrier ⇒ règle inchangée.
  const eventFactor = weekGrowthFactor(draft);
  for (const town of draft.towns) {
    if (!town.ownerPlayerId) continue;
    let bonusFort = 0;
    for (const buildingId of Object.keys(town.buildings)) {
      const level = builtLevelOf(town, draft.buildingCatalog, buildingId);
      if (level?.effect.type === 'growthBonus') bonusFort += level.effect.percent / 100;
    }
    // Croissance partagée (doc 05 §3.1/§8) : les membres d'un même groupe se
    // partagent une seule croissance ; seul le destinataire résolu grossit.
    const shared = sharedGrowthRecipients(town, draft.growthGroups, draft.buildingCatalog);
    for (const buildingId of Object.keys(town.buildings)) {
      const level = builtLevelOf(town, draft.buildingCatalog, buildingId);
      if (!level || level.effect.type !== 'dwelling') continue;
      const unitId = level.effect.unitId;
      const groupId = shared.groupOf.get(unitId);
      if (groupId !== undefined && shared.recipientOf.get(groupId) !== unitId) continue;
      const growth = unitWithEconomy(draft.unitCatalog, unitId)?.growthPerWeek;
      if (!growth) continue; // pas de donnée de croissance connue : no-op
      const added = Math.floor(growth * (1 + bonusFort) * eventFactor);
      if (added <= 0) continue;
      const cap = 2 * added;
      const current = town.stock[unitId] ?? 0;
      // Le plafond (2× la croissance) borne l'ACCUMULATION, il ne doit jamais
      // RÉDUIRE un stock déjà supérieur (pré-seedé par un scénario) — remédiation
      // R1 : on n'ajoute rien si le stock dépasse déjà le plafond.
      town.stock[unitId] = Math.max(current, Math.min(current + added, cap));
      events.push({ type: 'TownGrowth', townId: town.id, unitId, added });
    }
  }
  // Habitations hors ville (doc 02 §2.2) : même règle d'accumulation que les
  // villes (plafond 2× la croissance, jamais de réduction). Objet neutre —
  // aucun événement (pas de toast ; le rendu suit l'état).
  for (const obj of draft.map?.objects ?? []) {
    // M-DWELLOWN (doc 02 §2.2) : seul un propriétaire touche le réassort — une
    // habitation neutre garde son stock initial jusqu'à sa capture.
    if (obj.type !== 'dwelling' || !obj.ownerId) continue;
    const growth = unitWithEconomy(draft.unitCatalog, obj.unitId)?.growthPerWeek;
    if (!growth) continue;
    const added = Math.floor(growth * eventFactor);
    obj.stock = Math.max(obj.stock, Math.min(obj.stock + added, 2 * growth));
  }
}
