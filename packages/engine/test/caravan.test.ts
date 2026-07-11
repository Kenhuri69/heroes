import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * T-CARAVAN (doc 02 §4.1) — caravanes inter-villes : une pile de garnison voyage
 * d'une ville possédée à une autre en un nombre de jours dérivé de l'A*, puis se
 * dépose dans la garnison de destination. Non interceptable.
 */
function startedGame(): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: { ...emptyResources() } },
    { id: 'p2', startingResources: { ...emptyResources() } },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [
      testTown({ id: 'town-a', pos: { x: 1, y: 1 }, garrison: [{ unitId: 'red-grunt', count: 5 }] }),
      testTown({ id: 'town-b', pos: { x: 8, y: 8 }, garrison: [] }),
      testTown({ id: 'town-c', ownerPlayerId: 'p2', pos: { x: 9, y: 0 }, garrison: [] }),
    ],
  };
  return apply(createEmptyState(), cmd).state;
}

/** Fait passer un jour entier (EndTurn de chaque joueur) et renvoie les events du jour. */
function passDay(state: GameState): { state: GameState; events: ReturnType<typeof apply>['events'] } {
  const r1 = apply(state, { type: 'EndTurn', playerId: 'p1' });
  const r2 = apply(r1.state, { type: 'EndTurn', playerId: 'p2' });
  return { state: r2.state, events: [...r1.events, ...r2.events] };
}

describe('T-CARAVAN — caravanes inter-villes', () => {
  it('expédie une pile : retirée de la garnison de départ, caravane créée', () => {
    const { events, state } = apply(startedGame(), {
      type: 'SendCaravan',
      fromTownId: 'town-a',
      toTownId: 'town-b',
      slot: 0,
    });
    expect(state.towns.find((t) => t.id === 'town-a')?.garrison).toEqual([]);
    expect(state.caravans).toHaveLength(1);
    const caravan = state.caravans[0]!;
    expect(caravan.toTownId).toBe('town-b');
    expect(caravan.playerId).toBe('p1');
    expect(caravan.army).toEqual([{ unitId: 'red-grunt', count: 5 }]);
    expect(caravan.daysLeft).toBeGreaterThanOrEqual(1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'CaravanSent', fromTownId: 'town-a', toTownId: 'town-b' }),
    );
  });

  it('arrive en garnison de destination après le trajet', () => {
    let s = apply(startedGame(), {
      type: 'SendCaravan',
      fromTownId: 'town-a',
      toTownId: 'town-b',
      slot: 0,
    }).state;
    const days = s.caravans[0]!.daysLeft;
    let arrived: unknown = null;
    for (let d = 0; d < days + 1 && s.caravans.length > 0; d++) {
      const r = passDay(s);
      s = r.state;
      const ev = r.events.find((e) => e.type === 'CaravanArrived');
      if (ev) arrived = ev;
    }
    expect(s.caravans).toHaveLength(0);
    expect(s.towns.find((t) => t.id === 'town-b')?.garrison).toEqual([
      { unitId: 'red-grunt', count: 5 },
    ]);
    expect(arrived).toMatchObject({ type: 'CaravanArrived', toTownId: 'town-b', unitId: 'red-grunt', count: 5 });
  });

  it('fusionne avec une pile existante de même unité à l’arrivée', () => {
    // town-b a déjà une pile red-grunt : la caravane la renforce (pas de 2e pile).
    let s = startedGame();
    s = { ...s, towns: s.towns.map((t) => (t.id === 'town-b' ? { ...t, garrison: [{ unitId: 'red-grunt', count: 3 }] } : t)) };
    s = apply(s, { type: 'SendCaravan', fromTownId: 'town-a', toTownId: 'town-b', slot: 0 }).state;
    for (let d = 0; d < 10 && s.caravans.length > 0; d++) s = passDay(s).state;
    expect(s.towns.find((t) => t.id === 'town-b')?.garrison).toEqual([{ unitId: 'red-grunt', count: 8 }]);
  });

  it('se disperse si la ville de destination a changé de main (CaravanLost)', () => {
    let s = apply(startedGame(), {
      type: 'SendCaravan',
      fromTownId: 'town-a',
      toTownId: 'town-b',
      slot: 0,
    }).state;
    // La destination passe à l'ennemi avant l'arrivée.
    s = { ...s, towns: s.towns.map((t) => (t.id === 'town-b' ? { ...t, ownerPlayerId: 'p2' } : t)) };
    let lost = false;
    for (let d = 0; d < 10 && s.caravans.length > 0; d++) {
      const r = passDay(s);
      s = r.state;
      if (r.events.some((e) => e.type === 'CaravanLost')) lost = true;
    }
    expect(lost).toBe(true);
    expect(s.caravans).toHaveLength(0);
    // Aucune unité déposée chez l'ennemi.
    expect(s.towns.find((t) => t.id === 'town-b')?.garrison).toEqual([]);
  });

  it('refuse : même ville, ville adverse, case vide', () => {
    const s = startedGame();
    // Même ville de départ et d'arrivée.
    expect(() => apply(s, { type: 'SendCaravan', fromTownId: 'town-a', toTownId: 'town-a', slot: 0 })).toThrow();
    // Destination possédée par l'adversaire (town-c est à p2).
    expect(() => apply(s, { type: 'SendCaravan', fromTownId: 'town-a', toTownId: 'town-c', slot: 0 })).toThrow();
    // Case de garnison vide (town-b n'a pas de pile au slot 0).
    expect(() => apply(s, { type: 'SendCaravan', fromTownId: 'town-b', toTownId: 'town-a', slot: 0 })).toThrow();
  });
});
