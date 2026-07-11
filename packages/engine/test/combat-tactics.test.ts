import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { beginGuardianCombat } from '../src/combat/setup';
import { runAutoCombat } from '../src/combat/ai';
import type { GameEvent } from '../src/core/events';
import type { HeroSkillDef } from '../src/hero/types';
import type { AdventureMapDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * C-TACTICS (doc 02 §5.1) : compétence Tactique ⇒ phase de placement pré-combat.
 * Le camp joueur repositionne ses piles dans sa bande (`PlaceStack`) puis clôt
 * (`FinishPlacement`). Sans Tactique : le combat démarre directement en bataille.
 */

const TACTICS_CATALOG: Record<string, HeroSkillDef> = {
  tactics: { id: 'tactics', ranks: [{ tacticsColumns: 2 }, { tacticsColumns: 3 }, { tacticsColumns: 4 }] },
};

function mapWithGuardian(unitId: string, count: number): AdventureMapDef {
  const base = testMap();
  return {
    ...base,
    objects: [...base.objects, { id: 'guardian-1', type: 'guardian', pos: { x: 0, y: 5 }, unitId, count }],
  };
}

function startedGame(tactics: number): GameState {
  const players: PlayerSetup[] = [
    {
      id: 'p1',
      startingResources: emptyResources(),
      startingArmy: [{ unitId: 'red-grunt', count: 20 }],
      ...(tactics > 0 ? { startingSkills: { tactics } } : {}),
    },
  ];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 7,
    players,
    map: mapWithGuardian('blue-wolf', 1),
    config: testConfig(),
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
    skillCatalog: TACTICS_CATALOG,
  }).state;
}

function openCombat(state: GameState): GameState {
  const events: GameEvent[] = [];
  return produce(state, (draft) => {
    beginGuardianCombat(draft, 'hero-p1', 'guardian-1', events);
  });
}

describe('C-TACTICS — phase de placement', () => {
  it('un héros doté de Tactique ouvre le combat en phase de placement (aucun tour joué)', () => {
    const state = openCombat(startedGame(1));
    expect(state.combat?.phase).toBe('placement');
    expect(state.combat?.activeStackId).toBeNull();
  });

  it('sans Tactique : le combat démarre directement en bataille', () => {
    const state = openCombat(startedGame(0));
    expect(state.combat?.phase).toBe('battle');
    expect(state.combat?.activeStackId).not.toBeNull();
  });

  it('PlaceStack repositionne une pile du camp joueur dans sa bande', () => {
    const state = openCombat(startedGame(1)); // rang 1 ⇒ tacticsColumns 2, bande cols [0,2]
    const stackId = state.combat!.stacks.find((s) => s.side === 'attacker')!.id;
    const next = apply(state, { type: 'PlaceStack', stackId, to: { col: 2, row: 3 } }).state;
    const moved = next.combat!.stacks.find((s) => s.id === stackId)!;
    expect(moved.pos).toEqual({ col: 2, row: 3 });
    expect(next.combat?.phase).toBe('placement'); // toujours en placement
  });

  it('PlaceStack hors bande / pile ennemie : rejeté', () => {
    const state = openCombat(startedGame(1));
    const own = state.combat!.stacks.find((s) => s.side === 'attacker')!.id;
    const enemy = state.combat!.stacks.find((s) => s.side === 'defender')!.id;
    // Col 5 hors de la bande [0,2].
    expect(() => apply(state, { type: 'PlaceStack', stackId: own, to: { col: 5, row: 3 } })).toThrow();
    // Une pile ennemie ne se place pas.
    expect(() => apply(state, { type: 'PlaceStack', stackId: enemy, to: { col: 1, row: 1 } })).toThrow();
  });

  it('FinishPlacement clôt le placement et démarre la bataille (premier tour posé)', () => {
    const state = openCombat(startedGame(1));
    const next = apply(state, { type: 'FinishPlacement' }).state;
    expect(next.combat?.phase).toBe('battle');
    expect(next.combat?.activeStackId).not.toBeNull();
  });

  it('les actions de combat sont rejetées pendant le placement', () => {
    const state = openCombat(startedGame(1));
    expect(() =>
      apply(state, { type: 'CombatAction', action: { type: 'defend' } }),
    ).toThrow();
  });

  it('l’auto-combat saute une phase de placement pendante et résout le combat', () => {
    const events: GameEvent[] = [];
    const next = produce(startedGame(1), (draft) => {
      beginGuardianCombat(draft, 'hero-p1', 'guardian-1', events);
      expect(draft.combat?.phase).toBe('placement');
      runAutoCombat(draft, events);
    });
    // 20 grunts contre 1 loup : le combat se résout (auto-skip du placement).
    expect(next.combat).toBeNull();
    expect(events.some((e) => e.type === 'CombatEnded')).toBe(true);
  });
});
