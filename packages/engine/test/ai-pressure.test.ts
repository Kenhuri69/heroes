import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import type { AdventureMapDef } from '../src/adventure/map';
import type { BuildingDef, TownState } from '../src/town/types';
import type { CombatUnitDef } from '../src/combat/types';
import { testConfig, testMap } from './fixtures';
import { testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * Lot LE1 « un adversaire qui presse » (plan `.claude/plans/le1-ai-pressure.md`) :
 * l'IA recrute tout son stock (B2), achète au marché ce qui lui manque (B2),
 * bâtit une Taverne quand elle n'a plus de héros, joue la ville d'un héros
 * stationné AVANT ce héros, assiège une ville à garnison qu'elle domine
 * (D-SIEGEAI), et vise un objectif à quelques jours avant d'explorer (B1).
 * Fixtures anonymes : aucun id de faction dans `packages/` (README §1).
 */

const config = testConfig();
const configWithMarket = { ...config, market: { sellRate: 25, buyRate: 50 } };

/** `red-grunt` (tier 1, 50 or) ; `blue-wolf` (tier 2, 100 or). */
function unitCatalog(): Record<string, CombatUnitDef> {
  const base = testUnitCatalogWithEconomy();
  const wolf = base['blue-wolf'];
  if (!wolf) throw new Error('fixture blue-wolf absente');
  return { ...base, 'blue-wolf': { ...wolf, recruitCost: { gold: 100 }, growthPerWeek: 3 } as CombatUnitDef };
}

/** Deux habitations (tiers 1 et 2) déjà bâties : fixent le tier de chaque unité. */
const DWELLINGS: Record<string, BuildingDef> = {
  caserne: {
    id: 'caserne',
    maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'dwelling', tier: 1, unitId: 'red-grunt' } }],
  },
  chenil: {
    id: 'chenil',
    maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'dwelling', tier: 2, unitId: 'blue-wolf' } }],
  },
};

