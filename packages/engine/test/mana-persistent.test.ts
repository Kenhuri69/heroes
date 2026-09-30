import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { beginGuardianCombat } from '../src/combat/setup';
import { maybeHeroAction } from '../src/combat/ai';
import { dailyManaRegen } from '../src/adventure/config';
import type { AdventureMapDef } from '../src/adventure/map';
import type { HeroSkillDef, SpellDef } from '../src/hero/types';
import { testCatalog, testConfig, testMap } from './fixtures';
import { testTown } from './town-fixtures';

/**
 * LE4/C2 (doc 02 §1.4) — mana persistante : plus de remplissage à l'ouverture
 * du combat ni à l'aube ; régénération `max(base, ⌊% × max⌋)` + Mysticisme ;
 * plein en commençant la journée sur une de ses villes à Guilde. Opt-in : sans
 * le bloc `hero.mana`, rien ne change.
 */

const MANA = { persistent: true, basePerDay: 2, pctPerDay: 10 };
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
  it('dailyManaRegen : max(base, ⌊% × max⌋) + Mysticisme', () => {
    expect(dailyManaRegen(MANA, 10, 0)).toBe(2);
    expect(dailyManaRegen(MANA, 50, 0)).toBe(5);
    expect(dailyManaRegen(MANA, 50, 3)).toBe(8);
  });

  it('à l’aube : régénération partielle, plus de remplissage ; sans le bloc, plein', () => {
    expect(endDay(game(true)).heroes[0]!.mana).toBe(15);
    expect(endDay(game(false)).heroes[0]!.mana).toBe(50);
  });

  it('Mysticisme ajoute sa régénération ; le max plafonne', () => {
    const mystic = produce(game(true), (d) => {
      d.heroes[0]!.skills = { mysticism: 3 };
    });
    expect(endDay(mystic).heroes[0]!.mana).toBe(19);
    const almost = produce(game(true), (d) => {
      d.heroes[0]!.mana = 48;
    });
    expect(endDay(almost).heroes[0]!.mana).toBe(50);
  });

  it('commencer la journée sur une de ses villes à Guilde : plein', () => {
    const inTown = (pool: string[]) =>
      produce(game(true), (d) => {
        d.towns = [testTown({ ownerPlayerId: 'p1', pos: { ...d.heroes[0]!.pos }, spellPool: pool })];
      });
    expect(endDay(inTown(['bolt'])).heroes[0]!.mana).toBe(50);
    expect(endDay(inTown([])).heroes[0]!.mana).toBe(15); // ville sans Guilde : régénération seule
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
});
