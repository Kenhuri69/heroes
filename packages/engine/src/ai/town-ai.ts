import type { GameEvent } from '../core/events';
import type { GameState, PlayerState, ResourceId, Resources } from '../core/state';
import { RESOURCE_IDS } from '../core/state';
import {
  validateBuildStructure,
  handleBuildStructure,
  validateRecruitUnits,
  handleRecruitUnits,
  validateUpgradeUnits,
  handleUpgradeUnits,
  validateGarrisonTransfer,
  handleGarrisonTransfer,
  validateBuyWarMachine,
  handleBuyWarMachine,
  validateTradeResources,
  handleTradeResources,
  builtLevelOf,
  levelOptions,
} from '../town';
import { marketRates, ownedMarketCount, townHasMarket, tradeQuote } from '../town/market';
import { validateRecruitHero, handleRecruitHero } from '../hero/recruit';
import { samePos } from '../adventure/map';
import type { BuildingDef, BuildingEffect, BuildingLevel, TownState } from '../town/types';
import { unitWithEconomy } from '../town/unit-economy';
import { maxAffordableCount, scaleCost } from '../town/resources';

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
      for (const effect of levelOptions(level))
        if (effect.type === 'dwelling' && effect.unitId === unitId) return effect.tier;
    }
  }
  return 0;
}

/**
 * Priorité de construction, dérivée du seul EFFET déclaratif du niveau visé —
 * jamais d'un id de bâtiment ni de faction (invariant README §1) : l'économie
 * d'abord (elle finance tout le reste), puis les habitations (les unités
 * gagnent les combats — le plus haut palier d'abord), puis la croissance, enfin
 * les services. Un effet inconnu du moteur garde une valeur de repli basse : un
 * bâtiment de faction inédit reste constructible, simplement pas prioritaire.
 */
function buildPriority(effect: BuildingEffect, heroless: boolean): number {
  switch (effect.type) {
    // LE1/B2 : un joueur sans héros ne peut plus rien prendre ni défendre — la
    // Taverne (seul moyen d'en recruter un) passe alors devant tout.
    case 'tavern':
      return heroless ? 200 : 20;
    case 'income':
    case 'factionResourceIncome':
      return 100;
    case 'dwelling':
      return 80 + effect.tier;
    case 'growthBonus':
      return 70;
    case 'mageGuild':
      return 40;
    case 'market':
      return 35;
    default:
      return 20;
  }
}

/**
 * Option retenue par l'IA à un niveau à `alternatives` (lot E3/LE8) : parmi des
 * habitations, celle qui rapporte le plus de force brute par pièce d'or —
 * (PV + Att + Déf, la mesure d'`armyStrength`) × croissance hebdo ÷ coût en or.
 * Égalité, ou options d'un autre type ⇒ option 0. Générique, sans RNG.
 */
function preferredLevelChoice(draft: GameState, level: BuildingLevel): number {
  const options = levelOptions(level);
  let best = 0;
  let bestValue = -1;
  options.forEach((effect, choice) => {
    if (effect.type !== 'dwelling') return;
    const unit = unitWithEconomy(draft.unitCatalog, effect.unitId);
    const gold = unit?.recruitCost?.gold ?? 0;
    if (!unit || gold <= 0) return;
    const value = ((unit.stats.hp + unit.stats.attack + unit.stats.defense) * (unit.growthPerWeek ?? 1)) / gold;
    if (value > bestValue) {
      best = choice;
      bestValue = value;
    }
  });
  return best;
}

/**
 * Construit le bâtiment abordable le PLUS UTILE (1/jour, doc 02 §4.1). L'IA
 * bâtissait jusqu'ici le premier bâtiment abordable par ordre **alphabétique**
 * d'id — un ordre arbitraire qui lui faisait poser un marché avant ses
 * habitations. Le balayage reste trié par id : à score égal, le choix est
 * déterministe.
 *
 * Rend le coût du bâtiment le plus utile qui n'est refusé **que** faute de
 * ressources (LE1/B2) — la réserve que le recrutement ne doit pas entamer au-delà
 * de sa première pile — ou `null` si l'IA a bâti, ou n'a rien à économiser.
 */
