import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { EngineError, type Command, type PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, humanPlayerId, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';

function setup(ids: string[]): PlayerSetup[] {
  return ids.map((id) => ({ id, startingResources: { ...emptyResources(), gold: 1000 } }));
}

function startCmd(ids: string[], seed = 42): Command {
  return {
    type: 'StartGame',
    seed,
    players: setup(ids),
    map: testMap(),
    config: testConfig(),
    unitCatalog: {},
    buildingCatalog: {},
    towns: [],
  };
}

function startedGame(ids: string[] = ['p1', 'p2']): GameState {
  return apply(createEmptyState(), startCmd(ids)).state;
}

describe('StartGame', () => {
  it('initialise joueurs, RNG seedé, jour 1', () => {
    const { state, events } = apply(createEmptyState(), startCmd(['p1', 'p2']));
    expect(state.started).toBe(true);
    expect(state.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(state.players[0]?.resources.gold).toBe(1000);
    expect(state.calendar.day).toBe(1);
    expect(state.rng).not.toEqual(createEmptyState().rng);
    expect(events.map((e) => e.type)).toEqual(['GameStarted', 'DayStarted', 'WeekStarted']);
  });

  it('refuse un double démarrage et les setups invalides', () => {
    const started = startedGame();
    expect(validate(started, startCmd(['x'], 1))?.code).toBe('gameAlreadyStarted');
    expect(validate(createEmptyState(), startCmd([], 1))?.code).toBe('noPlayers');
    expect(validate(createEmptyState(), startCmd(['a', 'a'], 1))?.code).toBe('duplicatePlayerId');
  });
});

describe('humanPlayerId (remédiation R3/CL5)', () => {
  it('dérive du contrôleur, pas d’une convention « player-1 »', () => {
    const cmd = startCmd(['red', 'blue']);
    if (cmd.type !== 'StartGame') throw new Error('unreachable');
    // Ordre inversé + humain nommé 'blue' (≠ player-1, ≠ premier joueur).
    cmd.players = [
      { id: 'red', startingResources: emptyResources(), controller: 'ai' },
      { id: 'blue', startingResources: emptyResources(), controller: 'human' },
    ];
    const state = apply(createEmptyState(), cmd).state;
    expect(humanPlayerId(state)).toBe('blue');
    expect(state.heroes.find((h) => h.playerId === 'blue')).toBeDefined();
  });

  it('renvoie null si aucun joueur humain (partie IA vs IA)', () => {
    const cmd = startCmd(['a', 'b']);
    if (cmd.type !== 'StartGame') throw new Error('unreachable');
    cmd.players = cmd.players.map((p) => ({ ...p, controller: 'ai' as const }));
    const state = apply(createEmptyState(), cmd).state;
    expect(humanPlayerId(state)).toBeNull();
  });
});

describe('EndTurn', () => {
  it('fait tourner les joueurs puis avance le jour (1 jour = 1 tour de chacun)', () => {
    const state = startedGame(['p1', 'p2']);
    let r = apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(r.state.currentPlayer).toBe(1);
    expect(r.state.calendar.day).toBe(1);

    r = apply(r.state, { type: 'EndTurn', playerId: 'p2' });
    expect(r.state.currentPlayer).toBe(0);
    expect(r.state.calendar.day).toBe(2);
    expect(r.events).toContainEqual({ type: 'DayStarted', day: 2 });
  });

  it('émet WeekStarted au passage du jour 7 au jour 8', () => {
    let state = startedGame(['solo']);
    const weeks: number[] = [];
    for (let i = 0; i < 14; i++) {
      const r = apply(state, { type: 'EndTurn', playerId: 'solo' });
      for (const e of r.events) if (e.type === 'WeekStarted') weeks.push(e.week);
      state = r.state;
    }
    expect(state.calendar.day).toBe(15);
    expect(weeks).toEqual([2, 3]); // jours 8 et 15
  });

  it('refuse un tour hors ordre ou avant démarrage', () => {
    expect(validate(createEmptyState(), { type: 'EndTurn', playerId: 'p1' })?.code).toBe(
      'gameNotStarted',
    );
    expect(validate(startedGame(), { type: 'EndTurn', playerId: 'p2' })?.code).toBe('notYourTurn');
    expect(() => apply(startedGame(), { type: 'EndTurn', playerId: 'p2' })).toThrow(EngineError);
  });

  it('ne mute jamais l’état d’entrée', () => {
    const state = startedGame();
    const before = JSON.stringify(state);
    apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('apply', () => {
  it('est pur : même état + même commande ⇒ résultat identique', () => {
    const state = startedGame();
    const cmd: Command = { type: 'EndTurn', playerId: 'p1' };
    const a = apply(state, cmd);
    const b = apply(state, cmd);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });
});
