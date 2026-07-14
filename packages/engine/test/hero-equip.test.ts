import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { testConfig } from './fixtures';

/**
 * Lot H-ARTEQUIP.1 — équiper/déséquiper des artefacts (doc 08 §2.3). Les 10
 * slots `artifacts` contribuent aux bonus, le `backpack` non. IDs génériques.
 */

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-1', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null), backpack: [],
    visitMorale: 0,
    pendingSkillChoices: [], pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [],
    name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '', ...over,
  };
}

function state(h: HeroState): GameState {
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    players: [{ ...createEmptyState().players[0]!, id: 'p1' }], currentPlayer: 0, heroes: [h],
  };
}

describe('H-ARTEQUIP.1 — équiper / déséquiper', () => {
  it('déséquipe un artefact vers le sac', () => {
    const arts = Array.from({ length: 10 }, () => null) as (string | null)[];
    arts[2] = 'sword';
    const { state: next } = apply(state(hero({ artifacts: arts })), {
      type: 'UnequipArtifact', heroId: 'hero-1', slot: 2,
    });
    const h = next.heroes[0]!;
    expect(h.artifacts[2]).toBeNull();
    expect(h.backpack).toEqual(['sword']);
  });

  it('équipe un artefact du sac vers le 1er slot libre', () => {
    const arts = Array.from({ length: 10 }, () => null) as (string | null)[];
    arts[0] = 'shield';
    const { state: next } = apply(state(hero({ artifacts: arts, backpack: ['ring', 'amulet'] })), {
      type: 'EquipArtifact', heroId: 'hero-1', index: 1,
    });
    const h = next.heroes[0]!;
    expect(h.artifacts[1]).toBe('amulet'); // slot 0 occupé ⇒ slot 1
    expect(h.backpack).toEqual(['ring']);
  });

  it('refuse d’équiper si les 10 slots sont pleins', () => {
    const full = Array.from({ length: 10 }, (_, i) => `a${i}`) as (string | null)[];
    expect(
      validate(state(hero({ artifacts: full, backpack: ['extra'] })), {
        type: 'EquipArtifact', heroId: 'hero-1', index: 0,
      })?.code,
    ).toBe('invalidEquip');
  });

  it('refuse de déséquiper un slot vide ou hors bornes', () => {
    const s = state(hero());
    expect(validate(s, { type: 'UnequipArtifact', heroId: 'hero-1', slot: 0 })?.code).toBe('invalidEquip');
    expect(validate(s, { type: 'UnequipArtifact', heroId: 'hero-1', slot: 10 })?.code).toBe('invalidEquip');
  });

  it('refuse d’équiper/déséquiper le héros d’un autre joueur', () => {
    const s = state(hero({ playerId: 'p2', backpack: ['x'] }));
    expect(validate(s, { type: 'EquipArtifact', heroId: 'hero-1', index: 0 })?.code).toBe('notYourHero');
  });
});
