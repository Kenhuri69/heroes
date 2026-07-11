import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { BuildingDef } from '../src/town/types';
import type { SpellDef } from '../src/hero/types';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * Lot F-BUILDEFF.3 — bâtiment enseignant (doc 03 §4 — Cloître) : l'effet
 * générique `grantSpell` ajoute un sort au `spellPool` de la ville à la
 * construction ; un héros du propriétaire présent l'apprend via la mécanique
 * d'apprentissage à la visite (`learnGuildSpellsAtTown`). Bâtiment GÉNÉRIQUE.
 */

function spellCatalog(): Record<string, SpellDef> {
  return {
    blessing: { id: 'blessing', school: 'fire', circle: 1, kind: 'buff', manaCost: 5, base: 0, perPower: 0, attackMod: 3 },
  };
}

/** Catalogue avec un Cloître générique enseignant `blessing`. */
function cloisterCatalog(): Record<string, BuildingDef> {
  return {
    ...testBuildingCatalog(),
    cloister: {
      id: 'cloister', maxLevel: 1,
      levels: [{ cost: { gold: 100 }, requires: [], effect: { type: 'grantSpell', spellId: 'blessing' } }],
    },
  };
}

function started(heroOnTown: boolean): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources(), gold: 1000 } }];
  const map = testMap();
  const town = testTown({
    pos: heroOnTown ? (map.startPositions[0] as { x: number; y: number }) : { x: 9, y: 9 },
  });
  const cmd: Command = {
    type: 'StartGame', seed: 42, players, map, config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(), buildingCatalog: cloisterCatalog(),
    spellCatalog: spellCatalog(), towns: [town],
  };
  return apply(createEmptyState(), cmd).state;
}

describe('F-BUILDEFF.3 — Cloître : enseigne un sort', () => {
  it('construire le bâtiment ajoute le sort au pool de la ville', () => {
    const next = apply(started(false), { type: 'BuildStructure', townId: 'town-1', buildingId: 'cloister' }).state;
    expect(next.towns[0]?.spellPool).toContain('blessing');
  });

  it('un héros du propriétaire présent apprend le sort à la construction', () => {
    const { state: next, events } = apply(started(true), {
      type: 'BuildStructure', townId: 'town-1', buildingId: 'cloister',
    });
    const hero = next.heroes[0];
    expect(hero?.spells).toContain('blessing');
    expect(events).toContainEqual({ type: 'SpellsLearned', heroId: hero?.id, spellIds: ['blessing'] });
  });

  it('un héros absent n’apprend pas encore (le sort reste dans le pool)', () => {
    const next = apply(started(false), { type: 'BuildStructure', townId: 'town-1', buildingId: 'cloister' }).state;
    expect(next.heroes[0]?.spells ?? []).not.toContain('blessing');
    expect(next.towns[0]?.spellPool).toContain('blessing');
  });
});
