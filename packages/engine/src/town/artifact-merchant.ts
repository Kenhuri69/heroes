import type { MarketConfig } from '../adventure/config';
import { samePos } from '../adventure/map';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import { rollRange, seedRng } from '../core/rng';
import type { GameState } from '../core/state';
import type { ArtifactDef } from '../hero/types';
import type { TownState } from './types';
import { townHasMarket } from './market';

/**
 * Marchand d'artefacts (doc 18 D2) — VENTE d'un artefact contre or au bâtiment
 * marché. Point d'extension GÉNÉRIQUE : prix dérivé des bonus (données), aucun id
 * de faction/artefact en dur. L'ACHAT (exige un stock de ville) est différé.
 */

type SellCmd = Extract<Command, { type: 'SellArtifact' }>;
type BuyCmd = Extract<Command, { type: 'BuyArtifact' }>;

/** Hash déterministe d'une chaîne (FNV-1a 32 bits) — graine du stock de marchand. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Stock d'ACHAT dérivé (doc 18 D2) : `artifactStockSize` artefacts distincts
 * tirés du catalogue, **déterministe** par `townId` (RNG LOCAL seedé — jamais
 * `draft.rng`, donc aucune perturbation de la séquence ni du golden). Fixe pour
 * la partie ; le disponible réel = ce stock moins `town.artifactsBought`. Vide si
 * le marchand d'achat n'est pas configuré.
 */
export function merchantBuyStock(game: GameState, town: TownState): string[] {
  const market = game.config?.market;
  const size = market?.artifactStockSize ?? 0;
  if (!market || market.artifactValuePerPoint === undefined || size <= 0) return [];
  const pool = Object.keys(game.artifactCatalog).sort();
  let rng = seedRng(hashString(town.id));
  const stock: string[] = [];
  const n = Math.min(size, pool.length);
  for (let i = 0; i < n; i++) {
    const roll = rollRange(rng, 0, pool.length - 1);
    rng = roll.state;
    stock.push(pool.splice(roll.value, 1)[0]!);
  }
  return stock;
}

/** Artefacts encore ACHETABLES à cette ville (stock dérivé moins déjà achetés). */
export function merchantAvailable(game: GameState, town: TownState): string[] {
  const bought = town.artifactsBought ?? [];
  return merchantBuyStock(game, town).filter((id) => !bought.includes(id));
}

/** Somme des points de bonus (valeurs absolues) d'un artefact — mesure de puissance. */
function bonusPoints(def: ArtifactDef): number {
  const b = def.bonus;
  return (
    Math.abs(b.attack ?? 0) +
    Math.abs(b.defense ?? 0) +
    Math.abs(b.power ?? 0) +
    Math.abs(b.knowledge ?? 0) +
    Math.abs(b.luck ?? 0) +
    Math.abs(b.morale ?? 0) +
    Math.abs(b.manaMax ?? 0) +
    Math.abs(b.movementFlat ?? 0) +
    Math.abs(b.vision ?? 0)
  );
}

/**
 * Valeur marchande de base (or) d'un artefact : `value` explicite du contenu,
 * sinon dérivée `Σ|bonus| × artifactValuePerPoint`. 0 si le marché n'active pas
 * la vente d'artefacts (`artifactValuePerPoint` absent) et sans `value`.
 */
export function artifactBaseValue(def: ArtifactDef, market: MarketConfig): number {
  const perPoint = market.artifactValuePerPoint ?? 0;
  return def.value ?? bonusPoints(def) * perPoint;
}

/** Or rendu à la VENTE d'un artefact : `floor(valeur de base × artifactSellFactor)`. */
export function artifactSellPrice(def: ArtifactDef, market: MarketConfig): number {
  const factor = market.artifactSellFactor ?? 1;
  return Math.floor(artifactBaseValue(def, market) * factor);
}

/** Artefact ciblé par la commande (slot équipé ou entrée de sac), ou `null`. */
function targetArtifactId(hero: GameState['heroes'][number], cmd: SellCmd): string | null {
  if (cmd.source === 'equipped') return hero.artifacts[cmd.index] ?? null;
  return hero.backpack?.[cmd.index] ?? null;
}

