import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { beginGuardianCombat } from '../src/combat/setup';
import { advanceTurn } from '../src/combat/turns';
import type { AdventureMapDef } from '../src/adventure/map';
import type { AdventureConfig } from '../src/adventure/config';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Mort subite (doc 18 B4, MMHO « Sudden Death ») — opt-in par
 * `combat.suddenDeath { round, resolution: 'strongestArmy' }` : à l'ATTEINTE
 * du round configuré, le combat est résolu de force au profit du camp au plus
 * fort `armyStrength` restant (égalité ⇒ défenseur, convention B17), avec les
 * conséquences NORMALES de fin de combat. Config absente ⇒ aucune borne.
 */

function mapWithGuardian(count: number): AdventureMapDef {
  const base = testMap();
  return {
    ...base,
    objects: [
      ...base.objects,
      { id: 'guardian-1', type: 'guardian', pos: { x: 0, y: 5 }, unitId: 'blue-wolf', count },
    ],
  };
}

function startedGame(heroCount: number, guardianCount: number, suddenDeathRound?: number): GameState {
  const config: AdventureConfig = testConfig();
  if (suddenDeathRound !== undefined)
    config.combat.suddenDeath = { round: suddenDeathRound, resolution: 'strongestArmy' };
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: heroCount }] },
  ];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 7,
    players,
    map: mapWithGuardian(guardianCount),
    config,
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
}

/**
 * Force la bascule de round SANS jouer : toutes les piles sont marquées
 * `acted`, puis `advanceTurn` incrémente le round (et déclenche l'éventuelle
 * mort subite) — aucun dégât échangé, forces restantes = forces initiales.
 */
function forceNextRound(state: GameState, events: GameEvent[]): GameState {
  return produce(state, (draft) => {
    for (const s of draft.combat!.stacks) s.acted = true;
    advanceTurn(draft, events);
  });
}

function begunCombat(state: GameState, events: GameEvent[]): GameState {
  return produce(state, (draft) => {
    beginGuardianCombat(draft, 'hero-p1', 'guardian-1', events);
  });
}

describe('mort subite (doc 18 B4)', () => {
  it('au round configuré : résolution forcée, le camp le plus fort gagne (attaquant) et les conséquences normales s’appliquent', () => {
    const events: GameEvent[] = [];
    // 100 grunts (600 PV) vs 1 loup — l'attaquant domine, personne ne combat.
    let state = begunCombat(startedGame(100, 1, 2), events);
    expect(state.combat?.round).toBe(1);
    state = forceNextRound(state, events);

    expect(state.combat).toBeNull(); // le round 2 n'a jamais démarré
    expect(events.some((e) => e.type === 'CombatSuddenDeath' && e.round === 2 && e.winner === 'attacker')).toBe(true);
    expect(events.some((e) => e.type === 'CombatEnded' && e.winner === 'attacker')).toBe(true);
    // Conséquences normales de victoire : gardien retiré, armée du héros intacte.
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(false);
    expect(state.heroes.find((h) => h.id === 'hero-p1')?.army).toEqual([{ unitId: 'red-grunt', count: 100 }]);
  });

  it('défenseur plus fort : le héros attaquant subit une défaite normale (retiré de la partie)', () => {
    const events: GameEvent[] = [];
    // 1 grunt (6 PV) vs 100 loups — le défenseur domine.
    let state = begunCombat(startedGame(1, 100, 2), events);
    state = forceNextRound(state, events);

    expect(state.combat).toBeNull();
    expect(events.some((e) => e.type === 'CombatSuddenDeath' && e.winner === 'defender')).toBe(true);
    expect(state.heroes.find((h) => h.id === 'hero-p1')).toBeUndefined(); // défaite normale
    expect(state.map?.objects.some((o) => o.id === 'guardian-1')).toBe(true); // gardien intact
  });

  it('la résolution lit la force RESTANTE : un attaquant initialement dominant mais saigné perd', () => {
    const events: GameEvent[] = [];
    // 100 grunts vs 30 loups : l'attaquant domine au départ…
    let state = begunCombat(startedGame(100, 30, 2), events);
    state = produce(state, (draft) => {
      // …mais il ne lui reste que 2 grunts au moment de la bascule.
      const stack = draft.combat!.stacks.find((s) => s.side === 'attacker')!;
      stack.count = 2;
    });
    state = forceNextRound(state, events);

    expect(state.combat).toBeNull();
    expect(events.some((e) => e.type === 'CombatSuddenDeath' && e.winner === 'defender')).toBe(true);
    expect(state.heroes.find((h) => h.id === 'hero-p1')).toBeUndefined();
  });

  it('égalité stricte de force : le DÉFENSEUR l’emporte (convention B17)', () => {
    const events: GameEvent[] = [];
    // Même unité, même effectif des deux côtés (le héros aligne des loups).
    const config: AdventureConfig = testConfig();
    config.combat.suddenDeath = { round: 2, resolution: 'strongestArmy' };
    const base = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 7,
      players: [{ id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'blue-wolf', count: 5 }] }],
      map: mapWithGuardian(5),
      config,
      unitCatalog: testCatalog(),
      buildingCatalog: {},
      towns: [],
    }).state;
    let state = begunCombat(base, events);
    state = forceNextRound(state, events);

    expect(state.combat).toBeNull();
    expect(events.some((e) => e.type === 'CombatSuddenDeath' && e.winner === 'defender')).toBe(true);
  });

  it('config absente : la bascule de round ne déclenche RIEN (aucune borne)', () => {
    const events: GameEvent[] = [];
    let state = begunCombat(startedGame(100, 1), events);
    for (let i = 0; i < 30; i += 1) state = forceNextRound(state, events);

    expect(state.combat).not.toBeNull(); // le combat continue, round avancé sans fin forcée
    expect(state.combat?.round).toBe(31);
    expect(events.some((e) => e.type === 'CombatSuddenDeath')).toBe(false);
    expect(events.some((e) => e.type === 'CombatEnded')).toBe(false);
  });
});
