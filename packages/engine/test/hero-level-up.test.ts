import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { grantXp } from '../src/adventure/experience';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { GameEvent } from '../src/core/events';
import type { HeroProgressionConfig } from '../src/adventure/config';
import type { HeroSkillDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * Choix de compétence à la montée de niveau (doc 02 §1.2, décision plan
 * phase-3.2 #6) : 2 propositions au RNG de l'état lors de `grantXp`,
 * appliquées via `ChooseSkill` (`hero/index.ts` + `hero/level-up.ts`).
 */

/** Courbe linéaire (base=10, exponent=1) : seuils lisibles pour les tests de montée. */
function simpleProgression(): HeroProgressionConfig {
  return {
    xpPerHpKilled: 1,
    levelCurve: { base: 10, exponent: 1 },
    maxLevel: 30,
    attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 },
  };
}

function baseHero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-1',
    playerId: 'p1',
    pos: { x: 0, y: 0 },
    movementPoints: 0,
    army: [],
    xp: 0,
    level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0,
    manaMax: 0,
    skills: {},
    spells: [],
    artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [],
    factionId: '',
    ...over,
  };
}

/** Catalogue de 7 compétences (>6) pour exercer la limite « 6 compétences connues ». */
function sevenSkills(): Record<string, HeroSkillDef> {
  const cat: Record<string, HeroSkillDef> = {};
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    cat[id] = { id, ranks: [{}, {}, {}] };
  }
  return cat;
}

function stateWithHero(hero: HeroState, skillCatalog: Record<string, HeroSkillDef>, seed = 1): GameState {
  const state = createEmptyState();
  state.config = { ...testConfig(), hero: simpleProgression() };
  state.rng = seedRng(seed);
  state.heroes = [hero];
  state.skillCatalog = skillCatalog;
  return state;
}

describe('grantXp → propositions de compétence (pendingSkillChoices)', () => {
  it('une montée de niveau tire 2 propositions parmi les compétences éligibles', () => {
    const catalog = sevenSkills();
    const state = stateWithHero(baseHero({ xp: 15 }), catalog);
    const events: GameEvent[] = [];
    grantXp(state, events, 'hero-1', 10); // xp 15→25, franchit le niveau 2 (seuil 20)
    const hero = state.heroes[0];
    expect(hero?.level).toBe(2);
    expect(hero?.pendingSkillChoices).toHaveLength(2);
    for (const id of hero!.pendingSkillChoices) expect(Object.keys(catalog)).toContain(id);
    // propositions distinctes
    expect(new Set(hero!.pendingSkillChoices).size).toBe(2);
  });

  it('déterminisme : même état ⇒ mêmes propositions', () => {
    const catalog = sevenSkills();
    const run = () => {
      const state = stateWithHero(baseHero({ xp: 15 }), catalog, 42);
      grantXp(state, [], 'hero-1', 10);
      return state.heroes[0]?.pendingSkillChoices;
    };
    expect(run()).toEqual(run());
  });

  it('6 compétences déjà connues ⇒ propositions limitées aux montées de rang (jamais une 7ᵉ)', () => {
    const catalog = sevenSkills();
    const hero = baseHero({ xp: 15, skills: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } });
    const state = stateWithHero(hero, catalog);
    grantXp(state, [], 'hero-1', 10);
    const choices = state.heroes[0]!.pendingSkillChoices;
    expect(choices).toHaveLength(2);
    for (const id of choices) expect(['a', 'b', 'c', 'd', 'e', 'f']).toContain(id); // jamais 'g'
  });

  it('compétences déjà toutes au rang 3 (et 6 connues) ⇒ aucune proposition possible', () => {
    const catalog = sevenSkills();
    const hero = baseHero({ xp: 15, skills: { a: 3, b: 3, c: 3, d: 3, e: 3, f: 3 } });
    const state = stateWithHero(hero, catalog);
    grantXp(state, [], 'hero-1', 10);
    expect(state.heroes[0]!.pendingSkillChoices).toEqual([]);
  });

  it('remplace les propositions précédentes (montée multiple en chaîne)', () => {
    const catalog = sevenSkills();
    const hero = baseHero({ xp: 0 });
    const state = stateWithHero(hero, catalog);
    grantXp(state, [], 'hero-1', 55); // franchit plusieurs niveaux (seuils 10/20/30/40/50)
    // toujours exactement 2 propositions en attente (celles du DERNIER niveau franchi, pas d'accumulation).
    expect(state.heroes[0]!.pendingSkillChoices).toHaveLength(2);
  });
});

describe('ChooseSkill', () => {
  const catalog = sevenSkills();

  function startedState(hero: HeroState): GameState {
    const state = createEmptyState();
    state.started = true;
    state.skillCatalog = catalog;
    state.heroes = [hero];
    return state;
  }

  it('applique le choix (rang 1 pour une nouvelle compétence), vide les propositions, émet SkillLearned', () => {
    const state = startedState(baseHero({ pendingSkillChoices: ['a', 'b'] }));
    const result = apply(state, { type: 'ChooseSkill', heroId: 'hero-1', skillId: 'a' });
    const hero = result.state.heroes.find((h) => h.id === 'hero-1');
    expect(hero?.skills.a).toBe(1);
    expect(hero?.pendingSkillChoices).toEqual([]);
    expect(result.events).toEqual([{ type: 'SkillLearned', heroId: 'hero-1', skillId: 'a', rank: 1 }]);
  });

  it('monte le rang d’une compétence déjà connue', () => {
    const state = startedState(baseHero({ skills: { a: 1 }, pendingSkillChoices: ['a'] }));
    const result = apply(state, { type: 'ChooseSkill', heroId: 'hero-1', skillId: 'a' });
    expect(result.state.heroes.find((h) => h.id === 'hero-1')?.skills.a).toBe(2);
  });

  it('plafonne au rang 3', () => {
    const state = startedState(baseHero({ skills: { a: 3 }, pendingSkillChoices: ['a'] }));
    const result = apply(state, { type: 'ChooseSkill', heroId: 'hero-1', skillId: 'a' });
    expect(result.state.heroes.find((h) => h.id === 'hero-1')?.skills.a).toBe(3);
  });

  it('noPendingChoice : aucune proposition en attente', () => {
    const state = startedState(baseHero({ pendingSkillChoices: [] }));
    expect(() => apply(state, { type: 'ChooseSkill', heroId: 'hero-1', skillId: 'a' })).toThrowError(
      /noPendingChoice/,
    );
  });

  it('unknownSkill : id hors des propositions en attente', () => {
    const state = startedState(baseHero({ pendingSkillChoices: ['a'] }));
    expect(() => apply(state, { type: 'ChooseSkill', heroId: 'hero-1', skillId: 'z' })).toThrowError(
      /unknownSkill/,
    );
  });

  it('unknownHero', () => {
    const state = startedState(baseHero({ pendingSkillChoices: ['a'] }));
    expect(() => apply(state, { type: 'ChooseSkill', heroId: 'ghost', skillId: 'a' })).toThrowError(
      /unknownHero/,
    );
  });
});
