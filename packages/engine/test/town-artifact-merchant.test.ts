import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { BuildingDef } from '../src/town/types';
import { artifactSellPrice } from '../src/town/artifact-merchant';
import { testConfig } from './fixtures';
import { testTown } from './town-fixtures';

/**
 * Marchand d'artefacts (doc 18 D2) — VENTE : un héros présent à une ville à
 * marché vend un artefact contre or. Prix dérivé des bonus (data), déterministe.
 */
const MARKET = { sellRate: 25, buyRate: 50, artifactValuePerPoint: 500, artifactSellFactor: 0.5 };

const marketCatalog: Record<string, BuildingDef> = {
  market: { id: 'market', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'market' } }] },
};

function hero(artifacts: (string | null)[], backpack?: string[]): HeroState {
  return {
    id: 'hero-p1', playerId: 'p1', pos: { x: 5, y: 5 },
    movementPoints: 100, naval: false, army: [{ unitId: 'grunt', count: 1 }],
    xp: 0, level: 1, attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0, manaMax: 0, skills: {}, visitLuck: 0, visitMorale: 0, spells: [],
    artifacts, ...(backpack ? { backpack } : {}),
    pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  } as unknown as HeroState;
}

function merchantState(h: HeroState): GameState {
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    currentPlayer: 0,
    config: { ...testConfig(), market: MARKET },
    buildingCatalog: marketCatalog,
    artifactCatalog: {
      'relic-att': { id: 'relic-att', bonus: { attack: 2 } }, // 2 pts × 500 = 1000, vente 500
      'trinket': { id: 'trinket', bonus: { luck: 1 } }, // 1 pt × 500 = 500, vente 250
    },
    towns: [testTown({ ownerPlayerId: 'p1', buildings: { market: 1 }, pos: { x: 5, y: 5 } })],
    heroes: [h],
    players: [
      { id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: -1, huntContract: null, team: 0 },
    ],
  };
}

describe('D2 — marchand d’artefacts (vente)', () => {
  it('artifactSellPrice : dérivé des bonus × facteur (arrondi bas)', () => {
    expect(artifactSellPrice({ id: 'a', bonus: { attack: 2 } }, MARKET)).toBe(500); // 2×500×0.5
    expect(artifactSellPrice({ id: 'a', bonus: { luck: 1 } }, MARKET)).toBe(250);
    // `value` explicite prime sur la dérivation.
    expect(artifactSellPrice({ id: 'a', bonus: { attack: 2 }, value: 100 }, MARKET)).toBe(50);
  });

  it('vend un artefact équipé : slot vidé, or crédité, événement émis', () => {
    const s = merchantState(hero(['relic-att', null, null, null, null, null, null, null, null, null]));
    const r = apply(s, { type: 'SellArtifact', townId: 'town-1', heroId: 'hero-p1', source: 'equipped', index: 0 });
    expect(r.state.heroes[0]!.artifacts[0]).toBeNull();
    expect(r.state.players[0]!.resources.gold).toBe(500);
    expect(r.events.some((e) => e.type === 'ArtifactSold' && e.gold === 500)).toBe(true);
  });

  it('vend un artefact du sac : entrée retirée, or crédité', () => {
    const s = merchantState(
      hero(Array.from({ length: 10 }, () => null), ['relic-att', 'trinket']),
    );
    const r = apply(s, { type: 'SellArtifact', townId: 'town-1', heroId: 'hero-p1', source: 'backpack', index: 1 });
    expect(r.state.heroes[0]!.backpack).toEqual(['relic-att']); // trinket retiré
    expect(r.state.players[0]!.resources.gold).toBe(250);
  });

  it('refus : héros absent de la ville', () => {
    const h = hero(['relic-att', ...Array.from({ length: 9 }, () => null)]);
    h.pos = { x: 0, y: 0 };
    const s = merchantState(h);
    expect(
      validate(s, { type: 'SellArtifact', townId: 'town-1', heroId: 'hero-p1', source: 'equipped', index: 0 })?.code,
    ).toBe('invalidAction');
  });

  it('refus : emplacement vide', () => {
    const s = merchantState(hero(Array.from({ length: 10 }, () => null)));
    expect(
      validate(s, { type: 'SellArtifact', townId: 'town-1', heroId: 'hero-p1', source: 'equipped', index: 0 })?.code,
    ).toBe('invalidTarget');
  });
});
