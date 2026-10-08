import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import type { AdventureMapDef, MapObjectDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Lot R3 — l'IA se sert des lieux qui forgent le héros : lieu d'entraînement,
 * sanctuaire apprenable, cabane de la sorcière (acceptée s'il lui reste au moins
 * 2 emplacements de compétence). Ids génériques, aucune faction.
 */

function aiGame(site: MapObjectDef, skills: Record<string, number> = {}): GameState {
  const map: AdventureMapDef = { ...testMap(), objects: [site] };
  const s = apply(createEmptyState(), {
    type: 'StartGame',
    seed: 5,
    players: [{ id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 10 }] }],
    map,
    config: testConfig(),
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
  return produce(s, (d) => {
    d.players[0]!.controller = 'ai';
    d.players[0]!.explored = d.players[0]!.explored.map(() => 1);
    d.heroes[0]!.skills = skills;
  });
}

const turn = (s: GameState): GameState => produce(s, (d) => void runAiTurn(d, 'p1', []));

const site = (effect: Extract<MapObjectDef, { type: 'visitable' }>['effect']): MapObjectDef => ({
  id: 'site',
  type: 'visitable',
  pos: { x: 3, y: 3 },
  effect,
  frequency: 'oncePerHero',
  visits: {},
});

describe('R3 — l’IA visite les lieux d’apprentissage', () => {
  it('elle va chercher un attribut permanent', () => {
    const s0 = aiGame(site({ kind: 'permanentStat', attribute: 'attack', amount: 1 }));
    const before = s0.heroes[0]!.attributes.attack;
    expect(turn(s0).heroes[0]!.attributes.attack).toBe(before + 1);
  });

  it('à la cabane, elle apprend s’il lui reste 2 emplacements, refuse sinon', () => {
    const hut = site({ kind: 'grantSkill', skillId: 'logistics' });
    const learned = turn(aiGame(hut, { a: 1, b: 1, c: 1, d: 1 }));
    expect(learned.heroes[0]!.skills['logistics']).toBe(1);
    expect(learned.pendingSkillOffer).toBeUndefined();
    const five = turn(aiGame(hut, { a: 1, b: 1, c: 1, d: 1, e: 1 }));
    expect(five.heroes[0]!.skills['logistics']).toBeUndefined();
    expect(five.pendingSkillOffer).toBeUndefined();
  });
});
