import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { canHeroAttack, heroAttackDamage } from '../src/combat/hero-attack';
import { advanceTurn } from '../src/combat/turns';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import type { Draft } from '../src/combat/draft';
import { testConfig } from './fixtures';

/**
 * C1 — Attaque du héros : frappe directe sur une pile ennemie, UNE action de
 * héros par round (frappe OU sort, exclusifs ; réinit chaque round — doc 02 §1),
 * `base + perPower×Pouvoir + perAttack×Attaque` (déterministe, sans RNG).
 */

function unit(id: string, hp: number): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
  };
}

function hero(attack: number, power: number): HeroState {
  return {
    id: 'hero-a',
    playerId: 'p1',
    pos: { x: 0, y: 0 },
    movementPoints: 0,
    level: 1,
    xp: 0,
    attributes: { attack, defense: 0, power, knowledge: 0 },
    mana: 20,
    manaMax: 20,
    spells: [],
    skills: {},
    visitLuck: 0,
    visitMorale: 0,
    artifacts: Array.from({ length: 10 }, () => null),
    army: [],
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
  } as unknown as HeroState;
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0,
    firstHp: 10,
    pos: { col: 0, row: 0 },
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
    ...over,
  };
}

function stateWith(heroAttackCfg: { base: number; perPower: number; perAttack: number } | undefined): GameState {
  const config = { ...testConfig(), combat: { ...testConfig().combat, heroAttack: heroAttackCfg } };
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 5, pos: { col: 0, row: 2 } }),
    stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 10, firstHp: 10 }),
  ];
  const combat: CombatState = {
    terrain: 'grass',
    phase: 'battle',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: 'attacker-0',
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId: 'hero-a',
    defenderHeroId: null,
    heroCastThisRound: [],
    heroAttackUsed: [],
    finished: false,
    winner: null,
  };
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config,
    unitCatalog: { ally: unit('ally', 10), foe: unit('foe', 10) },
    heroes: [hero(3, 4)],
    combat,
  };
}

describe('C1 — attaque du héros', () => {
  it('dégâts = base + perPower×Pouvoir + perAttack×Attaque (déterministe)', () => {
    const state = stateWith({ base: 8, perPower: 6, perAttack: 2 });
    // hero(attack 3, power 4) ⇒ 8 + 6×4 + 2×3 = 38.
    expect(heroAttackDamage(state, state.combat as CombatState, 'attacker')).toBe(38);
  });

  it('la frappe réduit la pile ennemie, marque le camp et émet HeroStruck', () => {
    const state = stateWith({ base: 8, perPower: 6, perAttack: 2 });
    const { state: next, events } = apply(state, { type: 'HeroAttack', targetStackId: 'defender-0' });
    const foe = next.combat?.stacks.find((s) => s.id === 'defender-0');
    // 38 dégâts sur une pile 10×10 PV ⇒ 3 tués (30 PV), reste 7 unités.
    expect(foe?.count).toBe(7);
    expect(next.combat?.heroAttackUsed).toContain('attacker');
    expect(events).toContainEqual({
      type: 'HeroStruck',
      side: 'attacker',
      targetId: 'defender-0',
      amount: 38,
      kills: 3,
    });
  });

  it('refuse une 2ᵉ attaque le même round (heroAttackUsed)', () => {
    const first = apply(stateWith({ base: 8, perPower: 6, perAttack: 2 }), {
      type: 'HeroAttack',
      targetStackId: 'defender-0',
    }).state;
    expect(() => apply(first, { type: 'HeroAttack', targetStackId: 'defender-0' })).toThrowError(
      /heroAttackUsed/,
    );
  });

  it('exclusivité : refuse la frappe si le héros a déjà lancé un sort ce round', () => {
    const base = stateWith({ base: 8, perPower: 6, perAttack: 2 });
    // Le héros a lancé un sort ce round ⇒ plus d'action de héros disponible.
    const state: GameState = {
      ...base,
      combat: { ...(base.combat as CombatState), heroCastThisRound: ['attacker'] },
    };
    expect(canHeroAttack(state)).toBe(false);
    expect(() => apply(state, { type: 'HeroAttack', targetStackId: 'defender-0' })).toThrowError(
      /heroAttackUsed/,
    );
  });

  it('reset de round : la frappe redevient disponible au round suivant', () => {
    // Après une frappe, `heroAttackUsed` est posé ; on force la fin de round
    // (les deux piles ont agi) puis on avance le tour ⇒ le verrou est vidé.
    const struck = apply(stateWith({ base: 8, perPower: 6, perAttack: 2 }), {
      type: 'HeroAttack',
      targetStackId: 'defender-0',
    }).state;
    expect(struck.combat?.heroAttackUsed).toContain('attacker');
    const events: GameEvent[] = [];
    const next = produce(struck, (draft) => {
      const combat = (draft as Draft).combat as CombatState;
      for (const s of combat.stacks) s.acted = true; // round terminé
      advanceTurn(draft as Draft, events);
    });
    expect(next.combat?.round).toBe(2);
    expect(next.combat?.heroAttackUsed).toEqual([]);
    // Verrou vidé ⇒ la frappe est de nouveau permise (pile joueur active).
    const playerActive: GameState = {
      ...next,
      combat: { ...(next.combat as CombatState), activeStackId: 'attacker-0' },
    };
    expect(canHeroAttack(playerActive)).toBe(true);
  });

  it('refuse si la feature est désactivée (config heroAttack absente)', () => {
    expect(() =>
      apply(stateWith(undefined), { type: 'HeroAttack', targetStackId: 'defender-0' }),
    ).toThrowError(/heroAttackUnavailable/);
  });

  it('refuse une cible alliée', () => {
    expect(() =>
      apply(stateWith({ base: 8, perPower: 6, perAttack: 2 }), {
        type: 'HeroAttack',
        targetStackId: 'attacker-0',
      }),
    ).toThrowError(/invalidTarget/);
  });
});
