import { produce } from 'immer';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { hashState } from '../src/core/serialize';
import { chooseAction } from '../src/combat/ai';
import { applyAction } from '../src/combat/actions';
import { COMBAT_COLS, COMBAT_ROWS } from '../src/combat/hex';
import type { ArmyStack } from '../src/combat/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Propriétés du combat (guidelines §4) : « un combat se termine toujours »
 * et déterminisme du replay (même seed + mêmes commandes ⇒ même hash).
 */

const CATALOG = testCatalog();
const UNIT_IDS = Object.keys(CATALOG);

const arbArmy = fc.array(
  fc.record({
    unitId: fc.constantFrom(...UNIT_IDS),
    count: fc.integer({ min: 1, max: 50 }),
  }),
  { minLength: 1, maxLength: 7 },
) as fc.Arbitrary<ArmyStack[]>;

const arbSeed = fc.integer({ min: 0, max: 2 ** 31 - 1 });

function startedGame(seed: number): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources() }];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: CATALOG,
  }).state;
}

describe('propriétés du combat', () => {
  it('un combat se termine toujours (< 500 rounds), invariants respectés à chaque étape', () => {
    fc.assert(
      fc.property(arbSeed, arbArmy, arbArmy, (seed, attacker, defender) => {
        const startCmd: Command = { type: 'StartCombat', attacker, defender, terrain: 'grass' };
        let state = apply(startedGame(seed), startCmd).state;
        let steps = 0;
        while (state.combat && !state.combat.finished) {
          steps++;
          if (steps > 5000) throw new Error('combat.test : trop d’itérations, boucle infinie suspectée');
          const combat = state.combat;
          expect(combat.round).toBeLessThan(500);
          const hexKeys = combat.stacks.map((s) => `${s.pos.col},${s.pos.row}`);
          expect(new Set(hexKeys).size).toBe(hexKeys.length);
          for (const s of combat.stacks) {
            expect(s.count).toBeGreaterThanOrEqual(0);
            expect(s.pos.col).toBeGreaterThanOrEqual(0);
            expect(s.pos.col).toBeLessThan(COMBAT_COLS);
            expect(s.pos.row).toBeGreaterThanOrEqual(0);
            expect(s.pos.row).toBeLessThan(COMBAT_ROWS);
          }
          const activeId = combat.activeStackId;
          if (!activeId) break;
          const action = chooseAction(state, activeId);
          state = produce(state, (draft) => {
            applyAction(draft, [], activeId, action);
          });
        }
        expect(state.combat).toBeNull();
      }),
      { numRuns: 50 },
    );
  });

  it('déterminisme : même seed + mêmes armées ⇒ même hashState après AutoCombat', () => {
    fc.assert(
      fc.property(arbSeed, arbArmy, arbArmy, (seed, attacker, defender) => {
        const run = (): GameState => {
          const startCmd: Command = { type: 'StartCombat', attacker, defender, terrain: 'grass' };
          let state = apply(startedGame(seed), startCmd).state;
          // StartCombat peut déjà avoir résolu tout le combat (l'IA du camp
          // non-joueur joue immédiatement) — AutoCombat n'a alors plus rien à faire.
          if (state.combat) state = apply(state, { type: 'AutoCombat' }).state;
          return state;
        };
        expect(hashState(run())).toBe(hashState(run()));
      }),
      { numRuns: 50 },
    );
  });
});
