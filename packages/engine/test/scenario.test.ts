import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { ScenarioState, VictoryCondition } from '../src/scenario/types';
import { conditionMet } from '../src/scenario/outcome';
import { testConfig, testMap } from './fixtures';

/**
 * Fixtures propres au lot R (conditions de victoire/défaite) — deux joueurs,
 * `player-1` (humain, joueur local) et `player-2`, sans carte réelle de
 * scénario (les scénarios de contenu arrivent au lot T) : `scenario` posé
 * directement dans la commande `StartGame`.
 */
function setup(controllers: Record<string, 'human' | 'ai'> = {}): PlayerSetup[] {
  return ['player-1', 'player-2'].map((id) => {
    const controller = controllers[id];
    return controller
      ? { id, startingResources: emptyResources(), controller }
      : { id, startingResources: emptyResources() };
  });
}

function startCmd(scenario?: ScenarioState, controllers?: Record<string, 'human' | 'ai'>): Command {
  const base = {
    type: 'StartGame' as const,
    seed: 1,
    players: setup(controllers),
    map: testMap(),
    config: testConfig(),
    unitCatalog: {},
    buildingCatalog: {},
    towns: [],
  };
  return scenario ? { ...base, scenario } : base;
}

function objectives(victory: VictoryCondition, defeat: VictoryCondition): ScenarioState {
  return { objectives: { 'player-1': { victory, defeat }, 'player-2': { victory, defeat } } };
}

function startedGame(scenario?: ScenarioState): GameState {
  return apply(createEmptyState(), startCmd(scenario)).state;
}

describe('evaluateOutcome — partie libre (scenario null)', () => {
  it("n'évalue rien : pas d'outcome, pas d'event de fin de partie", () => {
    const state = startedGame();
    const { state: next, events } = apply(state, { type: 'EndTurn', playerId: 'player-1' });
    expect(next.outcome).toBeNull();
    expect(events.some((e) => e.type === 'GameEnded' || e.type === 'PlayerEliminated')).toBe(false);
  });
});

describe('conditionMet', () => {
  it('eliminateAllEnemies : vrai si tous les autres joueurs sont éliminés', () => {
    const state = startedGame();
    expect(conditionMet(state, 'player-1', { type: 'eliminateAllEnemies' })).toBe(false);
    const eliminated: GameState = {
      ...state,
      players: state.players.map((p) => (p.id === 'player-2' ? { ...p, eliminated: true } : p)),
    };
    expect(conditionMet(eliminated, 'player-1', { type: 'eliminateAllEnemies' })).toBe(true);
  });

  it('captureTown : vrai si le joueur possède la ville visée', () => {
    const state = startedGame();
    const withTown: GameState = {
      ...state,
      towns: [
        {
          id: 'town-1',
          ownerPlayerId: 'player-1',
          pos: { x: 0, y: 0 },
          factionId: '',
          buildings: {},
          builtToday: false,
          garrison: [],
          stock: {},
          spellPool: [],
        },
      ],
    };
    expect(conditionMet(withTown, 'player-1', { type: 'captureTown', townId: 'town-1' })).toBe(true);
    expect(conditionMet(withTown, 'player-2', { type: 'captureTown', townId: 'town-1' })).toBe(false);
    expect(conditionMet(state, 'player-1', { type: 'captureTown', townId: 'town-1' })).toBe(false);
  });

  it("defeatHero : vrai si le héros visé n'existe plus", () => {
    const state = startedGame();
    const heroId = state.heroes[0]?.id ?? '';
    expect(conditionMet(state, 'player-1', { type: 'defeatHero', heroId })).toBe(false);
    const withoutHero: GameState = { ...state, heroes: [] };
    expect(conditionMet(withoutHero, 'player-1', { type: 'defeatHero', heroId })).toBe(true);
  });

  it('surviveDays : vrai à partir du jour visé', () => {
    const state = startedGame();
    expect(conditionMet(state, 'player-1', { type: 'surviveDays', days: 5 })).toBe(false);
    const day5: GameState = { ...state, calendar: { day: 5 } };
    expect(conditionMet(day5, 'player-1', { type: 'surviveDays', days: 5 })).toBe(true);
  });
});