function tryBuild(draft: GameState, town: TownState, events: GameEvent[]): Partial<Resources> | null {
  if (town.builtToday) return null;
  const heroless = !draft.heroes.some((h) => h.playerId === town.ownerPlayerId);
  let best: { buildingId: string; score: number } | null = null;
  let saving: { cost: Partial<Resources>; score: number } | null = null;
  for (const buildingId of Object.keys(draft.buildingCatalog).sort()) {
    const cmd = { type: 'BuildStructure' as const, townId: town.id, buildingId };
    const error = validateBuildStructure(draft, cmd);
    const level = draft.buildingCatalog[buildingId]?.levels[town.buildings[buildingId] ?? 0];
    if (!level) continue; // exclu par validate — garde-fou
    const score = buildPriority(level.effect, heroless);
    if (error) {
      // `cannotAfford` est la DERNIÈRE garde de `validateBuildStructure` : tout le
      // reste (prérequis, exclusivité, unicité) est déjà satisfait.
      if (error.code === 'cannotAfford' && (!saving || score > saving.score)) saving = { cost: level.cost, score };
      continue;
    }
    if (!best || score > best.score) best = { buildingId, score };
  }
  if (!best) return saving?.cost ?? null;
  const level = draft.buildingCatalog[best.buildingId]?.levels[town.buildings[best.buildingId] ?? 0];
  const choice = level?.alternatives ? preferredLevelChoice(draft, level) : 0;
  handleBuildStructure(
    draft,
    { type: 'BuildStructure', townId: town.id, buildingId: best.buildingId, ...(choice > 0 ? { choice } : {}) },
    events,
  );
  return null;
}

/**
 * Recrute tout ce que la ville a en stock, du plus haut tier au plus bas (LE1/B2).
 * L'IA ne recrutait qu'UNE pile par jour : ses stocks dormaient pendant que
 * l'humain vidait les siens. La première pile (le plus haut tier abordable) se
 * paie comme avant ; les suivantes ne puisent pas dans `reserve` — le bâtiment
 * prioritaire que l'IA n'a pas pu payer aujourd'hui (`tryBuild`).
 */
function tryRecruit(
  draft: GameState,
  town: TownState,
  player: PlayerState,
  reserve: Partial<Resources> | null,
  events: GameEvent[],
): void {
  const candidates = Object.keys(town.stock)
    .filter((unitId) => (town.stock[unitId] ?? 0) > 0)
    // Départage par unités de code (remédiation R1) : déterministe et
    // indépendant de l'ICU hôte, contrairement à `localeCompare`.
    .sort(
      (a, b) =>
        unitTier(draft.buildingCatalog, b) - unitTier(draft.buildingCatalog, a) ||
        (a < b ? -1 : a > b ? 1 : 0),
    );
  let recruited = false;
  for (const unitId of candidates) {
    const recruitCost = unitWithEconomy(draft.unitCatalog, unitId)?.recruitCost;
    // Revue 2026-09 : helper de `town/resources` (faction-aware) — la copie locale
    // ignorait `factionResources` ⇒ `cannotAfford` puis `continue` : l'IA sautait
    // ses unités à coût de faction (T8) au lieu d'en recruter le nombre abordable.
    const budget = recruited && reserve ? withoutReserve(player, reserve) : player;
    const stock = town.stock[unitId] ?? 0;
    let count = maxAffordableCount(budget, recruitCost ?? {}, stock);
    // LE1/B2 : le reste du stock se paie en convertissant de l'or au marché (le
    // mercure d'un T5 ne doit plus bloquer une ville riche en or).
    let plan: MarketPlan | null = null;
    if (count < stock && recruitCost) {
      // Lot R2 : l'or du marché ne puise jamais dans la réserve du bâtiment
      // prioritaire, première pile comprise — avec des ressources rares chères,
      // acheter le mercure des recrues retardait l'habitation T7 de plusieurs jours.
      const marketBudget = reserve ? withoutReserve(player, reserve) : budget;
      const withMarket = maxCountWithMarket(draft, town, marketBudget, recruitCost, stock);
      if (withMarket.count > count) ({ count, plan } = withMarket);
    }
    if (count <= 0) continue;
    const cmd = { type: 'RecruitUnits' as const, townId: town.id, unitId, count };
    if (plan) {
      // N'acheter que si le coût est le SEUL obstacle (`cannotAfford` est la
      // dernière garde) : une garnison pleine gaspillerait l'or du marché.
      const blocker = validateRecruitUnits(draft, cmd);
      if (blocker && blocker.code !== 'cannotAfford') continue;
      executePlan(draft, town, plan, events);
    }
    if (validateRecruitUnits(draft, cmd)) continue;
    handleRecruitUnits(draft, cmd, events);
    recruited = true;
  }
}

