import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { EngineError, type Command } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { MapObjectDef } from '../src/adventure/map';
import { testConfig, testMap } from './fixtures';

/**
 * Objets de carte « comblement » (doc 02 §2.2) : mines capturables à revenu
 * quotidien, trésors à choix or/XP, artefacts au sol. Les gardiens/tas de
 * ressources existants sont couverts par `combat-guardian` / `adventure`.
 */

function startCommand(
  objects: MapObjectDef[],
  players: { id: string; controller?: 'human' | 'ai' }[] = [{ id: 'p1' }],
  startingArtifacts?: string[],
): Command {
  const map = testMap();
  map.objects = objects;
  return {
    type: 'StartGame',
    seed: 42,
    players: players.map((p) => ({
      id: p.id,
      startingResources: emptyResources(),
      ...(p.controller ? { controller: p.controller } : {}),
    })),
    map,
    config: testConfig(),
    unitCatalog: {},
    artifactCatalog: { 'test-art': { id: 'test-art', bonus: { attack: 1 } } },
    ...(startingArtifacts ? { startingArtifacts } : {}),
  };
}

function startedWith(
  objects: MapObjectDef[],
  players: { id: string; controller?: 'human' | 'ai' }[] = [{ id: 'p1' }],
  startingArtifacts?: string[],
): GameState {
  return apply(createEmptyState(), startCommand(objects, players, startingArtifacts)).state;
}

const mine = (ownerId: string | null = null): MapObjectDef => ({
  id: 'mine-1',
  type: 'mine',
  pos: { x: 2, y: 0 },
  resource: 'wood',
  amount: 2,
  ownerId,
});

const treasure: MapObjectDef = {
  id: 'chest-1',
  type: 'treasure',
  pos: { x: 2, y: 0 },
  gold: 1500,
  xp: 4000,
};

const groundArtifact: MapObjectDef = {
  id: 'art-1',
  type: 'artifact',
  pos: { x: 2, y: 0 },
  artifactId: 'test-art',
};

describe('mine capturable (doc 02 §2.2)', () => {
  it('fouler une mine neutre la capture sans arrêter le héros', () => {
    const { state, events } = apply(startedWith([mine()]), {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    });
    const obj = state.map?.objects.find((o) => o.id === 'mine-1');
    expect(obj?.type === 'mine' && obj.ownerId).toBe('p1');
    // La mine reste sur la carte et le héros a poursuivi son chemin.
    expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 0 });
    expect(events).toContainEqual({
      type: 'MineCaptured',
      playerId: 'p1',
      objectId: 'mine-1',
      resource: 'wood',
      amount: 2,
      pos: { x: 2, y: 0 },
    });
  });

  it('verse son revenu chaque jour à son propriétaire, jamais neutre', () => {
    let state = startedWith([mine()]);
    // Jour 2 sans capture : aucun revenu de mine.
    let result = apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(result.state.players[0]?.resources.wood).toBe(0);

    state = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    }).state;
    result = apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(result.state.players[0]?.resources.wood).toBe(2);
    expect(result.events).toContainEqual({
      type: 'MineIncome',
      playerId: 'p1',
      objectId: 'mine-1',
      resource: 'wood',
      amount: 2,
    });
  });

  it('est recapturable par un adversaire', () => {
    // p2 démarre en (9,9) — on lui donne la mine d'emblée, p1 la reprend.
    const state = startedWith([mine('p2')], [{ id: 'p1' }, { id: 'p2' }]);
    const next = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    }).state;
    const obj = next.map?.objects.find((o) => o.id === 'mine-1');
    expect(obj?.type === 'mine' && obj.ownerId).toBe('p1');
  });

  it('validateMap rejette une mine à ressource inconnue ou revenu nul', () => {
    const badResource = startCommand([{ ...mine(), resource: 'petrol' } as MapObjectDef]);
    expect(validate(createEmptyState(), badResource)?.code).toBe('invalidMap');
    const badAmount = startCommand([{ ...mine(), amount: 0 } as MapObjectDef]);
    expect(validate(createEmptyState(), badAmount)?.code).toBe('invalidMap');
  });
});

