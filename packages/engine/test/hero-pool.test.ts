import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type PlayerState } from '../src/core/state';
import type { ResolvedHeroDef } from '../src/hero/types';
import type { BuildingDef, TownState } from '../src/town/types';
import { playTownTurn } from '../src/ai/town-ai';
import { testConfig, testMap } from './fixtures';

/**
 * Lot M-TAVERN.4 — pool de taverne exclusif inter-joueurs + IA recruteuse.
 * Un héros du roster ne peut être VIVANT que chez un joueur ; mort ⇒ re-recrutable.
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

function player(id: string, gold: number): PlayerState {
  return { id, resources: { ...emptyResources(), gold }, factionResources: {}, explored: [], controller: id === 'p2' ? 'ai' : 'human', eliminated: false, townlessDays: 0, huntContract: null, team: 0 };
}

function town(id: string, ownerPlayerId: string): TownState {
  return { id, ownerPlayerId, pos: { x: 5, y: 5 }, factionId: 'fac-x', buildings: { tavern: 1 }, builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {} };
}

function state(over: { p1Gold?: number; p2Gold?: number; current?: number } = {}): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(1);
  s.map = testMap();
  s.currentPlayer = over.current ?? 0;
  s.players = [player('p1', over.p1Gold ?? 5000), player('p2', over.p2Gold ?? 5000)];
  s.towns = [town('t1', 'p1'), town('t2', 'p2')];
  s.buildingCatalog = CATALOG;
  s.heroRoster = { knight: KNIGHT };
  return s;
}

const recruitBy = (playerId: string, townId: string) =>
  ({ type: 'RecruitHero' as const, townId, heroId: 'knight', playerId });

describe('M-TAVERN.4 — pool exclusif', () => {
  it('un héros vivant chez p1 est refusé à p2', () => {
    const afterP1 = apply(state(), recruitBy('p1', 't1')).state;
    // Au tour de p2 : recruter le même héros de roster est refusé (déjà en jeu).
    const atP2 = { ...afterP1, currentPlayer: 1 };
    expect(validate(atP2, recruitBy('p2', 't2'))?.code).toBe('invalidAction');
  });

  it('un héros MORT (retiré) redevient recrutable', () => {
    const afterP1 = apply(state(), recruitBy('p1', 't1')).state;
    // Le héros de p1 meurt (retiré de `heroes`) — p2 peut alors le recruter.
    const p1Dead: GameState = { ...afterP1, currentPlayer: 1, heroes: afterP1.heroes.filter((h) => h.rosterId !== 'knight') };
    expect(validate(p1Dead, recruitBy('p2', 't2'))).toBeNull();
  });

  it('le héros recruté porte rosterId = id du roster', () => {
    const afterP1 = apply(state(), recruitBy('p1', 't1')).state;
    expect(afterP1.heroes.find((h) => h.rosterId === 'knight')).toBeDefined();
  });
});

describe('M-TAVERN.4 — IA recruteuse', () => {
  it('l’IA riche et sous le cap recrute un héros à sa ville dotée d’une Taverne', () => {
    const s = state({ current: 1, p2Gold: 100000 }); // p2 = IA, tour de p2, très riche
    const next = produce(s, (draft) => {
      const t = draft.towns.find((tw) => tw.id === 't2')!;
      const p = draft.players.find((pl) => pl.id === 'p2')!;
      playTownTurn(draft, t, p, []);
    });
    expect(next.heroes.some((h) => h.playerId === 'p2' && h.rosterId === 'knight')).toBe(true);
  });

  it('l’IA pauvre (or < coût × marge) ne recrute pas', () => {
    const s = state({ current: 1, p2Gold: 3000 }); // ≥ coût (2500) mais < 2× marge
    const next = produce(s, (draft) => {
      const t = draft.towns.find((tw) => tw.id === 't2')!;
      const p = draft.players.find((pl) => pl.id === 'p2')!;
      playTownTurn(draft, t, p, []);
    });
    expect(next.heroes.some((h) => h.playerId === 'p2')).toBe(false);
  });
});