/**
 * Plus grand effectif ≤ `stock` payable en complétant au marché (recherche
 * dichotomique : le coût d'un plan croît avec l'effectif). `budget` est la vue
 * du joueur (réserve déjà ôtée).
 */
function maxCountWithMarket(
  draft: GameState,
  town: TownState,
  budget: PlayerState,
  unitCost: Record<string, number>,
  stock: number,
): { count: number; plan: MarketPlan | null } {
  let lo = 0;
  let best: MarketPlan | null = null;
  let hi = stock;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const plan = marketPlan(draft, town, budget, scaleCost(unitCost, mid));
    if (plan && plan.gold <= budget.resources.gold) {
      lo = mid;
      best = plan;
    } else hi = mid - 1;
  }
  return { count: lo, plan: best };
}

/** Vue du joueur amputée d'une réserve (ressources communes, plancher 0) — lecture seule. */
function withoutReserve(player: PlayerState, reserve: Partial<Resources>): PlayerState {
  const resources = { ...player.resources };
  for (const id of RESOURCE_IDS) resources[id] = Math.max(0, resources[id] - (reserve[id] ?? 0));
  return { ...player, resources };
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
  // Héros de la réserve d'abord (LE6 B3 : le héros qui a fui revient avec son
  // niveau et ses artefacts), puis roster de la faction de la ville, non déjà
  // vivant (pool exclusif), en ordre d'id stable (déterministe).
  const reserveIds = (player.reserveHeroes ?? []).map((h) => (h.rosterId !== '' ? h.rosterId : h.id));
  for (const heroId of [...reserveIds, ...Object.keys(draft.heroRoster).sort()]) {
    const cmd = { type: 'RecruitHero' as const, townId: town.id, heroId, playerId: player.id };
    if (validateRecruitHero(draft, cmd)) continue;
    handleRecruitHero(draft, cmd, events);
    return;
  }
}

/**
 * Améliore les piles de garnison dont l'habitation de niveau 2 est bâtie
 * (Alpha 4.11) — l'IA ne l'avait jamais fait : elle payait des habitations
 * améliorées puis alignait des unités de base. Joué APRÈS le recrutement : le
 * neuf d'abord, l'amélioration avec ce qui reste. Ordre d'id stable, une passe
 * par pile ; `validateUpgradeUnits` écarte tout ce qui n'est pas payable.
 */
function tryUpgrade(draft: GameState, town: TownState, events: GameEvent[]): void {
  for (const unitId of town.garrison.map((s) => s.unitId).sort()) {
    const cmd = { type: 'UpgradeUnits' as const, townId: town.id, unitId };
    if (validateUpgradeUnits(draft, cmd)) continue;
    handleUpgradeUnits(draft, cmd, events);
  }
}

