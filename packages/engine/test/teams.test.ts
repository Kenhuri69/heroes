import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { areAllies, createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { conditionMet } from '../src/scenario/outcome';
import { validateCaptureTown } from '../src/town';
import { testConfig, testMap } from './fixtures';

/**
 * Alliances / équipes (doc 02 §6, plan phase-newgame-teams). Trois joueurs :
 * `p1` et `p2` alliés (équipe 1), `p3` sans alliance (équipe 0). Le champ `team`
 * est porté par `PlayerSetup` → `PlayerState` via `StartGame`.
 */
function startedThree(teams: Record<string, number>): GameState {
  const players: PlayerSetup[] = ['p1', 'p2', 'p3'].map((id) => ({
    id,
    startingResources: emptyResources(),
    controller: id === 'p1' ? 'human' : 'ai',
    team: teams[id] ?? 0,
  }));
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: {},
    buildingCatalog: {},
    towns: [],
  };
  return apply(createEmptyState(), cmd).state;
}

const eliminate = (state: GameState, id: string): GameState => ({
  ...state,
  players: state.players.map((p) => (p.id === id ? { ...p, eliminated: true } : p)),
});

describe('areAllies', () => {
  it('même équipe non nulle = alliés ; équipe 0 = jamais allié', () => {
    const a = { id: 'a', team: 1 };
    const b = { id: 'b', team: 1 };
    const c = { id: 'c', team: 2 };
    const z1 = { id: 'z1', team: 0 };
    const z2 = { id: 'z2', team: 0 };
    expect(areAllies(a, b)).toBe(true);
    expect(areAllies(a, c)).toBe(false);
    expect(areAllies(z1, z2)).toBe(false); // équipe 0 : sans alliance
    expect(areAllies(a, a)).toBe(false); // pas allié de soi-même
  });
});

describe('eliminateAllEnemies avec équipes', () => {
  it('un allié vivant n’empêche pas la victoire (victoire partagée)', () => {
    const state = startedThree({ p1: 1, p2: 1, p3: 0 });
    // p3 (seul ennemi) encore vivant ⇒ pas encore gagné.
    expect(conditionMet(state, 'p1', { type: 'eliminateAllEnemies' })).toBe(false);
    // p3 éliminé : p1 gagne bien que son allié p2 soit toujours vivant.
    const noEnemy = eliminate(state, 'p3');
    expect(conditionMet(noEnemy, 'p1', { type: 'eliminateAllEnemies' })).toBe(true);
    // ... et l'allié p2 remplit la même condition au même instant (victoire partagée).
    expect(conditionMet(noEnemy, 'p2', { type: 'eliminateAllEnemies' })).toBe(true);
  });

  it('sans alliance (équipe 0 partout) : comportement chacun-pour-soi inchangé', () => {
    const state = startedThree({ p1: 0, p2: 0, p3: 0 });
    expect(conditionMet(state, 'p1', { type: 'eliminateAllEnemies' })).toBe(false);
    // p3 éliminé mais p2 encore là (non allié) ⇒ pas gagné.
    expect(conditionMet(eliminate(state, 'p3'), 'p1', { type: 'eliminateAllEnemies' })).toBe(false);
    // p2 ET p3 éliminés ⇒ gagné.
    expect(
      conditionMet(eliminate(eliminate(state, 'p3'), 'p2'), 'p1', { type: 'eliminateAllEnemies' }),
    ).toBe(true);
  });
});

describe('validateCaptureTown avec équipes', () => {
  function withTown(state: GameState, ownerPlayerId: string): GameState {
    return {
      ...state,
      currentPlayer: 0, // p1 actif
      towns: [
        {
          id: 'town-x',
          ownerPlayerId,
          pos: { x: 3, y: 3 },
          factionId: '',
          buildings: {},
          builtToday: false,
          garrison: [],
          stock: {},
          spellPool: [],
          sharedGrowthChoice: {},
        },
      ],
    };
  }

  it('refuse d’assiéger la ville d’un allié', () => {
    const state = withTown(startedThree({ p1: 1, p2: 1, p3: 0 }), 'p2');
    const err = validateCaptureTown(state, { type: 'CaptureTown', townId: 'town-x', playerId: 'p1' });
    expect(err?.code).toBe('invalidAction');
    expect(err?.message).toContain('allié');
  });

  it('n’oppose pas la garde d’alliance à la ville d’un ennemi (équipe différente)', () => {
    const state = withTown(startedThree({ p1: 1, p2: 1, p3: 0 }), 'p3');
    const err = validateCaptureTown(state, { type: 'CaptureTown', townId: 'town-x', playerId: 'p1' });
    // Peut échouer pour une autre raison (héros absent) mais JAMAIS pour alliance.
    expect(err?.message ?? '').not.toContain('allié');
  });
});