function start(opts: {
  gold: number;
  catalog: Record<string, BuildingDef>;
  towns: TownState[];
  map?: AdventureMapDef;
  gameConfig?: typeof config;
  players?: PlayerSetup[];
}): GameState {
  const players = opts.players ?? [
    { id: 'p1', startingResources: { ...emptyResources(), gold: opts.gold }, controller: 'ai' },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: opts.map ?? { ...testMap(), objects: [] },
    config: opts.gameConfig ?? config,
    unitCatalog: unitCatalog(),
    buildingCatalog: opts.catalog,
    towns: opts.towns,
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

/** Éloigne le héros de p1 de sa ville et l'immobilise (isole le tour de ville). */
function parkHero(state: GameState): GameState {
  return produce(state, (draft) => {
    const hero = draft.heroes.find((h) => h.playerId === 'p1');
    if (!hero) throw new Error('héros absent');
    hero.pos = { x: 0, y: 0 };
    hero.movementPoints = 0;
  });
}

describe('LE1/B2 — l’IA recrute tout son stock', () => {
  it('recrute chaque tier en stock, pas seulement le plus haut', () => {
    const town = testTown({ buildings: { caserne: 1, chenil: 1 }, builtToday: true, stock: { 'red-grunt': 10, 'blue-wolf': 3 } });
    const { next } = playAi(parkHero(start({ gold: 10_000, catalog: DWELLINGS, towns: [town] })));

    expect(next.towns[0]?.garrison).toContainEqual({ unitId: 'blue-wolf', count: 3 });
    expect(next.towns[0]?.garrison).toContainEqual({ unitId: 'red-grunt', count: 10 });
  });

  it('au-delà de la 1ʳᵉ pile, ne puise pas dans la réserve du bâtiment qu’elle n’a pas pu payer', () => {
    const catalog: Record<string, BuildingDef> = {
      ...DWELLINGS,
      // Bloqué faute de bois (aucun marché) : son coût devient la réserve.
      beffroi: { id: 'beffroi', maxLevel: 1, levels: [{ cost: { gold: 1000, wood: 5 }, requires: [], effect: { type: 'income', resource: 'gold', amount: 500 } }] },
    };
    const town = testTown({ buildings: { caserne: 1, chenil: 1 }, stock: { 'red-grunt': 10, 'blue-wolf': 3 } });
    const { next } = playAi(parkHero(start({ gold: 1100, catalog, towns: [town] })));

    // La 1ʳᵉ pile (plus haut tier) se paie comme avant : 3 × 100 or.
    expect(next.towns[0]?.garrison).toEqual([{ unitId: 'blue-wolf', count: 3 }]);
    // 800 or restants < réserve de 1000 : aucun grunt.
    expect(next.players[0]?.resources.gold).toBe(800);
  });
});

describe('LE1/B2 — l’IA achète au marché ce qui lui manque', () => {
  const MARKET: Record<string, BuildingDef> = {
    comptoir: { id: 'comptoir', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'market' } }] },
  };

  it('achète le bois manquant avec de l’or, puis construit le bâtiment prioritaire', () => {
    const catalog: Record<string, BuildingDef> = {
      ...MARKET,
      beffroi: { id: 'beffroi', maxLevel: 1, levels: [{ cost: { gold: 500, wood: 5 }, requires: [], effect: { type: 'income', resource: 'gold', amount: 500 } }] },
    };
    const town = testTown({ buildings: { comptoir: 1 }, stock: {} });
    const { next } = playAi(parkHero(start({ gold: 2000, catalog, towns: [town], gameConfig: configWithMarket })));

    expect(next.towns[0]?.buildings.beffroi).toBe(1);
    // 5 bois au taux d'achat 50 = 250 or, + 500 or du bâtiment.
    expect(next.players[0]?.resources.gold).toBe(1250);
    expect(next.players[0]?.resources.wood).toBe(0);
  });

  it('paie le mercure d’une recrue au marché plutôt que de laisser dormir le stock', () => {
    const town = testTown({ buildings: { comptoir: 1, chenil: 1 }, builtToday: true, stock: { 'blue-wolf': 4 } });
    let state = parkHero(start({ gold: 10_000, catalog: { ...MARKET, ...DWELLINGS }, towns: [town], gameConfig: configWithMarket }));
    state = produce(state, (draft) => {
      const wolf = draft.unitCatalog['blue-wolf'];
      if (wolf) (wolf as { recruitCost?: Record<string, number> }).recruitCost = { gold: 100, mercury: 1 };
    });
    const { next } = playAi(state);

    expect(next.towns[0]?.garrison).toContainEqual({ unitId: 'blue-wolf', count: 4 });
    expect(next.players[0]?.resources.mercury).toBe(0);
  });

  it('R2 : n’achète pas le mercure d’une recrue avec l’or réservé au bâtiment prioritaire, 1ʳᵉ pile comprise', () => {
    const catalog: Record<string, BuildingDef> = {
      ...MARKET,
      ...DWELLINGS,
      // 1000 or + 5 bois (250 or au marché) > 1100 : non achetable, son coût devient la réserve.
      beffroi: { id: 'beffroi', maxLevel: 1, levels: [{ cost: { gold: 1000, wood: 5 }, requires: [], effect: { type: 'income', resource: 'gold', amount: 500 } }] },
    };
    const town = testTown({ buildings: { comptoir: 1, caserne: 1, chenil: 1 }, stock: { 'blue-wolf': 4 } });
    let state = parkHero(start({ gold: 1100, catalog, towns: [town], gameConfig: configWithMarket }));
    state = produce(state, (draft) => {
      const wolf = draft.unitCatalog['blue-wolf'];
      if (wolf) (wolf as { recruitCost?: Record<string, number> }).recruitCost = { gold: 100, mercury: 1 };
    });
    const { next } = playAi(state);

    // Hors réserve, il reste 100 or : moins qu'un loup et son mercure (150).
    expect(next.towns[0]?.garrison).toEqual([]);
    expect(next.players[0]?.resources.gold).toBe(1100);
  });

  it('n’achète rien quand l’or ne couvre pas achats ET bâtiment (tout ou rien)', () => {
    const catalog: Record<string, BuildingDef> = {
      ...MARKET,
      beffroi: { id: 'beffroi', maxLevel: 1, levels: [{ cost: { gold: 500, wood: 5 }, requires: [], effect: { type: 'income', resource: 'gold', amount: 500 } }] },
    };
    const town = testTown({ buildings: { comptoir: 1 }, stock: {} });
    const { next } = playAi(parkHero(start({ gold: 700, catalog, towns: [town], gameConfig: configWithMarket })));

    expect(next.towns[0]?.buildings.beffroi).toBeUndefined();
    expect(next.players[0]?.resources.gold).toBe(700);
  });
});