/**
 * Le héros du propriétaire présent SUR la ville embarque la garnison. Sans ce
 * ramassage, l'IA recrutait dans le vide : `RecruitUnits` dépose les recrues en
 * **garnison** (doc 02 §4.1) et rien ne les en sortait — ses héros finissaient
 * la partie avec leur armée de départ. Piles parcourues du dernier au premier
 * (les indices restants restent valides après retrait) ; une pile qui ne passe
 * pas (cap de 7 côté héros) n'empêche pas les suivantes de fusionner.
 *
 * Appelée aux DEUX bouts du tour (`runAiTurn`) : au début du tour du héros (il
 * embarque ce qui l'attend là où il dort, avant de choisir son objectif) et à
 * la fin du tour de la ville (il vient peut-être d'y arriver). No-op sans héros
 * sur place ou sans garnison.
 */
export function tryGarrisonPickup(draft: GameState, town: TownState, events: GameEvent[]): void {
  const hero = draft.heroes
    .filter((h) => h.playerId === town.ownerPlayerId && samePos(h.pos, town.pos))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  if (!hero) return;
  for (let slot = town.garrison.length - 1; slot >= 0; slot--) {
    const cmd = { type: 'GarrisonTransfer' as const, townId: town.id, heroId: hero.id, from: 'town' as const, slot };
    if (validateGarrisonTransfer(draft, cmd)) continue;
    handleGarrisonTransfer(draft, cmd, events);
  }
}

/**
 * Réserve conservée de chaque ressource non-or avant de vendre : couvre les
 * paliers de coût de bâtiment les plus lourds du contenu livré (ordre de 20-40)
 * pour que la vente ne bloque jamais une construction du lendemain.
 */
const AI_RESOURCE_RESERVE = 30;

/**
 * Vend au marché le plus gros surplus de ressource non-or (au-delà de la
 * réserve) contre de l'or. L'IA n'avait jamais émis `TradeResources` : elle
 * s'asseyait sur un tas de gemmes ou de cristal inutile pendant que son or
 * — la ressource qui recrute — manquait. Joué EN PREMIER dans le tour de ville :
 * l'or gagné finance la construction et le recrutement du jour même. Une seule
 * ressource par ville et par tour ; `validateTradeResources` porte le reste
 * (marché construit, taux configuré, contrepartie non nulle).
 */
function tryTradeSurplus(draft: GameState, town: TownState, player: PlayerState, events: GameEvent[]): void {
  let best: { id: ResourceId; surplus: number } | null = null;
  for (const id of RESOURCE_IDS) {
    if (id === 'gold') continue;
    const surplus = player.resources[id] - AI_RESOURCE_RESERVE;
    if (surplus <= 0) continue;
    if (!best || surplus > best.surplus) best = { id, surplus };
  }
  if (!best) return;
  const cmd = {
    type: 'TradeResources' as const,
    townId: town.id,
    give: best.id,
    receive: 'gold' as const,
    giveAmount: best.surplus,
  };
  if (validateTradeResources(draft, cmd)) return;
  handleTradeResources(draft, cmd, events);
}

/** Achats d'or → ressource qui couvrent un coût, et l'or total qu'ils engagent (coût compris). */
interface MarketPlan {
  buys: { id: ResourceId; gold: number }[];
  gold: number;
}

/**
 * Plan d'achat au marché pour couvrir `cost` (ressources communes seulement : une
 * ressource de faction ne s'achète pas) — `null` sans marché ou si une ressource
 * de faction manque. LE1/B2, mesuré : l'IA finissait assise sur 30 000 à 70 000
 * or, bloquée à vie par 3 mercure ou 5 bois — elle savait vendre son surplus
 * (`tryTradeSurplus`), jamais acheter. PUR (aucune mutation).
 */
