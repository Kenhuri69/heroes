import { rollRange } from '../core/rng';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import { heroLearnableCircle } from '../hero/skills';
import type { TownState } from './types';

/**
 * Guilde des mages (doc 02 §4.1, G2). Deux opérations pures et déterministes :
 *  - `rollGuildSpells` : à la construction d'un niveau de guilde, tire au RNG
 *    seedé `spellCount` sorts du cercle enseigné et les ajoute à `town.spellPool` ;
 *  - `learnGuildSpellsAtTown` : un héros du propriétaire présent sur la ville
 *    apprend les sorts du pool de cercle ≤ son cercle apprenable (Sagesse, H2).
 *
 * Le moteur reste faction-agnostique : le tirage puise dans le catalogue de
 * sorts par CERCLE, jamais par faction. RNG seedé uniquement (jamais Math.random).
 */

/**
 * Ajoute au pool de la ville `spellCount` sorts du cercle `level`, tirés au RNG
 * seedé parmi les sorts du catalogue de ce cercle non encore dans le pool.
 * Retourne les ids ajoutés (ordre du tirage). Mute `draft.rng` et `town.spellPool`.
 */
export function rollGuildSpells(
  draft: GameState,
  town: TownState,
  level: number,
  spellCount: number,
): string[] {
  if (spellCount <= 0) return [];
  const pool = new Set(town.spellPool);
  // Candidats déterministes : sorts du cercle, non déjà présents, triés par id.
  const candidates = Object.values(draft.spellCatalog)
    .filter((s) => s.circle === level && !pool.has(s.id))
    .map((s) => s.id)
    .sort();
  const added: string[] = [];
  const n = Math.min(spellCount, candidates.length);
  // Sélection sans remise (Fisher-Yates partiel) : on échange l'élément tiré au
  // bout du segment restant, ce qui donne un sous-ensemble uniforme et stable.
  for (let i = 0; i < n; i++) {
    const last = candidates.length - 1 - i;
    const roll = rollRange(draft.rng, 0, last);
    draft.rng = roll.state;
    const pick = candidates[roll.value] as string;
    candidates[roll.value] = candidates[last] as string;
    candidates[last] = pick;
    added.push(pick);
    town.spellPool.push(pick);
  }
  return added;
}

/**
 * Fait apprendre au héros les sorts du pool de la ville qu'il peut apprendre
 * (cercle ≤ `heroLearnableCircle`) et ne connaît pas encore. Émet `SpellsLearned`
 * si au moins un sort est appris. Mute `hero.spells`.
 */
export function learnGuildSpellsAtTown(
  draft: GameState,
  hero: HeroState,
  town: TownState,
  events: GameEvent[],
): void {
  if (town.spellPool.length === 0) return;
  const limit = heroLearnableCircle(hero, draft.skillCatalog);
  const learned: string[] = [];
  for (const id of town.spellPool) {
    if (hero.spells.includes(id)) continue;
    const circle = draft.spellCatalog[id]?.circle;
    if (circle === undefined || circle > limit) continue;
    hero.spells.push(id);
    learned.push(id);
  }
  if (learned.length > 0) events.push({ type: 'SpellsLearned', heroId: hero.id, spellIds: learned });
}
