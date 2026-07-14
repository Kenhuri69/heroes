import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { CalendarEventDef } from '../src/adventure/config';
import { createEmptyState, emptyResources, monthOf, weekOf, type GameState } from '../src/core/state';
import { rollWeekEvent, weekGrowthFactor } from '../src/adventure/calendar';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * M-CALENDAR (doc 02 §2.3) — événements de calendrier hebdomadaires : un
 * événement tiré au RNG seedé chaque début de semaine, son `growthFactor`
 * module la croissance (`applyWeeklyGrowth`). Purement data-driven via
 * `config.calendar.events`.
 */
function startedGame(events?: CalendarEventDef[]): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources() } }];
  const config = testConfig();
  if (events) config.calendar = { events };
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config,
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [{ ...testTown(), buildings: { townHall: 1, fort: 2, dwelling1: 1 }, stock: { 'red-grunt': 2 } }],
  };
  return apply(createEmptyState(), cmd).state;
}

/** Avance jusqu'au jour 8 (1ère bascule de semaine) en accumulant les events. */
function advanceToWeek2(state: GameState): { state: GameState; growth: number[]; calendarEvents: string[] } {
  let s = state;
  const growth: number[] = [];
  const calendarEvents: string[] = [];
  for (let day = 1; day <= 7; day++) {
    const r = apply(s, { type: 'EndTurn', playerId: 'p1' });
    s = r.state;
    for (const e of r.events) {
      if (e.type === 'TownGrowth') growth.push(e.added);
      if (e.type === 'CalendarEventStarted') calendarEvents.push(e.eventId);
    }
  }
  return { state: s, growth, calendarEvents };
}

describe('monthOf / weekOf', () => {
  it('un mois = 4 semaines = 28 jours', () => {
    expect(monthOf(1)).toBe(1);
    expect(monthOf(28)).toBe(1);
    expect(monthOf(29)).toBe(2);
    expect(weekOf(8)).toBe(2);
    expect(weekOf(29)).toBe(5);
  });
});

