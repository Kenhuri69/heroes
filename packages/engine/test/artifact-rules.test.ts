import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { GuardianRewardConfig } from '../src/adventure/config';
import { rewardGuardianDefeat } from '../src/adventure/guardian-reward';
import { heroEffectTotal, heroGoldPerDay } from '../src/hero/skills';
import { heroManaMax } from '../src/hero/artifacts';
import type { ArtifactDef } from '../src/hero/types';
import { dailyIncome } from '../src/town/economy';
import { merchantBuyStock } from '../src/town/artifact-merchant';
import { testCatalog, testConfig, testMap } from './fixtures';
import { testTown } from './town-fixtures';

/**
 * LE7 C3 — artefacts qui changent une règle (`effects`, vocabulaire des
 * compétences) et reliques (grande banque seule : jamais au butin de gardien ni
 * au marchand).
 */

const CATALOG: Record<string, ArtifactDef> = {
  purse: { id: 'purse', bonus: { luck: 1 }, effects: { goldPerDay: 500 } },
  orb: { id: 'orb', bonus: { power: 1 }, effects: { spellDamagePct: 25, manaMaxPct: 50 } },
  relic: { id: 'relic', bonus: { attack: 6 }, relic: true },
  plain: { id: 'plain', bonus: { defense: 1 } },
};

function heroWith(equipped: (string | null)[], backpack: string[] = []): HeroState {
  const arts = Array.from({ length: 10 }, () => null) as (string | null)[];
  equipped.forEach((id, i) => (arts[i] = id));
  return {
    id: 'hero-p1', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 2 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, visitMorale: 0, spells: [], artifacts: arts, backpack, pendingSkillChoices: [],
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

describe('LE7 C3 — effets de règle des artefacts', () => {
  it('un artefact équipé ajoute ses effets ; au sac, rien', () => {
    const worn = heroWith(['orb']);
    expect(heroEffectTotal(worn, {}, 'spellDamagePct', CATALOG)).toBe(25);
    expect(heroEffectTotal(worn, {}, 'spellDamagePct')).toBe(0); // catalogue non fourni
    expect(heroEffectTotal(heroWith([], ['orb']), {}, 'spellDamagePct', CATALOG)).toBe(0);
    // (Savoir 2 + 0) × 10 = 20, +50 % d'Intelligence d'artefact.
    expect(heroManaMax(worn, CATALOG, {})).toBe(30);
  });

  it('Bourse : or quotidien du joueur', () => {
    const hero = heroWith(['purse']);
    expect(heroGoldPerDay(hero, {}, CATALOG)).toBe(500);
    const state: GameState = {
      ...createEmptyState(),
      heroes: [hero],
      artifactCatalog: CATALOG,
      players: [
        { id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
      ],
    };
    expect(dailyIncome(state, 'p1').gold).toBe(500);
  });
});

describe('LE7 C3 — reliques', () => {
  const REWARD: GuardianRewardConfig = {
    goldPerHp: 1,
    variancePercent: 0,
    resources: [],
    resourceThresholdHp: 1_000_000,
    resourceAmount: { min: 1, max: 1 },
    artifactThresholdHp: 1,
    artifactChancePercent: 100,
  };

  function withGuardian(seed: number): GameState {
    const base = testMap();
    const s = apply(createEmptyState(), {
      type: 'StartGame',
      seed,
      players: [{ id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 10 }] }],
      map: { ...base, objects: [...base.objects, { id: 'g', type: 'guardian', pos: { x: 0, y: 5 }, unitId: 'blue-wolf', count: 50 }] },
      config: { ...testConfig(), guardianReward: REWARD },
      unitCatalog: testCatalog(),
      buildingCatalog: {},
      towns: [],
    }).state;
    return { ...s, artifactCatalog: { relic: CATALOG.relic!, plain: CATALOG.plain! } };
  }

  it('jamais au butin d’un gardien', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const events: GameEvent[] = [];
      produce(withGuardian(seed), (d) => rewardGuardianDefeat(d, d.heroes[0]!, 'g', events));
      const ev = events.find((e) => e.type === 'GuardianVanquished');
      expect(ev?.type === 'GuardianVanquished' && ev.artifactId).toBe('plain');
    }
  });

  it('jamais au stock du marchand', () => {
    const state: GameState = {
      ...createEmptyState(),
      config: { ...testConfig(), market: { sellRate: 25, buyRate: 50, artifactValuePerPoint: 500, artifactSellFactor: 0.5, artifactStockSize: 4 } },
      artifactCatalog: CATALOG,
    };
    const stock = merchantBuyStock(state, testTown());
    expect(stock.sort()).toEqual(['orb', 'plain', 'purse']);
  });
});