describe('evaluateOutcome — victoire/défaite (joueur local player-1)', () => {
  it('victoire surviveDays : outcome won + GameEnded une fois le jour atteint', () => {
    let state = startedGame(objectives({ type: 'surviveDays', days: 2 }, { type: 'surviveDays', days: 999 }));
    let last = apply(state, { type: 'EndTurn', playerId: 'player-1' });
    state = last.state;
    expect(state.outcome).toBeNull();
    last = apply(state, { type: 'EndTurn', playerId: 'player-2' }); // bascule jour 2
    state = last.state;
    expect(state.outcome).toEqual({ status: 'won', winnerPlayerId: 'player-1' });
    expect(last.events).toContainEqual({ type: 'GameEnded', status: 'won', winnerPlayerId: 'player-1' });
  });

  it('défaite surviveDays : outcome lost + adversaire vivant comme gagnant', () => {
    let state = startedGame(objectives({ type: 'surviveDays', days: 999 }, { type: 'surviveDays', days: 2 }));
    state = apply(state, { type: 'EndTurn', playerId: 'player-1' }).state;
    const last = apply(state, { type: 'EndTurn', playerId: 'player-2' }); // bascule jour 2
    state = last.state;
    expect(state.outcome).toEqual({ status: 'lost', winnerPlayerId: 'player-2' });
    expect(last.events).toContainEqual({ type: 'GameEnded', status: 'lost', winnerPlayerId: 'player-2' });
  });

  it('captureTown : victoire quand le joueur local capture la ville visée', () => {
    const scenario = objectives({ type: 'captureTown', townId: 'town-1' }, { type: 'surviveDays', days: 999 });
    const cmd = startCmd(scenario);
    if (cmd.type !== 'StartGame') throw new Error('unreachable');
    cmd.towns = [
      {
        id: 'town-1',
        ownerPlayerId: null,
        pos: { x: 0, y: 0 },
        factionId: '',
        buildings: {},
        builtToday: false,
        garrison: [],
        stock: {},
        spellPool: [],
      },
    ];
    const state = apply(createEmptyState(), cmd).state;
    const { state: next, events } = apply(state, {
      type: 'CaptureTown',
      townId: 'town-1',
      playerId: 'player-1',
    });
    expect(next.outcome).toEqual({ status: 'won', winnerPlayerId: 'player-1' });
    expect(events).toContainEqual({ type: 'GameEnded', status: 'won', winnerPlayerId: 'player-1' });
  });

  it('defeatHero : défaite quand le héros du joueur local disparaît (et il est éliminé sans ville)', () => {
    const scenario = objectives({ type: 'surviveDays', days: 999 }, { type: 'defeatHero', heroId: 'hero-player-1' });
    let state = startedGame(scenario);
    // Simule la disparition du héros local (perte en combat) sans passer par
    // le moteur de combat — hors périmètre de ce test tabulaire.
    state = { ...state, heroes: state.heroes.filter((h) => h.playerId !== 'player-1') };
    const { state: next, events } = apply(state, { type: 'EndTurn', playerId: 'player-1' });
    expect(next.players.find((p) => p.id === 'player-1')?.eliminated).toBe(true);
    expect(events).toContainEqual({ type: 'PlayerEliminated', playerId: 'player-1' });
    expect(next.outcome).toEqual({ status: 'lost', winnerPlayerId: 'player-2' });
    expect(events).toContainEqual({ type: 'GameEnded', status: 'lost', winnerPlayerId: 'player-2' });
  });

  it('eliminateAllEnemies : victoire locale quand tous les adversaires sont éliminés', () => {
    const scenario = objectives({ type: 'eliminateAllEnemies' }, { type: 'surviveDays', days: 999 });
    let state = startedGame(scenario);
    state = { ...state, heroes: state.heroes.filter((h) => h.playerId !== 'player-2') };
    const { state: next, events } = apply(state, { type: 'EndTurn', playerId: 'player-1' });
    expect(next.players.find((p) => p.id === 'player-2')?.eliminated).toBe(true);
    expect(next.outcome).toEqual({ status: 'won', winnerPlayerId: 'player-1' });
    expect(events).toContainEqual({ type: 'GameEnded', status: 'won', winnerPlayerId: 'player-1' });
  });

  it('A10 — un joueur IA qui remplit SON objectif de victoire fait perdre le joueur local', () => {
    // player-1 (local) : victoire captureTown('town-ai') — jamais atteinte ;
    // player-2 (IA) : victoire captureTown('start-town'). Le local GARDE une autre
    // ville (`keep`) : il n'est donc PAS éliminé — seule la victoire « par joueur »
    // de l'IA (doc 02 §6, A10) explique la défaite locale.
    const scenario: ScenarioState = {
      objectives: {
        'player-1': { victory: { type: 'captureTown', townId: 'town-ai' }, defeat: { type: 'surviveDays', days: 999 } },
        'player-2': { victory: { type: 'captureTown', townId: 'start-town' }, defeat: { type: 'surviveDays', days: 999 } },
      },
    };
    const cmd = startCmd(scenario, { 'player-1': 'human', 'player-2': 'ai' });
    if (cmd.type !== 'StartGame') throw new Error('unreachable');
    const town = (id: string, owner: string) => ({ id, ownerPlayerId: owner, pos: { x: 0, y: 0 }, factionId: '', buildings: {}, builtToday: false, garrison: [], stock: {}, spellPool: [] });
    cmd.towns = [town('start-town', 'player-2'), town('keep', 'player-1')]; // l'IA a déjà pris start-town
    const state = apply(createEmptyState(), cmd).state;
    const { state: next, events } = apply(state, { type: 'EndTurn', playerId: 'player-1' });
    expect(next.players.find((p) => p.id === 'player-1')?.eliminated).toBe(false); // garde `keep`
    expect(next.outcome).toEqual({ status: 'lost', winnerPlayerId: 'player-2' });
    expect(events).toContainEqual({ type: 'GameEnded', status: 'lost', winnerPlayerId: 'player-2' });
  });

  it('B3 — le héros d’un joueur éliminé (grâce dépassée) est retiré de l’état', () => {
    const scenario = objectives({ type: 'surviveDays', days: 999 }, { type: 'surviveDays', days: 999 });
    let state = startedGame(scenario);
    expect(state.heroes.some((h) => h.playerId === 'player-1')).toBe(true);
    // player-1 : héros présent, aucune ville, grâce de reprise dépassée (> 7 jours).
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 'player-1' ? { ...p, townlessDays: 8 } : p)),
      towns: [],
    };
    const { state: next, events } = apply(state, { type: 'EndTurn', playerId: 'player-1' });
    expect(next.players.find((p) => p.id === 'player-1')?.eliminated).toBe(true);
    expect(events).toContainEqual({ type: 'PlayerEliminated', playerId: 'player-1' });
    // B3 : plus aucun héros du joueur éliminé (ni obstacle, ni rapporteur d'or).
    expect(next.heroes.some((h) => h.playerId === 'player-1')).toBe(false);
  });

  it("GameEnded n'est émis qu'une seule fois (outcome déjà posé ⇒ no-op)", () => {
    const scenario = objectives({ type: 'surviveDays', days: 1 }, { type: 'surviveDays', days: 999 });
    let state = startedGame(scenario);
    state = apply(state, { type: 'EndTurn', playerId: 'player-1' }).state;
    expect(state.outcome).toEqual({ status: 'won', winnerPlayerId: 'player-1' });
    // Un StartGame refusé (déjà démarré) ne rejoue rien ; on force un second
    // passage direct par evaluateOutcome via un nouvel EndTurn : la commande
    // est de toute façon rejetée (gameOver) — voir bloc ci-dessous.
    const err = validate(state, { type: 'EndTurn', playerId: 'player-2' });
    expect(err?.code).toBe('gameOver');
  });
});

