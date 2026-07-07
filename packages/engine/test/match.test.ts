import { describe, expect, it } from 'vitest';
import type { Command } from '../src/core/commands';
import { emptyResources } from '../src/core/state';
import { testMap, testConfig } from './fixtures';
import { replayCommands, replayHash, currentTurnPlayerId, appendTurn } from '../src/net/match';

/** `StartGame` minimal à 2 joueurs (netcode : 1ʳᵉ commande d'un journal de partie). */
const START: Command = {
  type: 'StartGame',
  seed: 42,
  players: [
    { id: 'p1', startingResources: emptyResources() },
    { id: 'p2', startingResources: emptyResources() },
  ],
  map: testMap(),
  config: testConfig(),
  unitCatalog: {},
  buildingCatalog: {},
  towns: [],
};

describe('netcode match (doc 15)', () => {
  it('rejoue un journal → partie démarrée, tour du 1er joueur', () => {
    const state = replayCommands([START]);
    expect(state.started).toBe(true);
    expect(currentTurnPlayerId(state)).toBe('p1');
  });

  it('EndTurn fait tourner le tour au joueur suivant', () => {
    const state = replayCommands([START, { type: 'EndTurn', playerId: 'p1' }]);
    expect(currentTurnPlayerId(state)).toBe('p2');
  });

  it('replayHash est déterministe (même journal ⇒ même empreinte)', () => {
    const log: Command[] = [START, { type: 'EndTurn', playerId: 'p1' }];
    expect(replayHash(log)).toBe(replayHash(log));
  });

  it('appendTurn accepte le tour du joueur courant, le refuse hors-tour', () => {
    // Ce n'est pas le tour de p2 → refus.
    const refus = appendTurn([START], 'p2', [{ type: 'EndTurn', playerId: 'p2' }]);
    expect(refus.ok).toBe(false);

    // C'est le tour de p1 → accepté, et le tour passe à p2.
    const ok = appendTurn([START], 'p1', [{ type: 'EndTurn', playerId: 'p1' }]);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(currentTurnPlayerId(replayCommands(ok.commands))).toBe('p2');
  });

  it('appendTurn refuse un lot illégal (commande qui lève au rejeu)', () => {
    // p1 joue mais poste un EndTurn attribué à p2 → le rejeu lève → refus.
    const res = appendTurn([START], 'p1', [{ type: 'EndTurn', playerId: 'p2' }]);
    expect(res.ok).toBe(false);
  });
});
