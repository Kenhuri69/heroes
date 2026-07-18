import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * B3 — Renforts en combat (doc 18, signature MMHO) : en PvE, le héros dépense de
 * l'or pour ajouter une pile fraîche d'une unité qu'il commande. Opt-in par
 * config, plafonné, le renfort n'agit qu'au round suivant (`acted: true`).
 */

function unit(id: string, hp = 10): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'grass', stats: { hp, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0,
    firstHp: 10,
    pos: { col: 0, row: 0 },
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null,
    spellCharges: 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...over,
  };
}

type ReinfCfg = { maxCallsPerCombat: number; maxUnitsPerCall: number; costMultiplier: number } | undefined;

function stateWith(
  cfg: ReinfCfg,
  opts: { gold?: number; defenderHeroId?: string | null; heroArmyUnit?: string } = {},
): GameState {
  const config = { ...testConfig(), combat: { ...testConfig().combat, reinforcements: cfg } };
  const combat: CombatState = {
    terrain: 'grass',
    phase: 'battle',
    round: 1,
    obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 5, pos: { col: 0, row: 2 } }),
      stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 10 }),
    ],
    activeStackId: 'attacker-0',
    playerSide: 'attacker',
    heroId: 'hero-a',
    guardianObjectId: 'g1',
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId: 'hero-a',
    defenderHeroId: opts.defenderHeroId ?? null,
    heroCastThisRound: [],
    heroAttackUsed: [],
    finished: false,
    winner: null,
  } as unknown as CombatState;
  const hero = {
    id: 'hero-a',
    playerId: 'p1',
    pos: { x: 0, y: 0 },
    movementPoints: 0,
    naval: false,
    level: 1,
    xp: 0,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0,
    manaMax: 0,
    spells: [],
    skills: {},
    visitLuck: 0,
    visitMorale: 0,
    artifacts: Array.from({ length: 10 }, () => null),
    army: [{ unitId: opts.heroArmyUnit ?? 'ally', count: 5 }],
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
  } as unknown as HeroState;
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config,
    unitCatalog: { ally: { ...unit('ally'), recruitCost: { gold: 100 } } as CombatUnitDef, foe: unit('foe') },
    heroes: [hero],
    players: [
      {
        id: 'p1',
        resources: { ...emptyResources(), gold: opts.gold ?? 2000 },
        factionResources: {},
        explored: [],
        controller: 'human',
        eliminated: false,
        townlessDays: 0,
        huntContract: null,
        team: 0,
      },
    ],
    combat,
  };
}

const CFG = { maxCallsPerCombat: 2, maxUnitsPerCall: 10, costMultiplier: 2 };

describe('B3 — renforts en combat', () => {
  it('ajoute une pile fraîche au camp joueur, débite l’or, émet ReinforcementsCalled', () => {
    const { state, events } = apply(stateWith(CFG), { type: 'CallReinforcements', unitId: 'ally', count: 3 });
    const reinf = state.combat!.stacks.find((s) => s.side === 'attacker' && s.id !== 'attacker-0');
    expect(reinf?.unitId).toBe('ally');
    expect(reinf?.count).toBe(3);
    expect(reinf?.acted).toBe(true); // se déploie, agit au round suivant
    // Coût = recruitCost(100) × count(3) × costMultiplier(2) = 600.
    expect(state.players[0]?.resources.gold).toBe(2000 - 600);
    expect(state.combat!.reinforcementsUsed).toBe(1);
    expect(events.some((e) => e.type === 'ReinforcementsCalled')).toBe(true);
  });

  it('refuse si la feature est désactivée (config absente)', () => {
    expect(validate(stateWith(undefined), { type: 'CallReinforcements', unitId: 'ally', count: 1 })?.code).toBe(
      'reinforcementsUnavailable',
    );
  });

  it('refuse en combat de héros (PvE only)', () => {
    const s = stateWith(CFG, { defenderHeroId: 'hero-b' });
    expect(validate(s, { type: 'CallReinforcements', unitId: 'ally', count: 1 })?.code).toBe('reinforcementsUnavailable');
  });

  it('refuse au-delà du plafond de renforts', () => {
    const s = stateWith(CFG);
    s.combat!.reinforcementsUsed = CFG.maxCallsPerCombat;
    expect(validate(s, { type: 'CallReinforcements', unitId: 'ally', count: 1 })?.code).toBe('reinforcementsUnavailable');
  });

  it('refuse un effectif hors bornes (> maxUnitsPerCall)', () => {
    expect(validate(stateWith(CFG), { type: 'CallReinforcements', unitId: 'ally', count: 11 })?.code).toBe('invalidAction');
  });

  it('refuse une unité que le héros ne commande pas', () => {
    expect(validate(stateWith(CFG), { type: 'CallReinforcements', unitId: 'foe', count: 1 })?.code).toBe(
      'reinforcementsUnavailable',
    );
  });

  it('refuse si l’or manque (cannotAfford)', () => {
    expect(validate(stateWith(CFG, { gold: 100 }), { type: 'CallReinforcements', unitId: 'ally', count: 3 })?.code).toBe(
      'cannotAfford',
    );
  });
});
