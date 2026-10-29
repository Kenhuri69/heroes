import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { aiSkillPick, rollSkillChoices } from '../src/hero/level-up';
import type { HeroSkillDef, ResolvedHeroDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * LD4 — montée de niveau HoMM III : une montée + une nouvelle, tirage pondéré
 * par archétype, garanties Sagesse/école, choix de l'IA.
 */

const IDS = ['a', 'b', 'c', 'd', 'wisdom', 'fire', 'water', 'fac'];

function catalog(): Record<string, HeroSkillDef> {
  const cat: Record<string, HeroSkillDef> = {};
  for (const id of IDS) cat[id] = { id, ranks: [{}, {}, {}] };
  cat['fac'] = { id: 'fac', ranks: [{}, {}, {}], factionId: 'fx' };
  return cat;
}

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-1', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, visitMorale: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [], pendingAttributeChoices: [], factionId: 'fx', houseId: '', houseEffects: [],
    name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: 'mage', ...over,
  };
}

function state(weights: Record<string, number>, seed = 1, guarantees = true): GameState {
  const s = createEmptyState();
  const base = testConfig();
  s.config = {
    ...base,
    hero: {
      ...base.hero,
      skillWeightsByArchetype: { magic: weights },
      ...(guarantees
        ? { skillGuarantees: [{ skillIds: ['wisdom'], everyLevels: 6 }, { skillIds: ['fire', 'water'], everyLevels: 4 }] }
        : {}),
    },
  };
  s.rng = seedRng(seed);
  s.skillCatalog = catalog();
  s.heroRoster = { mage: { archetype: 'magic' } as ResolvedHeroDef };
  return s;
}

describe('LD4 — propositions de compétence', () => {
  it('une montée et une nouvelle quand les deux sont possibles', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = state({}, seed, false);
      const h = hero({ skills: { a: 1 } });
      const picks = rollSkillChoices(s, h);
      expect(picks).toHaveLength(2);
      expect(picks[0]).toBe('a'); // seule montée possible
      expect(h.skills[picks[1]!]).toBeUndefined();
    }
  });

  it('deux nouvelles sans compétence à monter, deux montées sans place libre', () => {
    const fresh = rollSkillChoices(state({}, 3, false), hero());
    expect(fresh).toHaveLength(2);
    const six = { a: 1, b: 2, c: 1, d: 3, wisdom: 3, fire: 3 };
    const full = rollSkillChoices(state({}, 3, false), hero({ skills: six }));
    expect(full).toHaveLength(2);
    expect(full.every((id) => id in six)).toBe(true);
  });

  it('les poids d’archétype sont respectés, un poids 0 n’est jamais proposé', () => {
    let b = 0;
    const N = 2000;
    for (let seed = 1; seed <= N; seed++) {
      const picks = rollSkillChoices(state({ a: 0, b: 9, c: 1, d: 0, wisdom: 0, fire: 0, water: 0, fac: 0 }, seed, false), hero());
      expect(picks).not.toContain('a');
      if (picks[0] === 'b') b++;
    }
    expect(b / N).toBeGreaterThan(0.85);
    expect(b / N).toBeLessThan(0.95);
  });

  it('garantie : la Sagesse est proposée au 6ᵉ niveau sans elle', () => {
    const weights = { a: 1000, b: 1000, c: 1000, d: 1000, wisdom: 1, fire: 1, water: 1, fac: 1000 };
    let offeredBy6 = false;
    const h = hero();
    for (let level = 1; level <= 6; level++) {
      const picks = rollSkillChoices(state(weights, level), h);
      if (picks.includes('wisdom')) offeredBy6 = true;
    }
    expect(offeredBy6).toBe(true);
  });

  it('garantie : une école de magie tous les 4 niveaux au plus', () => {
    const weights = { a: 1000, b: 1000, c: 1000, d: 1000, wisdom: 1000, fire: 1, water: 1, fac: 1000 };
    const h = hero();
    let since = 0;
    for (let level = 1; level <= 12; level++) {
      const picks = rollSkillChoices(state(weights, level * 7), h);
      since = picks.some((id) => id === 'fire' || id === 'water') ? 0 : since + 1;
      expect(since).toBeLessThan(4);
      // Le héros n'apprend rien : ses emplacements restent libres.
    }
  });

  it('IA : la compétence de faction d’abord, puis le poids d’archétype (montée × 1,5)', () => {
    const s = state({ a: 2, b: 3 });
    expect(aiSkillPick(s, hero(), ['a', 'fac'])).toBe('fac');
    expect(aiSkillPick(s, hero(), ['a', 'b'])).toBe('b');
    expect(aiSkillPick(s, hero({ skills: { a: 1 } }), ['a', 'b'])).toBe('a'); // montée : 2 × 1,5 = 3, égalité avec b ⇒ la première proposée
  });
});
