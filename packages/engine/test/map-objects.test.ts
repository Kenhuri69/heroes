import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { EngineError, type Command } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { MapObjectDef } from '../src/adventure/map';
import { testConfig, testMap, testCatalog } from './fixtures';

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

  it('tombe dans le sac si les 10 slots équipés sont pleins (H-ARTEQUIP)', () => {
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
    // Plus rien de perdu au sol : l'artefact est ramassé dans le sac.
    expect(state.map?.objects.some((o) => o.id === 'art-1')).toBe(false);
    expect(state.heroes[0]?.backpack).toEqual(['test-art']); // ramassé au sac
    expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 0 }); // pas d'arrêt
    expect(events.some((e) => e.type === 'ArtifactPicked')).toBe(true);
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

describe('M-GUARDLINK — objet gardé (doc 02 §2.2)', () => {
  // Gardien VALIDE (unité du catalogue) placé HORS du chemin — il n'intercepte
  // pas, il sert seulement de sentinelle liée à l'objet.
  const sentinel: MapObjectDef = { id: 'g1', type: 'guardian', pos: { x: 4, y: 0 }, unitId: 'red-grunt', count: 1 };
  const guardedGold: MapObjectDef = {
    id: 'res-g',
    type: 'resource',
    pos: { x: 2, y: 0 },
    resource: 'gold',
    amount: 500,
    guardedBy: 'g1',
  };
  const walkOver: Command = {
    type: 'MoveHero',
    heroId: 'hero-p1',
    path: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  };
  const startGuarded = (objects: MapObjectDef[]): GameState => {
    const map = testMap();
    map.objects = objects;
    return apply(createEmptyState(), {
      type: 'StartGame',
      seed: 42,
      players: [{ id: 'p1', startingResources: emptyResources() }],
      map,
      config: testConfig(),
      unitCatalog: testCatalog(),
    }).state;
  };

  it("un objet gardé n'est PAS ramassé tant que sa sentinelle existe", () => {
    const { state } = apply(startGuarded([guardedGold, sentinel]), walkOver);
    expect(state.players[0]?.resources.gold).toBe(0); // rien ramassé
    expect(state.map?.objects.some((o) => o.id === 'res-g')).toBe(true); // l'objet reste
    expect(state.heroes[0]?.pos).toEqual({ x: 3, y: 0 }); // le héros a poursuivi (sentinelle hors chemin)
  });

  it('sentinelle absente (vaincue) ⇒ l’objet est ramassé en passant', () => {
    const { state } = apply(startGuarded([guardedGold]), walkOver); // pas de gardien sur la carte
    expect(state.players[0]?.resources.gold).toBe(500);
    expect(state.map?.objects.some((o) => o.id === 'res-g')).toBe(false);
  });
});

describe('M-NAV a — monolithe apparié (doc 02 §2.1)', () => {
  const monoA: MapObjectDef = { id: 'mono-a', type: 'monolith', pos: { x: 2, y: 0 }, pairId: 'gate' };
  const monoB: MapObjectDef = { id: 'mono-b', type: 'monolith', pos: { x: 5, y: 3 }, pairId: 'gate' };

  it('fouler un monolithe téléporte vers son jumeau et interrompt le déplacement', () => {
    const { state, events } = apply(startedWith([monoA, monoB]), {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 }, // monolithe A ⇒ téléport en B (5,3), le reste du chemin est ignoré
        { x: 3, y: 0 },
      ],
    });
    expect(state.heroes[0]?.pos).toEqual({ x: 5, y: 3 }); // arrivé sur le jumeau
    expect(events).toContainEqual({
      type: 'HeroTeleported',
      heroId: 'hero-p1',
      from: { x: 2, y: 0 },
      to: { x: 5, y: 3 },
    });
  });

  it('arriver sur le jumeau ne re-téléporte pas (pas de boucle)', () => {
    const state = startedWith([monoA, monoB]);
    const after = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }).state;
    expect(after.heroes[0]?.pos).toEqual({ x: 5, y: 3 });
    // Un SEUL téléport a eu lieu (le héros reste sur B, il n'y « entre » pas).
    const teleports = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    }).events.filter((e) => e.type === 'HeroTeleported');
    expect(teleports).toHaveLength(1);
  });
});

