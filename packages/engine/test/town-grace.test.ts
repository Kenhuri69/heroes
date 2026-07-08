import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { TownState } from '../src/town/types';
import type { ScenarioState } from '../src/scenario/types';
import { RETAKE_GRACE_DAYS } from '../src/scenario/outcome';
import { testConfig, testMap } from './fixtures';

/**
 * Grâce de reprise de ville (doc 02 §4.1, comblement MVP) : un joueur qui **perd**
 * sa dernière ville mais garde un héros a `RETAKE_GRACE_DAYS` jours pour en
 * reprendre une avant d'être éliminé ; sans ville NI héros, élimination immédiate.
 * La règle ne s'arme qu'une fois une ville possédée (héros de survie exempté).
 */
const town = (owner: string): TownState => ({
  id: `town-${owner}`,
  ownerPlayerId: owner,
  pos: { x: 5, y: 5 },
  factionId: '',
  buildings: {},
  builtToday: false,
  garrison: [],
  stock: {},
  spellPool: [],
});

const SCENARIO: ScenarioState = {
  objectives: {
    p1: { victory: { type: 'eliminateAllEnemies' }, defeat: { type: 'defeatHero', heroId: 'hero-p1' } },
    p2: { victory: { type: 'eliminateAllEnemies' }, defeat: { type: 'defeatHero', heroId: 'hero-p2' } },
  },
};

function started(towns: TownState[]): GameState {
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 1,
    players: [P1, P2],
    map: testMap(),
    config: testConfig(),
    unitCatalog: {},
    buildingCatalog: {},
    towns,
    scenario: SCENARIO,
  }).state;
}

const P1: PlayerSetup = { id: 'p1', startingResources: emptyResources(), controller: 'human' };
const P2: PlayerSetup = { id: 'p2', startingResources: emptyResources(), controller: 'ai' };

const isElim = (s: GameState, id: string): boolean =>
  s.players.find((p) => p.id === id)!.eliminated;
const without = (s: GameState, owner: string): GameState => ({
  ...s,
  towns: s.towns.filter((t) => t.ownerPlayerId !== owner),
});

/** Avance d'un jour complet (les deux joueurs finissent leur tour). */
function advanceDay(s: GameState): GameState {
  const a = apply(s, { type: 'EndTurn', playerId: 'p1' }).state;
  return apply(a, { type: 'EndTurn', playerId: 'p2' }).state;
}

describe('grâce de reprise de ville', () => {
  it('perdre sa dernière ville (héros conservé) : éliminé au-delà de la grâce', () => {
    // p1 & p2 démarrent avec une ville (minuteur armé à 0) ; p1 perd la sienne.
    let s = without(started([town('p1'), town('p2')]), 'p1');
    let elimDay = -1;
    for (let i = 0; i < RETAKE_GRACE_DAYS + 5 && elimDay < 0; i++) {
      s = advanceDay(s);
      if (isElim(s, 'p1')) elimDay = s.calendar.day;
    }
    // townlessDays passe 7 au jour 9 (jour 1 = départ ; +1 par bascule).
    expect(elimDay).toBe(RETAKE_GRACE_DAYS + 2);
    expect(isElim(s, 'p2')).toBe(false); // p2 garde sa ville
  });

  it('héros de survie (jamais possédé de ville) : jamais éliminé par la grâce', () => {
    // p1 démarre SANS ville (minuteur désarmé -1) ; p2 en a une.
    let s = started([town('p2')]);
    for (let i = 0; i < RETAKE_GRACE_DAYS + 5; i++) s = advanceDay(s);
    expect(isElim(s, 'p1')).toBe(false);
    expect(s.players.find((p) => p.id === 'p1')!.townlessDays).toBe(-1);
  });

  it('sans ville NI héros : élimination immédiate (irrécupérable)', () => {
    let s = without(started([town('p1'), town('p2')]), 'p1');
    s = { ...s, heroes: s.heroes.filter((h) => h.playerId !== 'p1') }; // p1 perd aussi son héros
    const after = apply(s, { type: 'EndTurn', playerId: 'p1' }).state; // éval hors bascule
    expect(isElim(after, 'p1')).toBe(true);
  });

  it('reprendre une ville remet le compteur à zéro : pas d’élimination', () => {
    let s = without(started([town('p1'), town('p2')]), 'p1');
    for (let i = 0; i < 5; i++) s = advanceDay(s); // 5 jours sans ville
    expect(isElim(s, 'p1')).toBe(false);
    s = { ...s, towns: [...s.towns, town('p1')] }; // p1 reprend une ville
    for (let i = 0; i < RETAKE_GRACE_DAYS + 3; i++) s = advanceDay(s);
    expect(isElim(s, 'p1')).toBe(false); // compteur remis à 0, jamais éliminé
    expect(s.players.find((p) => p.id === 'p1')!.townlessDays).toBe(0);
  });
});
