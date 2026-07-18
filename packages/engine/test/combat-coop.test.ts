import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { beginGuardianCombat } from '../src/combat/setup';
import { apply } from '../src/core/engine';
import { runAutoCombat } from '../src/combat/ai';
import type { CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import type { AdventureMapDef } from '../src/adventure/map';
import type { TownState } from '../src/town/types';
import { testConfig } from './fixtures';

/**
 * E4.2 — Combats coopératifs (doc 18 E4) : l'armée d'un héros allié adjacent
 * invité rejoint le camp du joueur en combat PvE ; les piles portent leur héros
 * propriétaire (`ownerHeroId`), les survivants reviennent au bon héros, l'XP se
 * partage à égalité.
 */

function unit(id: string, hp = 10): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'grass', stats: { hp, attack: 8, defense: 5, damage: [6, 6], speed: 5 }, abilities: [] };
}

function hero(id: string, playerId: string, army: { unitId: string; count: number }[], pos: { x: number; y: number }): HeroState {
  return {
    id,
    playerId,
    pos,
    movementPoints: 100,
    naval: false,
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
  } as unknown as HeroState;
}

function player(id: string, team: number) {
  return {
    id,
    resources: emptyResources(),
    factionResources: {},
    explored: [],
    controller: 'human' as const,
    eliminated: false,
    townlessDays: 0,
    huntContract: null,
    team,
  };
}

function mapWithGuardian(): AdventureMapDef {
  return {
    id: 'm',
    width: 6,
    height: 6,
    terrain: Array<string>(36).fill('grass'),
    road: Array<boolean>(36).fill(false),
    triggers: [],
    objects: [{ id: 'g1', type: 'guardian', pos: { x: 1, y: 0 }, unitId: 'wolf', count: 1 }],
    startPositions: [{ x: 0, y: 0 }],
  };
}

/** Lead en (0,0), allié en (1,1) (adjacent), même équipe 1 ; gardien faible en (1,0). */
function coopState(allyTeam = 1): GameState {
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(7),
    config: testConfig(),
    map: mapWithGuardian(),
    unitCatalog: { grunt: unit('grunt'), knight: unit('knight'), wolf: unit('wolf', 4) },
    heroes: [
      hero('hero-lead', 'p1', [{ unitId: 'grunt', count: 20 }], { x: 0, y: 0 }),
      hero('hero-ally', 'p2', [{ unitId: 'knight', count: 15 }], { x: 1, y: 1 }),
    ],
    players: [player('p1', 1), player('p2', allyTeam)],
  };
}

describe('E4.2 — combats coopératifs', () => {
  it('l’armée de l’allié invité rejoint le camp, taguée à son propriétaire, son armée est vidée', () => {
    const events: GameEvent[] = [];
    const s = produce(coopState(), (draft) => {
      beginGuardianCombat(draft, 'hero-lead', 'g1', events, 'hero-ally');
    });
    const attacker = s.combat!.stacks.filter((st) => st.side === 'attacker');
    // Deux piles attaquantes : le grunt du lead (owner absent) + le knight de l'allié.
    expect(attacker.some((st) => st.unitId === 'grunt' && st.ownerHeroId === undefined)).toBe(true);
    expect(attacker.some((st) => st.unitId === 'knight' && st.ownerHeroId === 'hero-ally')).toBe(true);
    // L'armée de l'allié est engagée (vidée sur la carte).
    expect(s.heroes.find((h) => h.id === 'hero-ally')!.army).toEqual([]);
    expect(events.some((e) => e.type === 'AllyJoinedCombat')).toBe(true);
  });

  it('victoire : les survivants reviennent au bon héros, l’XP est partagée', () => {
    const events: GameEvent[] = [];
    const started = produce(coopState(), (draft) => {
      beginGuardianCombat(draft, 'hero-lead', 'g1', events, 'hero-ally');
    });
    const done = produce(started, (draft) => {
      runAutoCombat(draft, events);
    });
    const lead = done.heroes.find((h) => h.id === 'hero-lead')!;
    const ally = done.heroes.find((h) => h.id === 'hero-ally')!;
    // Chaque héros récupère SES survivants (routage par propriétaire).
    expect(lead.army.some((s) => s.unitId === 'grunt')).toBe(true);
    expect(ally.army.some((s) => s.unitId === 'knight')).toBe(true);
    expect(ally.army.some((s) => s.unitId === 'grunt')).toBe(false);
    // XP partagée : les DEUX héros en gagnent (part égale > 0).
    expect(lead.xp).toBeGreaterThan(0);
    expect(ally.xp).toBeGreaterThan(0);
  });

  it('invite invalide (allié non adjacent) ⇒ combat solo (aucune pile taguée)', () => {
    const events: GameEvent[] = [];
    const s = produce(coopState(), (draft) => {
      // Éloigne l'allié : plus adjacent au lead.
      draft.heroes.find((h) => h.id === 'hero-ally')!.pos = { x: 5, y: 5 };
      beginGuardianCombat(draft, 'hero-lead', 'g1', events, 'hero-ally');
    });
    expect(s.combat!.stacks.some((st) => st.ownerHeroId)).toBe(false);
    // L'armée de l'allié non invité est intacte.
    expect(s.heroes.find((h) => h.id === 'hero-ally')!.army.length).toBe(1);
  });

  it('invite d’un non-allié (autre équipe) ⇒ ignorée', () => {
    const events: GameEvent[] = [];
    const s = produce(coopState(2), (draft) => {
      beginGuardianCombat(draft, 'hero-lead', 'g1', events, 'hero-ally');
    });
    expect(s.combat!.stacks.some((st) => st.ownerHeroId)).toBe(false);
  });
});