function marketPlan(draft: GameState, town: TownState, player: PlayerState, cost: Record<string, number>): MarketPlan | null {
  const market = draft.config?.market;
  if (!market || !townHasMarket(draft, town)) return null;
  const markets = ownedMarketCount(draft, player.id);
  const plan: MarketPlan = { buys: [], gold: cost.gold ?? 0 };
  for (const [id, amount] of Object.entries(cost)) {
    if (id === 'gold' || !amount) continue;
    if (!(RESOURCE_IDS as readonly string[]).includes(id)) {
      if ((player.factionResources[id] ?? 0) < amount) return null;
      continue;
    }
    const missing = amount - player.resources[id as ResourceId];
    if (missing <= 0) continue;
    // Plus petit montant d'or qui rapporte `missing` (le marché arrondit à la baisse) :
    // forme fermée, la boucle ne rattrape qu'un écart d'arrondi flottant.
    let gold = Math.ceil(missing * marketRates(market, id as ResourceId, markets).buyRate);
    while (tradeQuote(market, 'gold', id as ResourceId, gold, markets) < missing) gold++;
    plan.buys.push({ id: id as ResourceId, gold });
    plan.gold += gold;
  }
  return plan;
}

/** Exécute un plan d'achat (déjà jugé payable). */
function executePlan(draft: GameState, town: TownState, plan: MarketPlan, events: GameEvent[]): void {
  for (const { id, gold } of plan.buys) {
    const cmd = { type: 'TradeResources' as const, townId: town.id, give: 'gold' as const, receive: id, giveAmount: gold };
    if (validateTradeResources(draft, cmd)) return;
    handleTradeResources(draft, cmd, events);
  }
}

/**
 * Achète ce qui manque au bâtiment prioritaire, tout ou rien : si l'or ne couvre
 * pas à la fois les achats ET la part d'or du bâtiment, on n'achète rien. Rend
 * `true` si des achats ont eu lieu (l'appelant retente la construction).
 */
function tryBuyShortfall(
  draft: GameState,
  town: TownState,
  player: PlayerState,
  cost: Partial<Resources>,
  events: GameEvent[],
): boolean {
  const plan = marketPlan(draft, town, player, cost as Record<string, number>);
  if (!plan || plan.buys.length === 0 || plan.gold > player.resources.gold) return false;
  executePlan(draft, town, plan, events);
  return true;
}

/**
 * Achète UNE machine de guerre au héros présent (Forge et consorts, doc 02 §5) :
 * la baliste ou la tente de soins pesaient dans chaque combat de l'IA… qui ne
 * les achetait jamais. Une par ville et par tour (l'or restant va à l'armée) ;
 * les machines vendues sont déclarées par l'effet `warMachineVendor`, jamais un
 * id en dur — `validateBuyWarMachine` couvre héros présent, vendeur, doublon
 * et prix.
 */
function tryBuyWarMachine(draft: GameState, town: TownState, events: GameEvent[]): void {
  const sold = new Set<string>();
  for (const [buildingId, level] of Object.entries(town.buildings)) {
    if (level < 1) continue;
    const effect = builtLevelOf(town, draft.buildingCatalog, buildingId)?.effect;
    if (effect?.type === 'warMachineVendor') for (const unitId of effect.units) sold.add(unitId);
  }
  for (const unitId of [...sold].sort()) {
    const cmd = { type: 'BuyWarMachine' as const, townId: town.id, unitId };
    if (validateBuyWarMachine(draft, cmd)) continue;
    handleBuyWarMachine(draft, cmd, events);
    return;
  }
}

export function playTownTurn(draft: GameState, town: TownState, player: PlayerState, events: GameEvent[]): void {
  tryTradeSurplus(draft, town, player, events);
  let reserve = tryBuild(draft, town, events);
  if (reserve && tryBuyShortfall(draft, town, player, reserve, events)) reserve = tryBuild(draft, town, events);
  tryRecruit(draft, town, player, reserve, events);
  tryUpgrade(draft, town, events);
  tryRecruitHero(draft, town, player, events);
  tryBuyWarMachine(draft, town, events);
  tryGarrisonPickup(draft, town, events);
}
