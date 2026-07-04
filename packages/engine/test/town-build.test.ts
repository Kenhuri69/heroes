import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

function setup(resources: Partial<ReturnType<typeof emptyResources>> = {}): PlayerSetup[] {
  return [{ id: 'p1', startingResources: { ...emptyResources(), ...resources } }];
}

function startCmd(resources: Partial<ReturnType<typeof emptyResources>> = {}): Command {
  return {
    type: 'StartGame',
    seed: 1,
    players: setup(resources),
    map: testMap(),
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [testTown()],
  };
}

function startedGame(resources: Partial<ReturnType<typeof emptyResources>> = {}): GameState {
  return apply(createEmptyState(), startCmd(resources)).state;
}

describe('BuildStructure', () => {
  it('construit un bâtiment, débite le coût, incrémente le niveau et émet TownBuilt', () => {
    const state = startedGame({ gold: 2500 });
    const { state: next, events } = apply(state, {
      type: 'BuildStructure',
      townId: 'town-1',
      buildingId: 'townHall',
    });
    expect(next.towns[0]?.buildings.townHall).toBe(2);
    expect(next.towns[0]?.builtToday).toBe(true);
    expect(next.players[0]?.resources.gold).toBe(0);
    expect(events).toContainEqual({
      type: 'TownBuilt',
      townId: 'town-1',
      buildingId: 'townHall',
      level: 2,
    });
  });

  it('refuse une 2ᵉ construction le même jour (alreadyBuiltToday)', () => {
    const state = startedGame({ gold: 5000 });
    const first = apply(state, {
      type: 'BuildStructure',
      townId: 'town-1',
      buildingId: 'townHall',
    }).state;
    expect(
      validate(first, { type: 'BuildStructure', townId: 'town-1', buildingId: 'dwelling1' })?.code,
    ).toBe('alreadyBuiltToday');
  });

  it('réarme builtToday après un EndTurn (jour suivant)', () => {
    // Jour 1 : townHall niveau 1→2 (2500 or). Jour 2 : townHall niveau 2→3
    // (5000 or + 5 gemmes) redevient constructible une fois `builtToday` réarmé.
    const state = startedGame({ gold: 10000, gems: 10 });
    const afterBuild = apply(state, {
      type: 'BuildStructure',
      townId: 'town-1',
      buildingId: 'townHall',
    }).state;
    const afterDay = apply(afterBuild, { type: 'EndTurn', playerId: 'p1' }).state;
    expect(afterDay.towns[0]?.builtToday).toBe(false);
    expect(
      validate(afterDay, { type: 'BuildStructure', townId: 'town-1', buildingId: 'townHall' }),
    ).toBeNull();
  });

  it('rejette un prérequis manquant (requirementsNotMet)', () => {
    // fort niveau 2 requiert townHall niveau 2 — non satisfait tant que townHall reste niveau 1.
    const state = startedGame({ gold: 100000, ore: 100 });
    expect(
      validate(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'fort' })?.code,
    ).toBe('requirementsNotMet');
  });

  it('rejette un coût insuffisant (cannotAfford)', () => {
    const state = startedGame({ gold: 100 });
    expect(
      validate(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'townHall' })?.code,
    ).toBe('cannotAfford');
  });

  it('rejette au niveau maximum (buildingMaxLevel)', () => {
    const town = { ...testTown(), buildings: { townHall: 4, fort: 1, dwelling1: 1 } };
    const s2 = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players: setup({ gold: 999999, ore: 999, gems: 999, crystal: 999 }),
      map: testMap(),
      config: testConfig(),
      unitCatalog: testUnitCatalogWithEconomy(),
      buildingCatalog: testBuildingCatalog(),
      towns: [town],
    }).state;
    expect(
      validate(s2, { type: 'BuildStructure', townId: 'town-1', buildingId: 'townHall' })?.code,
    ).toBe('buildingMaxLevel');
  });

  it('rejette une ville inconnue et une ville qui n’appartient pas au joueur actif', () => {
    const state = startedGame();
    expect(
      validate(state, { type: 'BuildStructure', townId: 'unknown', buildingId: 'townHall' })?.code,
    ).toBe('unknownTown');
    const neutralTown = { ...testTown(), ownerPlayerId: null };
    const withNeutral = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players: setup(),
      map: testMap(),
      config: testConfig(),
      unitCatalog: testUnitCatalogWithEconomy(),
      buildingCatalog: testBuildingCatalog(),
      towns: [neutralTown],
    }).state;
    expect(
      validate(withNeutral, { type: 'BuildStructure', townId: 'town-1', buildingId: 'townHall' })
        ?.code,
    ).toBe('notYourTown');
  });

  it('rejette un bâtiment inconnu du catalogue', () => {
    const state = startedGame({ gold: 5000 });
    expect(
      validate(state, { type: 'BuildStructure', townId: 'town-1', buildingId: 'nope' })?.code,
    ).toBe('unknownBuilding');
  });
});
