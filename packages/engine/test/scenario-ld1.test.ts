import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { sendToReserve } from '../src/combat/leave';
import type { Command } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { ScenarioState } from '../src/scenario/types';
import type { TownState } from '../src/town/types';
import { testConfig, testMap } from './fixtures';

/**
 * Lot LD1 — une défaite HoMM : `defeat` optionnelle (élimination seule), la
 * fuite ne fait pas perdre son propre joueur, et en hot-seat la partie continue
 * tant qu'un humain reste en jeu.
 */

type Ctrl = 'human' | 'ai';

function town(id: string, owner: string, x: number): TownState {
  return { id, ownerPlayerId: owner, pos: { x, y: 0 }, factionId: '', buildings: {}, builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {} };
}

function start(controllers: Record<string, Ctrl>, scenario: ScenarioState): GameState {
  const ids = Object.keys(controllers);
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players: ids.map((id) => ({ id, startingResources: emptyResources(), controller: controllers[id]! })),
    map: testMap(),
    config: { ...testConfig(), hero: { ...testConfig().hero, retreatToTavern: true } },
    unitCatalog: {},
    buildingCatalog: {},
    towns: ids.map((id, i) => town(`town-${id}`, id, 2 + i * 3)),
    scenario,
  };
  return apply(createEmptyState(), cmd).state;
}

const eliminate = { victory: { type: 'eliminateAllEnemies' as const } };

/**
 * Termine le tour du joueur courant (déclenche l'évaluation de fin de partie) —
 * sauf si la partie est déjà finie (la fuite l'évalue elle-même).
 */
function endTurn(s: GameState): { state: GameState; events: GameEvent[] } {
  if (s.outcome) return { state: s, events: [] };
  return apply(s, { type: 'EndTurn', playerId: s.players[s.currentPlayer]!.id });
}

describe('LD1 — défaite par élimination', () => {
  it('sans `defeat`, perdre son héros de départ en gardant une ville ne fait pas perdre', () => {
    let s = start({ p1: 'human', p2: 'ai' }, { objectives: { p1: eliminate, p2: eliminate } });
    s = produce(s, (d) => {
      d.heroes = d.heroes.filter((h) => h.playerId !== 'p1');
    });
    const { state, events } = endTurn(s);
    expect(state.outcome).toBeNull();
    expect(state.players[0]!.eliminated).toBe(false);
    expect(events.some((e) => e.type === 'PlayerEliminated')).toBe(false);
  });

  it('plus de ville ni de héros sur la carte (héros seulement en réserve) ⇒ éliminé', () => {
    let s = start({ p1: 'human', p2: 'ai' }, { objectives: { p1: eliminate, p2: eliminate } });
    s = produce(s, (d) => {
      d.towns = d.towns.filter((t) => t.ownerPlayerId !== 'p1');
      sendToReserve(d, d.heroes.find((h) => h.playerId === 'p1')!.id, []);
    });
    const { state } = endTurn(s);
    expect(state.players[0]!.eliminated).toBe(true);
    expect(state.outcome).toEqual({ status: 'lost', winnerPlayerId: 'p2' });
  });

  it('fuite du protagoniste : pas de défaite `defeatHero` pour son propre joueur', () => {
    const scenario: ScenarioState = {
      objectives: {
        p1: { victory: { type: 'surviveDays', days: 999 }, defeat: { type: 'defeatHero', heroId: 'hero-p1' } },
        p2: eliminate,
      },
    };
    let s = start({ p1: 'human', p2: 'ai' }, scenario);
    s = produce(s, (d) => sendToReserve(d, 'hero-p1', []));
    const { state } = endTurn(s);
    expect(state.outcome).toBeNull();
  });

  it('fuite du héros cible : victoire de l’adversaire qui devait le battre', () => {
    const scenario: ScenarioState = {
      objectives: {
        p1: { victory: { type: 'surviveDays', days: 999 } },
        p2: { victory: { type: 'defeatHero', heroId: 'hero-p1' } },
      },
    };
    let s = start({ p1: 'human', p2: 'ai' }, scenario);
    s = produce(s, (d) => sendToReserve(d, 'hero-p1', []));
    const { state } = endTurn(s);
    expect(state.outcome).toEqual({ status: 'lost', winnerPlayerId: 'p2' });
  });
});

describe('LD1 — hot-seat : la partie continue tant qu’un humain reste en jeu', () => {
  const all = { objectives: { h1: eliminate, h2: eliminate, ai: eliminate } };
  const wipe = (s: GameState, id: string) =>
    produce(s, (d) => {
      d.towns = d.towns.filter((t) => t.ownerPlayerId !== id);
      d.heroes = d.heroes.filter((h) => h.playerId !== id);
    });

  it('le 1ᵉʳ humain éliminé ⇒ avis d’élimination, la partie continue ; le dernier ⇒ défaite', () => {
    const first = endTurn(wipe(start({ h1: 'human', h2: 'human', ai: 'ai' }, all), 'h1'));
    expect(first.state.players[0]!.eliminated).toBe(true);
    expect(first.events).toContainEqual({ type: 'PlayerEliminated', playerId: 'h1' });
    expect(first.state.outcome).toBeNull();

    const last = endTurn(wipe(first.state, 'h2'));
    expect(last.state.outcome).toEqual({ status: 'lost', winnerPlayerId: 'ai' });
  });

  it('un humain dont la défaite explicite est remplie est éliminé, l’autre continue', () => {
    const scenario: ScenarioState = {
      objectives: {
        h1: { victory: { type: 'surviveDays', days: 999 }, defeat: { type: 'defeatHero', heroId: 'hero-h1' } },
        h2: { victory: { type: 'surviveDays', days: 999 } },
        ai: eliminate,
      },
    };
    let s = start({ h1: 'human', h2: 'human', ai: 'ai' }, scenario);
    s = produce(s, (d) => {
      d.heroes = d.heroes.filter((h) => h.id !== 'hero-h1');
    });
    const { state, events } = endTurn(s);
    expect(events).toContainEqual({ type: 'PlayerEliminated', playerId: 'h1' });
    expect(state.outcome).toBeNull();
  });

  it('le second humain qui gagne termine la partie à son nom', () => {
    const s = wipe(wipe(start({ h1: 'human', h2: 'human', ai: 'ai' }, all), 'h1'), 'ai');
    const { state } = endTurn(s);
    expect(state.outcome).toEqual({ status: 'won', winnerPlayerId: 'h2' });
  });
});
