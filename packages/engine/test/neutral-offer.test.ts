import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import type { AdventureMapDef } from '../src/adventure/map';
import type { HeroSkillDef } from '../src/hero/types';
import type { CombatUnitDef } from '../src/combat/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * LE5 A4 — réactions des neutres : un gardien dominé propose de fuir (≥ 3×) ou,
 * face à Diplomatie, de rejoindre contre or (≥ 1,5×). Forces de test : grunt =
 * 11, loup = 17 (`armyStrength`).
 */

const DIPLOMACY: Record<string, HeroSkillDef> = {
  diplomacy: {
    id: 'diplomacy',
    ranks: [{ neutralJoinDiscountPct: 25 }, { neutralJoinDiscountPct: 50 }, { neutralJoinDiscountPct: 75 }],
  },
};

type Opts = {
  wolves: number;
  grunts?: number;
  reactions?: boolean;
  diplomacy?: number;
  gold?: number;
  controller?: 'human' | 'ai';
  extra?: AdventureMapDef['objects'];
  neverFlee?: boolean;
};

function game(o: Opts): GameState {
  const base = testMap();
  const map: AdventureMapDef = {
    ...base,
    objects: [
      ...(o.extra ?? []),
      {
        id: 'wolf',
        type: 'guardian',
        pos: { x: 2, y: 0 },
        unitId: 'blue-wolf',
        count: o.wolves,
        ...(o.neverFlee ? { neverFlee: true } : {}),
      },
    ],
  };
  const config = testConfig();
  if (o.reactions !== false) config.neutralReactions = { fleeRatio: 3, fleeChanceFrom: 2, joinRatio: 1.5 };
  const catalog = testCatalog();
  (catalog['blue-wolf'] as CombatUnitDef & { recruitCost: Record<string, number> }).recruitCost = { gold: 100 };
  const players: PlayerSetup[] = [
    {
      id: 'p1',
      startingResources: { ...emptyResources(), gold: o.gold ?? 0 },
      startingArmy: [{ unitId: 'red-grunt', count: o.grunts ?? 100 }],
      controller: o.controller ?? 'human',
    },
  ];
  let s = apply(createEmptyState(), {
    type: 'StartGame',
    seed: 5,
    players,
    map,
    config,
    unitCatalog: catalog,
    buildingCatalog: {},
    towns: [],
  }).state;
  s = produce(s, (d) => {
    d.skillCatalog = DIPLOMACY;
    if (o.diplomacy) d.heroes[0]!.skills = { diplomacy: o.diplomacy };
  });
  return s;
}

const move = (state: GameState) =>
  apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }, { x: 2, y: 0 }] });
const resolve = (state: GameState, choice: 'fight' | 'release' | 'join') =>
  apply(state, { type: 'ResolveNeutralOffer', heroId: 'hero-p1', choice });
const hasGuardian = (state: GameState) => state.map?.objects.some((o) => o.id === 'wolf') ?? false;

