import type { GameEvent } from '../core/events';
import type { GameState, PlayerState, Resources } from '../core/state';
import { RESOURCE_IDS } from '../core/state';
import { validateBuildStructure, handleBuildStructure, validateRecruitUnits, handleRecruitUnits } from '../town';
import { validateRecruitHero, handleRecruitHero } from '../hero/recruit';
import type { BuildingDef, TownState } from '../town/types';
import { unitWithEconomy } from '../town/unit-economy';

/**
 * IA de ville (doc 11 §3.5, plan phase-3.5 décision #6) : construction et
 * recrutement, appelés depuis `runAiTurn` (`adventure.ts`). Réutilise
 * intégralement les validations du town building (`../town`) — aucune
 * commande illégale n'est jamais produite.
 */

/** Tier du dwelling qui débloque `unitId`, tous bâtiments confondus (0 si aucun). */
function unitTier(catalog: Record<string, BuildingDef>, unitId: string): number {
  for (const def of Object.values(catalog)) {
    for (const level of def.levels) {
      if (level.effect.type === 'dwelling' && level.effect.unitId === unitId) return level.effect.tier;
    }
  }
  return 0;
}

/** Effectif maximal de `unitId` que le joueur peut à la fois payer et prélever du stock. */
function maxAffordableCount(resources: Resources, cost: Partial<Resources> | undefined, stock: number): number {
  if (stock <= 0) return 0;
  if (!cost) return stock;
  let max = stock;
  for (const id of RESOURCE_IDS) {
    const amount = cost[id];
    if (amount) max = Math.min(max, Math.floor(resources[id] / amount));
  }
  return Math.max(0, max);
}

/** Construit le premier bâtiment abordable dont les prérequis sont satisfaits (1/jour, doc 02 §4.1). */
function tryBuild(draft: GameState, town: TownState, events: GameEvent[]): void {
  if (town.builtToday) return;
  for (const buildingId of Object.keys(draft.buildingCatalog).sort()) {
    const cmd = { type: 'BuildStructure' as const, townId: town.id, buildingId };
    if (validateBuildStructure(draft, cmd)) continue;
    handleBuildStructure(draft, cmd, events);
    return;
  }
}

/** Recrute le plus haut tier abordable, au plus grand effectif possible (une seule pile/tour). */
function tryRecruit(draft: GameState, town: TownState, player: PlayerState, events: GameEvent[]): void {
  const candidates = Object.keys(town.stock)
    .filter((unitId) => (town.stock[unitId] ?? 0) > 0)
    // Départage par unités de code (remédiation R1) : déterministe et
    // indépendant de l'ICU hôte, contrairement à `localeCompare`.
    .sort(
      (a, b) =>
        unitTier(draft.buildingCatalog, b) - unitTier(draft.buildingCatalog, a) ||
        (a < b ? -1 : a > b ? 1 : 0),
    );
  for (const unitId of candidates) {
    const recruitCost = unitWithEconomy(draft.unitCatalog, unitId)?.recruitCost;
    const count = maxAffordableCount(player.resources, recruitCost, town.stock[unitId] ?? 0);
    if (count <= 0) continue;
    const cmd = { type: 'RecruitUnits' as const, townId: town.id, unitId, count };
    if (validateRecruitUnits(draft, cmd)) continue;
    handleRecruitUnits(draft, cmd, events);
    return;
  }
}

/** Facteur de marge « riche » (M-TAVERN.4) : l'IA ne recrute un héros que si son or ≥ coût × ce facteur (garde de l'or pour l'armée). */
const AI_HERO_GOLD_FACTOR = 2;

const DEFAULT_RECRUIT_COST = 2500;
const DEFAULT_MAX_HEROES = 8;

/**
 * IA recruteuse (M-TAVERN.4, doc 02 §1.5) : à une ville dotée d'une Taverne, si
 * l'IA est **riche** (or ≥ coût × marge) et **sous le cap**, recrute le premier
 * héros de roster éligible (faction de la ville, non déjà en jeu). Réutilise
 * `validate/handleRecruitHero` — aucune commande illégale (le pool exclusif et
 * la Taverne y sont vérifiés). Un seul recrutement par ville et par tour.
 */
function tryRecruitHero(draft: GameState, town: TownState, player: PlayerState, events: GameEvent[]): void {
  const cost = draft.config?.hero?.recruitCost ?? DEFAULT_RECRUIT_COST;
  const cap = draft.config?.hero?.maxPerPlayer ?? DEFAULT_MAX_HEROES;
  if (player.resources.gold < cost * AI_HERO_GOLD_FACTOR) return;
  if (draft.heroes.filter((h) => h.playerId === player.id).length >= cap) return;
  // Héros de roster de la faction de la ville, non déjà vivant (pool exclusif),
  // en ordre d'id stable (déterministe).
  for (const heroId of Object.keys(draft.heroRoster).sort()) {
    const cmd = { type: 'RecruitHero' as const, townId: town.id, heroId, playerId: player.id };
    if (validateRecruitHero(draft, cmd)) continue;
    handleRecruitHero(draft, cmd, events);
    return;
  }
}

export function playTownTurn(draft: GameState, town: TownState, player: PlayerState, events: GameEvent[]): void {
  tryBuild(draft, town, events);
  tryRecruit(draft, town, player, events);
  tryRecruitHero(draft, town, player, events);
}
