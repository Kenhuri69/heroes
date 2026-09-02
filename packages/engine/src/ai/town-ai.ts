import type { GameEvent } from '../core/events';
import type { GameState, PlayerState, ResourceId } from '../core/state';
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
} from '../town';
import { validateRecruitHero, handleRecruitHero } from '../hero/recruit';
import { samePos } from '../adventure/map';
import type { BuildingDef, BuildingEffect, TownState } from '../town/types';
import { unitWithEconomy } from '../town/unit-economy';
import { maxAffordableCount } from '../town/resources';

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

/**
 * Priorité de construction, dérivée du seul EFFET déclaratif du niveau visé —
 * jamais d'un id de bâtiment ni de faction (invariant README §1) : l'économie
 * d'abord (elle finance tout le reste), puis les habitations (les unités
 * gagnent les combats — le plus haut palier d'abord), puis la croissance, enfin
 * les services. Un effet inconnu du moteur garde une valeur de repli basse : un
 * bâtiment de faction inédit reste constructible, simplement pas prioritaire.
 */
function buildPriority(effect: BuildingEffect): number {
  switch (effect.type) {
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
 * Construit le bâtiment abordable le PLUS UTILE (1/jour, doc 02 §4.1). L'IA
 * bâtissait jusqu'ici le premier bâtiment abordable par ordre **alphabétique**
 * d'id — un ordre arbitraire qui lui faisait poser un marché avant ses
 * habitations. Le balayage reste trié par id : à score égal, le choix est
 * déterministe.
 */
function tryBuild(draft: GameState, town: TownState, events: GameEvent[]): void {
  if (town.builtToday) return;
  let best: { buildingId: string; score: number } | null = null;
  for (const buildingId of Object.keys(draft.buildingCatalog).sort()) {
    const cmd = { type: 'BuildStructure' as const, townId: town.id, buildingId };
    if (validateBuildStructure(draft, cmd)) continue;
    const level = draft.buildingCatalog[buildingId]?.levels[town.buildings[buildingId] ?? 0];
    if (!level) continue; // exclu par validate — garde-fou
    const score = buildPriority(level.effect);
    if (!best || score > best.score) best = { buildingId, score };
  }
  if (!best) return;
  handleBuildStructure(draft, { type: 'BuildStructure', townId: town.id, buildingId: best.buildingId }, events);
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
    // Revue 2026-09 : helper de `town/resources` (faction-aware) — la copie locale
    // ignorait `factionResources` ⇒ `cannotAfford` puis `continue` : l'IA sautait
    // ses unités à coût de faction (T8) au lieu d'en recruter le nombre abordable.
    const count = maxAffordableCount(player, recruitCost ?? {}, town.stock[unitId] ?? 0);
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
    const effect = draft.buildingCatalog[buildingId]?.levels[level - 1]?.effect;
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
  tryBuild(draft, town, events);
  tryRecruit(draft, town, player, events);
  tryUpgrade(draft, town, events);
  tryRecruitHero(draft, town, player, events);
  tryBuyWarMachine(draft, town, events);
  tryGarrisonPickup(draft, town, events);
}