describe('M-CALENDAR — événements de calendrier', () => {
  it('sans calendrier configuré : aucun événement, croissance normale (×1)', () => {
    const { state, growth, calendarEvents } = advanceToWeek2(startedGame());
    expect(state.calendar.day).toBe(8);
    expect(state.calendar.weekEventId).toBeNull();
    expect(calendarEvents).toEqual([]);
    // growthPerWeek=6, fort +50% ⇒ floor(6*1.5)=9 (identique à town-economy.test).
    expect(growth).toEqual([9]);
  });

  it('« semaine de la peste » (facteur 0.5) divise la croissance par deux', () => {
    const { state, growth, calendarEvents } = advanceToWeek2(
      startedGame([{ id: 'plague', weight: 1, growthFactor: 0.5 }]),
    );
    expect(state.calendar.weekEventId).toBe('plague');
    expect(calendarEvents).toEqual(['plague']);
    // floor(6 * 1.5 * 0.5) = floor(4.5) = 4.
    expect(growth).toEqual([4]);
    expect(state.towns[0]?.stock['red-grunt']).toBe(6); // 2 + 4
  });

  it('« semaine d\'abondance » (facteur 2) double la croissance et émet le mois', () => {
    let month = -1;
    let s = startedGame([{ id: 'bounty', weight: 1, growthFactor: 2 }]);
    const growth: number[] = [];
    for (let day = 1; day <= 7; day++) {
      const r = apply(s, { type: 'EndTurn', playerId: 'p1' });
      s = r.state;
      for (const e of r.events) {
        if (e.type === 'TownGrowth') growth.push(e.added);
        if (e.type === 'CalendarEventStarted') month = e.month;
      }
    }
    expect(s.calendar.weekEventId).toBe('bounty');
    expect(month).toBe(1); // jour 8 ⇒ mois 1
    // floor(6 * 1.5 * 2) = 18 ; stock 2+18=20 ≤ plafond 2*18=36.
    expect(growth).toEqual([18]);
    expect(s.towns[0]?.stock['red-grunt']).toBe(20);
  });

  it('« semaine ciblant une créature » (growthTier) double la croissance du palier visé', () => {
    // red-grunt (T1) : la Semaine des Recrues cible le palier 1 (×2), en plus du fort.
    const config = testConfig();
    config.calendar = { events: [{ id: 'recruits', weight: 1, growthFactor: 1, growthTier: { tier: 1, factor: 2 } }] };
    const catalog = testUnitCatalogWithEconomy();
    catalog['red-grunt'] = { ...catalog['red-grunt']!, tier: 1 };
    let s = apply(createEmptyState(), {
      type: 'StartGame', seed: 1, players: [{ id: 'p1', startingResources: { ...emptyResources() } }],
      map: testMap(), config, unitCatalog: catalog, buildingCatalog: testBuildingCatalog(),
      towns: [{ ...testTown(), buildings: { townHall: 1, fort: 2, dwelling1: 1 }, stock: { 'red-grunt': 2 } }],
    }).state;
    const growth: number[] = [];
    for (let day = 1; day <= 7; day++) {
      const r = apply(s, { type: 'EndTurn', playerId: 'p1' });
      s = r.state;
      for (const e of r.events) if (e.type === 'TownGrowth') growth.push(e.added);
    }
    expect(s.calendar.weekEventId).toBe('recruits');
    // floor(6 * 1.5 (fort) * 1 (global) * 2 (palier 1)) = 18.
    expect(growth).toEqual([18]);
  });

  it('« semaine ciblant une créature » n’affecte PAS les autres paliers', () => {
    const config = testConfig();
    // Cible le palier 2 ; red-grunt est T1 ⇒ croissance normale (9).
    config.calendar = { events: [{ id: 'recruits', weight: 1, growthFactor: 1, growthTier: { tier: 2, factor: 2 } }] };
    const catalog = testUnitCatalogWithEconomy();
    catalog['red-grunt'] = { ...catalog['red-grunt']!, tier: 1 };
    let s = apply(createEmptyState(), {
      type: 'StartGame', seed: 1, players: [{ id: 'p1', startingResources: { ...emptyResources() } }],
      map: testMap(), config, unitCatalog: catalog, buildingCatalog: testBuildingCatalog(),
      towns: [{ ...testTown(), buildings: { townHall: 1, fort: 2, dwelling1: 1 }, stock: { 'red-grunt': 2 } }],
    }).state;
    const growth: number[] = [];
    for (let day = 1; day <= 7; day++) {
      const r = apply(s, { type: 'EndTurn', playerId: 'p1' });
      s = r.state;
      for (const e of r.events) if (e.type === 'TownGrowth') growth.push(e.added);
    }
    expect(growth).toEqual([9]); // floor(6 * 1.5) — palier non ciblé
  });

  it('« semaine de ruée » (resourceGrant) crédite la ressource à tous les joueurs', () => {
    const config = testConfig();
    config.calendar = {
      events: [{ id: 'gold-rush', weight: 1, growthFactor: 1, resourceGrant: { resource: 'gold', amount: 500 } }],
    };
    // Deux joueurs : le crédit s'applique à TOUS.
    let s = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players: [
        { id: 'p1', startingResources: { ...emptyResources() } },
        { id: 'p2', startingResources: { ...emptyResources() } },
      ],
      map: testMap(),
      config,
      unitCatalog: testUnitCatalogWithEconomy(),
      buildingCatalog: testBuildingCatalog(),
      towns: [{ ...testTown(), buildings: { townHall: 1, fort: 2, dwelling1: 1 }, stock: { 'red-grunt': 2 } }],
    }).state;
    // Un jour = un tour de CHAQUE joueur ⇒ boucle jusqu'au jour 8 (semaine 2).
    // p2 ne possède aucune ville ⇒ son or ne vient QUE de la ruée (isole le crédit
    // du revenu quotidien de ville qui gonfle l'or de p1).
    const granted: { playerId: string; amount: number }[] = [];
    while (s.calendar.day < 8) {
      const r = apply(s, { type: 'EndTurn', playerId: s.players[s.currentPlayer]!.id });
      s = r.state;
      for (const e of r.events)
        if (e.type === 'CalendarResourceGranted') granted.push({ playerId: e.playerId, amount: e.amount });
    }
    expect(s.calendar.weekEventId).toBe('gold-rush');
    expect(s.players[1]?.resources.gold).toBe(500); // p2 sans ville : or = ruée seule
    expect(granted).toContainEqual({ playerId: 'p1', amount: 500 });
    expect(granted).toContainEqual({ playerId: 'p2', amount: 500 });
  });

  it('sans resourceGrant : aucun crédit émis au passage de semaine', () => {
    let s = startedGame([{ id: 'harvest', weight: 1, growthFactor: 1.5 }]);
    const granted: string[] = [];
    for (let day = 1; day <= 7; day++) {
      const r = apply(s, { type: 'EndTurn', playerId: 'p1' });
      s = r.state;
      for (const e of r.events) if (e.type === 'CalendarResourceGranted') granted.push(e.playerId);
    }
    expect(s.calendar.weekEventId).toBe('harvest');
    expect(granted).toEqual([]);
  });

  it('tirage déterministe : même graine ⇒ même événement', () => {
    const events: CalendarEventDef[] = [
      { id: 'a', weight: 1, growthFactor: 1 },
      { id: 'b', weight: 1, growthFactor: 1 },
      { id: 'c', weight: 1, growthFactor: 1 },
    ];
    const a = advanceToWeek2(startedGame(events)).state.calendar.weekEventId;
    const b = advanceToWeek2(startedGame(events)).state.calendar.weekEventId;
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it('rollWeekEvent : liste vide ⇒ null sans consommer le RNG', () => {
    // Copie mutable : l'état issu d'`apply` est gelé par immer.
    const s = structuredClone(startedGame());
    const rngBefore = { ...s.rng };
    const evt = rollWeekEvent(s);
    expect(evt).toBeNull();
    expect(s.calendar.weekEventId).toBeNull();
    expect(s.rng).toEqual(rngBefore);
    expect(weekGrowthFactor(s)).toBe(1);
  });
});