export function validateSellArtifact(state: GameState, cmd: SellCmd): CommandError | null {
  if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
  const market = state.config?.market;
  if (!market || market.artifactValuePerPoint === undefined)
    return { code: 'invalidTrade', message: 'aucun marchand d’artefacts configuré' };
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return { code: 'notYourTown', message: `la ville '${cmd.townId}' n'appartient pas au joueur actif` };
  if (!townHasMarket(state, town))
    return { code: 'invalidTrade', message: `aucun marché construit dans '${cmd.townId}'` };
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero || hero.playerId !== player.id)
    return { code: 'notYourHero', message: `'${cmd.heroId}' n'appartient pas au joueur actif` };
  if (!samePos(hero.pos, town.pos))
    return { code: 'invalidAction', message: `'${cmd.heroId}' n'est pas dans la ville` };
  const artifactId = targetArtifactId(hero, cmd);
  if (!artifactId) return { code: 'invalidTarget', message: 'aucun artefact à cet emplacement' };
  const def = state.artifactCatalog[artifactId];
  if (!def) return { code: 'invalidTarget', message: `artefact inconnu '${artifactId}'` };
  if (artifactSellPrice(def, market) <= 0)
    return { code: 'invalidTrade', message: `'${artifactId}' n'a aucune valeur marchande` };
  return null;
}

export function handleSellArtifact(draft: GameState, cmd: SellCmd, events: GameEvent[]): void {
  const market = draft.config?.market;
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!market || !town || !player || !hero) return; // exclu par validate
  const artifactId = targetArtifactId(hero, cmd);
  if (!artifactId) return;
  const def = draft.artifactCatalog[artifactId];
  if (!def) return;
  const price = artifactSellPrice(def, market);
  // Retire l'artefact de sa source (slot équipé → null ; sac → splice).
  if (cmd.source === 'equipped') hero.artifacts[cmd.index] = null;
  else hero.backpack?.splice(cmd.index, 1);
  player.resources.gold += price;
  events.push({ type: 'ArtifactSold', heroId: hero.id, playerId: player.id, artifactId, gold: price });
}

export function validateBuyArtifact(state: GameState, cmd: BuyCmd): CommandError | null {
  if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
  const market = state.config?.market;
  if (!market || market.artifactValuePerPoint === undefined || (market.artifactStockSize ?? 0) <= 0)
    return { code: 'invalidTrade', message: 'aucun marchand d’artefacts à l’achat configuré' };
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return { code: 'notYourTown', message: `la ville '${cmd.townId}' n'appartient pas au joueur actif` };
  if (!townHasMarket(state, town))
    return { code: 'invalidTrade', message: `aucun marché construit dans '${cmd.townId}'` };
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero || hero.playerId !== player.id)
    return { code: 'notYourHero', message: `'${cmd.heroId}' n'appartient pas au joueur actif` };
  if (!samePos(hero.pos, town.pos))
    return { code: 'invalidAction', message: `'${cmd.heroId}' n'est pas dans la ville` };
  if (!merchantAvailable(state, town).includes(cmd.artifactId))
    return { code: 'invalidTarget', message: `'${cmd.artifactId}' n'est pas au stock du marchand` };
  const def = state.artifactCatalog[cmd.artifactId];
  if (!def) return { code: 'invalidTarget', message: `artefact inconnu '${cmd.artifactId}'` };
  if (player.resources.gold < artifactBaseValue(def, market))
    return { code: 'cannotAfford', message: 'or insuffisant pour cet artefact' };
  return null;
}

export function handleBuyArtifact(draft: GameState, cmd: BuyCmd, events: GameEvent[]): void {
  const market = draft.config?.market;
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!market || !town || !player || !hero) return; // exclu par validate
  const def = draft.artifactCatalog[cmd.artifactId];
  if (!def) return;
  const price = artifactBaseValue(def, market);
  player.resources.gold -= price;
  // Remise de l'artefact : 1er slot équipé libre, sinon le sac (comme grantArtifact).
  const slot = hero.artifacts.indexOf(null);
  if (slot !== -1) hero.artifacts[slot] = cmd.artifactId;
  else (hero.backpack ??= []).push(cmd.artifactId);
  // Marque l'artefact comme acheté (retiré du stock disponible de la ville).
  (town.artifactsBought ??= []).push(cmd.artifactId);
  events.push({ type: 'ArtifactBought', heroId: hero.id, playerId: player.id, artifactId: cmd.artifactId, gold: price });
}
