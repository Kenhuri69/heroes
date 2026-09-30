import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { beginGuardianCombat } from '../src/combat/setup';
import { maybeHeroAction } from '../src/combat/ai';
import { runAiTurn } from '../src/ai/adventure';
import { heroDailyManaRegen } from '../src/hero/mana';
import type { AdventureMapDef } from '../src/adventure/map';
import type { HeroSkillDef, SpellDef } from '../src/hero/types';
import { testCatalog, testConfig, testMap } from './fixtures';
import { testTown } from './town-fixtures';

/**
 * LE4/C2 (doc 02 §1.4, décision utilisateur 2026-09-30) — mana persistante :
 * aucune recharge après un combat ; l'aube rend `max(1, Savoir)` + Mysticisme ;
 * une de ses villes remonte à 50 % (100 % avec une Guilde) ; une fontaine de
 * mana remplit à 100 %, une fois par jour. Opt-in : sans `hero.mana`, rien ne change.
 */

const MANA = { persistent: true, basePerDay: 1, perKnowledge: 1, townRestorePct: 50 };
const SKILLS: Record<string, HeroSkillDef> = {
  mysticism: { id: 'mysticism', ranks: [{ manaRegenPerDay: 2 }, { manaRegenPerDay: 3 }, { manaRegenPerDay: 4 }] },
};
const BOLT: SpellDef = { id: 'bolt', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 5, perPower: 0 };

function mapWithGuardian(count: number): AdventureMapDef {
  const base = testMap();
  return { ...base, objects: [...base.objects, { id: 'g', type: 'guardian', pos: { x: 0, y: 5 }, unitId: 'blue-wolf', count }] };
}

