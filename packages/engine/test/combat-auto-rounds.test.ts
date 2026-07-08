import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { hashState } from '../src/core/serialize';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Lot M4 (doc 08 §2.4 « reprendre la main à tout round ») : `AutoCombat`
 * borné à N rounds — le levier moteur de la bascule auto round par round.
 * Même IA que la résolution complète ⇒ itérer `rounds: 1` jusqu'au bout doit
 * produire EXACTEMENT le même état final (déterminisme).
 */

function startedCombat(seed: number): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources() }];
  const started = apply(createEmptyState(), {
    type: 'StartGame',
    seed,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testCatalog(),
  }).state;
  // Armées asymétriques : le combat dure plusieurs rounds (pas de one-shot).
  return apply(started, {
    type: 'StartCombat',
    attacker: [
      { unitId: 'red-grunt', count: 12 },
      { unitId: 'red-archer', count: 6 },
    ],
    defender: [
      { unitId: 'blue-wolf', count: 10 },
      { unitId: 'red-grunt', count: 8 },
    ],
    terrain: 'grass',
  }).state;
}

describe('AutoCombat { rounds }', () => {
  it('rounds: 1 avance d’exactement un round et rend la main au joueur', () => {
    const state = startedCombat(7);
    expect(state.combat?.round).toBe(1);
    const after = apply(state, { type: 'AutoCombat', rounds: 1 }).state;
    if (after.combat) {
      expect(after.combat.round).toBe(2);
      const active = after.combat.stacks.find((s) => s.id === after.combat?.activeStackId);
      expect(active?.side).toBe(after.combat.playerSide);
    } else {
      // Le combat peut légitimement se terminer pendant le round demandé.
      expect(after.combat).toBeNull();
    }
  });

  it('itérer rounds: 1 jusqu’à la fin ≡ résolution complète (même hashState)', () => {
    const full = apply(startedCombat(11), { type: 'AutoCombat' }).state;
    let step = startedCombat(11);
    for (let i = 0; i < 200 && step.combat; i++) {
      step = apply(step, { type: 'AutoCombat', rounds: 1 }).state;
    }
    expect(step.combat).toBeNull();
    expect(hashState(step)).toBe(hashState(full));
  });

  it('rejette un bornage invalide (0, négatif, non entier)', () => {
    const state = startedCombat(3);
    for (const rounds of [0, -1, 1.5]) {
      expect(() => apply(state, { type: 'AutoCombat', rounds })).toThrowError(/invalidRounds|rounds/);
    }
  });

  it('sans `rounds`, la commande résout tout le combat (comportement historique)', () => {
    const after = apply(startedCombat(5), { type: 'AutoCombat' }).state;
    expect(after.combat).toBeNull();
  });
});
