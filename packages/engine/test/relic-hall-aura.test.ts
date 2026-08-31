import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { learnGuildSpellsAtTown } from '../src/town/mage-guild';
import type { BuildingDef } from '../src/town/types';
import type { SpellDef } from '../src/hero/types';
import { testCatalog, testConfig, testMap } from './fixtures';
import { testTown } from './town-fixtures';

/**
 * Aura `heroAura.learnCircleBonus` (lot L8) — la Salle des Reliques des Chasseurs
 * en est le premier porteur, mais le moteur ne voit qu'un champ générique :
 * fixtures anonymes (aucun id de faction dans `packages/`, README §1).
 */

const HIGH_SPELL: SpellDef = {
  id: 'sort-cercle-4',
  school: 'test-school',
  circle: 4,
  manaCost: 10,
  kind: 'damage',
  base: 10,
  perPower: 1,
};

/** Bâtiment porteur de l'aura : +1 cercle apprenable au héros présent. */
function catalogWithHall(bonus: number): Record<string, BuildingDef> {
  return {
    reliquaire: {
      id: 'reliquaire',
      maxLevel: 1,
      levels: [{ cost: {}, requires: [], effect: { type: 'heroAura', learnCircleBonus: bonus } }],
    },
  };
}

function stateWith(hallBuilt: boolean, bonus = 1): GameState {
  const town = testTown({
    buildings: hallBuilt ? { reliquaire: 1 } : {},
    stock: {},
    spellPool: [HIGH_SPELL.id],
  });
  let state = apply(createEmptyState(), {
    type: 'StartGame',
    seed: 1,
    players: [{ id: 'p1', startingResources: emptyResources() }],
    map: { ...testMap(), objects: [] },
    config: testConfig(),
    unitCatalog: testCatalog(),
    buildingCatalog: catalogWithHall(bonus),
    spellCatalog: { [HIGH_SPELL.id]: HIGH_SPELL },
    towns: [town],
  }).state;
  // Le héros visite sa ville (l'aura est « option B » : il doit être présent).
  state = produce(state, (draft) => {
    const hero = draft.heroes[0];
    const t = draft.towns[0];
    if (!hero || !t) throw new Error('fixture incomplète');
    hero.pos = { ...t.pos };
    hero.skills = {}; // aucune Sagesse : cercle de base seul
  });
  return state;
}

function learn(state: GameState): string[] {
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    const hero = draft.heroes[0];
    const town = draft.towns[0];
    if (hero && town) learnGuildSpellsAtTown(draft, hero, town, events);
  });
  return next.heroes[0]?.spells ?? [];
}

describe('aura learnCircleBonus (Salle des Reliques)', () => {
  it('sans le bâtiment, un sort de cercle 4 reste hors de portée', () => {
    expect(learn(stateWith(false))).not.toContain(HIGH_SPELL.id);
  });

  it('avec l’aura, le héros présent apprend un cercle plus haut', () => {
    // Cercle de base 2 (+1 d'aura = 3) ne suffit pas ; +2 ouvre le cercle 4.
    expect(learn(stateWith(true, 1))).not.toContain(HIGH_SPELL.id);
    expect(learn(stateWith(true, 2))).toContain(HIGH_SPELL.id);
  });
});
