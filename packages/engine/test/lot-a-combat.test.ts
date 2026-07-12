import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction, reachableHexes, validateCombatAction } from '../src/combat/actions';
import { estimateDamage } from '../src/combat/damage';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { SpellStatus } from '../src/hero/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A — correctifs moteur P0 (plan `code-doc-coherence-remediation.md`),
 * partie combat : A1 (téléportation via `from`), A2 (`noRetaliation` inversée),
 * A3 (pente Défense héros), A4 (`speedMod` sur la portée), A5 (préviz = résolution).
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-group`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
    ...over,
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 10,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null, spellCharges: 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...partial,
  };
}

function combatState(stacks: CombatStack[], over: Partial<CombatState> = {}): CombatState {
  return {
    terrain: 'grass',
    phase: 'battle',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    finished: false,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: [],
    heroAttackUsed: [],
    winner: null,
    ...over,
  };
}

function baseState(catalog: Record<string, CombatUnitDef>): GameState {
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog };
}

function baseHero(over: Partial<HeroState>): HeroState {
  return {
    id: 'hero-1',
    playerId: 'p1',
    pos: { x: 0, y: 0 },
    movementPoints: 0,
    army: [],
    xp: 0,
    level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0,
    manaMax: 0,
    skills: {},
    visitLuck: 0,
    spells: [],
    artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [],
    pendingAttributeChoices: [],
    factionId: '',
    houseId: '',
    houseEffects: [],
    name: '',
    specialtyId: '',
    specialtyEffects: [],
    warMachines: [],
    rosterId: '',
    ...over,
  };
}

function status(over: Partial<SpellStatus>): SpellStatus {
  return { spellId: 'test', attackMod: 0, defenseMod: 0, speedMod: 0, damageDealtMod: 0, damagePerRound: 0, silenced: false, roundsLeft: 3, ...over };
}

function strikeDamage(state: GameState, attackerId: string, targetId: string): number {
  const events: GameEvent[] = [];
  produce(state, (draft) => applyAction(draft, events, attackerId, { type: 'attack', targetStackId: targetId }));
  const hit = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
  return hit.damage;
}

describe('Lot A — correctifs combat', () => {
  it('A1 — `from` hostile refusé même cible adjacente (anti-téléportation)', () => {
    const catalog = { atk: unit({ id: 'atk' }), def: unit({ id: 'def' }) };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 5, row: 5 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 6, row: 5 } });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    // `from` hors plateau / non adjacent à la cible ⇒ rejeté (auparavant : dist===1 renvoyait null).
    expect(
      validateCombatAction(state, { action: { type: 'attack', targetStackId: 'defender-0', from: { col: 999, row: -4 } } })?.code,
    ).toBe('invalidAction');
    // Sans `from`, cible adjacente ⇒ accepté (frappe sur place).
    expect(validateCombatAction(state, { action: { type: 'attack', targetStackId: 'defender-0' } })).toBeNull();
  });

  it('A2 — `noRetaliation` de l’ATTAQUANT prive la victime de riposte (pas celle de la victime)', () => {
    const retaliationOf = (atkAbil: { id: string }[], defAbil: { id: string }[]) => {
      const catalog = { atk: unit({ id: 'atk', abilities: atkAbil }), def: unit({ id: 'def', abilities: defAbil }) };
      const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 5, row: 5 } });
      const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 5, pos: { col: 6, row: 5 } });
      const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
      return estimateDamage(state, 'attacker-0', 'defender-0').retaliation;
    };
    // Attaquant porteur ⇒ la victime ne riposte pas.
    expect(retaliationOf([{ id: 'noRetaliation' }], [])).toBeNull();
    // Victime porteuse, attaquant non ⇒ la riposte a bien lieu (exact inverse du bug).
    expect(retaliationOf([], [{ id: 'noRetaliation' }])).not.toBeNull();
  });

  it('A3 — Défense du héros défenseur : −2,5 %/pt (pas −5 %)', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 5, defense: 0, damage: [10, 10], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    const damage = (heroDefense?: number): number => {
      const defHero = heroDefense !== undefined ? baseHero({ id: 'dh', attributes: { attack: 0, defense: heroDefense, power: 0, knowledge: 0 } }) : undefined;
      const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
      const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
      const combat = combatState([attacker, defender], defHero ? { defenderHeroId: defHero.id } : {});
      return strikeDamage({ ...baseState(catalog), heroes: defHero ? [defHero] : [], combat }, 'attacker-0', 'defender-0');
    };
    // Sans héros : diff unités 5−5=0 ⇒ mult 1 ⇒ 10.
    expect(damage()).toBe(10);
    // Héros +10 Défense : −0,025×10 = −0,25 ⇒ mult 0,75 ⇒ round(7,5)=8 (le taux buggé −0,05×10 donnait 5).
    expect(damage(10)).toBe(8);
  });

  it('A4 — un statut Lenteur (speedMod<0) réduit la portée de déplacement, bornée ≥ 0', () => {
    const catalog = { atk: unit({ id: 'atk', stats: { hp: 10, attack: 5, defense: 5, damage: [1, 1], speed: 5 } }) };
    const reach = (statuses: SpellStatus[]) => {
      const s = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 5, row: 5 }, statuses });
      return reachableHexes({ ...baseState(catalog), combat: combatState([s]) }, 'attacker-0').length;
    };
    const full = reach([]);
    expect(reach([status({ speedMod: -3 })])).toBeLessThan(full);
    expect(reach([status({ speedMod: -99 })])).toBe(0); // portée bornée ≥ 0 (jamais négative)
  });

  it('A5 — préviz = résolution en siège : les murs entrent bien dans la prévisualisation', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 10, defense: 0, damage: [10, 10], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 0, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender], { wallDefenseBonus: 10 }) };
    const preview = estimateDamage(state, 'attacker-0', 'defender-0');
    const resolved = strikeDamage(state, 'attacker-0', 'defender-0'); // dégâts fixes, chance nulle ⇒ déterministe
    // Auparavant la préviz ignorait `wallDefenseBonus` ⇒ damageMax surestimé (15 vs 10 résolus).
    expect(preview.damageMax).toBe(resolved);
  });
});
