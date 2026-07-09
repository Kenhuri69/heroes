import { describe, expect, it } from 'vitest';
import { assignHuntContracts, rewardHuntContract } from '../src/town/hunt-contract';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { GameEvent } from '../src/core/events';
import type { BuildingDef } from '../src/town/types';

/**
 * Contrats de chasse (doc 05 §3.3, comblement du point (5) du cadrage 4.1).
 * Point d'extension **générique** : effet de bâtiment `huntContract` → cible
 * neutre assignée au passage de semaine ; la vaincre crédite la récompense.
 */
const CATALOG: Record<string, BuildingDef> = {
  board: {
    id: 'board',
    maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'huntContract', gold: 300, resource: 'essence', amount: 15 } }],
  },
};

function stateWith(hasBoard: boolean): GameState {
  const s = createEmptyState();
  s.rng = seedRng(1);
  s.players = [
    {
      id: 'p1',
      resources: emptyResources(),
      factionResources: {},
      explored: [],
      controller: 'human',
      eliminated: false,
      townlessDays: 0,
      huntContract: null,
      team: 0,
    },
  ];
  s.map = {
    id: 'm',
    width: 3,
    height: 3,
    terrain: Array<string>(9).fill('grass'),
    road: Array<boolean>(9).fill(false),
    triggers: [],
    objects: [{ id: 'g1', type: 'guardian', pos: { x: 1, y: 0 }, unitId: 'wolf', count: 5 }],
    startPositions: [{ x: 0, y: 0 }],
  };
  s.buildingCatalog = CATALOG;
  s.towns = [
    {
      id: 't1',
      ownerPlayerId: 'p1',
      pos: { x: 0, y: 0 },
      factionId: '',
      buildings: hasBoard ? { board: 1 } : {},
      builtToday: false,
      garrison: [],
      stock: {},
      spellPool: [],
    },
  ];
  return s;
}

const hero = { id: 'h1', playerId: 'p1' } as HeroState;

describe('assignHuntContracts', () => {
  it('assigne une cible neutre au propriétaire d’un bâtiment huntContract', () => {
    const s = stateWith(true);
    const events: GameEvent[] = [];
    assignHuntContracts(s, events);
    expect(s.players[0]!.huntContract).toEqual({ targetObjectId: 'g1', gold: 300, resource: 'essence', amount: 15 });
    expect(events).toContainEqual({ type: 'HuntContractAssigned', playerId: 'p1', targetObjectId: 'g1' });
  });

  it('n’assigne rien sans bâtiment huntContract', () => {
    const s = stateWith(false);
    assignHuntContracts(s, []);
    expect(s.players[0]!.huntContract).toBeNull();
  });

  it('A9 — expire le contrat de la semaine écoulée et en réassigne un neuf (deadline hebdo + cible tuée par un tiers libérée)', () => {
    const s = stateWith(true);
    // Contrat périmé de la semaine passée, sur une cible qui n'existe plus sur la
    // carte (gardien `gX` tué par un tiers) ⇒ auparavant bloqué à jamais.
    s.players[0]!.huntContract = { targetObjectId: 'gX', gold: 1, resource: 'essence', amount: 1 };
    const events: GameEvent[] = [];
    assignHuntContracts(s, events);
    // Réassigné à une cible réelle (g1), avec l'effet COURANT du bâtiment (300/essence/15) :
    // preuve d'expiration + réassignation (et non d'un contrat laissé inchangé).
    expect(s.players[0]!.huntContract).toEqual({ targetObjectId: 'g1', gold: 300, resource: 'essence', amount: 15 });
    expect(events).toContainEqual({ type: 'HuntContractAssigned', playerId: 'p1', targetObjectId: 'g1' });
  });
});

describe('rewardHuntContract', () => {
  it('crédite or + ressource de faction et libère le contrat quand la cible est vaincue', () => {
    const s = stateWith(true);
    s.players[0]!.huntContract = { targetObjectId: 'g1', gold: 300, resource: 'essence', amount: 15 };
    const events: GameEvent[] = [];
    rewardHuntContract(s, hero, 'g1', events);
    expect(s.players[0]!.resources.gold).toBe(300);
    expect(s.players[0]!.factionResources['essence']).toBe(15);
    expect(s.players[0]!.huntContract).toBeNull();
    expect(events).toContainEqual({ type: 'HuntContractCompleted', playerId: 'p1', gold: 300, resource: 'essence', amount: 15 });
  });

  it('ne récompense pas si le gardien vaincu n’est pas la cible', () => {
    const s = stateWith(true);
    s.players[0]!.huntContract = { targetObjectId: 'g1', gold: 300, resource: 'essence', amount: 15 };
    rewardHuntContract(s, hero, 'other', []);
    expect(s.players[0]!.resources.gold).toBe(0);
    expect(s.players[0]!.huntContract).not.toBeNull();
  });
});
