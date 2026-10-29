import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import { checkCombatEnd } from '../src/combat/turns';
import type { CombatState } from '../src/combat/types';
import type { AdventureMapDef } from '../src/adventure/map';
import type { TownState } from '../src/town/types';
import { testCatalog, testConfig } from './fixtures';

/**
 * LD2 — une IA qui conclut : relais vers le héros principal, offensive sans
 * horizon, Ville-portail défensive (LD6a), exploration qui avance vraiment, et
 * un camp réduit à ses machines de guerre qui perd (canon III).
 */

const CATALOG = {
  ...testCatalog(),
  ballista: {
    id: 'ballista', groupId: 'wm', nativeTerrain: 'grass',
    stats: { hp: 250, attack: 10, defense: 10, damage: [2, 3] as [number, number], speed: 1 },
    abilities: [{ id: 'warMachine' }, { id: 'immobile' }],
  },
};

/** Prairie `width`×`height` sans objet. */
function plain(width: number, height: number): AdventureMapDef {
  const size = width * height;
  return {
    id: 'plain', width, height,
    terrain: new Array<string>(size).fill('grass'),
    road: new Array<boolean>(size).fill(false),
    objects: [], triggers: [],
    startPositions: [{ x: 1, y: 1 }, { x: width - 2, y: height - 2 }],
  } as AdventureMapDef;
}

function town(id: string, owner: string, x: number, y: number): TownState {
  return { id, ownerPlayerId: owner, pos: { x, y }, factionId: '', buildings: {}, builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {} };
}

function start(map: AdventureMapDef, towns: TownState[] = []): GameState {
  const cmd: Command = {
    type: 'StartGame', seed: 1,
    players: [
      { id: 'p1', startingResources: emptyResources(), controller: 'ai' },
      { id: 'p2', startingResources: emptyResources(), controller: 'ai' },
    ],
    map, config: testConfig(), unitCatalog: CATALOG, towns,
  };
  return apply(createEmptyState(), cmd).state;
}

const play = (s: GameState): GameState => produce(s, (d) => runAiTurn(d, 'p1', [] as GameEvent[]));
const revealAll = (d: GameState): void => {
  for (const p of d.players) p.explored = p.explored.map(() => 1);
};

describe('LD2 — relais vers le héros principal', () => {
  it('le secondaire rejoint le principal et lui donne tout sauf sa pile la plus faible', () => {
    const s = produce(start(plain(12, 12)), (d) => {
      revealAll(d);
      const main = d.heroes.find((h) => h.playerId === 'p1')!;
      main.pos = { x: 2, y: 2 };
      main.army = [{ unitId: 'blue-wolf', count: 50 }];
      d.heroes.push({ ...JSON.parse(JSON.stringify(main)), id: 'hero-p1-b', pos: { x: 6, y: 2 }, army: [{ unitId: 'blue-wolf', count: 10 }, { unitId: 'red-grunt', count: 3 }] });
      d.heroes.find((h) => h.playerId === 'p2')!.pos = { x: 10, y: 10 };
    });
    const next = play(s);
    const main = next.heroes.find((h) => h.id === 'hero-p1')!;
    const relay = next.heroes.find((h) => h.id === 'hero-p1-b')!;
    expect(main.army).toContainEqual({ unitId: 'blue-wolf', count: 60 });
    expect(relay.army).toEqual([{ unitId: 'red-grunt', count: 3 }]);
  });
});

describe('LD2 — offensive du principal', () => {
  it('marche sur une ville adverse dominée au-delà de 3 jours, avant d’explorer', () => {
    const s = produce(start(plain(90, 3), [town('t2', 'p2', 88, 1)]), (d) => {
      revealAll(d);
      d.players[0]!.explored[2 * 90 + 0] = 0; // une tuile encore inexplorée, à côté du héros
      const main = d.heroes.find((h) => h.playerId === 'p1')!;
      main.pos = { x: 1, y: 1 };
      main.army = [{ unitId: 'blue-wolf', count: 50 }];
      d.heroes.find((h) => h.playerId === 'p2')!.pos = { x: 88, y: 2 };
      d.heroes.find((h) => h.playerId === 'p2')!.army = [{ unitId: 'red-grunt', count: 1 }];
    });
    const main = play(s).heroes.find((h) => h.playerId === 'p1')!;
    expect(main.pos.x).toBeGreaterThan(10);
  });
});

describe('LD6a — Ville-portail défensive', () => {
  it('le principal hors de portée rentre défendre sa ville menacée', () => {
    const s = produce(start(plain(60, 12), [town('t1', 'p1', 50, 5)]), (d) => {
      revealAll(d);
      d.config!.buildingVisionRadius = 5; // la ville voit l'assaillant
      d.spellCatalog = { portal: { id: 'portal', school: 'neutral', circle: 2, manaCost: 8, kind: 'adventure', base: 0, perPower: 0, adventure: { type: 'townPortal' } } } as GameState['spellCatalog'];
      const main = d.heroes.find((h) => h.playerId === 'p1')!;
      main.pos = { x: 1, y: 1 };
      main.army = [{ unitId: 'blue-wolf', count: 50 }];
      main.spells = ['portal'];
      main.mana = 20;
      const foe = d.heroes.find((h) => h.playerId === 'p2')!;
      foe.pos = { x: 53, y: 5 };
      foe.army = [{ unitId: 'red-grunt', count: 20 }];
    });
    const main = play(s).heroes.find((h) => h.playerId === 'p1')!;
    expect(Math.abs(main.pos.x - 50)).toBeLessThanOrEqual(1);
  });
});

describe('LD2 — exploration', () => {
  it('le héros explore tant qu’il a des PM (plus d’un pas par jour)', () => {
    const s = produce(start(plain(40, 3)), (d) => {
      const main = d.heroes.find((h) => h.playerId === 'p1')!;
      main.pos = { x: 1, y: 1 };
      main.army = [{ unitId: 'blue-wolf', count: 5 }];
      d.heroes.find((h) => h.playerId === 'p2')!.pos = { x: 38, y: 1 };
    });
    const main = play(s).heroes.find((h) => h.playerId === 'p1')!;
    expect(main.pos.x).toBeGreaterThan(5);
  });
});

describe('LD2 — un camp réduit à ses machines de guerre a perdu (canon III)', () => {
  it('la baliste seule ne garde pas le défenseur en vie', () => {
    const stack = (id: string, side: 'attacker' | 'defender', unitId: string, count: number, col: number) => ({
      id, side, slot: 0, unitId, count, firstHp: CATALOG[unitId as keyof typeof CATALOG].stats.hp, pos: { col, row: 2 },
      retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0, marks: 0,
      immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    });
    const s = produce(start(plain(12, 12)), (d) => {
      d.combat = {
        terrain: 'grass', phase: 'battle', round: 3, obstacles: [],
        stacks: [stack('attacker-0', 'attacker', 'red-grunt', 10, 0), stack('defender-0', 'defender', 'ballista', 1, 14)],
        activeStackId: 'attacker-0', playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null,
        wallDefenseBonus: 0, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [],
        finished: false, winner: null,
      } as unknown as CombatState;
    });
    const events: GameEvent[] = [];
    const next = produce(s, (d) => {
      checkCombatEnd(d, events);
    });
    expect(events.some((e) => e.type === 'CombatEnded' && e.winner === 'attacker')).toBe(true);
    expect(next.combat === null || next.combat.finished).toBe(true);
  });
});
