import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { estimateSpell } from '../src/hero';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import type { SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * Magie Irrésistible (signature du Donjon, doc 17 §2, lot 17.3) — point
 * d'extension moteur GÉNÉRIQUE : un `factionBonus` de type `irresistibleMagic`
 * majore les dégâts des sorts du héros de la faction et atténue la résistance
 * magique GRADUÉE de la cible. Aucun nom de faction dans le moteur : le bonus est
 * résolu via `hero.factionId` → `state.factionCatalog`. L'immunité TOTALE
 * (`spellImmune`) reste un bloc de ciblage entier. Ids de faction synthétiques
 * (jamais un id du registre — garde-fou de modularité).
 */

const BOLT: SpellDef = { id: 'irr-bolt', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 10, perPower: 2 };

/** Cible avec résistance magique graduée (0.5) ; variante immunité totale. */
function unit(id: string, opts: { resistance?: number; immune?: boolean } = {}): CombatUnitDef {
  const abilities = [];
  if (opts.resistance) abilities.push({ id: 'magicResistance', params: { value: opts.resistance } });
  if (opts.immune) abilities.push({ id: 'spellImmune' });
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'rough',
    stats: { hp: 200, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities,
  };
}

function hero(factionId: string): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 4, knowledge: 3 }, mana: 30, manaMax: 30, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: ['irr-bolt'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId, houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, firstHp: 200, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false, defending: false,
    ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...over,
  };
}

/** `factionId` du héros pilote le bonus ; le catalogue déclare une faction dotée + une nue. */
function state(factionId: string): GameState {
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'caster-ally', count: 1, pos: { col: 0, row: 2 } }),
    stack({ id: 'defender-res', side: 'defender', unitId: 'resistant', count: 2, pos: { col: 10, row: 2 } }),
    stack({ id: 'defender-imm', side: 'defender', unitId: 'immune', count: 2, pos: { col: 10, row: 4 } }),
  ];
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: {
      'caster-ally': unit('caster-ally'),
      resistant: unit('resistant', { resistance: 0.5 }),
      immune: unit('immune', { immune: true }),
    },
    spellCatalog: { 'irr-bolt': BOLT },
    // Faction dotée de la signature vs faction nue — génériques, ids synthétiques.
    factionCatalog: {
      mystics: { bonuses: [{ type: 'irresistibleMagic', spellBonusPercent: 30, resistancePierce: 0.5 }] },
      plains: { bonuses: [] },
    },
    heroes: [hero(factionId)],
    combat,
  };
}

/** Dégâts du SpellCast après lancer du bolt sur `targetId`. */
function castDamage(s: GameState, targetId: string): number {
  const { events } = apply(s, { type: 'CastSpell', spellId: 'irr-bolt', targetStackId: targetId });
  const cast = events.find((e: GameEvent) => e.type === 'SpellCast');
  return cast && cast.type === 'SpellCast' ? cast.amount : 0;
}

describe('Magie Irrésistible (doc 17 §2) — signature générique de faction', () => {
  it('majore les dégâts et perce la résistance graduée pour le héros de la faction', () => {
    // Base : (10 + 2×4) = 18. Résistance 0.5.
    // Faction nue : 18 × (1 − 0.5) = 9. Faction dotée : résistance percée
    // (0.5 − 0.5 = 0), +30 % ⇒ 18 × 1 × 1.3 ≈ 23.
    const plain = castDamage(state('plains'), 'defender-res');
    const irre = castDamage(state('mystics'), 'defender-res');
    expect(plain).toBe(9);
    expect(irre).toBe(23);
    expect(irre).toBeGreaterThan(plain);
  });

  it("n'affecte PAS un héros d'une autre faction (preuve de généricité)", () => {
    // Un héros sans le bonus subit la résistance pleine — aucun nom de faction câblé.
    expect(castDamage(state('plains'), 'defender-res')).toBe(9);
  });

  it('la préviz (sans RNG) reflète la même formule que la résolution', () => {
    const est = estimateSpell(state('mystics'), 'irr-bolt', 'defender-res');
    expect(est.kind).toBe('damage');
    expect(est.amount).toBe(23);
    expect(estimateSpell(state('plains'), 'irr-bolt', 'defender-res').amount).toBe(9);
  });

  it("ne franchit PAS l'immunité totale (spellImmune reste un bloc de ciblage)", () => {
    // Même pour la faction dotée : total = total. Le sort est refusé au ciblage.
    expect(
      validate(state('mystics'), { type: 'CastSpell', spellId: 'irr-bolt', targetStackId: 'defender-imm' })?.code,
    ).toBe('invalidTarget');
  });
});
