import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { validateCombatAction } from '../src/combat/actions';
import { seedRng } from '../src/core/rng';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/** Commandes illégales rejetées avec les bons codes (validateStartCombat / validateCombatAction). */

function startedGame(): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources() }];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
}

describe('validateStartCombat', () => {
  const state = startedGame();

  it('refuse une armée vide', () => {
    const cmd: Command = { type: 'StartCombat', attacker: [], defender: [{ unitId: 'blue-wolf', count: 1 }], terrain: 'grass' };
    expect(validate(state, cmd)?.code).toBe('invalidArmy');
  });

  it('refuse plus de 7 piles', () => {
    const attacker = Array.from({ length: 8 }, () => ({ unitId: 'red-grunt', count: 1 }));
    const cmd: Command = { type: 'StartCombat', attacker, defender: [{ unitId: 'blue-wolf', count: 1 }], terrain: 'grass' };
    expect(validate(state, cmd)?.code).toBe('invalidArmy');
  });

  it('refuse une unité inconnue du catalogue', () => {
    const cmd: Command = {
      type: 'StartCombat',
      attacker: [{ unitId: 'ghost', count: 1 }],
      defender: [{ unitId: 'blue-wolf', count: 1 }],
      terrain: 'grass',
    };
    expect(validate(state, cmd)?.code).toBe('invalidArmy');
  });

  it('refuse un effectif non positif', () => {
    const cmd: Command = {
      type: 'StartCombat',
      attacker: [{ unitId: 'red-grunt', count: 0 }],
      defender: [{ unitId: 'blue-wolf', count: 1 }],
      terrain: 'grass',
    };
    expect(validate(state, cmd)?.code).toBe('invalidArmy');
  });

  it('refuse un terrain inconnu de la config', () => {
    const cmd: Command = {
      type: 'StartCombat',
      attacker: [{ unitId: 'red-grunt', count: 1 }],
      defender: [{ unitId: 'blue-wolf', count: 1 }],
      terrain: 'lava',
    };
    expect(validate(state, cmd)?.code).toBe('invalidAction');
  });

  it('accepte une configuration valide', () => {
    const cmd: Command = {
      type: 'StartCombat',
      attacker: [{ unitId: 'red-grunt', count: 5 }],
      defender: [{ unitId: 'blue-wolf', count: 3 }],
      terrain: 'grass',
    };
    expect(validate(state, cmd)).toBeNull();
  });

  it('refuse un second StartCombat pendant un combat en cours', () => {
    const cmd: Command = {
      type: 'StartCombat',
      attacker: [{ unitId: 'red-grunt', count: 5 }],
      defender: [{ unitId: 'blue-wolf', count: 3 }],
      terrain: 'grass',
    };
    const inCombat = apply(state, cmd).state;
    expect(validate(inCombat, cmd)?.code).toBe('combatActive');
  });
});

/** Combat construit à la main pour isoler `validateCombatAction` de l'ordre de jeu réel. */
function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-group`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [1, 2], speed: 5 },
    abilities: [],
    ...over,
  };
}

function stack(partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>): CombatStack {
  return {
    firstHp: 10,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...partial,
  };
}

function manualState(stacks: CombatStack[], activeStackId: string | null): GameState {
  const catalog = {
    atk: unit({ id: 'atk' }),
    def: unit({ id: 'def' }),
  };
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    finished: false,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: false,
    winner: null,
  };
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat };
}

describe('validateCombatAction', () => {
  it('refuse une action hors combat', () => {
    expect(validateCombatAction(createEmptyState(), { action: { type: 'wait' } })?.code).toBe('noCombat');
  });

  it('refuse de commander la pile de l’adversaire (pas le tour du joueur)', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 } });
    const state = manualState([attacker, defender], 'defender-0');
    expect(validateCombatAction(state, { action: { type: 'wait' } })?.code).toBe('invalidAction');
  });

  it('refuse un déplacement hors de portée', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 11, row: 9 } });
    const state = manualState([attacker, defender], 'attacker-0');
    expect(validateCombatAction(state, { action: { type: 'move', to: { col: 11, row: 9 } } })?.code).toBe('invalidAction');
  });

  it('refuse d’attaquer une cible alliée', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const ally = stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'atk', count: 1, pos: { col: 1, row: 0 } });
    const state = manualState([attacker, ally], 'attacker-0');
    expect(validateCombatAction(state, { action: { type: 'attack', targetStackId: 'attacker-1' } })?.code).toBe('invalidAction');
  });

  it('refuse une cible non adjacente sans hex de départ', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 3, row: 0 } });
    const state = manualState([attacker, defender], 'attacker-0');
    expect(
      validateCombatAction(state, { action: { type: 'attack', targetStackId: 'defender-0' } })?.code,
    ).toBe('invalidAction');
  });

  it('refuse un `from` hors plateau même quand la cible est adjacente (anti-téléportation)', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 } });
    const state = manualState([attacker, defender], 'attacker-0');
    // Bug critique : cible adjacente + `from` forgé ⇒ le moteur DOIT rejeter,
    // sinon `applyAttack` téléporterait la pile n'importe où.
    expect(
      validateCombatAction(state, {
        action: { type: 'attack', targetStackId: 'defender-0', from: { col: 999, row: -4 } },
      })?.code,
    ).toBe('invalidAction');
  });

  it('refuse un `from` non adjacent à la cible', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 5, row: 0 } });
    const state = manualState([attacker, defender], 'attacker-0');
    expect(
      validateCombatAction(state, {
        action: { type: 'attack', targetStackId: 'defender-0', from: { col: 0, row: 0 } },
      })?.code,
    ).toBe('invalidAction');
  });

  it('accepte une attaque adjacente sans `from`, et avec `from` = case actuelle', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 } });
    const state = manualState([attacker, defender], 'attacker-0');
    expect(validateCombatAction(state, { action: { type: 'attack', targetStackId: 'defender-0' } })).toBeNull();
    expect(
      validateCombatAction(state, {
        action: { type: 'attack', targetStackId: 'defender-0', from: { col: 0, row: 0 } },
      }),
    ).toBeNull();
  });

  it('refuse d’attendre deux fois dans le même round', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, waited: true });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 } });
    const state = manualState([attacker, defender], 'attacker-0');
    expect(validateCombatAction(state, { action: { type: 'wait' } })?.code).toBe('invalidAction');
  });

  it('accepte défendre systématiquement', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 } });
    const state = manualState([attacker, defender], 'attacker-0');
    expect(validateCombatAction(state, { action: { type: 'defend' } })).toBeNull();
  });
});
