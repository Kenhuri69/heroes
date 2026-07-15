import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { ArtifactDef } from '../src/hero/types';
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

/** H-ARTEQUIP typed slots — le moteur fait respecter `artifact.slot` à l'équipement. */
const CAT: Record<string, ArtifactDef> = {
  helm1: { id: 'helm1', bonus: { defense: 1 }, slot: 'head' },
  helm2: { id: 'helm2', bonus: { defense: 2 }, slot: 'head' },
  ring1: { id: 'ring1', bonus: { luck: 1 }, slot: 'ring' },
  misc1: { id: 'misc1', bonus: { power: 1 }, slot: 'misc' },
  misc2: { id: 'misc2', bonus: { vision: 1 }, slot: 'misc' },
  legacy: { id: 'legacy', bonus: { attack: 1 } }, // sans slot (non contraint)
};

function stateC(h: HeroState): GameState {
  return { ...state(h), artifactCatalog: CAT };
}

/** Héros portant `equipped` (au 1er slot) avec `bag` au sac. */
function heroWith(equipped: string, bag: string[]): HeroState {
  const arts = Array.from({ length: 10 }, () => null) as (string | null)[];
  arts[0] = equipped;
  return hero({ artifacts: arts, backpack: bag });
}

describe('H-ARTEQUIP typed slots — EquipArtifact respecte artifact.slot', () => {
  it('refuse un 2ᵉ artefact du même emplacement exclusif', () => {
    expect(
      validate(stateC(heroWith('helm1', ['helm2'])), { type: 'EquipArtifact', heroId: 'hero-1', index: 0 })?.code,
    ).toBe('slotOccupied');
  });

  it('accepte un artefact d’un emplacement différent', () => {
    const { state: next } = apply(stateC(heroWith('helm1', ['ring1'])), {
      type: 'EquipArtifact', heroId: 'hero-1', index: 0,
    });
    expect(next.heroes[0]?.artifacts).toContain('ring1');
    expect(next.heroes[0]?.backpack).toEqual([]);
  });

  it('accepte plusieurs artefacts « misc » (fourre-tout non contraint)', () => {
    const { state: next } = apply(stateC(heroWith('misc1', ['misc2'])), {
      type: 'EquipArtifact', heroId: 'hero-1', index: 0,
    });
    expect(next.heroes[0]?.artifacts).toContain('misc2');
  });

  it('accepte un artefact sans slot (legacy, non contraint)', () => {
    const { state: next } = apply(stateC(heroWith('helm1', ['legacy'])), {
      type: 'EquipArtifact', heroId: 'hero-1', index: 0,
    });
    expect(next.heroes[0]?.artifacts).toContain('legacy');
  });
});
