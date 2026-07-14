import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { runAutoCombat } from '../src/combat/ai';
import { reachableHexes } from '../src/combat/actions';
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
    visitMorale: 0,
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

  it('C-SIEGE2.3 : une ville bien fortifiée (Fort ≥ 2) creuse une douve devant le rempart', () => {
    const noMoat = apply(
      siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 1 }),
      { type: 'CaptureTown', townId: 't1', playerId: 'p1' },
    ).state;
    expect(noMoat.combat?.moat).toBeUndefined(); // Fort 1 : murs seuls

    const withMoat = apply(
      siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 2 }),
      { type: 'CaptureTown', townId: 't1', playerId: 'p1' },
    ).state;
    const moat = withMoat.combat?.moat ?? [];
    expect(moat.length).toBe(COMBAT_ROWS); // colonne pleine
    expect(moat.every((m) => m.col === WALL_COL - 1)).toBe(true); // juste devant le mur
  });

  it('C-SIEGE2.3 : une douve est atteignable mais infranchissable en un déplacement', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 2 });
    const next = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    const combat = next.combat!;
    // Attaquant devant la douve sur la RANGÉE DE LA PORTE (le mur y est ouvert,
    // isolant l'effet de la douve du blocage de mur), vitesse large : il peut
    // ENTRER dans la douve mais pas la traverser jusqu'au-delà du rempart.
    const attacker = combat.stacks.find((st) => st.side === 'attacker')!;
    // Isolation : on ne garde que l'attaquant (l'IA défenseuse a pu occuper la
    // douve) et on efface les obstacles aléatoires — seule la douve doit peser.
    const moved = produce(next, (d) => {
      d.combat!.obstacles = [];
      d.combat!.stacks = d.combat!.stacks.filter((st) => st.id === attacker.id);
      d.combat!.stacks[0]!.pos = { col: WALL_COL - 2, row: GATE[0]! };
      d.combat!.activeStackId = attacker.id;
    });
    const reach = reachableHexes(moved, attacker.id);
    const gateRow = (p: { col: number; row: number }): boolean => p.row === GATE[0]!;
    // Peut entrer dans la douve (col WALL-1) sur la rangée de la porte…
    expect(reach.some((p) => p.col === WALL_COL - 1 && gateRow(p))).toBe(true);
    // …mais ne franchit pas la douve ce tour-ci : la porte elle-même (col WALL)
    // et l'au-delà restent inatteignables (il faut d'abord s'arrêter dans la douve).
    expect(reach.some((p) => p.col >= WALL_COL && gateRow(p))).toBe(false);
  });

  it('C-SIEGE2.3 : un assaillant fort capture malgré la douve (franchie en un tour, pas de stalemate)', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 100 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 2 });
    const events: GameEvent[] = [];
    const started = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    expect((started.combat?.moat ?? []).length).toBeGreaterThan(0);
    const done = produce(started, (d) => runAutoCombat(d, events));
    expect(done.combat).toBeNull();
    expect(done.towns[0]?.ownerPlayerId).toBe('p1');
  });

  it('C-SIEGE2.4 : s’arrêter dans la douve d’un Fort ≥ 2 inflige des dégâts (MoatDamaged)', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 2 });
    const next = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    const combat = next.combat!;
    expect(combat.moatDamage).toBe(40); // Fort 2 × 20
    const attacker = combat.stacks.find((st) => st.side === 'attacker')!;
    const defender = combat.stacks.find((st) => st.side === 'defender')!;
    // Isolation : attaquant devant la douve sur la rangée de la porte, défenseur
    // relégué au fond (le combat ne se termine pas), obstacles effacés.
    const ready = produce(next, (d) => {
      d.combat!.obstacles = [];
      d.combat!.stacks = d.combat!.stacks.filter((st) => st.id === attacker.id || st.id === defender.id);
      d.combat!.stacks.find((st) => st.id === attacker.id)!.pos = { col: WALL_COL - 2, row: GATE[0]! };
      d.combat!.stacks.find((st) => st.id === defender.id)!.pos = { col: COMBAT_COLS - 1, row: 0 };
      d.combat!.activeStackId = attacker.id;
      d.combat!.phase = 'battle';
    });
    const { events } = apply(ready, { type: 'CombatAction', action: { type: 'move', to: { col: WALL_COL - 1, row: GATE[0]! } } });
    // La douve mord l'assaillant qui s'y arrête : StackMoved dans la douve, puis
    // MoatDamaged (dégâts = échelle Fort, au moins une créature perdue).
    const moatEvent = events.find((e) => e.type === 'MoatDamaged');
    expect(moatEvent).toBeDefined();
    expect(moatEvent).toMatchObject({ stackId: attacker.id, damage: 40 });
    expect((moatEvent as { kills: number }).kills).toBeGreaterThan(0); // red-grunt 6 PV
  });

  it('C-SIEGE2.4 : sans Fort ≥ 2, aucun dégât de douve', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 1 });
    const next = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    expect(next.combat?.moatDamage).toBeUndefined();
  });

  it('C-SIEGE2.4 : la douve épargne le défenseur (il vit derrière son rempart)', () => {
    // Un seul loup défenseur avancé jusqu'à la douve : s'il subissait les dégâts,
    // il mourrait et le combat s'achèverait à l'ouverture — or la garnison tient.
    const s = siegeState([{ unitId: 'red-grunt', count: 1 }], [{ unitId: 'blue-wolf', count: 100 }], { fort: 3 });
    const next = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    const defender = next.combat!.stacks.find((st) => st.side === 'defender')!;
    const moved = produce(next, (d) => {
      d.combat!.obstacles = [];
      d.combat!.stacks = d.combat!.stacks.filter((st) => st.id === defender.id);
      d.combat!.stacks[0]!.pos = { col: WALL_COL - 1, row: GATE[0]! }; // sur la douve
      d.combat!.activeStackId = defender.id;
      d.combat!.playerSide = 'defender'; // on pilote le défenseur pour le tester
      d.combat!.phase = 'battle';
    });
    const { events } = apply(moved, { type: 'CombatAction', action: { type: 'move', to: { col: WALL_COL - 1, row: GATE[1]! } } });
    expect(events.some((e) => e.type === 'MoatDamaged')).toBe(false); // défenseur épargné
  });

  // C-SIEGE2.5 : la tour de tir vit dans les données `war-machines.json` (absente
  // du catalogue de test) — on l'injecte pour les sièges Fort ≥ 3.
  const withTower = (s: GameState): GameState => {
    s.unitCatalog = {
      ...s.unitCatalog,
      'arrow-tower': {
        id: 'arrow-tower', groupId: 'war-machine', nativeTerrain: '',
        stats: { hp: 400, attack: 12, defense: 12, damage: [10, 20], speed: 1 },
        abilities: [{ id: 'shooter', params: { ammo: 999, noMeleePenalty: true } }, { id: 'warMachine' }, { id: 'immobile' }],
      },
    };
    return s;
  };

  it('C-SIEGE2.5 : une ville Fort ≥ 3 défend avec une tour de tir immobile derrière la porte', () => {
    const s = withTower(siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 3 }));
    const next = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    const tower = next.combat!.stacks.find((st) => st.id === 'defender-tower');
    expect(tower).toBeDefined();
    expect(tower!.side).toBe('defender');
    expect(tower!.pos).toEqual({ col: WALL_COL + 1, row: GATE[0]! }); // derrière la porte
    expect(tower!.ammo).toBeGreaterThan(0); // tireuse
    // Immobile (vitesse 0) : aucun hex atteignable.
    expect(reachableHexes(next, 'defender-tower')).toHaveLength(0);
  });

  it('C-SIEGE2.5 : sans Fort ≥ 3, aucune tour', () => {
    const s = withTower(siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 2 }));
    const next = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    expect(next.combat!.stacks.some((st) => st.id === 'defender-tower')).toBe(false);
  });

  it('C-SIEGE2.5 : un assaillant fort capture malgré la tour (atteignable, pas de stalemate)', () => {
    const s = withTower(siegeState([{ unitId: 'red-grunt', count: 100 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 3 }));
    const events: GameEvent[] = [];
    const started = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    expect(started.combat!.stacks.some((st) => st.id === 'defender-tower')).toBe(true);
    const done = produce(started, (d) => runAutoCombat(d, events));
    expect(done.combat).toBeNull(); // le combat se termine (la tour est tuable)
    expect(done.towns[0]?.ownerPlayerId).toBe('p1');
  });

  it('C-SIEGE2.7a : un Château (Fort ≥ 3) à garnison vide se défend par sa seule tour', () => {
    const s = withTower(siegeState([{ unitId: 'red-grunt', count: 100 }], [], { fort: 3 }));
    const events: GameEvent[] = [];
    const started = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    // Siège ouvert malgré la garnison vide : la tour seule défend.
    expect(started.combat).not.toBeNull();
    const defenders = started.combat!.stacks.filter((st) => st.side === 'defender');
    expect(defenders).toHaveLength(1);
    expect(defenders[0]!.id).toBe('defender-tower');
    // Puis l'assaillant détruit la tour et capture (pas de stalemate).
    const done = produce(started, (d) => runAutoCombat(d, events));
    expect(done.combat).toBeNull();
    expect(done.towns[0]?.ownerPlayerId).toBe('p1');
  });

  it('C-SIEGE2.7a : un héros sans armée ne prend pas un Château tour-défendu (invalidArmy)', () => {
    const s = withTower(siegeState([], [], { fort: 3 }));
    expect(validate(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' })?.code).toBe('invalidArmy');
  });

  it('C-SIEGE2.7a : sans tour (Fort < 3), une garnison vide reste une capture immédiate', () => {
    const s = withTower(siegeState([{ unitId: 'red-grunt', count: 1 }], [], { fort: 2 }));
    const next = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    expect(next.combat).toBeNull(); // aucun combat
    expect(next.towns[0]?.ownerPlayerId).toBe('p1');
  });

  it('C-SIEGE2.2 : une catapulte (siegeBreaker) élargit la brèche du rempart', () => {
    const s = siegeState([{ unitId: 'red-grunt', count: 50 }], [{ unitId: 'blue-wolf', count: 1 }], { fort: 2 });
    s.heroes[0]!.warMachines = ['siege-cat'];
    s.unitCatalog = {
      ...s.unitCatalog,
      'siege-cat': {
        id: 'siege-cat', groupId: 'wm', nativeTerrain: 'grass',
        stats: { hp: 300, attack: 8, defense: 10, damage: [8, 15], speed: 1 },
        abilities: [{ id: 'warMachine' }, { id: 'siegeBreaker' }],
      },
    };
    const { state: next } = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' });
    const walls = next.combat?.siegeWalls ?? [];
    // Brèche : la porte est élargie ⇒ 2 segments de moins que le rempart plein.
    expect(walls.length).toBe(COMBAT_ROWS - GATE.length - 2);
    expect(walls.some((w) => w.row === GATE[0]! - 1 || w.row === GATE[1]! + 1)).toBe(false);
    // La catapulte rejoint bien le camp attaquant (machine de guerre).
    expect(next.combat?.stacks.some((st) => st.side === 'attacker' && st.unitId === 'siege-cat')).toBe(true);
  });

  // C-SIEGE2.6 : catapulte assaillante embarquée + son catalogue.
  const withCatapult = (s: GameState): GameState => {
    s.heroes[0]!.warMachines = ['siege-cat'];
    s.unitCatalog = {
      ...s.unitCatalog,
      'siege-cat': {
        id: 'siege-cat', groupId: 'wm', nativeTerrain: 'grass',
        stats: { hp: 300, attack: 8, defense: 10, damage: [8, 15], speed: 1 },
        abilities: [{ id: 'warMachine' }, { id: 'siegeBreaker' }],
      },
    };
    return s;
  };

  it('C-SIEGE2.6 : une catapulte dote les segments de PV (siegeWallHp) ; sans catapulte, aucun', () => {
    const withCat = apply(
      withCatapult(siegeState([{ unitId: 'red-grunt', count: 30 }], [{ unitId: 'blue-wolf', count: 30 }], { fort: 2 })),
      { type: 'CaptureTown', townId: 't1', playerId: 'p1' },
    ).state;
    const hp = withCat.combat!.siegeWallHp!;
    expect(hp).toBeDefined();
    // Un PV par segment restant (après la brèche de montage).
    expect(Object.keys(hp).length).toBe(withCat.combat!.siegeWalls!.length);
    expect(Object.values(hp).every((v) => v > 0)).toBe(true);

    const noCat = apply(
      siegeState([{ unitId: 'red-grunt', count: 30 }], [{ unitId: 'blue-wolf', count: 30 }], { fort: 2 }),
      { type: 'CaptureTown', townId: 't1', playerId: 'p1' },
    ).state;
    expect(noCat.combat!.siegeWallHp).toBeUndefined(); // murs indestructibles
  });

  it('C-SIEGE2.6 : la catapulte érode le rempart round après round (segment détruit)', () => {
    // Combat qui dure : l'assaillant tient assez longtemps pour que la catapulte
    // ouvre au moins un segment (30 PV ÷ dégâts 8-15 ⇒ ~2-3 tirs).
    const s = withCatapult(siegeState([{ unitId: 'red-grunt', count: 60 }], [{ unitId: 'blue-wolf', count: 40 }], { fort: 2 }));
    const events: GameEvent[] = [];
    const started = apply(s, { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    const wallsAtStart = started.combat!.siegeWalls!.length;
    produce(started, (d) => runAutoCombat(d, events));
    const bombardments = events.filter((e) => e.type === 'WallBombarded');
    expect(bombardments.length).toBeGreaterThan(0); // la catapulte a tiré
    expect(bombardments.some((e) => (e as { destroyed: boolean }).destroyed)).toBe(true); // ≥ 1 segment ouvert
    // Autant de destructions que de segments retirés du rempart initial.
    const destroyed = bombardments.filter((e) => (e as { destroyed: boolean }).destroyed).length;
    expect(destroyed).toBeLessThanOrEqual(wallsAtStart);
  });
});