describe('LE1/B2 — sans héros, la Taverne passe devant tout', () => {
  it('bâtit la Taverne plutôt qu’une habitation quand le joueur n’a plus de héros', () => {
    const catalog: Record<string, BuildingDef> = {
      auberge: { id: 'auberge', maxLevel: 1, levels: [{ cost: { gold: 500 }, requires: [], effect: { type: 'tavern' } }] },
      tour: { id: 'tour', maxLevel: 1, levels: [{ cost: { gold: 500 }, requires: [], effect: { type: 'dwelling', tier: 7, unitId: 'blue-wolf' } }] },
    };
    let state = start({ gold: 500, catalog, towns: [testTown({ buildings: {}, stock: {} })] });
    state = produce(state, (draft) => {
      draft.heroes = [];
    });
    const { next } = playAi(state);

    expect(next.towns[0]?.buildings.auberge).toBe(1);
    expect(next.towns[0]?.buildings.tour).toBeUndefined();
  });
});

describe('LE1/B2 — la ville d’un héros stationné joue avant lui', () => {
  it('le héros part avec les recrues du jour au lieu de les laisser en garnison', () => {
    // Couloir sous le brouillard : le héros quitte la ville pour explorer ; avant
    // LE1 il partait AVANT le recrutement et les recrues restaient en garnison.
    const town = testTown({ pos: { x: 1, y: 1 }, buildings: { caserne: 1 }, builtToday: true, stock: { 'red-grunt': 10 } });
    let state = start({ gold: 10_000, catalog: DWELLINGS, towns: [town], map: corridor() });
    state = produce(state, (draft) => {
      const hero = draft.heroes.find((h) => h.playerId === 'p1');
      if (!hero) throw new Error('héros absent');
      hero.pos = { ...town.pos };
    });
    const { next } = playAi(state);

    expect(next.heroes[0]?.pos).not.toEqual(town.pos); // il est bien parti
    expect(next.heroes[0]?.army).toContainEqual({ unitId: 'red-grunt', count: 10 });
    expect(next.towns[0]?.garrison).toEqual([]);
  });
});

/** p1 (IA) contre p2 (humain, sans héros) : p2 tient une ville voisine du héros de p1. */
function siegeState(garrison: TownState['garrison'], heroArmy: { unitId: string; count: number }[]): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), controller: 'ai' },
    { id: 'p2', startingResources: emptyResources(), controller: 'human' },
  ];
  const enemyTown = testTown({ id: 'town-2', ownerPlayerId: 'p2', pos: { x: 1, y: 1 }, buildings: {}, stock: {}, garrison });
  let state = start({ gold: 0, catalog: {}, towns: [enemyTown], players });
  state = produce(state, (draft) => {
    draft.heroes = draft.heroes.filter((h) => h.playerId === 'p1');
    const hero = draft.heroes[0];
    if (!hero) throw new Error('héros absent');
    hero.pos = { x: 0, y: 0 };
    hero.army = heroArmy;
  });
  return state;
}

describe('LE1/D-SIEGEAI — l’IA assiège une ville à garnison qu’elle domine', () => {
  it('garnison faible ⇒ siège (combat ouvert puis résolu)', () => {
    const { events } = playAi(siegeState([{ unitId: 'red-grunt', count: 1 }], [{ unitId: 'blue-wolf', count: 50 }]));
    expect(events).toContainEqual(expect.objectContaining({ type: 'CombatStarted', guardianObjectId: null }));
  });

  it('garnison forte ⇒ pas de siège suicidaire', () => {
    const { events } = playAi(siegeState([{ unitId: 'blue-wolf', count: 100 }], [{ unitId: 'red-grunt', count: 10 }]));
    expect(events.some((e) => e.type === 'CombatStarted')).toBe(false);
  });
});

