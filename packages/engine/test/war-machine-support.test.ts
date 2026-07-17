import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { advanceTurn } from '../src/combat/turns';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Doc 18 B2 — machines de soutien : capacités génériques `healPerRound` (tente
 * de premiers soins) et `replenishAmmo` (chariot de munitions), tick passif aux
 * transitions de round (comme le poison). Unités synthétiques : le moteur ne
 * connaît aucune machine — seule la capacité fait foi.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 },
    abilities: [],
    ...over,
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 100, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
    marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...partial,
  };
}

function state(catalog: Record<string, CombatUnitDef>, stacks: CombatStack[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
    heroAttackUsed: [], winner: null,
  };
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat };
}

const catalog = {
  tent: unit({ id: 'tent', stats: { hp: 75, attack: 0, defense: 10, damage: [1, 1], speed: 1 },
    abilities: [{ id: 'warMachine' }, { id: 'immobile' }, { id: 'healPerRound', params: { amount: 30 } }] }),
  cart: unit({ id: 'cart', stats: { hp: 100, attack: 0, defense: 10, damage: [1, 1], speed: 1 },
    abilities: [{ id: 'warMachine' }, { id: 'immobile' }, { id: 'replenishAmmo', params: { amount: 6 } }] }),
  archer: unit({ id: 'archer', abilities: [{ id: 'shooter', params: { ammo: 12 } }] }),
  grunt: unit({ id: 'grunt' }),
  foe: unit({ id: 'foe', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
};

/** Passe une transition de round (toutes les piles ont agi) et rend ses événements. */
function nextRound(cur: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(cur, (draft) => {
    const combat = draft.combat as CombatState;
    for (const s of combat.stacks) { s.acted = true; s.waited = false; }
    advanceTurn(draft, events);
  });
  return { state: next, events };
}

const healEvents = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackHealed') as Extract<GameEvent, { type: 'StackHealed' }>[];
const ammoEvents = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackAmmoReplenished') as Extract<GameEvent, { type: 'StackAmmoReplenished' }>[];

describe('B2 — healPerRound (tente de premiers soins)', () => {
  it('soigne la pile alliée la plus blessée à chaque transition de round, plafonnée à son pool', () => {
    const tent = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'tent', count: 1, firstHp: 75, pos: { col: 0, row: 0 } });
    // Deux blessés : grunt A (manque 50 PV), grunt B (manque 10) — la tente vise A.
    const woundedA = stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'grunt', count: 2, firstHp: 50, pos: { col: 1, row: 2 } });
    const woundedB = stack({ id: 'attacker-2', side: 'attacker', slot: 2, unitId: 'grunt', count: 1, firstHp: 90, pos: { col: 1, row: 4 } });
    const foe = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, firstHp: 1000, pos: { col: 14, row: 5 } });

    const r1 = nextRound(state(catalog, [tent, woundedA, woundedB, foe]));
    expect(healEvents(r1.events)).toEqual([{ type: 'StackHealed', stackId: 'attacker-1', amount: 30 }]);
    expect(r1.state.combat?.stacks.find((s) => s.id === 'attacker-1')?.firstHp).toBe(80);

    // Round suivant : A ne manque plus que de 20 ⇒ soin partiel (plafond du pool).
    const r2 = nextRound(r1.state);
    expect(healEvents(r2.events)).toEqual([{ type: 'StackHealed', stackId: 'attacker-1', amount: 20 }]);
    // Round d'après : A est plein, B (manque 10) devient la plus blessée.
    const r3 = nextRound(r2.state);
    expect(healEvents(r3.events)).toEqual([{ type: 'StackHealed', stackId: 'attacker-2', amount: 10 }]);
    // Plus personne de blessé ⇒ aucun événement de soin.
    const r4 = nextRound(r3.state);
    expect(healEvents(r4.events)).toEqual([]);
  });

  it('ne soigne jamais une pile ennemie ni elle-même', () => {
    const tent = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'tent', count: 1, firstHp: 10, pos: { col: 0, row: 0 } });
    const foe = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, firstHp: 500, pos: { col: 14, row: 5 } });
    const { events } = nextRound(state(catalog, [tent, foe]));
    // Seule la tente (alliée d'elle-même) est blessée ⇒ aucune cible valide.
    expect(healEvents(events)).toEqual([]);
  });
});

describe('B2 — replenishAmmo (chariot de munitions)', () => {
  it('recharge les tireurs alliés entamés, plafonné à leur réserve initiale', () => {
    const cart = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'cart', count: 1, pos: { col: 0, row: 0 } });
    const lowAmmo = stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'archer', count: 3, pos: { col: 1, row: 2 }, ammo: 2 });
    const nearFull = stack({ id: 'attacker-2', side: 'attacker', slot: 2, unitId: 'archer', count: 3, pos: { col: 1, row: 4 }, ammo: 10 });
    const enemyShooter = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'archer', count: 3, pos: { col: 14, row: 5 }, ammo: 1 });

    const { state: next, events } = nextRound(state(catalog, [cart, lowAmmo, nearFull, enemyShooter]));
    expect(ammoEvents(events)).toEqual([
      { type: 'StackAmmoReplenished', stackId: 'attacker-1', amount: 6 },
      { type: 'StackAmmoReplenished', stackId: 'attacker-2', amount: 2 }, // plafond 12
    ]);
    const byId = (id: string) => next.combat?.stacks.find((s) => s.id === id);
    expect(byId('attacker-1')?.ammo).toBe(8);
    expect(byId('attacker-2')?.ammo).toBe(12);
    expect(byId('defender-0')?.ammo).toBe(1); // l'ennemi n'est jamais ravitaillé
  });

  it('sans machine de soutien : aucune capacité ⇒ transition de round bit-identique (opt-in)', () => {
    const archer = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'archer', count: 3, pos: { col: 1, row: 2 }, ammo: 2, firstHp: 40 });
    const foe = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, firstHp: 500, pos: { col: 14, row: 5 } });
    const { state: next, events } = nextRound(state(catalog, [archer, foe]));
    expect(healEvents(events)).toEqual([]);
    expect(ammoEvents(events)).toEqual([]);
    expect(next.combat?.stacks.find((s) => s.id === 'attacker-0')).toMatchObject({ ammo: 2, firstHp: 40 });
  });
});
