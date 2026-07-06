import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { BuildingDef } from '../src/town/types';
import type { CombatUnitDef } from '../src/combat/types';
import { beginGuardianCombat } from '../src/combat/setup';
import { runAutoCombat } from '../src/combat/ai';
import type { AdventureMapDef } from '../src/adventure/map';
import { testConfig, testCatalog } from './fixtures';

/**
 * Machines de guerre (doc 02 §5, Alpha 4.12) : achetées à la Forge
 * (`warMachineVendor`), elles rejoignent le camp du héros en combat comme piles
 * supplémentaires (hors cap 7) et ne sont jamais absorbées dans l'armée.
 */
const BALLISTA: CombatUnitDef = {
  id: 'ballista',
  groupId: 'war-machine',
  nativeTerrain: '',
  stats: { hp: 250, attack: 12, defense: 10, damage: [10, 20], speed: 1 },
  abilities: [{ id: 'shooter', params: { ammo: 24 } }],
  recruitCost: { gold: 1500 },
} as CombatUnitDef;

const FORGE: BuildingDef = {
  id: 'forge',
  maxLevel: 1,
  levels: [{ cost: {}, requires: [], effect: { type: 'warMachineVendor', units: ['ballista'] } }],
};

function heroAt(pos: { x: number; y: number }, warMachines: string[] = []): HeroState {
  return {
    id: 'hero-p1',
    playerId: 'p1',
    pos,
    movementPoints: 100,
    army: [{ unitId: 'red-grunt', count: 20 }],
    xp: 0,
    level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0,
    manaMax: 0,
    skills: {},
    visitLuck: 0,
    spells: [],
    artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [],
    factionId: '',
    warMachines,
  };
}

function stateWithForge(gold = 2000, heroPos = { x: 5, y: 5 }): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(7); // RNG seedé — sinon les jets de combat sont dégénérés
  s.currentPlayer = 0;
  s.players = [
    {
      id: 'p1',
      resources: { ...emptyResources(), gold },
      factionResources: {},
      explored: [],
      controller: 'human',
      eliminated: false,
      townlessDays: 0,
      huntContract: null,
    },
  ];
  s.heroes = [heroAt(heroPos)];
  s.towns = [
    { id: 't1', ownerPlayerId: 'p1', pos: { x: 5, y: 5 }, factionId: '', buildings: { forge: 1 }, builtToday: false, garrison: [], stock: {} },
  ];
  s.buildingCatalog = { forge: FORGE };
  s.unitCatalog = { ...testCatalog(), ballista: BALLISTA };
  return s;
}

describe('BuyWarMachine', () => {
  it('achète la machine pour le héros présent, débite le coût, émet WarMachineBought', () => {
    const s = stateWithForge(2000);
    const { state: next, events } = apply(s, { type: 'BuyWarMachine', townId: 't1', unitId: 'ballista' });
    expect(next.heroes[0]?.warMachines).toEqual(['ballista']);
    expect(next.players[0]?.resources.gold).toBe(2000 - 1500);
    expect(events).toContainEqual({ type: 'WarMachineBought', townId: 't1', heroId: 'hero-p1', unitId: 'ballista' });
  });

  it('rejette sans héros présent (warMachineUnavailable)', () => {
    const s = stateWithForge(2000, { x: 0, y: 0 }); // héros ailleurs
    expect(validate(s, { type: 'BuyWarMachine', townId: 't1', unitId: 'ballista' })?.code).toBe('warMachineUnavailable');
  });

  it('rejette une machine non vendue (warMachineUnavailable)', () => {
    const s = stateWithForge(2000);
    expect(validate(s, { type: 'BuyWarMachine', townId: 't1', unitId: 'red-grunt' })?.code).toBe('warMachineUnavailable');
  });

  it('rejette si déjà possédée (warMachineUnavailable)', () => {
    const s = stateWithForge(2000);
    s.heroes[0]!.warMachines = ['ballista'];
    expect(validate(s, { type: 'BuyWarMachine', townId: 't1', unitId: 'ballista' })?.code).toBe('warMachineUnavailable');
  });

  it('rejette si les ressources manquent (cannotAfford)', () => {
    const s = stateWithForge(100);
    expect(validate(s, { type: 'BuyWarMachine', townId: 't1', unitId: 'ballista' })?.code).toBe('cannotAfford');
  });
});

describe('machine de guerre en combat', () => {
  function mapWithGuardian(): AdventureMapDef {
    return {
      id: 'm',
      width: 6,
      height: 6,
      terrain: Array<string>(36).fill('grass'),
      road: Array<boolean>(36).fill(false),
      triggers: [],
      objects: [{ id: 'g1', type: 'guardian', pos: { x: 1, y: 0 }, unitId: 'blue-wolf', count: 1 }],
      startPositions: [{ x: 0, y: 0 }],
    };
  }

  it('rejoint le camp du héros comme pile supplémentaire, et n’est pas absorbée dans l’armée après victoire', () => {
    const s = stateWithForge(0);
    s.map = mapWithGuardian();
    s.heroes = [heroAt({ x: 0, y: 0 }, ['ballista'])]; // armée 20 grunts + 1 baliste
    s.unitCatalog = { ...testCatalog(), ballista: BALLISTA };

    const events: import('../src/core/events').GameEvent[] = [];
    const withCombat = produce(s, (draft) => {
      beginGuardianCombat(draft, 'hero-p1', 'g1', events);
    });
    // La baliste est bien une pile attaquante.
    expect(
      withCombat.combat?.stacks.some((st) => st.side === 'attacker' && st.unitId === 'ballista'),
    ).toBe(true);

    // Résout le combat : victoire large ; la baliste reste sur `warMachines`,
    // JAMAIS dans l'armée reconstruite.
    const done = produce(withCombat, (draft) => {
      runAutoCombat(draft, events);
    });
    const hero = done.heroes.find((h) => h.id === 'hero-p1');
    expect(hero?.warMachines).toEqual(['ballista']);
    expect(hero?.army.some((st) => st.unitId === 'ballista')).toBe(false);
  });
});
