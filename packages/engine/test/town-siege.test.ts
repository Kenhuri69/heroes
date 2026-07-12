import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { runAutoCombat } from '../src/combat/ai';
import { staticBlockedKeys } from '../src/combat/state-helpers';
import { COMBAT_COLS, COMBAT_ROWS } from '../src/combat/hex';
import type { GameEvent } from '../src/core/events';
import type { ArmyStack } from '../src/combat/types';
import type { TownState } from '../src/town/types';
import { testConfig, testCatalog } from './fixtures';

/**
 * Sièges v1 (doc 02 §4.1, Alpha 4.13) : attaquer une ville **défendue** ouvre un
 * combat contre sa garnison (le Fort accorde un bonus de défense « murs ») ; la
 * victoire capture la ville, la défaite retire le héros et réécrit la garnison.
 */
function hero(army: ArmyStack[]): HeroState {
  return {
    id: 'hero-p1',
    playerId: 'p1',
    pos: { x: 5, y: 5 },
    movementPoints: 100,
    army,
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
    pendingAttributeChoices: [],
    factionId: '',
    houseId: '',
    houseEffects: [],
    name: '',
    specialtyId: '',
    specialtyEffects: [],
    warMachines: [],
    rosterId: '',
  };
}

function siegeState(army: ArmyStack[], garrison: ArmyStack[], buildings: Record<string, number> = {}): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(7);
  s.currentPlayer = 0;
  s.players = [
    { id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: -1, huntContract: null, team: 0 },
    { id: 'p2', resources: emptyResources(), factionResources: {}, explored: [], controller: 'ai', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
  ];
  s.heroes = [hero(army)];
  const town: TownState = { id: 't1', ownerPlayerId: 'p2', pos: { x: 5, y: 5 }, factionId: '', buildings, builtToday: false, garrison, stock: {}, spellPool: [], sharedGrowthChoice: {} };
  s.towns = [town];
  s.unitCatalog = testCatalog();
  return s;
}

describe('CaptureTown — ville défendue = siège', () => {
  it('démarre un combat contre la garnison, avec le bonus de mur du Fort', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 2 });
    const { state: next } = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' });
    expect(next.combat).not.toBeNull();
    expect(next.combat?.townId).toBe('t1');
    expect(next.combat?.wallDefenseBonus).toBe(6); // fort 2 × 3
    expect(next.combat?.stacks.some((st) => st.side === 'defender' && st.unitId === 'blue-wolf')).toBe(true);
  });

  it('victoire de l’assaillant : la ville change de main, garnison vidée', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 100 }], [{ unitId: 'blue-wolf', count: 1 }]);
    const events: GameEvent[] = [];
    const started = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    const done = produce(started, (d) => runAutoCombat(d, events));
    expect(done.combat).toBeNull();
    expect(done.towns[0]?.ownerPlayerId).toBe('p1');
    expect(done.towns[0]?.garrison).toEqual([]);
    expect(events.some((e) => e.type === 'TownCaptured' && e.playerId === 'p1')).toBe(true);
  });

  it('siège repoussé : héros retiré, garnison survivante réécrite', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 1 }], [{ unitId: 'blue-wolf', count: 100 }]);
    const events: GameEvent[] = [];
    const started = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    const done = produce(started, (d) => runAutoCombat(d, events));
    expect(done.combat).toBeNull();
    expect(done.heroes.find((h) => h.id === 'hero-p1')).toBeUndefined();
    expect(done.towns[0]?.ownerPlayerId).toBe('p2'); // conservée
    const g = done.towns[0]?.garrison;
    expect(g && g.length > 0 && g[0]?.count).toBeGreaterThan(0);
  });

  it('ville sans garnison : capture immédiate, aucun combat', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 1 }], []);
    const { state: next } = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' });
    expect(next.combat).toBeNull();
    expect(next.towns[0]?.ownerPlayerId).toBe('p1');
  });

  it('armée vide contre une ville défendue : refusé (invalidArmy)', () => {
    const s = siegeState([], [{ unitId: 'blue-wolf', count: 1 }]);
    expect(validate(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' })?.code).toBe('invalidArmy');
  });
});

describe('C-SIEGE2 — murs de siège', () => {
  const WALL_COL = COMBAT_COLS - 4;
  const GATE = [Math.floor(COMBAT_ROWS / 2) - 1, Math.floor(COMBAT_ROWS / 2)];

  it('un Fort dresse un rempart sur une colonne avec une porte centrale', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 2 });
    const { state: next } = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' });
    const walls = next.combat?.siegeWalls ?? [];
    expect(walls.length).toBe(COMBAT_ROWS - GATE.length); // toutes rangées sauf la porte
    expect(walls.every((w) => w.col === WALL_COL)).toBe(true);
    expect(walls.some((w) => GATE.includes(w.row))).toBe(false); // porte ouverte
  });

  it('sans Fort : aucun mur (siège v1 inchangé)', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }]);
    const { state: next } = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' });
    expect(next.combat?.siegeWalls).toBeUndefined();
  });

  it('staticBlockedKeys inclut les segments de mur, jamais la porte', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 1 });
    const { state: next } = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' });
    const blocked = staticBlockedKeys(next.combat!);
    expect(blocked.has(`${WALL_COL},0`)).toBe(true); // segment de mur
    expect(blocked.has(`${WALL_COL},${GATE[0]}`)).toBe(false); // porte franchissable
  });

  it('un assaillant fort capture malgré le rempart (porte franchissable, pas de stalemate)', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 100 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 3 });
    const events: GameEvent[] = [];
    const started = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    expect((started.combat?.siegeWalls ?? []).length).toBeGreaterThan(0);
    const done = produce(started, (d) => runAutoCombat(d, events));
    expect(done.combat).toBeNull(); // le combat se termine (pas de blocage)
    expect(done.towns[0]?.ownerPlayerId).toBe('p1');
  });
});
