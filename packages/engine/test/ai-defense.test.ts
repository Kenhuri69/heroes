import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import type { AdventureMapDef } from '../src/adventure/map';
import type { SpellDef } from '../src/hero/types';
import { testCatalog, testConfig, testMap } from './fixtures';
import { testTown } from './town-fixtures';

/**
 * Lot L4 (`.claude/plans/l4-ai-defense-travel.md`) — l'IA défend et voyage :
 * garde d'une ville menacée, sorts d'aventure, obélisques et Graal. Fixtures
 * anonymes (aucun id de faction dans `packages/`, README §1).
 */

const CATALOG = testCatalog();
const config = testConfig();

/** Carte plate et franchissable : la géométrie n'est pas le sujet de ce lot. */
function flatMap(overrides: Partial<AdventureMapDef> = {}): AdventureMapDef {
  const base = testMap();
  return {
    ...base,
    terrain: base.terrain.map(() => 'grass'),
    objects: [],
    ...overrides,
  };
}

function twoPlayerState(map: AdventureMapDef, towns = [testTown({ buildings: {}, stock: {} })]): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), controller: 'ai' },
    { id: 'p2', startingResources: emptyResources(), controller: 'ai' },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map,
    config,
    unitCatalog: CATALOG,
    towns,
  };
  return apply(createEmptyState(), cmd).state;
}

function playAi(state: GameState, playerId = 'p1'): { next: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    runAiTurn(draft, playerId, events);
  });
  return { next, events };
}

/** Tout explorer pour `p1` : les pickers ignorent ce qui est sous brouillard (B31). */
function revealAll(draft: GameState, playerId: string): void {
  const player = draft.players.find((p) => p.id === playerId);
  if (player) player.explored = player.explored.map(() => 1);
}

describe('IA — garde d’une ville menacée', () => {
  const town = testTown({ pos: { x: 5, y: 8 }, buildings: {}, stock: {}, garrison: [] });

  it('rentre défendre quand un héros ennemi plus fort rôde près de la ville', () => {
    let state = twoPlayerState(flatMap(), [town]);
    state = produce(state, (draft) => {
      revealAll(draft, 'p1');
      const mine = draft.heroes.find((h) => h.playerId === 'p1');
      const foe = draft.heroes.find((h) => h.playerId === 'p2');
      if (!mine || !foe) throw new Error('héros absents');
      mine.pos = { x: 2, y: 8 };
      mine.army = [{ unitId: 'blue-wolf', count: 20 }];
      foe.pos = { x: 7, y: 8 }; // à 2 cases de la ville
      foe.army = [{ unitId: 'blue-wolf', count: 40 }]; // plus fort que la défense (vide)
    });

    const { next } = playAi(state);

    expect(next.heroes.find((h) => h.playerId === 'p1')?.pos).toEqual(town.pos);
  });

  it('tient la position tant que la menace dure, et repart quand elle s’en va', () => {
    // Un tas d'or à portée donne au héros une VRAIE raison de partir : s'il reste,
    // c'est bien la garde qui l'emporte sur le ramassage, pas l'absence d'objectif.
    const withLoot = flatMap({
      objects: [{ id: 'gold-x', type: 'resource', pos: { x: 3, y: 8 }, resource: 'gold', amount: 500 }],
    });
    let held = twoPlayerState(withLoot, [town]);
    held = produce(held, (draft) => {
      revealAll(draft, 'p1');
      const mine = draft.heroes.find((h) => h.playerId === 'p1');
      const foe = draft.heroes.find((h) => h.playerId === 'p2');
      if (!mine || !foe) throw new Error('héros absents');
      mine.pos = { ...town.pos };
      mine.army = [{ unitId: 'blue-wolf', count: 20 }];
      foe.pos = { x: 7, y: 8 };
      foe.army = [{ unitId: 'blue-wolf', count: 40 }];
    });
    expect(playAi(held).next.heroes.find((h) => h.playerId === 'p1')?.pos).toEqual(town.pos);

    // Même position, menace retombée (l'assaillant a perdu son armée) ⇒ sous le
    // palier d'hystérésis, le héros reprend sa route vers le butin.
    const free = produce(held, (draft) => {
      const foe = draft.heroes.find((h) => h.playerId === 'p2');
      if (foe) foe.army = [{ unitId: 'red-grunt', count: 1 }];
    });
    expect(playAi(free).next.heroes.find((h) => h.playerId === 'p1')?.pos).toEqual({ x: 3, y: 8 });
  });
});

