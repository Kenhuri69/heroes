import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import type { BuildingDef } from '../src/town/types';
import type { CombatUnitDef } from '../src/combat/types';
import { testConfig, testMap } from './fixtures';
import { testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * IA de ville (`ai/town-ai.ts`) — lot L2 du plan `missing-features-2026-08` :
 * l'IA choisissait son bâtiment par ordre ALPHABÉTIQUE d'id, n'améliorait
 * jamais ses unités, et laissait ses recrues dormir en garnison (son armée ne
 * grossissait donc jamais). Fixtures locales volontairement **anonymes** (ids
 * `atelier`/`caserne`…) : aucun id de faction dans `packages/` (README §1).
 */

const config = testConfig();

/** Unités : `red-grunt` (base, 50 or) et son amélioré `blue-wolf` (100 or). */
function unitCatalog(): Record<string, CombatUnitDef> {
  const base = testUnitCatalogWithEconomy();
  const wolf = base['blue-wolf'];
  if (!wolf) throw new Error('fixture blue-wolf absente');
  return { ...base, 'blue-wolf': { ...wolf, recruitCost: { gold: 100 }, growthPerWeek: 3 } as CombatUnitDef };
}

/**
 * Catalogue où l'ordre alphabétique et l'utilité DIVERGENT : `atelier` (un
 * marché, service) précède `caserne` (une habitation) — l'ancienne IA prenait
 * l'atelier.
 */
function catalogAlphabetTrap(): Record<string, BuildingDef> {
  return {
    atelier: { id: 'atelier', maxLevel: 1, levels: [{ cost: { gold: 500 }, requires: [], effect: { type: 'market' } }] },
    caserne: {
      id: 'caserne',
      maxLevel: 1,
      levels: [{ cost: { gold: 500 }, requires: [], effect: { type: 'dwelling', tier: 2, unitId: 'blue-wolf' } }],
    },
  };
}

/** Habitation GRADUÉE : niveau 1 = base, niveau 2 = amélioré (mapping dérivé, doc 02 §4.1). */
function catalogUpgradable(): Record<string, BuildingDef> {
  return {
    caserne: {
      id: 'caserne',
      maxLevel: 2,
      levels: [
        { cost: { gold: 500 }, requires: [], effect: { type: 'dwelling', tier: 1, unitId: 'red-grunt' } },
        { cost: { gold: 1000 }, requires: [], effect: { type: 'dwelling', tier: 1, unitId: 'blue-wolf' } },
      ],
    },
  };
}

function aiState(
  gold: number,
  buildingCatalog: Record<string, BuildingDef>,
  town: ReturnType<typeof testTown>,
): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources(), gold }, controller: 'ai' }];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: { ...testMap(), objects: [] },
    config,
    unitCatalog: unitCatalog(),
    buildingCatalog,
    towns: [town],
  };
  return apply(createEmptyState(), cmd).state;
}

function playAi(state: GameState): { next: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    runAiTurn(draft, 'p1', events);
  });
  return { next, events };
}

describe('IA de ville — construire utile', () => {
  it('préfère l’habitation au service, même si le service vient avant dans l’ordre des ids', () => {
    const town = testTown({ buildings: {}, stock: {} });
    const { next } = playAi(aiState(500, catalogAlphabetTrap(), town));

    expect(next.towns[0]?.buildings.caserne).toBe(1);
    expect(next.towns[0]?.buildings.atelier).toBeUndefined();
  });
});

describe('IA de ville — améliorer ses unités', () => {
  it('convertit la pile de garnison quand l’habitation améliorée est bâtie et payable', () => {
    // `builtToday` + stock vide isolent l'amélioration (ni construction ni recrutement).
    const town = testTown({
      buildings: { caserne: 2 },
      builtToday: true,
      stock: {},
      garrison: [{ unitId: 'red-grunt', count: 5 }],
    });
    // 5 × (100 − 50) = 250 or de différentiel.
    const { next, events } = playAi(aiState(250, catalogUpgradable(), town));

    expect(next.towns[0]?.garrison).toEqual([{ unitId: 'blue-wolf', count: 5 }]);
    expect(next.players[0]?.resources.gold).toBe(0);
    expect(events).toContainEqual({
      type: 'UnitsUpgraded',
      townId: 'town-1',
      fromUnitId: 'red-grunt',
      toUnitId: 'blue-wolf',
      count: 5,
    });
  });

  it('n’améliore pas sans les ressources du différentiel', () => {
    const town = testTown({
      buildings: { caserne: 2 },
      builtToday: true,
      stock: {},
      garrison: [{ unitId: 'red-grunt', count: 5 }],
    });
    const { next } = playAi(aiState(249, catalogUpgradable(), town));

    expect(next.towns[0]?.garrison).toEqual([{ unitId: 'red-grunt', count: 5 }]);
  });
});

describe('IA de ville — l’armée du héros grossit enfin', () => {
  it('le héros posté sur sa ville embarque la garnison', () => {
    const town = testTown({
      buildings: {},
      builtToday: true,
      stock: {},
      garrison: [{ unitId: 'red-grunt', count: 7 }],
    });
    let state = aiState(0, catalogAlphabetTrap(), town);
    state = produce(state, (draft) => {
      const hero = draft.heroes.find((h) => h.playerId === 'p1');
      if (!hero) throw new Error('héros absent');
      hero.pos = { ...town.pos };
      hero.army = [];
    });

    const { next } = playAi(state);

    expect(next.towns[0]?.garrison).toEqual([]);
    expect(next.heroes[0]?.army).toContainEqual({ unitId: 'red-grunt', count: 7 });
  });

  it('un héros au loin rentre chercher une garnison qui vaut le détour', () => {
    const town = testTown({
      // Ligne franchissable de la carte de fixture (la position par défaut de
      // `testTown` tombe sur une montagne : aucun chemin n'y mène).
      pos: { x: 5, y: 8 },
      buildings: {},
      builtToday: true,
      stock: {},
      garrison: [{ unitId: 'blue-wolf', count: 30 }],
    });
    let state = aiState(0, catalogAlphabetTrap(), town);
    state = produce(state, (draft) => {
      const hero = draft.heroes.find((h) => h.playerId === 'p1');
      if (!hero) throw new Error('héros absent');
      hero.pos = { x: 2, y: 8 }; // à 3 pas de la ville, dans les PM du jour
      hero.army = [{ unitId: 'red-grunt', count: 1 }];
    });

    const { next } = playAi(state);

    expect(next.heroes[0]?.pos).toEqual(town.pos);
    expect(next.heroes[0]?.army).toContainEqual({ unitId: 'blue-wolf', count: 30 });
    expect(next.towns[0]?.garrison).toEqual([]);
  });
});
