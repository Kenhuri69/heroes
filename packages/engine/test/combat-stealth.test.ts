import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { validateCombatAction, applyAction, attackableTargets, canShootTarget } from '../src/combat/actions';
import { chooseAction } from '../src/combat/ai';
import { validateCastSpell } from '../src/hero';
import { validateHeroAttack } from '../src/combat/hero-attack';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef } from '../src/hero/types';
import type { GameEvent } from '../src/core/events';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot F-SCHOOLS.7 — Mue Éphémère (`SpellKind 'stealth'` + `CombatStack.stealthed`,
 * doc 05 §6) : une pile furtive est INCIBLABLE par l'ennemi jusqu'à sa prochaine
 * action. IDs génériques (`melee`/`shooter`/`caster`) — aucune faction moteur.
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

const CATALOG: Record<string, CombatUnitDef> = {
  melee: unit({ id: 'melee' }),
  shooter: unit({ id: 'shooter', abilities: [{ id: 'shooter', params: { ammo: 6 } }] }),
};
const ZAP: SpellDef = { id: 'zap', school: 'neutral', circle: 1, manaCost: 0, kind: 'damage', base: 8, perPower: 0 };
const SHROUD: SpellDef = { id: 'shroud', school: 'traque', circle: 3, manaCost: 5, kind: 'stealth', base: 0, perPower: 0 };

function hero(): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 2, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {},
    visitLuck: 0, spells: ['zap', 'shroud'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

/**
 * `attacker-0` (joueur, actif) adjacent à `defender-0`. `attackerHeroId` = héros
 * joueur. `defenderStealthed` rend le défenseur furtif.
 */
function stateWith(over: Partial<CombatStack> = {}, active = 'attacker-0'): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'melee', pos: { col: 0, row: 3 } }),
      stack({ id: 'defender-0', side: 'defender', unitId: 'melee', pos: { col: 1, row: 3 }, ...over }),
    ],
    activeStackId: active, playerSide: 'attacker', heroId: 'hero-a', guardianObjectId: null,
    townId: null, wallDefenseBonus: 0, attackerHeroId: 'hero-a', defenderHeroId: null,
    heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  return {
    ...createEmptyState(), started: true, rng: seedRng(1),
    config: { ...testConfig(), combat: { ...testConfig().combat, heroAttack: { base: 10, perPower: 2, perAttack: 0 } } },
    unitCatalog: CATALOG, spellCatalog: { zap: ZAP, shroud: SHROUD }, heroes: [hero()], combat,
  };
}

describe('F-SCHOOLS.7 — Mue Éphémère (furtivité)', () => {
  it('le sort rend la pile alliée ciblée furtive', () => {
    const s = stateWith({}, 'attacker-0');
    // Le héros lance shroud sur son propre camp (attacker-0).
    const { state: next } = apply(s, { type: 'CastSpell', spellId: 'shroud', targetStackId: 'attacker-0' });
    expect(next.combat!.stacks.find((x) => x.id === 'attacker-0')!.stealthed).toBe(true);
  });

  it('une pile furtive est exclue de attackableTargets et canShootTarget', () => {
    const shooterState = produce(stateWith({ stealthed: true }), (draft) => {
      const a = draft.combat!.stacks.find((x) => x.id === 'attacker-0')!;
      a.unitId = 'shooter';
      a.ammo = 6;
    });
    expect(attackableTargets(shooterState, 'attacker-0').some((t) => t.id === 'defender-0')).toBe(false);
    expect(canShootTarget(shooterState, 'attacker-0', 'defender-0')).toBe(false);
  });

  it('la validation refuse l’attaque, le sort et la frappe de héros sur une pile furtive', () => {
    const s = stateWith({ stealthed: true });
    expect(validateCombatAction(s, { action: { type: 'attack', targetStackId: 'defender-0', from: { col: 0, row: 3 } } })?.code).toBe('invalidAction');
    expect(validateCastSpell(s, { type: 'CastSpell', spellId: 'zap', targetStackId: 'defender-0' })?.code).toBe('invalidTarget');
    expect(validateHeroAttack(s, { type: 'HeroAttack', targetStackId: 'defender-0' })?.code).toBe('invalidTarget');
    // Sans furtivité : l'attaque est légale.
    expect(validateCombatAction(stateWith({}), { action: { type: 'attack', targetStackId: 'defender-0', from: { col: 0, row: 3 } } })).toBeNull();
  });

  it('l’IA ne cible pas une pile furtive (défend/temporise faute de cible)', () => {
    const s = stateWith({ stealthed: true }, 'defender-0'); // c'est au tour de l'IA (defender)
    const action = chooseAction(s, 'defender-0');
    // Sa seule cible (attacker-0) n'est pas furtive ici ⇒ contrôle inverse :
    // rendons attacker-0 furtif pour vérifier que l'IA ne l'attaque pas.
    const hidden = produce(s, (draft) => {
      draft.combat!.stacks.find((x) => x.id === 'attacker-0')!.stealthed = true;
    });
    const hiddenAction = chooseAction(hidden, 'defender-0');
    expect(hiddenAction.type).not.toBe('attack');
    // (le premier `action` sert juste à exercer le chemin sans furtivité)
    expect(['attack', 'move', 'defend', 'wait']).toContain(action.type);
  });

  it('la furtivité retombe quand la pile prend sa prochaine action réelle', () => {
    const s = stateWith({}, 'attacker-0');
    const stealthed = produce(s, (draft) => {
      draft.combat!.stacks.find((x) => x.id === 'attacker-0')!.stealthed = true;
    });
    const events: GameEvent[] = [];
    const after = produce(stealthed, (draft) => applyAction(draft, events, 'attacker-0', { type: 'defend' }));
    expect(after.combat!.stacks.find((x) => x.id === 'attacker-0')!.stealthed).toBeUndefined();
  });
});
