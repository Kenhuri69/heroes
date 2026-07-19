import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { beginGuardianCombat, beginHeroCombat } from '../src/combat/setup';
import { runAutoCombat } from '../src/combat/ai';
import type { CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import type { AdventureMapDef } from '../src/adventure/map';
import { testConfig } from './fixtures';

/**
 * UX-ENDSTATS (doc 08 §2.5) — `PlayerState.unitsLost` : au commit d'un combat, les
 * pertes de chaque camp reviennent au joueur de ce camp ; un camp neutre (gardien)
 * n'est attribué à personne. Résout le mécompte du comptage côté client.
 */
function unit(id: string, hp = 10): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'grass',
    stats: { hp, attack: 8, defense: 5, damage: [6, 6], speed: 5 },
    abilities: [],
  };
}

function hero(id: string, playerId: string, army: { unitId: string; count: number }[], pos: { x: number; y: number }): HeroState {
  return {
    id, playerId, pos, movementPoints: 100, naval: false, army, xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0,
    skills: {}, visitLuck: 0, visitMorale: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [], pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [],
    name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  } as unknown as HeroState;
}

function player(id: string) {
  return {
    id, resources: emptyResources(), factionResources: {}, explored: [],
    controller: 'human' as const, eliminated: false, townlessDays: 0, huntContract: null, team: 0,
  };
}

function mapWithGuardian(count: number): AdventureMapDef {
  return {
    id: 'm', width: 6, height: 6, terrain: Array<string>(36).fill('grass'),
    road: Array<boolean>(36).fill(false), triggers: [],
    objects: [{ id: 'g1', type: 'guardian', pos: { x: 1, y: 0 }, unitId: 'wolf', count }],
    startPositions: [{ x: 0, y: 0 }],
  } as unknown as AdventureMapDef;
}

describe('UX-ENDSTATS — unitsLost', () => {
  it('combat vs gardien : les pertes de l’ATTAQUANT reviennent à son joueur, le gardien neutre à personne', () => {
    const events: GameEvent[] = [];
    const state: GameState = {
      ...createEmptyState(),
      started: true,
      rng: seedRng(7),
      config: testConfig(),
      map: mapWithGuardian(24), // gardien costaud ⇒ pertes garanties côté attaquant
      unitCatalog: { grunt: unit('grunt'), wolf: unit('wolf', 8) },
      heroes: [hero('hero-1', 'p1', [{ unitId: 'grunt', count: 20 }], { x: 0, y: 0 })],
      players: [player('p1')],
    };
    const done = produce(state, (draft) => {
      beginGuardianCombat(draft, 'hero-1', 'g1', events);
      runAutoCombat(draft, events);
    });
    const p1 = done.players.find((p) => p.id === 'p1')!;
    const survivingGrunts = done.heroes.find((h) => h.id === 'hero-1')?.army.find((s) => s.unitId === 'grunt')?.count ?? 0;
    // Attribution exacte : pertes = effectif initial − survivants (0 si le héros est tombé).
    expect(p1.unitsLost).toBe(20 - survivingGrunts);
    expect(p1.unitsLost).toBeGreaterThan(0);
    // Le gardien neutre (wolf) n'est attribué à AUCUN joueur : p1 ne compte QUE ses grunts.
    expect(p1.unitsLost).toBeLessThanOrEqual(20);
  });

  it('combat héros-vs-héros : les DEUX joueurs voient leurs pertes comptées', () => {
    const events: GameEvent[] = [];
    const state: GameState = {
      ...createEmptyState(),
      started: true,
      rng: seedRng(3),
      config: testConfig(),
      map: {
        id: 'm', width: 6, height: 6, terrain: Array<string>(36).fill('grass'),
        road: Array<boolean>(36).fill(false), triggers: [], objects: [], startPositions: [{ x: 0, y: 0 }],
      } as unknown as AdventureMapDef,
      unitCatalog: { grunt: unit('grunt'), knight: unit('knight') },
      heroes: [
        hero('hero-att', 'p1', [{ unitId: 'grunt', count: 18 }], { x: 0, y: 0 }),
        hero('hero-def', 'p2', [{ unitId: 'knight', count: 18 }], { x: 1, y: 0 }),
      ],
      players: [player('p1'), player('p2')],
    };
    const done = produce(state, (draft) => {
      beginHeroCombat(draft, 'hero-att', 'hero-def', events);
      runAutoCombat(draft, events);
    });
    const p1 = done.players.find((p) => p.id === 'p1')!;
    const p2 = done.players.find((p) => p.id === 'p2')!;
    // Combat serré à effectif égal : chaque camp perd des unités ⇒ les deux joueurs comptent.
    expect(p1.unitsLost).toBeGreaterThan(0);
    expect(p2.unitsLost).toBeGreaterThan(0);
  });
});
