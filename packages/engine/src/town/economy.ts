import type { GameEvent } from '../core/events';
import type { GameState, ResourceId } from '../core/state';
import { heroGoldPerDay, townHouseField } from '../hero/skills';
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

/**
 * Aura de bâtiment (F-BUILDEFF.1, doc 02 §4.1 / doc 03 §4 — Écuries) : somme du
 * champ `field` des effets `heroAura` des bâtiments **construits** de la ville
 * que `playerId` possède ET où il se tient (`pos`). Jumeau bâtiment de
 * `townHouseField` (option B — le héros doit être présent). Jamais un nom de
 * faction : lit `heroAura` de façon opaque. Consommé par `heroDailyMovement`.
 */
export function townBuildingAura(
  state: GameState,
  playerId: string,
  pos: { x: number; y: number },
  field: 'movementBonusFlat',
): number {
  let total = 0;
  for (const town of state.towns) {
    if (town.ownerPlayerId !== playerId) continue;
    if (town.pos.x !== pos.x || town.pos.y !== pos.y) continue;
    for (const buildingId of Object.keys(town.buildings)) {
      const level = builtLevelOf(town, state.buildingCatalog, buildingId);
      if (level?.effect.type === 'heroAura') total += level.effect[field] ?? 0;
    }
  }
  return total;
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
 * Croissance hebdomadaire PROJETÉE d'une unité dans une ville (T-GROWTHUI,
 * doc 02 §4.1) — miroir **sans mutation** du calcul d'`applyWeeklyGrowth` :
 * `added` = croissance de donnée × (1 + bonus Fort) × facteur d'événement de
 * calendrier de la semaine, `cap` = plafond d'ACCUMULATION du stock
 * (2 × added). `null` si l'unité n'a pas de donnée de croissance. Sert le
 * détail de l'onglet Recruter (pattern R7 : helper pur consommé par le client).
 */
export function weeklyGrowthOf(
  state: GameState,
  town: GameState['towns'][number],
  unitId: string,
): { added: number; cap: number } | null {
  const growth = unitWithEconomy(state.unitCatalog, unitId)?.growthPerWeek;
  if (!growth) return null;
  let bonusFort = 0;
  for (const buildingId of Object.keys(town.buildings)) {
    const level = builtLevelOf(town, state.buildingCatalog, buildingId);
    if (level?.effect.type === 'growthBonus') bonusFort += level.effect.percent / 100;
  }
  // Maison town-scoped (F-HOUSES, doc 16 §3.1 — Le Blaireau) : + % croissance hebdo
  // apporté par un héros du propriétaire présent sur la tuile de la ville (option B).
  // Calculé ici (helper partagé) ⇒ l'UI de recrutement projette la même croissance.
  if (town.ownerPlayerId)
    bonusFort += townHouseField(state.heroes, town.ownerPlayerId, town.pos, 'garrisonGrowthPct') / 100;
  const added = Math.floor(growth * (1 + bonusFort) * weekGrowthFactor(state));
  return { added, cap: 2 * added };
}

/**
 * Croissance hebdomadaire (doc 02 §4.1, décision plan phase-3.1 point 6) —
 * appelée au `WeekStarted`. La croissance/le coût des créatures vivent dans
 * les données d'unité (`growthPerWeek?`, absent de `CombatUnitDef` figé — lu
 * optionnellement via `unit-economy.ts`, no-op si absent). Le calcul par unité
 * vit dans `weeklyGrowthOf` (partagé avec l'UI de recrutement).
 */
export function applyWeeklyGrowth(draft: GameState, events: GameEvent[]): void {
  for (const town of draft.towns) {
    if (!town.ownerPlayerId) continue;
    // Croissance partagée (doc 05 §3.1/§8) : les membres d'un même groupe se
    // partagent une seule croissance ; seul le destinataire résolu grossit.
    const shared = sharedGrowthRecipients(town, draft.growthGroups, draft.buildingCatalog);
    for (const buildingId of Object.keys(town.buildings)) {
      const level = builtLevelOf(town, draft.buildingCatalog, buildingId);
      if (!level || level.effect.type !== 'dwelling') continue;
      const unitId = level.effect.unitId;
      const groupId = shared.groupOf.get(unitId);
      if (groupId !== undefined && shared.recipientOf.get(groupId) !== unitId) continue;
      const g = weeklyGrowthOf(draft, town, unitId);
      if (!g || g.added <= 0) continue;
      const current = town.stock[unitId] ?? 0;
      // Le plafond (2× la croissance) borne l'ACCUMULATION, il ne doit jamais
      // RÉDUIRE un stock déjà supérieur (pré-seedé par un scénario) — remédiation
      // R1 : on n'ajoute rien si le stock dépasse déjà le plafond.
      town.stock[unitId] = Math.max(current, Math.min(current + g.added, g.cap));
      events.push({ type: 'TownGrowth', townId: town.id, unitId, added: g.added });
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
    // Événement de calendrier de la semaine (M-CALENDAR) : module la croissance
    // (peste ÷2, abondance ×2…) — 1 hors calendrier, règle inchangée.
    const added = Math.floor(growth * weekGrowthFactor(draft));
    obj.stock = Math.max(obj.stock, Math.min(obj.stock + added, 2 * growth));
  }
}