describe('trésor à choix or/XP (doc 02 §2.2)', () => {
  function foundTreasure(): GameState {
    return apply(startedWith([treasure]), {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    }).state;
  }

  it('fouler le coffre arrête le héros et pose le choix en attente', () => {
    const state = foundTreasure();
    expect(state.heroes[0]?.pos).toEqual({ x: 2, y: 0 }); // arrêté sur le coffre
    expect(state.pendingTreasure).toEqual({
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'chest-1',
      gold: 1500,
      xp: 4000,
    });
    // L'objet n'est retiré qu'à la résolution.
    expect(state.map?.objects.some((o) => o.id === 'chest-1')).toBe(true);
  });

  it('bloque MoveHero et EndTurn tant que le choix est en attente', () => {
    const state = foundTreasure();
    const move: Command = { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 3, y: 0 }] };
    expect(validate(state, move)?.code).toBe('treasurePending');
    expect(validate(state, { type: 'EndTurn', playerId: 'p1' })?.code).toBe('treasurePending');
  });

  it('le choix « or » crédite le joueur et retire le coffre', () => {
    const { state, events } = apply(foundTreasure(), {
      type: 'ResolveTreasure',
      heroId: 'hero-p1',
      choice: 'gold',
    });
    expect(state.players[0]?.resources.gold).toBe(1500);
    expect(state.heroes[0]?.xp).toBe(0);
    expect(state.pendingTreasure).toBeNull();
    expect(state.map?.objects.some((o) => o.id === 'chest-1')).toBe(false);
    expect(events).toContainEqual({
      type: 'TreasureTaken',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'chest-1',
      choice: 'gold',
      amount: 1500,
    });
  });

  it("le choix « XP » passe par grantXp (montée de niveau à 4000 XP)", () => {
    const { state, events } = apply(foundTreasure(), {
      type: 'ResolveTreasure',
      heroId: 'hero-p1',
      choice: 'xp',
    });
    expect(state.players[0]?.resources.gold).toBe(0);
    expect(state.heroes[0]?.xp).toBe(4000);
    expect(state.heroes[0]?.level).toBe(2); // courbe de test : niveau 2 à 3732 XP (1000 × 2^1,9)
    expect(events.some((e) => e.type === 'XpGained')).toBe(true);
    expect(events.some((e) => e.type === 'HeroLevelUp')).toBe(true);
  });

  it('ResolveTreasure est refusé sans trésor en attente ou pour un autre héros', () => {
    const idle = startedWith([treasure]);
    expect(
      validate(idle, { type: 'ResolveTreasure', heroId: 'hero-p1', choice: 'gold' })?.code,
    ).toBe('noPendingChoice');
    expect(
      validate(foundTreasure(), { type: 'ResolveTreasure', heroId: 'hero-x', choice: 'gold' })
        ?.code,
    ).toBe('invalidTarget');
  });

  it('validateMap rejette un trésor sans aucun gain', () => {
    const bad = startCommand([{ ...treasure, gold: 0, xp: 0 } as MapObjectDef]);
    expect(validate(createEmptyState(), bad)?.code).toBe('invalidMap');
  });
});

describe('artefact au sol (doc 02 §2.2)', () => {
  it('est ramassé en passant vers le premier slot libre, sans arrêter le héros (D6)', () => {
    const { state, events } = apply(startedWith([groundArtifact]), {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 }, // artefact à (2,0) : ramassé au passage
        { x: 3, y: 0 },
      ],
    });
    expect(state.heroes[0]?.artifacts[0]).toBe('test-art');
    expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 0 }); // poursuit jusqu'au bout
    expect(state.map?.objects.some((o) => o.id === 'art-1')).toBe(false);
    expect(events.some((e) => e.type === 'ArtifactPicked')).toBe(true);
  });

  it("reste au sol si l'inventaire du héros est plein", () => {
    const full = Array.from({ length: 10 }, () => 'test-art');
    const { state, events } = apply(startedWith([groundArtifact], [{ id: 'p1' }], full), {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    });
    expect(state.map?.objects.some((o) => o.id === 'art-1')).toBe(true);
    expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 0 }); // pas d'arrêt
    expect(events.some((e) => e.type === 'ArtifactPicked')).toBe(false);
  });

  it('validateMap rejette un artefact inconnu du catalogue', () => {
    const bad = startCommand([{ ...groundArtifact, artifactId: 'nope' } as MapObjectDef]);
    expect(validate(createEmptyState(), bad)?.code).toBe('invalidMap');
  });
});

describe("IA d'aventure et objets de carte", () => {
  it("l'IA capture une mine et résout un trésor en or, sans blocage", () => {
    // Un seul joueur IA : la mine est adjacente, le coffre juste après.
    let state = startedWith(
      [
        { ...mine(), pos: { x: 1, y: 0 } },
        { ...treasure, pos: { x: 2, y: 1 } },
      ],
      [{ id: 'p1', controller: 'ai' }],
    );
    // Deux tours d'IA : un objectif par héros et par tour (heuristique gloutonne).
    state = apply(state, { type: 'AiTurn', playerId: 'p1' }).state;
    state = apply(state, { type: 'AiTurn', playerId: 'p1' }).state;
    const mineObj = state.map?.objects.find((o) => o.id === 'mine-1');
    expect(mineObj?.type === 'mine' && mineObj.ownerId).toBe('p1');
    expect(state.pendingTreasure).toBeNull(); // résolu immédiatement par l'IA
    expect(state.players[0]?.resources.gold).toBe(1500);
    expect(state.map?.objects.some((o) => o.id === 'chest-1')).toBe(false);
  });

  it("erreur EngineError propre si on force un MoveHero pendant le choix", () => {
    const state = apply(startedWith([treasure]), {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    }).state;
    expect(() =>
      apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 3, y: 0 }] }),
    ).toThrow(EngineError);
  });
});
