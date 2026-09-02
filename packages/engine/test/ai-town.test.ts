import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import type { BuildingDef } from '../src/town/types';
import type { ArtifactDef } from '../src/hero/types';
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
/** Config + taux de marché (absents de `testConfig`) : le troc l'exige. */
const configWithMarket = { ...config, market: { sellRate: 25, buyRate: 50 } };

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
  gameConfig = config,
): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources(), gold }, controller: 'ai' }];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: { ...testMap(), objects: [] },
    config: gameConfig,
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

/** Catalogue portant un marché ET un vendeur de machines de guerre. */
function catalogServices(): Record<string, BuildingDef> {
  return {
    comptoir: { id: 'comptoir', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'market' } }] },
    fonderie: {
      id: 'fonderie',
      maxLevel: 1,
      levels: [{ cost: {}, requires: [], effect: { type: 'warMachineVendor', units: ['engin-de-siege'] } }],
    },
  };
}

describe('IA de ville — le marché sert enfin à quelque chose', () => {
  it('vend le plus gros surplus non-or contre de l’or (réserve conservée)', () => {
    const town = testTown({ buildings: { comptoir: 1 }, builtToday: true, stock: {} });
    let state = aiState(0, catalogServices(), town, configWithMarket);
    state = produce(state, (draft) => {
      const p = draft.players[0];
      if (!p) throw new Error('joueur absent');
      p.resources.gems = 50; // 20 au-dessus de la réserve
      p.resources.wood = 35; // 5 au-dessus : surplus plus petit
    });

    const { next } = playAi(state);
    const after = next.players[0];

    expect(after?.resources.gems).toBe(30); // la réserve reste
    expect(after?.resources.wood).toBe(35); // un seul échange par tour
    expect(after?.resources.gold).toBeGreaterThan(0);
  });

  it('ne vend rien sous la réserve, ni sans marché construit', () => {
    const underReserve = testTown({ buildings: { comptoir: 1 }, builtToday: true, stock: {} });
    let state = aiState(0, catalogServices(), underReserve, configWithMarket);
    state = produce(state, (draft) => {
      const p = draft.players[0];
      if (p) p.resources.gems = 30;
    });
    expect(playAi(state).next.players[0]?.resources.gold).toBe(0);

    const noMarket = testTown({ buildings: {}, builtToday: true, stock: {} });
    let bare = aiState(0, catalogServices(), noMarket, configWithMarket);
    bare = produce(bare, (draft) => {
      const p = draft.players[0];
      if (p) p.resources.gems = 100;
    });
    const out = playAi(bare).next.players[0];
    expect(out?.resources.gold).toBe(0);
    expect(out?.resources.gems).toBe(100);
  });
});

describe('IA de ville — machines de guerre', () => {
  it('achète au héros présent une machine vendue par le bâtiment (une par tour)', () => {
    const town = testTown({ buildings: { fonderie: 1 }, builtToday: true, stock: {} });
    let state = aiState(1000, catalogServices(), town);
    state = produce(state, (draft) => {
      const hero = draft.heroes.find((h) => h.playerId === 'p1');
      if (!hero) throw new Error('héros absent');
      hero.pos = { ...town.pos };
      hero.movementPoints = 0; // il tient la ville : sinon il part explorer avant le tour de ville
    });

    const { next, events } = playAi(state);

    expect(next.heroes[0]?.warMachines).toContain('engin-de-siege');
    expect(events).toContainEqual(expect.objectContaining({ type: 'WarMachineBought', unitId: 'engin-de-siege' }));
  });

  it('n’achète pas sans héros sur place', () => {
    const town = testTown({ buildings: { fonderie: 1 }, builtToday: true, stock: {} });
    const { next } = playAi(aiState(1000, catalogServices(), town));
    expect(next.heroes[0]?.warMachines).toEqual([]);
  });
});

describe('IA d’aventure — les artefacts sortent du sac', () => {
  it('équipe le butin rangé dans le sac avant de jouer son tour', () => {
    const artifactCatalog: Record<string, ArtifactDef> = {
      'talisman-test': { id: 'talisman-test', bonus: { attack: 1 }, slot: 'misc' },
    };
    const town = testTown({ buildings: {}, builtToday: true, stock: {} });
    const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources(), controller: 'ai' }];
    let state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map: { ...testMap(), objects: [] },
      config,
      unitCatalog: unitCatalog(),
      buildingCatalog: catalogServices(),
      towns: [town],
      artifactCatalog,
    }).state;
    state = produce(state, (draft) => {
      const hero = draft.heroes.find((h) => h.playerId === 'p1');
      if (!hero) throw new Error('héros absent');
      hero.backpack = ['talisman-test'];
    });

    const { next } = playAi(state);

    expect(next.heroes[0]?.artifacts).toContain('talisman-test');
    expect(next.heroes[0]?.backpack).toEqual([]);
  });
});

describe('Revue 2026-09 — recrutement IA et ressource de FACTION (générique)', () => {
  /** Unité dont le coût mêle or et une ressource de faction opaque (`essence`). */
  function factionCostState(essence: number): GameState {
    const town = testTown({ buildings: { caserne: 1 }, builtToday: true, stock: { 'red-grunt': 10 } });
    const catalog = {
      caserne: {
        id: 'caserne',
        maxLevel: 1,
        levels: [{ cost: { gold: 500 }, requires: [], effect: { type: 'dwelling' as const, tier: 1, unitId: 'red-grunt' } }],
      },
    };
    let state = aiState(10_000, catalog, town);
    state = produce(state, (draft) => {
      const unit = draft.unitCatalog['red-grunt'];
      if (!unit) throw new Error('fixture red-grunt absente');
      // Coût de faction opaque : le type large est celui de `unitWithEconomy` (Record<string, number>).
      (unit as { recruitCost?: Record<string, number> }).recruitCost = { gold: 100, essence: 2 };
      const p = draft.players[0];
      if (p) p.factionResources = { essence };
      // Isole le recrutement : le héros n'est pas sur la ville (pas d'embarquement de garnison).
      const hero = draft.heroes[0];
      if (hero) hero.pos = { x: 0, y: 0 };
    });
    return state;
  }

  it('recrute exactement ce que la ressource de faction permet (5 pour 10 essence à 2/unité)', () => {
    const { next } = playAi(factionCostState(10));
    expect(next.towns[0]?.garrison).toContainEqual({ unitId: 'red-grunt', count: 5 });
    expect(next.players[0]?.factionResources['essence']).toBe(0);
  });

  it('sans la ressource de faction : ne recrute rien (et ne saute plus l’unité par erreur de calcul)', () => {
    const { next } = playAi(factionCostState(0));
    expect(next.towns[0]?.garrison ?? []).toEqual([]);
  });
});