describe('commandes refusées après fin de partie (gameOver)', () => {
  it('refuse les commandes de jeu une fois `outcome` posé, StartGame reste possible', () => {
    const scenario = objectives({ type: 'surviveDays', days: 1 }, { type: 'surviveDays', days: 999 });
    const state = apply(startedGame(scenario), { type: 'EndTurn', playerId: 'player-1' }).state;
    expect(state.outcome).not.toBeNull();
    const blocked: Command[] = [
      { type: 'MoveHero', heroId: 'hero-player-1', path: [{ x: 1, y: 0 }] },
      { type: 'EndTurn', playerId: 'player-2' },
      { type: 'StartCombat', attacker: [], defender: [], terrain: 'grass' },
      { type: 'CombatAction', action: { type: 'wait' } },
      { type: 'AutoCombat' },
      { type: 'BuildStructure', townId: 'town-1', buildingId: 'townHall' },
      { type: 'RecruitUnits', townId: 'town-1', unitId: 'red-grunt', count: 1 },
      {
        type: 'GarrisonTransfer',
        townId: 'town-1',
        heroId: 'hero-player-1',
        from: 'hero',
        slot: 0,
      },
      { type: 'CaptureTown', townId: 'town-1', playerId: 'player-1' },
      { type: 'CastSpell', spellId: 'firebolt', targetStackId: 'x' },
      { type: 'ChooseSkill', heroId: 'hero-player-1', skillId: 'logistics' },
    ];
    for (const cmd of blocked) {
      expect(validate(state, cmd)?.code).toBe('gameOver');
    }
    // StartGame reste autorisé (nouvelle partie) — l'erreur, si présente,
    // n'est jamais `gameOver` (ici : `gameAlreadyStarted`, attendu sur cet état démarré).
    expect(validate(state, startCmd())?.code).toBe('gameAlreadyStarted');
  });
});
