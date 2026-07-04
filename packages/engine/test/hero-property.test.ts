import { produce } from 'immer';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { chooseAction } from '../src/combat/ai';
import { applyAction } from '../src/combat/actions';
import type { ArmyStack } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Propriété « le combat se termine toujours » (guidelines §4) EN PRÉSENCE de
 * sorts scriptés : un héros lié au camp joueur lance un sort de dégâts légal
 * (mana illimitée pour ne pas contraindre le tirage) chaque fois que c'est
 * son tour et qu'il n'a pas encore agi ce round, en plus de l'action normale
 * de la pile active (IA heuristique déterministe, comme `combat-property.test.ts`).
 */

const CATALOG = testCatalog();
const UNIT_IDS = Object.keys(CATALOG);
const SPELLS: Record<string, SpellDef> = {
  bolt: { id: 'bolt', school: 'fire', circle: 1, manaCost: 0, kind: 'damage', base: 5, perPower: 1 },
};

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
    spellCatalog: SPELLS,
  }).state;
}

/** Lie le héros de scénario (`hero-p1`) au camp attaquant, mana illimitée, sort 'bolt' connu. */
function linkHeroToCombat(state: GameState): GameState {
  if (!state.combat) return state;
  return {
    ...state,
    combat: { ...state.combat, attackerHeroId: 'hero-p1' },
    heroes: state.heroes.map((h) =>
      h.id === 'hero-p1' ? { ...h, mana: 9999, manaMax: 9999, spells: ['bolt'] } : h,
    ),
  };
}

describe('propriété héros : sorts scriptés + IA ⇒ le combat se termine toujours', () => {
  it('CastSpell légal à chaque round où c’est possible, jusqu’à la fin du combat (< 500 rounds)', () => {
    fc.assert(
      fc.property(arbSeed, arbArmy, arbArmy, (seed, attacker, defender) => {
        const startCmd: Command = { type: 'StartCombat', attacker, defender, terrain: 'grass' };
        let state = apply(startedGame(seed), startCmd).state;
        state = linkHeroToCombat(state);
        let steps = 0;
        while (state.combat && !state.combat.finished) {
          steps++;
          if (steps > 5000) throw new Error('hero-property : trop d’itérations, boucle infinie suspectée');
          const combat = state.combat;
          expect(combat.round).toBeLessThan(500);

          if (combat.activeStackId && !combat.heroCastThisRound) {
            const activeStack = combat.stacks.find((s) => s.id === combat.activeStackId);
            if (activeStack && activeStack.side === combat.playerSide) {
              const enemy = combat.stacks.find((s) => s.side !== combat.playerSide && s.count > 0);
              if (enemy) {
                try {
                  state = apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: enemy.id }).state;
                } catch {
                  // Cible/état devenu invalide entre la lecture et l'application (property test :
                  // seule la terminaison du combat est vérifiée, pas le succès systématique du sort).
                }
              }
            }
          }
          if (!state.combat || state.combat.finished) break;

          const activeId = state.combat.activeStackId;
          if (!activeId) break;
          const action = chooseAction(state, activeId);
          state = produce(state, (draft) => {
            applyAction(draft, [], activeId, action);
          });
        }
        expect(state.combat).toBeNull();
      }),
      { numRuns: 30 },
    );
  });
});