/**
 * E4.2b — Siège coopératif (doc 18 E4) : même mécanique côté ville. Un héros
 * allié adjacent invité renforce l'assaut ; capture partagée, survivants et XP
 * routés par propriétaire. Piloté par la commande `CaptureTown.allyHeroId`.
 */
function coopSiegeState(): GameState {
  const s: GameState = {
    ...createEmptyState(),
    started: true,
    rng: seedRng(7),
    config: testConfig(),
    currentPlayer: 0,
    unitCatalog: { grunt: unit('grunt'), knight: unit('knight'), wolf: unit('wolf', 4) },
    heroes: [
      // Lead p1 SUR la ville (5,5) ; allié p3 adjacent (5,4), même équipe 1.
      hero('hero-lead', 'p1', [{ unitId: 'grunt', count: 30 }], { x: 5, y: 5 }),
      hero('hero-ally', 'p3', [{ unitId: 'knight', count: 20 }], { x: 5, y: 4 }),
    ],
    // p1 & p3 alliés (équipe 1) ; p2 propriétaire ennemi (équipe 2).
    players: [player('p1', 1), player('p2', 2), player('p3', 1)],
  };
  const town: TownState = {
    id: 't1', ownerPlayerId: 'p2', pos: { x: 5, y: 5 }, factionId: '',
    buildings: {}, builtToday: false, garrison: [{ unitId: 'wolf', count: 1 }],
    stock: {}, spellPool: [], sharedGrowthChoice: {},
  };
  s.towns = [town];
  return s;
}

describe('E4.2b — siège coopératif', () => {
  it('la commande CaptureTown avec allyHeroId agrège l’armée alliée dans l’assaut', () => {
    const { state: next } = apply(coopSiegeState(), {
      type: 'CaptureTown', townId: 't1', playerId: 'p1', allyHeroId: 'hero-ally',
    });
    const attacker = next.combat!.stacks.filter((st) => st.side === 'attacker');
    expect(attacker.some((st) => st.unitId === 'grunt' && st.ownerHeroId === undefined)).toBe(true);
    expect(attacker.some((st) => st.unitId === 'knight' && st.ownerHeroId === 'hero-ally')).toBe(true);
    expect(next.heroes.find((h) => h.id === 'hero-ally')!.army).toEqual([]);
  });

  it('victoire : la ville revient au lead, chaque allié récupère ses survivants et de l’XP', () => {
    const events: GameEvent[] = [];
    const started = apply(coopSiegeState(), {
      type: 'CaptureTown', townId: 't1', playerId: 'p1', allyHeroId: 'hero-ally',
    }).state;
    const done = produce(started, (d) => runAutoCombat(d, events));
    expect(done.combat).toBeNull();
    expect(done.towns[0]?.ownerPlayerId).toBe('p1');
    const lead = done.heroes.find((h) => h.id === 'hero-lead')!;
    const ally = done.heroes.find((h) => h.id === 'hero-ally')!;
    expect(lead.army.some((s) => s.unitId === 'grunt')).toBe(true);
    expect(ally.army.some((s) => s.unitId === 'knight')).toBe(true);
    expect(ally.army.some((s) => s.unitId === 'grunt')).toBe(false);
    expect(lead.xp).toBeGreaterThan(0);
    expect(ally.xp).toBeGreaterThan(0);
  });

  it('sans allyHeroId : siège solo inchangé (aucune pile taguée, armée de l’allié intacte)', () => {
    const { state: next } = apply(coopSiegeState(), {
      type: 'CaptureTown', townId: 't1', playerId: 'p1',
    });
    expect(next.combat!.stacks.some((st) => st.ownerHeroId)).toBe(false);
    expect(next.heroes.find((h) => h.id === 'hero-ally')!.army.length).toBe(1);
  });
});
