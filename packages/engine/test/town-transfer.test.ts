import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { ArmyStack } from '../src/combat/types';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * Ville posée sur la position de départ du héros (0,0 dans `testMap()`) pour
 * simplifier le transfert ; l'armée de départ du héros passe par
 * `startingArmy` (jamais de mutation post-`apply` — l'état retourné est figé
 * par Immer).
 */
function startedGame(
  townOverrides: Partial<ReturnType<typeof testTown>> = {},
  startingArmy: ArmyStack[] = [],
): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [{ ...testTown(), pos: { x: 0, y: 0 }, ...townOverrides }],
  };
  return apply(createEmptyState(), cmd).state;
}

describe('GarrisonTransfer', () => {
  it('transfère une pile de la garnison vers le héros présent sur la ville', () => {
    const state = startedGame({ garrison: [{ unitId: 'red-grunt', count: 5 }] });
    const next = apply(state, {
      type: 'GarrisonTransfer',
      townId: 'town-1',
      heroId: 'hero-p1',
      from: 'town',
      slot: 0,
    }).state;
    expect(next.towns[0]?.garrison).toEqual([]);
    expect(next.heroes[0]?.army).toEqual([{ unitId: 'red-grunt', count: 5 }]);
  });

  it('transfère du héros vers la garnison et fusionne avec une pile existante', () => {
    const state = startedGame({ garrison: [{ unitId: 'red-grunt', count: 2 }] }, [
      { unitId: 'red-grunt', count: 3 },
    ]);
    const next = apply(state, {
      type: 'GarrisonTransfer',
      townId: 'town-1',
      heroId: 'hero-p1',
      from: 'hero',
      slot: 0,
    }).state;
    expect(next.towns[0]?.garrison).toEqual([{ unitId: 'red-grunt', count: 5 }]);
    expect(next.heroes[0]?.army).toEqual([]);
  });

  it('rejette un héros absent de la ville (invalidTransfer)', () => {
    // Ville à (5,5), héros démarre à (0,0) : pas sur la tuile.
    const state = startedGame({ pos: { x: 5, y: 5 }, garrison: [{ unitId: 'red-grunt', count: 1 }] });
    expect(
      validate(state, {
        type: 'GarrisonTransfer',
        townId: 'town-1',
        heroId: 'hero-p1',
        from: 'town',
        slot: 0,
      })?.code,
    ).toBe('invalidTransfer');
  });

  it('rejette un slot hors borne (invalidTransfer)', () => {
    const state = startedGame({ garrison: [{ unitId: 'red-grunt', count: 1 }] });
    expect(
      validate(state, {
        type: 'GarrisonTransfer',
        townId: 'town-1',
        heroId: 'hero-p1',
        from: 'town',
        slot: 3,
      })?.code,
    ).toBe('invalidTransfer');
  });

  it('rejette une destination pleine (7 piles distinctes)', () => {
    const fullGarrison = Array.from({ length: 7 }, (_, i) => ({
      unitId: `filler-${i}`,
      count: 1,
    }));
    const state = startedGame({ garrison: fullGarrison }, [{ unitId: 'red-grunt', count: 1 }]);
    expect(
      validate(state, {
        type: 'GarrisonTransfer',
        townId: 'town-1',
        heroId: 'hero-p1',
        from: 'hero',
        slot: 0,
      })?.code,
    ).toBe('invalidTransfer');
  });
});

describe('Revue 2026-07 — B10 : GarrisonTransfer ancré sur le joueur actif', () => {
  it('rejette un transfert dans une ville qui n’appartient pas au joueur actif (notYourTown)', () => {
    // La ville (et son héros) appartiennent à p2 ; le joueur ACTIF est p1.
    const state = startedGame({ garrison: [{ unitId: 'red-grunt', count: 5 }] });
    const rigged = produce(state, (d) => {
      d.players.push({ ...d.players[0]!, id: 'p2' });
      d.towns[0]!.ownerPlayerId = 'p2';
      d.heroes[0]!.playerId = 'p2';
      // currentPlayer reste 0 (p1) : p2 n'a pas la main.
    });
    expect(
      validate(rigged, { type: 'GarrisonTransfer', townId: 'town-1', heroId: 'hero-p1', from: 'town', slot: 0 })?.code,
    ).toBe('notYourTown');
  });
});