describe('Revue 2026-07 — B9 : sortie de monolithe occupée (jamais deux héros superposés)', () => {
  const monoA: MapObjectDef = { id: 'mono-a', type: 'monolith', pos: { x: 2, y: 0 }, pairId: 'gate' };
  // Sortie posée SUR la position de départ du héros de p2 (9,9).
  const monoB: MapObjectDef = { id: 'mono-b', type: 'monolith', pos: { x: 9, y: 9 }, pairId: 'gate' };

  function startTwoPlayers(team: 0 | 1): GameState {
    const map = testMap();
    map.objects = [monoA, monoB];
    return apply(createEmptyState(), {
      type: 'StartGame',
      seed: 42,
      players: [
        { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 10 }], team },
        { id: 'p2', startingResources: emptyResources(), startingArmy: [{ unitId: 'blue-wolf', count: 1 }], team },
      ],
      map,
      config: testConfig(),
      unitCatalog: testCatalog(),
    }).state;
  }

  it('héros ENNEMI sur la sortie ⇒ combat d’interception à travers le monolithe, pas de superposition', () => {
    const { state, events } = apply(startTwoPlayers(0), {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    });
    expect(state.combat).not.toBeNull();
    expect(state.combat?.attackerHeroId).toBe('hero-p1');
    expect(state.combat?.defenderHeroId).toBe('hero-p2');
    // Pas de téléport : le héros reste sur l'entrée, jamais superposé au défenseur.
    expect(events.some((e) => e.type === 'HeroTeleported')).toBe(false);
    expect(state.heroes.find((h) => h.id === 'hero-p1')?.pos).toEqual({ x: 2, y: 0 });
  });

  it('héros ALLIÉ sur la sortie ⇒ passage bloqué (pas de téléport, pas de combat)', () => {
    const { state, events } = apply(startTwoPlayers(1), {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    });
    expect(state.combat).toBeNull();
    expect(events.some((e) => e.type === 'HeroTeleported')).toBe(false);
    expect(state.heroes.find((h) => h.id === 'hero-p1')?.pos).toEqual({ x: 2, y: 0 });
    expect(state.heroes.find((h) => h.id === 'hero-p2')?.pos).toEqual({ x: 9, y: 9 });
  });
});

describe('Revue 2026-07 — B26 : les structures d’un allié ne se capturent pas en passant', () => {
  it('traverser la mine d’un allié ne la re-flagge pas ; celle d’un ennemi si', () => {
    const map = testMap();
    map.objects = [
      { id: 'mine-ally', type: 'mine', pos: { x: 1, y: 0 }, resource: 'wood', amount: 2, ownerId: 'p2' },
      { id: 'mine-foe', type: 'mine', pos: { x: 2, y: 0 }, resource: 'ore', amount: 2, ownerId: 'p3' },
    ];
    const state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 42,
      players: [
        { id: 'p1', startingResources: emptyResources(), team: 1 },
        { id: 'p2', startingResources: emptyResources(), team: 1 }, // allié
        { id: 'p3', startingResources: emptyResources(), team: 2 }, // ennemi
      ],
      map,
      config: testConfig(),
      unitCatalog: {},
    }).state;
    const next = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    }).state;
    const ally = next.map?.objects.find((o) => o.id === 'mine-ally');
    const foe = next.map?.objects.find((o) => o.id === 'mine-foe');
    expect(ally && ally.type === 'mine' && ally.ownerId).toBe('p2'); // intacte
    expect(foe && foe.type === 'mine' && foe.ownerId).toBe('p1'); // recapturée
  });
});
