import type { ManaConfig } from '../adventure/config';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import type { TownState } from '../town/types';
import { heroArtifactBonus } from './artifacts';
import { heroEffectTotal } from './skills';

/**
 * Mana persistante (LE4/C2, doc 02 §1.4 — décision utilisateur 2026-09-30).
 * Aucune recharge après un combat ; trois sources seulement :
 * - l'aube : `max(basePerDay, ⌊Savoir effectif × perKnowledge⌋)` + Mysticisme ;
 * - une de ses villes : au moins `townRestorePct` % du max, 100 % avec une Guilde
 *   des mages (pool de sorts non vide — la « tour de magie ») ;
 * - une fontaine de mana (`restoreMana`, `adventure/visitable.ts`) : 100 %.
 * Tout est plafonné au max ; rien n'est cumulatif (une ville ne dépasse jamais son palier).
 */

/** Bloc de mana persistante actif, sinon `null` (mana pleine à chaque combat/aube). */
export function persistentMana(state: GameState): ManaConfig | null {
  const mana = state.config?.hero.mana;
  return mana?.persistent === true ? mana : null;
}

/** Mana regagnée à l'aube — le Savoir effectif compte les artefacts. */
export function heroDailyManaRegen(state: GameState, hero: HeroState, mana: ManaConfig): number {
  const knowledge = hero.attributes.knowledge + heroArtifactBonus(hero, state.artifactCatalog).knowledge;
  return (
    Math.max(mana.basePerDay, Math.floor(knowledge * mana.perKnowledge)) +
    heroEffectTotal(hero, state.skillCatalog, 'manaRegenPerDay', state.artifactCatalog)
  );
}

/** Palier de mana qu'offre une ville à son propriétaire : 100 % avec une Guilde, sinon `townRestorePct`. */
export function townManaTarget(town: TownState, hero: HeroState, mana: ManaConfig): number {
  if (town.spellPool.length > 0) return hero.manaMax;
  return Math.floor((hero.manaMax * mana.townRestorePct) / 100);
}

/**
 * Séjour dans une de ses villes : remonte la mana à son palier (jamais au-delà,
 * jamais de baisse). Émet `ManaRestored` quand la mana monte réellement.
 */
export function restoreManaInTown(
  state: GameState,
  hero: HeroState,
  town: TownState,
  events: GameEvent[],
): void {
  const mana = persistentMana(state);
  if (!mana || town.ownerPlayerId !== hero.playerId) return;
  const target = townManaTarget(town, hero, mana);
  if (hero.mana >= target) return;
  const amount = target - hero.mana;
  hero.mana = target;
  events.push({ type: 'ManaRestored', heroId: hero.id, playerId: hero.playerId, amount, source: 'town' });
}
