import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { validateCastSpell, teleportDestinations } from '../src/hero';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef } from '../src/hero/types';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot F-SCHOOLS.8 — Pas de Brume (`SpellKind 'teleport'` + `CastSpell.targetHex`,
 * doc 05 §6) : le héros téléporte une pile ALLIÉE vers une case libre à portée.
 * IDs génériques (`melee`) — aucune faction moteur.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`, nativeTerrain: 'swamp',
    stats: { hp: 20, attack: 5, defense: 5, damage: [4, 4], speed: 6 }, abilities: [], ...over,
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, count: 3, firstHp: 20, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...over,
  };
}

const CATALOG: Record<string, CombatUnitDef> = { melee: unit({ id: 'melee' }) };
// Portée 3 hexes plats (base 3, perPower 0) — le Pouvoir du héros ne l'étend pas.
const BLINK: SpellDef = { id: 'blink', school: 'traque', circle: 1, manaCost: 4, kind: 'teleport', base: 3, perPower: 0 };

function hero(): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {},
    visitLuck: 0, spells: ['blink'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    visitMorale: 0,
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

/** `attacker-0` (allié à téléporter) en (0,3), `defender-0` en (5,3). Héros = joueur. */
function stateWith(over: Partial<CombatStack> = {}): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [{ col: 2, row: 3 }],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'melee', pos: { col: 0, row: 3 }, ...over }),
      stack({ id: 'defender-0', side: 'defender', unitId: 'melee', pos: { col: 5, row: 3 } }),
    ],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: 'hero-a', guardianObjectId: null,
    townId: null, wallDefenseBonus: 0, attackerHeroId: 'hero-a', defenderHeroId: null,
    heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: CATALOG, spellCatalog: { blink: BLINK }, heroes: [hero()], combat,
  };
}

describe('F-SCHOOLS.8 — Pas de Brume (téléportation)', () => {
  it('téléporte la pile alliée ciblée vers la destination, débite la mana', () => {
    const s = stateWith();
    const { state: next } = apply(s, {
      type: 'CastSpell', spellId: 'blink', targetStackId: 'attacker-0', targetHex: { col: 3, row: 3 },
    });
    const moved = next.combat!.stacks.find((x) => x.id === 'attacker-0')!;
    expect(moved.pos).toEqual({ col: 3, row: 3 });
    expect(next.heroes[0]!.mana).toBe(30 - 4);
    expect(next.combat!.heroCastThisRound).toContain('hero-a'); // suivi par-héros (E4.4)
  });

  it('teleportDestinations : à portée, dans le plateau, hors obstacle et cases occupées', () => {
    const dests = teleportDestinations(stateWith(), 'blink', 'attacker-0');
    const has = (col: number, row: number): boolean => dests.some((p) => p.col === col && p.row === row);
    expect(has(3, 3)).toBe(true); // distance 3 depuis (0,3), libre
    expect(has(2, 3)).toBe(false); // obstacle
    expect(has(0, 3)).toBe(false); // case de la pile elle-même (occupée)
    expect(has(5, 3)).toBe(false); // occupée par le défenseur
    expect(has(4, 3)).toBe(false); // hors de portée (distance 4)
  });

  it('la validation refuse une destination invalide ou absente', () => {
    const s = stateWith();
    expect(validateCastSpell(s, { type: 'CastSpell', spellId: 'blink', targetStackId: 'attacker-0' })?.code)
      .toBe('invalidTarget'); // targetHex manquant
    expect(
      validateCastSpell(s, { type: 'CastSpell', spellId: 'blink', targetStackId: 'attacker-0', targetHex: { col: 4, row: 3 } })?.code,
    ).toBe('invalidTarget'); // hors de portée
    expect(
      validateCastSpell(s, { type: 'CastSpell', spellId: 'blink', targetStackId: 'attacker-0', targetHex: { col: 2, row: 3 } })?.code,
    ).toBe('invalidTarget'); // sur un obstacle
    // Destination légale ⇒ acceptée.
    expect(
      validateCastSpell(s, { type: 'CastSpell', spellId: 'blink', targetStackId: 'attacker-0', targetHex: { col: 3, row: 3 } }),
    ).toBeNull();
  });

  it('un sort de téléportation ne peut viser une pile ENNEMIE (allié seulement)', () => {
    const s = stateWith();
    expect(
      validateCastSpell(s, { type: 'CastSpell', spellId: 'blink', targetStackId: 'defender-0', targetHex: { col: 4, row: 3 } })?.code,
    ).toBe('invalidTarget');
  });
});