/** Couloir d'herbe 40×3 : la ville du bout est à plusieurs jours du héros (1700 PM/j). */
function corridor(): AdventureMapDef {
  const width = 40;
  const height = 3;
  return {
    id: 'corridor',
    width,
    height,
    terrain: Array.from({ length: width * height }, () => 'grass'),
    road: Array.from({ length: width * height }, () => false),
    objects: [],
    triggers: [],
    startPositions: [{ x: 1, y: 1 }, { x: 38, y: 1 }],
  };
}

/** Rend `x ≥ from` exploré pour p1 (le reste reste sous le brouillard : l'exploration a de quoi faire). */
function exploreFrom(draft: GameState, from: number): void {
  const map = draft.map;
  const p1 = draft.players.find((p) => p.id === 'p1');
  if (!map || !p1) return;
  for (let y = 0; y < map.height; y++) for (let x = from; x < map.width; x++) p1.explored[y * map.width + x] = 1;
}

describe('LE1/B1 — un objectif à quelques jours passe avant l’exploration', () => {
  it('marche vers une ville adverse prenable à 2 jours au lieu d’explorer pas à pas', () => {
    const players: PlayerSetup[] = [
      { id: 'p1', startingResources: emptyResources(), controller: 'ai' },
      { id: 'p2', startingResources: emptyResources(), controller: 'human' },
    ];
    const enemyTown = testTown({ id: 'town-2', ownerPlayerId: 'p2', pos: { x: 30, y: 1 }, buildings: {}, stock: {} });
    let state = start({ gold: 0, catalog: {}, towns: [enemyTown], players, map: corridor() });
    state = produce(state, (draft) => {
      draft.heroes = draft.heroes.filter((h) => h.playerId === 'p1');
      const hero = draft.heroes[0];
      if (hero) hero.army = [{ unitId: 'blue-wolf', count: 20 }];
      exploreFrom(draft, 25);
    });
    const { next } = playAi(state);

    // Un pas d'exploration ferait x = 2 ; la marche consomme la journée (~16 cases).
    expect(next.heroes[0]?.pos.x).toBeGreaterThanOrEqual(12);
    expect(next.towns[0]?.ownerPlayerId).toBe('p2'); // pas encore au contact
  });

  it('une garnison au moins aussi forte que l’armée rappelle le héros avant le ramassage du jour', () => {
    const home = testTown({ pos: { x: 30, y: 1 }, buildings: {}, builtToday: true, stock: {}, garrison: [{ unitId: 'blue-wolf', count: 30 }] });
    const map = { ...corridor(), objects: [{ id: 'gold-near', type: 'resource' as const, pos: { x: 0, y: 1 }, resource: 'gold' as const, amount: 250 }] };
    let state = start({ gold: 0, catalog: {}, towns: [home], map });
    state = produce(state, (draft) => {
      const hero = draft.heroes[0];
      if (hero) hero.army = [{ unitId: 'red-grunt', count: 1 }];
      exploreFrom(draft, 0);
    });
    const { next } = playAi(state);

    expect(next.map?.objects.some((o) => o.id === 'gold-near')).toBe(true); // tas laissé
    expect(next.heroes[0]?.pos.x).toBeGreaterThanOrEqual(12); // en route vers la garnison
  });
});

describe('LE1/B2 — pas d’achat gaspillé', () => {
  it('n’achète pas le mercure d’une recrue quand la garnison est pleine (7 piles)', () => {
    const MARKET: Record<string, BuildingDef> = {
      comptoir: { id: 'comptoir', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'market' } }] },
    };
    const fullGarrison = Array.from({ length: 7 }, (_, i) => ({ unitId: `filler-${i}`, count: 1 }));
    const town = testTown({ buildings: { comptoir: 1, chenil: 1 }, builtToday: true, stock: { 'blue-wolf': 4 }, garrison: fullGarrison });
    let state = parkHero(start({ gold: 10_000, catalog: { ...MARKET, ...DWELLINGS }, towns: [town], gameConfig: configWithMarket }));
    state = produce(state, (draft) => {
      const wolf = draft.unitCatalog['blue-wolf'];
      if (wolf) (wolf as { recruitCost?: Record<string, number> }).recruitCost = { gold: 100, mercury: 1 };
    });
    const { next } = playAi(state);

    expect(next.players[0]?.resources.gold).toBe(10_000);
    expect(next.players[0]?.resources.mercury).toBe(0);
  });
});
