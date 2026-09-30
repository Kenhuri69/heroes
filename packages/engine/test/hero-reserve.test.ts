import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type PlayerState } from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import { sendToReserve } from '../src/combat/leave';
import type { CombatState } from '../src/combat/types';
import type { ResolvedHeroDef } from '../src/hero/types';
import type { BuildingDef, TownState } from '../src/town/types';
import { playTownTurn } from '../src/ai/town-ai';
import { testConfig, testMap } from './fixtures';

/**
 * LE6 E1 — fuite HoMM : le héros en fuite quitte la carte pour la réserve de son
 * joueur, puis revient tel quel (niveau, artefacts) dans l'une de ses Tavernes.
 */

const KNIGHT: ResolvedHeroDef = {
  factionId: 'fac-x',
  name: '@loc:hero.knight.name',
  attributes: { attack: 2, defense: 2, power: 1, knowledge: 1 },
  specialtyId: '',
  specialtyEffects: [],
  startingSkills: {},
  startingSpells: [],
};

const CATALOG: Record<string, BuildingDef> = {
  tavern: { id: 'tavern', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'tavern' } }] },
};

function player(id: string): PlayerState {
  return {
    id,
    resources: { ...emptyResources(), gold: 10000 },
    factionResources: {},
    explored: [],
    controller: 'human',
    eliminated: false,
    townlessDays: 0,
    huntContract: null,
    team: 0,
  };
}

function town(id: string, owner: string, factionId: string, pos: { x: number; y: number }): TownState {
  return { id, ownerPlayerId: owner, pos, factionId, buildings: { tavern: 1 }, builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {} };
}

/** p1 a recruté le chevalier (niveau 5, un artefact), qui a ensuite fui. */
function afterRetreat(retreatToTavern = true): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  if (retreatToTavern) s.config.hero.retreatToTavern = true;
  s.rng = seedRng(1);
  s.map = testMap();
  s.players = [player('p1'), player('p2')];
  s.towns = [
    town('t1', 'p1', 'fac-x', { x: 5, y: 5 }),
    town('t1b', 'p1', 'fac-other', { x: 8, y: 8 }),
    town('t2', 'p2', 'fac-x', { x: 1, y: 8 }),
  ];
  s.buildingCatalog = CATALOG;
  s.heroRoster = { knight: KNIGHT };
  let next = apply(s, { type: 'RecruitHero', townId: 't1', heroId: 'knight', playerId: 'p1' }).state;
  next = produce(next, (d) => {
    const h = d.heroes[0]!;
    h.level = 5;
    h.xp = 4000;
    h.artifacts[0] = 'relic';
    h.army = [{ unitId: 'grunt', count: 3 }];
    sendToReserve(d, h.id, []);
  });
  return next;
}

describe('LE6 E1 — fuite HoMM', () => {
  it('le héros en fuite quitte la carte et rejoint la réserve de son joueur, armée vide', () => {
    const s = afterRetreat();
    expect(s.heroes).toHaveLength(0);
    const reserve = s.players[0]!.reserveHeroes ?? [];
    expect(reserve).toHaveLength(1);
    expect(reserve[0]).toMatchObject({ level: 5, xp: 4000, army: [] });
  });

  it('recrutable dans n’importe quelle Taverne du joueur, même d’une autre faction, tel qu’il est parti', () => {
    const s = afterRetreat();
    const { state } = apply(s, { type: 'RecruitHero', townId: 't1b', heroId: 'knight', playerId: 'p1' });
    const hero = state.heroes[0]!;
    expect(hero).toMatchObject({ level: 5, xp: 4000, playerId: 'p1' });
    expect(hero.artifacts[0]).toBe('relic');
    expect(hero.pos).toMatchObject({ x: 8, y: 8 });
    expect(hero.movementPoints).toBeGreaterThan(0);
    expect(state.players[0]!.reserveHeroes).toBeUndefined();
    expect(state.players[0]!.resources.gold).toBe(10000 - 2500 * 2);
  });

  it('pool exclusif : un héros en réserve n’est pas recrutable par un autre joueur', () => {
    const s = { ...afterRetreat(), currentPlayer: 1 };
    expect(validate(s, { type: 'RecruitHero', townId: 't2', heroId: 'knight', playerId: 'p2' })?.code).toBe(
      'invalidAction',
    );
  });

  it('Retreat en combat ⇒ réserve ; règle absente ⇒ le héros reste sur la carte', () => {
    const withCombat = (rule: boolean): GameState =>
      produce(afterRetreat(rule), (d) => {
        // Remet le héros sur la carte, en combat contre un gardien fictif.
        const p = d.players[0]!;
        const hero = p.reserveHeroes![0]!;
        d.heroes.push(hero);
        delete p.reserveHeroes;
        hero.army = [{ unitId: 'grunt', count: 3 }];
        d.unitCatalog = {
          grunt: { id: 'grunt', groupId: 'g', nativeTerrain: 'grass', stats: { hp: 5, attack: 1, defense: 1, damage: [1, 1], speed: 5 }, abilities: [] },
        };
        const combat = {
          terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
          stacks: [
            { id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt', count: 3, firstHp: 5, pos: { col: 0, row: 2 }, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [] },
            { id: 'defender-0', side: 'defender', slot: 0, unitId: 'grunt', count: 30, firstHp: 5, pos: { col: 14, row: 2 }, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [] },
          ],
          activeStackId: 'attacker-0', playerSide: 'attacker', heroId: hero.id, guardianObjectId: null, townId: null,
          wallDefenseBonus: 0, attackerHeroId: hero.id, defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [],
          finished: false, winner: null,
        } satisfies CombatState;
        d.combat = combat as unknown as CombatState;
      });
    const events: GameEvent[] = [];
    const on = apply(withCombat(true), { type: 'Retreat' });
    events.push(...on.events);
    expect(on.state.heroes).toHaveLength(0);
    expect(on.state.players[0]!.reserveHeroes).toHaveLength(1);
    expect(events.some((e) => e.type === 'HeroRetreatedToTavern')).toBe(true);
    const off = apply(withCombat(false), { type: 'Retreat' }).state;
    expect(off.heroes).toHaveLength(1);
    expect(off.heroes[0]!.army).toEqual([]);
    expect(off.players[0]!.reserveHeroes).toBeUndefined();
  });
});

describe('LE6 B3 — l’IA relance son héros de réserve', () => {
  it('à sa Taverne, l’IA recrute d’abord le héros qui a fui', () => {
    const s = produce(afterRetreat(), (d) => {
      d.players[0]!.controller = 'ai';
      d.players[0]!.resources.gold = 100000;
      d.heroRoster['a-squire'] = { ...KNIGHT, name: '@loc:hero.squire.name' }; // trié avant « knight »
    });
    const next = produce(s, (d) => {
      playTownTurn(d, d.towns[0]!, d.players[0]!, []);
    });
    expect(next.heroes.map((h) => h.rosterId)).toEqual(['knight']);
    expect(next.heroes[0]!.level).toBe(5);
  });
});
