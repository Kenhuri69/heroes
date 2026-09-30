import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { beginGuardianCombat, guardianStackCount } from '../src/combat/setup';
import { runAutoCombat } from '../src/combat/ai';
import type { AdventureMapDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * LE5 F1 — division des piles neutres : un gardien se scinde au combat selon le
 * rapport de force (table canon HoMM III), sans rien changer hors règle active.
 */

function game(guardianCount: number, heroCount: number, split: boolean): GameState {
  const base = testMap();
  const map: AdventureMapDef = {
    ...base,
    objects: [...base.objects, { id: 'g', type: 'guardian', pos: { x: 0, y: 5 }, unitId: 'red-grunt', count: guardianCount }],
  };
  const config = testConfig();
  if (split) config.combat.neutralSplit = { maxStacks: 5 };
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: heroCount }] },
  ];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 11,
    players,
    map,
    config,
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
}

function defenderCounts(state: GameState): number[] {
  return (state.combat?.stacks ?? []).filter((s) => s.side === 'defender').map((s) => s.count);
}

function engage(state: GameState): GameState {
  return produce(state, (draft) => {
    beginGuardianCombat(draft, 'hero-p1', 'g', []);
  });
}

describe('guardianStackCount (table canon)', () => {
  it('plus le héros est faible, plus le gardien se divise', () => {
    expect(guardianStackCount(0.3, 7, 100, 0)).toBe(7);
    expect(guardianStackCount(0.8, 7, 100, 0)).toBe(5);
    expect(guardianStackCount(1.2, 7, 100, 0)).toBe(4);
    expect(guardianStackCount(5, 7, 100, 0)).toBe(2);
  });

  it('borné par maxStacks, par l’effectif et à 1 minimum', () => {
    expect(guardianStackCount(0.3, 5, 100, 1)).toBe(5);
    expect(guardianStackCount(0.3, 7, 3, 0)).toBe(3);
    expect(guardianStackCount(5, 7, 100, -1)).toBe(1);
  });
});

describe('division au combat de gardien', () => {
  it('sans neutralSplit : une seule pile (comportement historique)', () => {
    expect(defenderCounts(engage(game(40, 10, false)))).toEqual([40]);
  });

  it('avec neutralSplit : plusieurs piles, effectif total conservé, réparti également', () => {
    const counts = defenderCounts(engage(game(40, 10, true)));
    expect(counts.length).toBeGreaterThan(1);
    expect(counts.length).toBeLessThanOrEqual(5);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(40);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('un héros faible affronte plus de piles qu’un héros dominant', () => {
    const weak = defenderCounts(engage(game(40, 8, true))).length; // rapport 0,2
    const strong = defenderCounts(engage(game(40, 400, true))).length; // rapport 10
    expect(weak).toBeGreaterThan(strong);
  });

  it('le gardien repoussé garde la somme de ses piles survivantes', () => {
    const events: GameEvent[] = [];
    const next = produce(game(60, 4, true), (draft) => {
      beginGuardianCombat(draft, 'hero-p1', 'g', events);
      runAutoCombat(draft, events);
    });
    expect(events.some((e) => e.type === 'CombatEnded' && e.winner === 'defender')).toBe(true);
    const guardian = next.map?.objects.find((o) => o.id === 'g');
    expect(guardian?.type === 'guardian' && guardian.count).toBeGreaterThan(0);
    expect(guardian?.type === 'guardian' && guardian.count).toBeLessThanOrEqual(60);
  });
});
