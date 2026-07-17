import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { AdventureMapDef } from '../src/adventure/map';
import { testConfig, testCatalog } from './fixtures';

/**
 * Croissance hebdo des gardiens neutres (A2, sprint 2, doc 02 §2.2) : au passage
 * de semaine, chaque pile neutre grossit `×weeklyFactor` (plancher +1), plafonnée
 * à `maxCount`. **Opt-in par données** : bloc absent ⇒ gardiens figés (golden
 * inchangé). Arithmétique pure, aucun RNG.
 */
function startWithGuardian(
  count: number,
  growth?: { weeklyFactor: number; maxCount: number },
): GameState {
  const terrain = Array.from({ length: 9 }, () => 'grass');
  const map: AdventureMapDef = {
    id: 'growth-map',
    width: 3,
    height: 3,
    terrain,
    road: terrain.map(() => false),
    objects: [{ id: 'g1', type: 'guardian', pos: { x: 2, y: 2 }, unitId: 'red-grunt', count }],
    triggers: [],
    startPositions: [{ x: 0, y: 0 }],
  };
  const config = { ...testConfig(), ...(growth ? { guardianGrowth: growth } : {}) };
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 1,
    players: [{ id: 'p1', startingResources: emptyResources() }],
    map,
    config,
    unitCatalog: testCatalog(),
  }).state;
}

/** Un seul joueur ⇒ chaque `EndTurn` avance d'un jour ; 7 jours = un passage de semaine. */
function advanceDays(state: GameState, days: number): GameState {
  for (let i = 0; i < days; i++) state = apply(state, { type: 'EndTurn', playerId: 'p1' }).state;
  return state;
}

const guardCount = (s: GameState): number => {
  const g = s.map?.objects.find((o) => o.id === 'g1');
  return g && g.type === 'guardian' ? g.count : -1;
};

describe('croissance hebdo des gardiens (A2)', () => {
  it('config absente ⇒ le gardien reste figé (non-régression)', () => {
    const s = advanceDays(startWithGuardian(10), 14); // 2 semaines
    expect(guardCount(s)).toBe(10);
  });

  it('avec config : +weeklyFactor par semaine (floor)', () => {
    const g = { weeklyFactor: 1.1, maxCount: 300 };
    expect(guardCount(advanceDays(startWithGuardian(10, g), 7))).toBe(11); // floor(10×1.1)
    expect(guardCount(advanceDays(startWithGuardian(10, g), 14))).toBe(12); // 11 → floor(12.1)=12
  });

  it('plancher +1 : une petite pile progresse malgré l’arrondi', () => {
    // floor(1×1.1) = 1 (pas de gain) ⇒ plancher +1.
    expect(guardCount(advanceDays(startWithGuardian(1, { weeklyFactor: 1.1, maxCount: 300 }), 7))).toBe(2);
  });

  it('plafonné à maxCount (jamais au-delà)', () => {
    const s = advanceDays(startWithGuardian(295, { weeklyFactor: 1.1, maxCount: 300 }), 7);
    expect(guardCount(s)).toBe(300); // floor(295×1.1)=324 → cap 300
    // Une semaine de plus : reste au cap (count ≥ maxCount ⇒ ignoré).
    expect(guardCount(advanceDays(s, 7))).toBe(300);
  });
});
