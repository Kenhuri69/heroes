import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events';
import { applyMonthSpawn } from '../src/adventure/calendar';
import type { CalendarMonthEventDef } from '../src/adventure/config';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * « Mois des créatures » (lot L8, doc 02 §2.3) : point d'extension générique
 * `CalendarMonthEventDef.spawnCreatures`. L'unité est tirée par le MOTEUR parmi
 * les recrutables — aucune donnée de paquet nommée ici (README §1).
 */

const CREATURE_MONTH: CalendarMonthEventDef = {
  id: 'creature-month-test',
  weight: 1,
  growthFactor: 1,
  spawnCreatures: { stacks: 3, size: 12 },
};

function baseState(): GameState {
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 7,
    players: [{ id: 'p1', startingResources: emptyResources() }],
    map: { ...testMap(), objects: [] },
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
  }).state;
}

function spawn(state: GameState, event: CalendarMonthEventDef): { next: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => applyMonthSpawn(draft, event, events));
  return { next, events };
}

describe('mois des créatures', () => {
  it('pose des piles neutres sur des tuiles libres et franchissables', () => {
    const { next, events } = spawn(baseState(), CREATURE_MONTH);
    const guardians = next.map?.objects.filter((o) => o.type === 'guardian') ?? [];

    expect(guardians).toHaveLength(3);
    for (const g of guardians) {
      expect(g.type === 'guardian' && g.count).toBe(12);
      // Jamais sur une tuile de héros (les seules occupées de la fixture).
      expect(next.heroes.some((h) => h.pos.x === g.pos.x && h.pos.y === g.pos.y)).toBe(false);
      // Ni sur une tuile infranchissable (eau/montagne de la carte de fixture).
      const terrain = next.map?.terrain[g.pos.y * (next.map?.width ?? 0) + g.pos.x];
      expect(terrain === 'water' || terrain === 'mountain').toBe(false);
    }
    expect(events).toContainEqual(expect.objectContaining({ type: 'CalendarCreaturesSpawned', stacks: 3, size: 12 }));
  });

  it('est déterministe : même état, mêmes positions', () => {
    const a = spawn(baseState(), CREATURE_MONTH).next.map?.objects.map((o) => o.pos);
    const b = spawn(baseState(), CREATURE_MONTH).next.map?.objects.map((o) => o.pos);
    expect(a).toEqual(b);
  });

  it('no-op sans `spawnCreatures` : ni objet, ni RNG consommé', () => {
    const before = baseState();
    const { next, events } = spawn(before, { id: 'ordinary', weight: 1, growthFactor: 1 });
    expect(next.map?.objects).toEqual([]);
    expect(next.rng).toEqual(before.rng);
    expect(events).toEqual([]);
  });
});