function game(persistent: boolean, opts: { knowledge?: number; map?: AdventureMapDef; army?: number } = {}): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: opts.army ?? 10 }] },
  ];
  const config = testConfig();
  let s = apply(createEmptyState(), {
    type: 'StartGame',
    seed: 5,
    players,
    map: opts.map ?? testMap(),
    config: { ...config, hero: { ...config.hero, ...(persistent ? { mana: MANA } : {}) } },
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
  s = produce(s, (d) => {
    d.skillCatalog = SKILLS;
    d.spellCatalog = { bolt: BOLT };
    const h = d.heroes[0]!;
    h.attributes.knowledge = opts.knowledge ?? 5; // manaMax 50
    h.spells = ['bolt'];
    h.manaMax = 50;
    h.mana = 10;
  });
  return s;
}

const endDay = (s: GameState): GameState => apply(s, { type: 'EndTurn', playerId: 'p1' }).state;

describe('LE4/C2 — mana persistante', () => {
  it('régénération de l’aube : max(1, Savoir effectif) + Mysticisme', () => {
    const s = game(true);
    expect(heroDailyManaRegen(s, s.heroes[0]!, MANA)).toBe(5);
    const weak = produce(s, (d) => {
      d.heroes[0]!.attributes.knowledge = 0;
    });
    expect(heroDailyManaRegen(weak, weak.heroes[0]!, MANA)).toBe(1);
    const mystic = produce(s, (d) => {
      d.heroes[0]!.skills = { mysticism: 3 };
    });
    expect(heroDailyManaRegen(mystic, mystic.heroes[0]!, MANA)).toBe(9);
  });

  it('à l’aube : régénération partielle, plus de remplissage ; sans le bloc, plein', () => {
    expect(endDay(game(true)).heroes[0]!.mana).toBe(15);
    expect(endDay(game(false)).heroes[0]!.mana).toBe(50);
    const almost = produce(game(true), (d) => {
      d.heroes[0]!.mana = 48;
    });
    expect(endDay(almost).heroes[0]!.mana).toBe(50); // plafonné au max
  });

  it('dormir en ville : 50 % sans Guilde, 100 % avec (jamais de baisse)', () => {
    const inTown = (pool: string[], mana = 10) =>
      produce(game(true), (d) => {
        d.heroes[0]!.mana = mana;
        d.towns = [testTown({ ownerPlayerId: 'p1', pos: { ...d.heroes[0]!.pos }, spellPool: pool })];
      });
    expect(endDay(inTown([])).heroes[0]!.mana).toBe(25);
    expect(endDay(inTown(['bolt'])).heroes[0]!.mana).toBe(50);
    expect(endDay(inTown([], 40)).heroes[0]!.mana).toBe(45); // au-dessus du palier : régénération seule
  });

  it('entrer dans sa ville recharge la mana (événement ManaRestored)', () => {
    const s = produce(game(true), (d) => {
      d.towns = [testTown({ ownerPlayerId: 'p1', pos: { x: 1, y: 0 }, spellPool: [] })];
    });
    const { state: next, events } = apply(s, { type: 'MoveHero', heroId: s.heroes[0]!.id, path: [{ x: 1, y: 0 }] });
    expect(next.heroes[0]!.mana).toBe(25);
    expect(events).toContainEqual({ type: 'ManaRestored', heroId: s.heroes[0]!.id, playerId: 'p1', amount: 15, source: 'town' });
  });

  it('fontaine de mana : 100 %, une fois par héros et par jour', () => {
    const map = testMap();
    const fountainMap: AdventureMapDef = {
      ...map,
      objects: [
        ...map.objects,
        { id: 'f', type: 'visitable', pos: { x: 1, y: 0 }, effect: { kind: 'restoreMana' }, frequency: 'oncePerHeroPerDay', visits: {} },
      ],
    };
    const s = game(true, { map: fountainMap });
    const heroId = s.heroes[0]!.id;
    const drink = (st: GameState) => apply(st, { type: 'MoveHero', heroId, path: [{ x: 1, y: 0 }] }).state;
    const back = (st: GameState) => apply(st, { type: 'MoveHero', heroId, path: [{ x: 0, y: 0 }] }).state;
    const first = drink(s);
    expect(first.heroes[0]!.mana).toBe(50);
    const drained = produce(back(first), (d) => {
      d.heroes[0]!.mana = 10;
    });
    expect(drink(drained).heroes[0]!.mana).toBe(10); // déjà bue aujourd'hui
    const tomorrow = produce(endDay(drained), (d) => {
      d.heroes[0]!.mana = 10;
    });
    expect(drink(tomorrow).heroes[0]!.mana).toBe(50);
  });

  it('à l’ouverture d’un combat : la mana restante est conservée (sans le bloc, pleine)', () => {
    const open = (persistent: boolean) =>
      produce(game(persistent, { map: mapWithGuardian(1) }), (d) => {
        beginGuardianCombat(d, d.heroes[0]!.id, 'g', []);
      }).heroes[0]!.mana;
    expect(open(true)).toBe(10);
    expect(open(false)).toBe(50);
  });

  it('IA : garde sa mana quand son camp domine (≥ 3×), la dépense sinon', () => {
    const castsWith = (army: number, persistent: boolean): boolean => {
      const s = produce(game(persistent, { map: mapWithGuardian(3), army }), (d) => {
        beginGuardianCombat(d, d.heroes[0]!.id, 'g', []);
      });
      const events: GameEvent[] = [];
      produce(s, (d) => {
        maybeHeroAction(d, events, 'attacker');
      });
      return events.some((e) => e.type === 'SpellCast');
    };
    expect(castsWith(100, true)).toBe(false); // écrasant : mana gardée
    expect(castsWith(100, false)).toBe(true); // mana gratuite chaque combat : on la dépense
    expect(castsWith(2, true)).toBe(true); // combat serré : on lance
  });

  it('IA : à court de mana, elle marche vers une fontaine', () => {
    const map = testMap();
    const fountainMap: AdventureMapDef = {
      ...map,
      objects: [
        { id: 'f', type: 'visitable', pos: { x: 3, y: 3 }, effect: { kind: 'restoreMana' }, frequency: 'oncePerHeroPerDay', visits: {} },
      ],
    };
    const run = (mana: number) => {
      let s = game(true, { map: fountainMap });
      s = produce(s, (d) => {
        d.players[0]!.controller = 'ai';
        d.players[0]!.explored = d.players[0]!.explored.map(() => 1);
        d.heroes[0]!.mana = mana;
      });
      return produce(s, (d) => {
        runAiTurn(d, 'p1', []);
      }).heroes[0]!.mana;
    };
    expect(run(10)).toBe(50);
    expect(run(40)).toBe(40); // plus de la moitié : la fontaine n'est pas une cible
  });
});
