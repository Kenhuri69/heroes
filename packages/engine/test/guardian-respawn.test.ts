import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { beginGuardianCombat } from '../src/combat/setup';
import { checkCombatEnd } from '../src/combat/turns';
import { recordLoss } from '../src/combat/state-helpers';
import { runAutoCombat } from '../src/combat/ai';
import type { AdventureMapDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Respawn de gardiens (doc 18 A2b) — OPT-IN par `respawnDays` sur le gardien :
 * vaincu, il réapparaît N jours plus tard au même endroit avec son effectif
 * pré-combat ; sans le champ, comportement historique bit-identique (la file
 * `map.respawns` n'est jamais créée).
 */

const GUARDIAN_POS = { x: 0, y: 5 };

function mapWithGuardian(count: number, respawnDays?: number): AdventureMapDef {
  const base = testMap();
  return {
    ...base,
    objects: [
      ...base.objects,
      {
        id: 'guardian-1',
        type: 'guardian',
        pos: { ...GUARDIAN_POS },
        unitId: 'blue-wolf',
        count,
        ...(respawnDays !== undefined ? { respawnDays } : {}),
      },
    ],
  };
}

function startedGame(guardianCount: number, respawnDays?: number): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 100 }] },
  ];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 7,
    players,
    map: mapWithGuardian(guardianCount, respawnDays),
    config: testConfig(),
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
}

/** Vainc le gardien en auto-combat (100 grunts vs quelques loups — marge large). */
function defeatGuardian(state: GameState): GameState {
  return produce(state, (draft) => {
    const events: import('../src/core/events').GameEvent[] = [];
    beginGuardianCombat(draft, 'hero-p1', 'guardian-1', events);
    runAutoCombat(draft, events);
  });
}

function endTurn(state: GameState): GameState {
  return apply(state, { type: 'EndTurn', playerId: 'p1' }).state;
}

describe('respawn de gardiens (doc 18 A2b)', () => {
  it('gardien `respawnDays: 2` vaincu au jour 1 : absent au jour 2, de retour au jour 3 (même id/pos, effectif pré-combat)', () => {
    let state = defeatGuardian(startedGame(3, 2));
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(false);
    expect(state.map?.respawns).toEqual([
      { day: 3, object: { id: 'guardian-1', type: 'guardian', pos: GUARDIAN_POS, unitId: 'blue-wolf', count: 3, respawnDays: 2 } },
    ]);

    state = endTurn(state); // jour 2 — pas encore dû
    expect(state.calendar.day).toBe(2);
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(false);

    state = endTurn(state); // jour 3 — dû
    const guardian = state.map?.objects.find((o) => o.id === 'guardian-1');
    expect(guardian).toBeDefined();
    if (guardian && guardian.type === 'guardian') {
      expect(guardian.pos).toEqual(GUARDIAN_POS);
      expect(guardian.count).toBe(3);
      expect(guardian.respawnDays).toBe(2); // le revenant reste re-farmable
    }
    expect(state.map?.respawns).toEqual([]);
  });

  it('sans `respawnDays` : disparition définitive ET la file `map.respawns` n’est jamais créée (forme d’état inchangée)', () => {
    let state = defeatGuardian(startedGame(3));
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(false);
    expect(state.map && 'respawns' in state.map).toBe(false);
    for (let i = 0; i < 3; i += 1) state = endTurn(state);
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(false);
    expect(state.map && 'respawns' in state.map).toBe(false);
  });

  it('tuile occupée par un héros au jour dû : la réapparition est reportée au premier jour libre', () => {
    let state = defeatGuardian(startedGame(3, 1)); // dû au jour 2
    state = produce(state, (draft) => {
      const hero = draft.heroes.find((h) => h.id === 'hero-p1');
      if (hero) hero.pos = { ...GUARDIAN_POS }; // campe sur la tuile du gardien
    });
    state = endTurn(state); // jour 2 — tuile occupée ⇒ report
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(false);
    expect(state.map?.respawns).toHaveLength(1);

    state = produce(state, (draft) => {
      const hero = draft.heroes.find((h) => h.id === 'hero-p1');
      if (hero) hero.pos = { x: 0, y: 0 }; // libère la tuile
    });
    state = endTurn(state); // jour 3 — libre ⇒ réapparition
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(true);
    expect(state.map?.respawns).toEqual([]);
  });

  it('anéantissement mutuel (B17) : le respawn est queué avec l’effectif PRÉ-combat, pas 0', () => {
    let state = startedGame(10, 2);
    state = produce(state, (draft) => {
      const events: import('../src/core/events').GameEvent[] = [];
      beginGuardianCombat(draft, 'hero-p1', 'guardian-1', events);
      // Simule un tick de poison qui vide les DEUX camps dans le même round.
      const combat = draft.combat!;
      for (const s of combat.stacks) {
        recordLoss(combat, s, s.count);
        s.count = 0;
        s.firstHp = 0;
      }
      combat.stacks.splice(0);
      checkCombatEnd(draft, events);
    });
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(false);
    expect(state.map?.respawns?.[0]?.object.count).toBe(10);

    state = endTurn(state); // jour 2
    state = endTurn(state); // jour 3 — dû (le héros est mort, le joueur joue toujours)
    const guardian = state.map?.objects.find((o) => o.id === 'guardian-1');
    expect(guardian).toBeDefined();
    if (guardian && guardian.type === 'guardian') expect(guardian.count).toBe(10);
  });

  it('StartGame rejette un `respawnDays` non positif', () => {
    expect(
      validate(createEmptyState(), {
        type: 'StartGame',
        seed: 1,
        players: [{ id: 'p1', startingResources: emptyResources() }],
        map: mapWithGuardian(3, 0),
        config: testConfig(),
        unitCatalog: testCatalog(),
        buildingCatalog: {},
        towns: [],
      })?.code,
    ).toBe('invalidMap');
  });
});