describe('IA — sorts d’aventure', () => {
  const marcheForcee: SpellDef = {
    id: 'marche-test',
    school: 'test-school',
    circle: 1,
    manaCost: 4,
    kind: 'adventure',
    base: 0,
    perPower: 0,
    adventure: { type: 'movementBonus', amount: 500 },
  };

  function withSpell(mana: number, manaMax: number): GameState {
    let state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players: [{ id: 'p1', startingResources: emptyResources(), controller: 'ai' }],
      map: flatMap(),
      config,
      unitCatalog: CATALOG,
      spellCatalog: { [marcheForcee.id]: marcheForcee },
    }).state;
    state = produce(state, (draft) => {
      const hero = draft.heroes[0];
      if (!hero) throw new Error('héros absent');
      hero.spells = [marcheForcee.id];
      hero.mana = mana;
      hero.manaMax = manaMax;
    });
    return state;
  }

  it('lance la Marche forcée en tête de tour quand la réserve de combat le permet', () => {
    const { events } = playAi(withSpell(10, 10));
    expect(events).toContainEqual(expect.objectContaining({ type: 'AdventureSpellCast', spellId: 'marche-test' }));
  });

  it('garde sa mana pour le combat sous la réserve de moitié', () => {
    const { events } = playAi(withSpell(5, 10)); // 5 − 4 = 1 < 5 ⇒ refusé
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'AdventureSpellCast' }));
  });
});

describe('IA — obélisques et Graal', () => {
  it('visite un obélisque non encore vu, puis fouille le Graal une fois révélé', () => {
    const map = flatMap({
      grailPos: { x: 4, y: 8 },
      objects: [{ id: 'obe-1', type: 'obelisk', pos: { x: 3, y: 8 } }],
    });
    let state = twoPlayerState(map, [testTown({ pos: { x: 9, y: 9 }, buildings: {}, stock: {} })]);
    state = produce(state, (draft) => {
      revealAll(draft, 'p1');
      const mine = draft.heroes.find((h) => h.playerId === 'p1');
      const foe = draft.heroes.find((h) => h.playerId === 'p2');
      if (!mine || !foe) throw new Error('héros absents');
      mine.pos = { x: 2, y: 8 };
      foe.pos = { x: 0, y: 0 };
    });

    // Tour 1 : l'obélisque est une cible ⇒ visité, Graal révélé (1 seul obélisque).
    const afterObelisk = playAi(state).next;
    expect(afterObelisk.players[0]?.obelisksVisited).toContain('obe-1');

    // Tour 2 : le héros marche sur la tuile du Graal et fouille.
    const refreshed = produce(afterObelisk, (draft) => {
      const mine = draft.heroes.find((h) => h.playerId === 'p1');
      if (mine) mine.movementPoints = 2000;
    });
    const { next, events } = playAi(refreshed);
    expect(next.players[0]?.hasGrail).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: 'GrailFound' }));
  });

  it('ne fouille pas une tuile de Graal non révélée', () => {
    const map = flatMap({
      grailPos: { x: 3, y: 8 },
      objects: [{ id: 'obe-1', type: 'obelisk', pos: { x: 9, y: 0 } }],
    });
    let state = twoPlayerState(map, [testTown({ pos: { x: 9, y: 9 }, buildings: {}, stock: {} })]);
    state = produce(state, (draft) => {
      revealAll(draft, 'p1');
      const mine = draft.heroes.find((h) => h.playerId === 'p1');
      const foe = draft.heroes.find((h) => h.playerId === 'p2');
      if (!mine || !foe) throw new Error('héros absents');
      mine.pos = { x: 3, y: 8 }; // pile sur le Graal, mais aucun obélisque visité
      foe.pos = { x: 0, y: 0 };
    });

    expect(playAi(state).next.players[0]?.hasGrail).toBeFalsy();
  });
});
