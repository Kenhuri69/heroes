import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { BuildingDef } from '../src/town/types';
import type { HeroSkillDef, SpellDef } from '../src/hero/types';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * G2 — Guilde des mages : à la construction d'un niveau de guilde, `spellCount`
 * sorts du cercle correspondant sont tirés au RNG seedé dans `town.spellPool` ;
 * un héros du propriétaire posé sur la ville apprend ceux de cercle ≤ son cercle
 * apprenable (base 2, relevé par la compétence Sagesse, H2 — fidélité HoMM3).
 */

// Catalogue de sorts de test : 4 sorts en cercle 1, plus 1 sort en cercle 3 et
// 1 en cercle 4 (pour exercer le gate de Sagesse : cercle 3 gaté par le rang 1,
// cercle 4 par le rang 2).
function spellCatalog(): Record<string, SpellDef> {
  const dmg = (id: string, circle: number): SpellDef => ({
    id,
    school: 'fire',
    circle,
    kind: 'damage',
    manaCost: 5,
    base: 10,
    perPower: 1,
  });
  return {
    c1a: dmg('c1a', 1),
    c1b: dmg('c1b', 1),
    c1c: dmg('c1c', 1),
    c1d: dmg('c1d', 1),
    c3: dmg('c3', 3),
    c4: dmg('c4', 4),
  };
}

// Guilde niveau 1 enseignant 2 sorts de cercle 1, + des guildes niveau 3/4
// fictives (spellCount 1) pour tester le gate de Sagesse.
function guildCatalog(): Record<string, BuildingDef> {
  return {
    ...testBuildingCatalog(),
    guild1: {
      id: 'guild1',
      maxLevel: 1,
      levels: [{ cost: { gold: 100 }, requires: [], effect: { type: 'mageGuild', level: 1, spellCount: 2 } }],
    },
    guild3: {
      id: 'guild3',
      maxLevel: 1,
      levels: [{ cost: { gold: 100 }, requires: [], effect: { type: 'mageGuild', level: 3, spellCount: 1 } }],
    },
    guild4: {
      id: 'guild4',
      maxLevel: 1,
      levels: [{ cost: { gold: 100 }, requires: [], effect: { type: 'mageGuild', level: 4, spellCount: 1 } }],
    },
  };
}

// Compétence Sagesse de test — mirroir de `data/core/skills.json` : rang 1 → cercle
// 3, rang 2 → cercle 4, rang 3 → cercle 5 (base apprenable 2 sans Sagesse).
function wisdomCatalog(): Record<string, HeroSkillDef> {
  return { wisdom: { id: 'wisdom', ranks: [{ learnCircle: 3 }, { learnCircle: 4 }, { learnCircle: 5 }] } };
}

function started(overrides: {
  skills?: Record<string, number>;
  heroOnTown?: boolean;
}): GameState {
  const players: PlayerSetup[] = [
    {
      id: 'p1',
      startingResources: { ...emptyResources(), gold: 1000 },
      ...(overrides.skills ? { startingSkills: overrides.skills } : {}),
    },
  ];
  // Le héros démarre à startPositions[0] ; on place la ville sur cette tuile
  // quand on veut que le héros la « visite » d'emblée.
  const map = testMap();
  const town = testTown({
    pos: overrides.heroOnTown ? (map.startPositions[0] as { x: number; y: number }) : { x: 9, y: 9 },
  });
  const cmd: Command = {
    type: 'StartGame',
    seed: 42,
    players,
    map,
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: guildCatalog(),
    spellCatalog: spellCatalog(),
    skillCatalog: wisdomCatalog(),
    towns: [town],
  };
  return apply(createEmptyState(), cmd).state;
}

describe('Guilde des mages (G2)', () => {
  it('construire une guilde tire spellCount sorts du bon cercle dans le pool (RNG seedé)', () => {
    const state = started({ heroOnTown: false });
    const next = apply(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'guild1' }).state;
    const pool = next.towns[0]?.spellPool ?? [];
    expect(pool).toHaveLength(2);
    // Tous de cercle 1, distincts, issus du catalogue.
    expect(new Set(pool).size).toBe(2);
    for (const id of pool) expect(next.spellCatalog[id]?.circle).toBe(1);
  });

  it('déterminisme : même seed ⇒ même pool tiré', () => {
    const a = apply(started({ heroOnTown: false }), {
      type: 'BuildStructure',
      townId: 'town-1',
      buildingId: 'guild1',
    }).state;
    const b = apply(started({ heroOnTown: false }), {
      type: 'BuildStructure',
      townId: 'town-1',
      buildingId: 'guild1',
    }).state;
    expect(a.towns[0]?.spellPool).toEqual(b.towns[0]?.spellPool);
  });

  it('un héros posé sur sa ville apprend les sorts du pool à la construction', () => {
    const state = started({ heroOnTown: true });
    const { state: next, events } = apply(state, {
      type: 'BuildStructure',
      townId: 'town-1',
      buildingId: 'guild1',
    });
    const hero = next.heroes[0];
    const pool = next.towns[0]?.spellPool ?? [];
    for (const id of pool) expect(hero?.spells).toContain(id);
    expect(events).toContainEqual({ type: 'SpellsLearned', heroId: hero?.id, spellIds: pool });
  });

  it('sans Sagesse, un sort de cercle 3 reste dans le pool mais n’est PAS appris (base 2)', () => {
    const state = started({ heroOnTown: true });
    const next = apply(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'guild3' }).state;
    expect(next.towns[0]?.spellPool).toContain('c3');
    expect(next.heroes[0]?.spells ?? []).not.toContain('c3');
  });

  it('avec Sagesse (rang 1, learnCircle 3), le sort de cercle 3 est appris', () => {
    const state = started({ heroOnTown: true, skills: { wisdom: 1 } });
    const next = apply(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'guild3' }).state;
    expect(next.heroes[0]?.spells ?? []).toContain('c3');
  });

  it('sans Sagesse, un sort de cercle 4 reste dans le pool mais n’est PAS appris', () => {
    const state = started({ heroOnTown: true });
    const next = apply(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'guild4' }).state;
    expect(next.towns[0]?.spellPool).toContain('c4');
    expect(next.heroes[0]?.spells ?? []).not.toContain('c4');
  });

  it('Sagesse rang 1 (learnCircle 3) ne suffit PAS pour un sort de cercle 4', () => {
    const state = started({ heroOnTown: true, skills: { wisdom: 1 } });
    const next = apply(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'guild4' }).state;
    expect(next.heroes[0]?.spells ?? []).not.toContain('c4');
  });

  it('avec Sagesse avancée (rang 2, learnCircle 4), le sort de cercle 4 est appris', () => {
    const state = started({ heroOnTown: true, skills: { wisdom: 2 } });
    const next = apply(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'guild4' }).state;
    expect(next.heroes[0]?.spells ?? []).toContain('c4');
  });
});
