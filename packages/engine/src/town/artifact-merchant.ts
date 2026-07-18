import type { MarketConfig } from '../adventure/config';
import { samePos } from '../adventure/map';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import type { ArtifactDef } from '../hero/types';
import { townHasMarket } from './market';

/**
 * Marchand d'artefacts (doc 18 D2) — VENTE d'un artefact contre or au bâtiment
 * marché. Point d'extension GÉNÉRIQUE : prix dérivé des bonus (données), aucun id
 * de faction/artefact en dur. L'ACHAT (exige un stock de ville) est différé.
 */

type SellCmd = Extract<Command, { type: 'SellArtifact' }>;

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
