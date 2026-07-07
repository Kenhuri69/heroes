import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command } from '../src/core/commands';
import { createEmptyState, emptyResources } from '../src/core/state';
import { testConfig, testMap } from './fixtures';

/**
 * Report de héros entre chapitres de campagne (doc 13 §4.1, lot N3a) : les
 * champs optionnels de `PlayerSetup` (niveau/XP/compétences/artefacts) dotent le
 * héros créé par `StartGame`. Absents ⇒ héros neuf (comportement inchangé).
 */
describe('report de héros (campagne)', () => {
  const base = {
    type: 'StartGame' as const,
    seed: 1,
    map: testMap(),
    config: testConfig(),
    unitCatalog: {},
    buildingCatalog: {},
    towns: [],
  };

  it('dote le héros du niveau/XP/compétences/artefacts reportés', () => {
    const cmd: Command = {
      ...base,
      players: [
        {
          id: 'player-1',
          startingResources: emptyResources(),
          startingLevel: 5,
          startingXp: 4200,
          startingSkills: { logistics: 2 },
          startingArtifacts: ['trefle-chance', null, 'lame-aiguisee'],
        },
      ],
    };
    const hero = apply(createEmptyState(), cmd).state.heroes[0]!;
    expect(hero.level).toBe(5);
    expect(hero.xp).toBe(4200);
    expect(hero.skills).toEqual({ logistics: 2 });
    expect(hero.artifacts[0]).toBe('trefle-chance');
    expect(hero.artifacts[1]).toBeNull();
    expect(hero.artifacts[2]).toBe('lame-aiguisee');
  });

  it('sans report : héros neuf (niveau 1, sans compétence)', () => {
    const cmd: Command = {
      ...base,
      players: [{ id: 'player-1', startingResources: emptyResources() }],
    };
    const hero = apply(createEmptyState(), cmd).state.heroes[0]!;
    expect(hero.level).toBe(1);
    expect(hero.xp).toBe(0);
    expect(hero.skills).toEqual({});
  });
});
