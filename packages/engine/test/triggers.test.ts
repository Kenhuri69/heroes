import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { AdventureMapDef, MapTriggerDef } from '../src/adventure/map';
import { testConfig, testMap } from './fixtures';

/**
 * Triggers de carte (doc 02 §2.1, comblement MVP) : effets déclaratifs
 * génériques déclenchés à la visite d'une tuile ou à un jour donné, one-shot.
 */
function startWith(triggers: MapTriggerDef[], players: PlayerSetup[]): GameState {
  const map: AdventureMapDef = { ...testMap(), triggers };
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 1,
    players,
    map,
    config: testConfig(),
    unitCatalog: {},
    buildingCatalog: {},
    towns: [],
  }).state;
}

const P1: PlayerSetup = { id: 'p1', startingResources: emptyResources() };
const P2: PlayerSetup = { id: 'p2', startingResources: emptyResources() };

describe('triggers de visite', () => {
  it('octroie la ressource au joueur qui visite, une seule fois (one-shot)', () => {
    const state = startWith(
      [
        {
          id: 't-visit',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'grantResource', resource: 'gold', amount: 100 },
          fired: false,
        },
      ],
      [P1],
    );
    const gold0 = state.players[0]!.resources.gold;
    const r1 = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] });
    expect(
      r1.events.some((e) => e.type === 'TriggerFired' && e.triggerId === 't-visit'),
    ).toBe(true);
    expect(r1.state.players[0]!.resources.gold).toBe(gold0 + 100);
    expect(r1.state.map!.triggers[0]!.fired).toBe(true);

    // Repasser (tour suivant pour restaurer les PM) ne re-déclenche pas.
    const day2 = apply(r1.state, { type: 'EndTurn', playerId: 'p1' });
    const back = apply(day2.state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 0, y: 0 }] });
    const again = apply(back.state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [{ x: 1, y: 0 }],
    });
    expect(again.events.some((e) => e.type === 'TriggerFired')).toBe(false);
    expect(again.state.players[0]!.resources.gold).toBe(gold0 + 100);
  });
});

describe('triggers de jour', () => {
  it('émet un message global au bon jour, une seule fois', () => {
    const state = startWith(
      [
        {
          id: 't-day',
          on: { kind: 'day', day: 2 },
          effect: { kind: 'message', textKey: 'hello' },
          fired: false,
        },
      ],
      [P1],
    );
    const r = apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(r.state.calendar.day).toBe(2);
    const fired = r.events.filter((e) => e.type === 'TriggerFired' && e.triggerId === 't-day');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ playerId: null, effect: { kind: 'message', textKey: 'hello' } });

    const r2 = apply(r.state, { type: 'EndTurn', playerId: 'p1' });
    expect(r2.events.some((e) => e.type === 'TriggerFired')).toBe(false);
  });

  it('un trigger « onDay: 1 » se déclenche dès StartGame (pas de bascule de jour au jour 1)', () => {
    const state = startWith(
      [
        {
          id: 't-day1',
          on: { kind: 'day', day: 1 },
          effect: { kind: 'grantResource', resource: 'gold', amount: 42 },
          fired: false,
        },
      ],
      [P1],
    );
    // Sans le correctif, ce trigger serait mort (fireDayTriggers jamais appelé au jour 1).
    expect(state.players[0]!.resources.gold).toBe(42);
    expect(state.map!.triggers[0]!.fired).toBe(true);
  });

  it('octroie une ressource symétriquement à tous les joueurs actifs', () => {
    const state = startWith(
      [
        {
          id: 't-day-res',
          on: { kind: 'day', day: 2 },
          effect: { kind: 'grantResource', resource: 'wood', amount: 5 },
          fired: false,
        },
      ],
      [P1, P2],
    );
    // Un jour bascule quand tous les joueurs ont fini leur tour.
    const a = apply(state, { type: 'EndTurn', playerId: 'p1' });
    const b = apply(a.state, { type: 'EndTurn', playerId: 'p2' });
    expect(b.state.calendar.day).toBe(2);
    expect(b.state.players[0]!.resources.wood).toBe(5);
    expect(b.state.players[1]!.resources.wood).toBe(5);
  });
});
