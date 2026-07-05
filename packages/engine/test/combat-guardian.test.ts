import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { beginGuardianCombat } from '../src/combat/setup';
import { runAutoCombat } from '../src/combat/ai';
import type { AdventureMapDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * `beginGuardianCombat` (interception héros ↔ gardien, câblage `MoveHero` au
 * lot D) : victoire ⇒ gardien retiré + pertes appliquées à l'armée du héros ;
 * défaite ⇒ héros retiré, effectif survivant écrit sur l'objet gardien.
 * Appelé directement dans un `produce()` (pas encore câblé à `MoveHero`).
 */

function mapWithGuardian(unitId: string, count: number): AdventureMapDef {
  const base = testMap();
  return {
    ...base,
    objects: [...base.objects, { id: 'guardian-1', type: 'guardian', pos: { x: 0, y: 5 }, unitId, count }],
  };
}

function startedGameWithGuardian(guardianUnitId: string, guardianCount: number, heroArmyUnitId: string, heroArmyCount: number): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: heroArmyUnitId, count: heroArmyCount }] },
  ];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 7,
    players,
    map: mapWithGuardian(guardianUnitId, guardianCount),
    config: testConfig(),
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
}

describe('beginGuardianCombat', () => {
  it('victoire du héros : gardien retiré de la carte, survivants dans l’armée du héros', () => {
    // 100 grunts (hp6/dmg1-2) écrasent 1 loup isolé (hp10/dmg2-3) — marge large, pas de flakiness RNG.
    const state = startedGameWithGuardian('blue-wolf', 1, 'red-grunt', 100);
    const events: import('../src/core/events').GameEvent[] = [];
    const next = produce(state, (draft) => {
      beginGuardianCombat(draft, 'hero-p1', 'guardian-1', events);
      runAutoCombat(draft, events);
    });
    expect(next.combat).toBeNull();
    expect(next.map?.objects.some((o) => o.id === 'guardian-1')).toBe(false);
    const hero = next.heroes.find((h) => h.id === 'hero-p1');
    expect(hero).toBeDefined();
    expect(hero?.army.length).toBeGreaterThan(0);
    expect(hero?.army[0]?.count).toBeGreaterThan(0);
    expect(hero?.army[0]?.count).toBeLessThanOrEqual(100);
    expect(events.some((e) => e.type === 'CombatEnded' && e.winner === 'attacker')).toBe(true);
    // R7c : l'événement porte le camp du joueur (ici le héros attaque le gardien)
    // → l'UI en déduit victoire/défaite sans supposer « joueur = attaquant ».
    expect(
      events.some((e) => e.type === 'CombatEnded' && e.playerSide === 'attacker'),
    ).toBe(true);
  });

  it('défaite du héros : héros retiré, effectif survivant écrit sur le gardien', () => {
    // 1 grunt isolé contre 100 loups — le gardien l'emporte largement.
    const state = startedGameWithGuardian('blue-wolf', 100, 'red-grunt', 1);
    const events: import('../src/core/events').GameEvent[] = [];
    const next = produce(state, (draft) => {
      beginGuardianCombat(draft, 'hero-p1', 'guardian-1', events);
      runAutoCombat(draft, events);
    });
    expect(next.combat).toBeNull();
    expect(next.heroes.find((h) => h.id === 'hero-p1')).toBeUndefined();
    const guardian = next.map?.objects.find((o) => o.id === 'guardian-1');
    expect(guardian).toBeDefined();
    if (guardian && guardian.type === 'guardian') {
      expect(guardian.count).toBeGreaterThan(0);
      expect(guardian.count).toBeLessThanOrEqual(100);
    }
    expect(events.some((e) => e.type === 'CombatEnded' && e.winner === 'defender')).toBe(true);
  });
});
