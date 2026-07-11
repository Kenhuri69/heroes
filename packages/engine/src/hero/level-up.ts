import type { Draft } from '../combat/draft';
import { rollRange } from '../core/rng';
import type { HeroState } from '../core/state';

/**
 * Choix de compétence à la montée de niveau (doc 02 §1.2, décision plan
 * phase-3.2 #6) : tire 2 propositions (nouvelle compétence si le héros en
 * connaît < 6, ou +1 rang d'une compétence connue < rang 3), au RNG de
 * l'état — déterministe, ordre stable des ids avant tirage.
 */

/** Compétences éligibles à une proposition : nouvelle (< 6 connues) ou montée (rang < 3). */
function eligibleSkills(hero: HeroState, catalog: Draft['skillCatalog']): string[] {
  const knownCount = Object.keys(hero.skills).length;
  const ids = Object.keys(catalog).sort();
  const eligible: string[] = [];
  for (const id of ids) {
    // F-SKILLS : une compétence de faction (`factionId` estampillé) n'est proposée
    // qu'aux héros de sa faction. Compétence commune (`factionId` absent) : à tous.
    const factionId = catalog[id]?.factionId;
    if (factionId && factionId !== hero.factionId) continue;
    const rank = hero.skills[id];
    if (rank !== undefined) {
      if (rank < 3) eligible.push(id);
    } else if (knownCount < 6) {
      eligible.push(id);
    }
  }
  return eligible;
}

/**
 * Tire jusqu'à 2 propositions distinctes parmi les compétences éligibles.
 * Peut en retourner moins de 2 si le héros est déjà maximisé (6 compétences
 * toutes au rang 3, ou catalogue trop restreint).
 */
export function rollSkillChoices(draft: Draft, hero: HeroState): string[] {
  const pool = eligibleSkills(hero, draft.skillCatalog);
  const picks: string[] = [];
  for (let i = 0; i < 2 && pool.length > 0; i++) {
    const roll = rollRange(draft.rng, 0, pool.length - 1);
    draft.rng = roll.state;
    picks.push(...pool.splice(roll.value, 1));
  }
  return picks;
}