describe('LE5 A4 — fuite proposée', () => {
  it('règle absente : combat immédiat, comme avant', () => {
    const { state } = move(game({ wolves: 10, reactions: false }));
    expect(state.pendingNeutralOffer).toBeUndefined();
    expect(state.combat?.guardianObjectId).toBe('wolf');
  });

  it('gardien dominé (≥ 3×) : proposition de fuite, déplacement arrêté, pas de combat', () => {
    const { state, events } = move(game({ wolves: 10 })); // 1100 / 170
    expect(state.combat).toBeNull();
    expect(state.pendingNeutralOffer).toMatchObject({ guardianObjectId: 'wolf', release: true, joinCost: null });
    expect(events.some((e) => e.type === 'NeutralOfferMade')).toBe(true);
    expect(validate(state, { type: 'EndTurn', playerId: 'p1' })?.code).toBe('choicePending');
  });

  it('laisser partir : gardien retiré, sans XP ni butin', () => {
    const offered = move(game({ wolves: 10 })).state;
    const { state, events } = resolve(offered, 'release');
    expect(hasGuardian(state)).toBe(false);
    expect(state.pendingNeutralOffer).toBeUndefined();
    expect(state.heroes[0]!.xp).toBe(offered.heroes[0]!.xp);
    expect(state.players[0]!.resources).toEqual(offered.players[0]!.resources);
    expect(events.some((e) => e.type === 'GuardianReleased')).toBe(true);
  });

  it('poursuivre : le combat de gardien s’ouvre', () => {
    const { state } = resolve(move(game({ wolves: 10 })).state, 'fight');
    expect(state.combat?.guardianObjectId).toBe('wolf');
  });

  it('sous 2× : jamais de proposition', () => {
    const { state } = move(game({ wolves: 40 })); // rapport 1,6
    expect(state.pendingNeutralOffer).toBeUndefined();
    expect(state.combat).not.toBeNull();
  });

  it('neverFlee : champ, butin gardé ou cible de quête ⇒ combat', () => {
    expect(move(game({ wolves: 10, neverFlee: true })).state.combat).not.toBeNull();
    const guarded = game({
      wolves: 10,
      extra: [{ id: 'chest', type: 'resource', pos: { x: 3, y: 0 }, resource: 'gold', amount: 500, guardedBy: 'wolf' }],
    });
    expect(move(guarded).state.combat).not.toBeNull();
    const quest = produce(game({ wolves: 10 }), (d) => {
      d.quests = {
        quests: [
          {
            def: { id: 'q', steps: [{ id: 's', condition: { type: 'defeatGuardian', objectId: 'wolf' } }], rewards: [] },
            stepIndex: 0,
            status: 'active',
          },
        ],
      };
    });
    expect(move(quest).state.combat).not.toBeNull();
  });
});

describe('LE5 A4 — ralliement (Diplomatie)', () => {
  it('Diplomatie + rapport ≥ 1,5 : ralliement au coût réduit ; la pile rejoint l’armée', () => {
    const offered = move(game({ wolves: 40, diplomacy: 1, gold: 5000 })).state; // rapport 1,6
    expect(offered.pendingNeutralOffer).toMatchObject({ release: false, joinCost: { gold: 3000 } });
    const { state, events } = resolve(offered, 'join');
    expect(state.players[0]!.resources.gold).toBe(2000);
    expect(state.heroes[0]!.army).toContainEqual({ unitId: 'blue-wolf', count: 40 });
    expect(hasGuardian(state)).toBe(false);
    expect(events.some((e) => e.type === 'NeutralJoined')).toBe(true);
  });

  it('or insuffisant : ralliement refusé par le moteur', () => {
    const offered = move(game({ wolves: 40, diplomacy: 1, gold: 100 })).state;
    expect(validate(offered, { type: 'ResolveNeutralOffer', heroId: 'hero-p1', choice: 'join' })?.code).toBe(
      'invalidTarget',
    );
  });

  it('armée pleine sans pile de même unité : pas de ralliement', () => {
    const full = produce(game({ wolves: 40, diplomacy: 1, gold: 5000 }), (d) => {
      d.heroes[0]!.army = Array.from({ length: 7 }, () => ({ unitId: 'red-grunt', count: 15 }));
    });
    const { state } = move(full);
    expect(state.pendingNeutralOffer).toBeUndefined();
    expect(state.combat).not.toBeNull();
  });
});

describe('LE5 A4 — IA', () => {
  const aiMoveToward = (s: GameState): { state: GameState; events: GameEvent[] } => {
    const events: GameEvent[] = [];
    const state = produce(s, (d) => {
      runAiTurn(d, 'p1', events);
    });
    return { state, events };
  };

  it('rallie quand elle peut payer', () => {
    const { state, events } = aiMoveToward(game({ wolves: 40, diplomacy: 1, gold: 5000, controller: 'ai' }));
    expect(events.some((e) => e.type === 'NeutralOfferMade')).toBe(true);
    expect(events.some((e) => e.type === 'NeutralJoined')).toBe(true);
    expect(state.heroes[0]!.army.some((s) => s.unitId === 'blue-wolf')).toBe(true);
  });

  it('sinon combat : aucune proposition laissée en attente', () => {
    const { state, events } = aiMoveToward(game({ wolves: 10, controller: 'ai' }));
    expect(state.pendingNeutralOffer).toBeUndefined();
    expect(events.some((e) => e.type === 'NeutralOfferMade')).toBe(true);
    expect(events.some((e) => e.type === 'CombatStarted')).toBe(true);
  });
});
