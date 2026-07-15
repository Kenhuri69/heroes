import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { spellAffectedStacks } from '../src/hero';
import type { CombatStack, CombatState } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * C-SPELLUI.2 — `spellAffectedStacks` : source pure des piles réellement
 * touchées par un sort (cible seule / splash / all / chaîne), réutilisée par le
 * grimoire client pour lister la zone. Mirroir de `spellTargets`/`chainTargets`
 * (résolution + préviz), donc on vérifie ici la même géométrie de zone. La
 * fonction ne lit que pos/side/count des piles ⇒ aucun `unitCatalog` requis.
 */

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 100, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
    marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...partial,
  };
}

function spell(over: Partial<SpellDef> & { id: string; kind: SpellDef['kind'] }): SpellDef {
  return { school: 'fire', circle: 1, manaCost: 4, base: 10, perPower: 0, ...over };
}

function state(stacks: CombatStack[], spells: SpellDef[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
    heroAttackUsed: [], winner: null,
  };
  const spellCatalog = Object.fromEntries(spells.map((s) => [s.id, s]));
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), spellCatalog, combat };
}

const catalogStacks = () => [
  stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 5, pos: { col: 8, row: 5 } }),
  stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'foe', count: 5, pos: { col: 8, row: 4 } }), // adjacent
  stack({ id: 'defender-2', side: 'defender', slot: 2, unitId: 'foe', count: 5, pos: { col: 2, row: 1 } }), // loin
  stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'foe', count: 5, pos: { col: 0, row: 0 } }),
];

const ids = (arr: CombatStack[]) => arr.map((s) => s.id).sort();

describe('C-SPELLUI.2 — spellAffectedStacks', () => {
  it('sort mono-cible : la cible seule', () => {
    const s = state(catalogStacks(), [spell({ id: 'bolt', kind: 'damage' })]);
    expect(ids(spellAffectedStacks(s, 'bolt', 'defender-0'))).toEqual(['defender-0']);
  });

  it('splash : la cible + ses alliées ADJACENTES seulement', () => {
    const s = state(catalogStacks(), [spell({ id: 'fireball', kind: 'damage', area: 'splash' })]);
    // defender-1 est adjacente à defender-0 ; defender-2 est loin ⇒ exclue.
    expect(ids(spellAffectedStacks(s, 'fireball', 'defender-0'))).toEqual(['defender-0', 'defender-1']);
  });

  it('all : toutes les piles vivantes du camp de la cible', () => {
    const s = state(catalogStacks(), [spell({ id: 'mass', kind: 'debuff', area: 'all' })]);
    expect(ids(spellAffectedStacks(s, 'mass', 'defender-0'))).toEqual(['defender-0', 'defender-1', 'defender-2']);
  });

  it('chaîne : la cible puis les rebonds (pas d’alliés hors camp de la cible)', () => {
    const s = state(catalogStacks(), [spell({ id: 'chain', kind: 'damage', chain: { jumps: 2, falloffPct: 25 } })]);
    const hit = ids(spellAffectedStacks(s, 'chain', 'defender-0'));
    // 3 piles ennemies présentes ⇒ centre + 2 rebonds = les 3 defenders (attaquant exclu).
    expect(hit).toEqual(['defender-0', 'defender-1', 'defender-2']);
  });

  it('bornes : id inconnu ou sans combat ⇒ [] (jamais d’exception)', () => {
    const s = state(catalogStacks(), [spell({ id: 'bolt', kind: 'damage' })]);
    expect(spellAffectedStacks(s, 'bolt', 'inconnu')).toEqual([]);
    expect(spellAffectedStacks(s, 'inconnu', 'defender-0')).toEqual([]);
    const noCombat: GameState = { ...s, combat: null };
    expect(spellAffectedStacks(noCombat, 'bolt', 'defender-0')).toEqual([]);
  });
});
