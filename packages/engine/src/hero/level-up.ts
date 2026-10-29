import type { Draft } from '../combat/draft';
import { rollRange } from '../core/rng';
import type { HeroState } from '../core/state';

/**
 * Choix de compétence à la montée de niveau (doc 02 §1.2, canon III — lot LD4) :
 * une **montée** de rang d'une compétence connue (< 3) et une **nouvelle**
 * compétence (si < 6 connues) ; à défaut, deux du même genre. Tirage **pondéré**
 * par l'archétype du héros (`config.hero.skillWeightsByArchetype`, 1 par défaut ;
 * 0 = jamais proposée comme nouvelle) et **garanties** (`skillGuarantees` :
 * Sagesse, écoles de magie). RNG de l'état, ordre stable des ids.
 */

/** Poids de tirage d'une compétence pour ce héros (archétype de son roster, 1 par défaut). */
export function skillWeight(draft: Draft, hero: HeroState, skillId: string): number {
  const archetype = hero.rosterId ? draft.heroRoster[hero.rosterId]?.archetype : undefined;
  const weights = archetype ? draft.config?.hero?.skillWeightsByArchetype?.[archetype] : undefined;
  return weights?.[skillId] ?? 1;
}

/** Compétences proposables : montées (connues, rang < 3) et nouvelles (< 6 connues, poids > 0). */
function skillPools(draft: Draft, hero: HeroState): { upgrades: string[]; news: string[] } {
  const catalog = draft.skillCatalog;
  const knownCount = Object.keys(hero.skills).length;
  const upgrades: string[] = [];
  const news: string[] = [];
  for (const id of Object.keys(catalog).sort()) {
    // F-SKILLS : une compétence de faction (`factionId` estampillé) n'est proposée
    // qu'aux héros de sa faction. Compétence commune (`factionId` absent) : à tous.
    const factionId = catalog[id]?.factionId;
    if (factionId && factionId !== hero.factionId) continue;
    const rank = hero.skills[id];
    if (rank !== undefined) {
      if (rank < 3) upgrades.push(id);
    } else if (knownCount < 6 && skillWeight(draft, hero, id) > 0) {
      news.push(id);
    }
  }
  return { upgrades, news };
}

/** Tire une compétence de `pool` au RNG, pondérée (une montée pèse au moins 1). */
function weightedPick(draft: Draft, hero: HeroState, pool: readonly string[]): string | undefined {
  if (pool.length === 0) return undefined;
  const weights = pool.map((id) => Math.max(1, Math.round(skillWeight(draft, hero, id))));
  const total = weights.reduce((a, b) => a + b, 0);
  const roll = rollRange(draft.rng, 0, total - 1);
  draft.rng = roll.state;
  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i]!;
    if (roll.value < acc) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Tire jusqu'à 2 propositions distinctes. Peut en retourner moins de 2 si le
 * héros est déjà maximisé (6 compétences toutes au rang 3, ou catalogue trop
 * restreint).
 */
export function rollSkillChoices(draft: Draft, hero: HeroState): string[] {
  const { upgrades, news } = skillPools(draft, hero);
  const guarantees = draft.config?.hero?.skillGuarantees ?? [];
  // Garantie échue : une de ses compétences prend la place de son genre (montée
  // si connue, nouvelle sinon) — la première échue l'emporte.
  let forced: { pool: 'up' | 'new'; ids: string[] } | null = null;
  guarantees.forEach((g, i) => {
    if (forced) return;
    if ((hero.skillOfferCounters?.[i] ?? 0) + 1 < g.everyLevels) return;
    const asNew = news.filter((id) => g.skillIds.includes(id));
    const asUp = upgrades.filter((id) => g.skillIds.includes(id));
    if (asNew.length > 0) forced = { pool: 'new', ids: asNew };
    else if (asUp.length > 0) forced = { pool: 'up', ids: asUp };
  });
  const f = forced as { pool: 'up' | 'new'; ids: string[] } | null;
  const up = weightedPick(draft, hero, f?.pool === 'up' ? f.ids : upgrades);
  const fresh = weightedPick(draft, hero, f?.pool === 'new' ? f.ids : news);
  const picks = [up, fresh].filter((id): id is string => id !== undefined);
  // À défaut d'un genre, deux propositions de l'autre (canon III).
  if (picks.length < 2) {
    const rest = [...upgrades, ...news].filter((id) => !picks.includes(id));
    const extra = weightedPick(draft, hero, rest);
    if (extra !== undefined) picks.push(extra);
  }
  // Compteurs des garanties : remis à 0 quand l'une des compétences est proposée,
  // avancés sinon — seulement pour un héros qui peut encore l'apprendre.
  guarantees.forEach((g, i) => {
    const learnable = [...upgrades, ...news].some((id) => g.skillIds.includes(id));
    if (!learnable) return;
    const offered = picks.some((id) => g.skillIds.includes(id));
    hero.skillOfferCounters = { ...hero.skillOfferCounters, [i]: offered ? 0 : (hero.skillOfferCounters?.[i] ?? 0) + 1 };
  });
  return picks;
}

/**
 * Choix de l'IA parmi les propositions (LD4) : la compétence de sa faction
 * d'abord, puis le meilleur poids d'archétype, une montée valant 1,5× (approfondir
 * son build) ; à égalité, la première proposée. Aucun tirage.
 */
export function aiSkillPick(draft: Draft, hero: HeroState, choices: readonly string[]): string | undefined {
  const factional = choices.find((id) => draft.skillCatalog[id]?.factionId);
  if (factional) return factional;
  let best: { id: string; score: number } | undefined;
  for (const id of choices) {
    const score = skillWeight(draft, hero, id) * (hero.skills[id] !== undefined ? 1.5 : 1);
    if (!best || score > best.score) best = { id, score };
  }
  return best?.id;
}

/**
 * Applique une compétence choisie : nouvelle au rang 1, sinon +1 rang (plafond 3),
 * et vide la file de propositions. Règle de rang UNIQUE, partagée par le choix du
 * joueur (`handleChooseSkill`) et l'application automatique côté IA — sans quoi
 * les deux chemins pourraient dériver.
 */
export function applySkillChoice(hero: HeroState, skillId: string): number {
  const current = hero.skills[skillId];
  const rank = current !== undefined ? Math.min(3, current + 1) : 1;
  hero.skills[skillId] = rank;
  hero.pendingSkillChoices = [];
  return rank;
}
