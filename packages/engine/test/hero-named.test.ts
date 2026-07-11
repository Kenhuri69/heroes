import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, type GameState } from '../src/core/state';
import type { ResolvedHeroDef } from '../src/hero/types';
import { testConfig, testMap } from './fixtures';

/**
 * Lot H-NAMED.1 — roster de héros nommés. Un `PlayerSetup.startingHeroId` résout
 * l'identité (nom/attributs/spécialité/compétences/sorts de départ) depuis
 * `StartGame.heroRoster` à la création. Roster/héros GÉNÉRIQUES (aucun nom réel) ;
 * les champs explicites du PlayerSetup (report de campagne) priment.
 */

const ROSTER: Record<string, ResolvedHeroDef> = {
  'named-a': {
    name: '@loc:hero.named-a.name',
    attributes: { attack: 2, defense: 2, power: 1, knowledge: 1 },
    specialtyId: 'meneur',
    specialtyEffects: [{ moraleBonus: 1 }],
    startingSkills: { leadership: 1 },
    startingSpells: ['spell-x'],
  },
};

function start(player: Partial<PlayerSetup>): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: {} as PlayerSetup['startingResources'], ...player }];
  const cmd: Command = {
    type: 'StartGame', seed: 1, players, map: testMap(), config: testConfig(),
    unitCatalog: {}, heroRoster: ROSTER,
  };
  return apply(createEmptyState(), cmd).state;
}

describe('H-NAMED.1 — résolution du héros nommé', () => {
  it('startingHeroId applique nom/attributs/spécialité/compétences/sorts du roster', () => {
    const hero = start({ startingHeroId: 'named-a' }).heroes[0];
    expect(hero?.name).toBe('@loc:hero.named-a.name');
    expect(hero?.attributes).toEqual({ attack: 2, defense: 2, power: 1, knowledge: 1 });
    expect(hero?.specialtyId).toBe('meneur');
    expect(hero?.specialtyEffects).toEqual([{ moraleBonus: 1 }]);
    expect(hero?.skills).toEqual({ leadership: 1 });
    expect(hero?.spells).toEqual(['spell-x']);
  });

  it('sans startingHeroId : héros générique (identité vide)', () => {
    const hero = start({}).heroes[0];
    expect(hero?.name).toBe('');
    expect(hero?.attributes).toEqual({ attack: 0, defense: 0, power: 0, knowledge: 0 });
    expect(hero?.specialtyId).toBe('');
    expect(hero?.skills).toEqual({});
  });

  it('les champs explicites du PlayerSetup priment le roster (report de campagne)', () => {
    const hero = start({
      startingHeroId: 'named-a',
      startingName: 'override',
      startingAttributes: { attack: 9, defense: 9, power: 9, knowledge: 9 },
      startingSkills: { logistics: 3 },
    }).heroes[0];
    expect(hero?.name).toBe('override');
    expect(hero?.attributes).toEqual({ attack: 9, defense: 9, power: 9, knowledge: 9 });
    expect(hero?.skills).toEqual({ logistics: 3 });
    // La spécialité non surchargée reste celle du roster.
    expect(hero?.specialtyId).toBe('meneur');
  });
});
