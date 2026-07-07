import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { computeMultiplier } from '../src/combat/damage';
import { initLedger, moraleOf } from '../src/combat/state-helpers';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import type { HeroSkillDef } from '../src/hero/types';
import {
  heroGoldPerDay,
  heroLuck,
  heroManaCostReduction,
  heroMorale,
  heroMovementBonus,
  heroRangedPct,
  heroVisionBonus,
} from '../src/hero/skills';
import { testCombatRules, testConfig } from './fixtures';

/**
 * Compétences secondaires (doc 02 §1.3, décision plan phase-3.2 #5) : effets
 * purs par rang (`hero/skills.ts`) + branchement combat dans `damage.ts`
 * (Chance/Armure/Attaque au corps/Tir) et `state-helpers.ts` (Commandement →
 * moral de pile, remédiation R5 CO4). PM/vision/or/mana restent des effets purs.
 */

const RULES = testCombatRules();

function baseHero(over: Partial<HeroState> = {}): HeroState {
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
    factionId: '',
    warMachines: [],
    ...over,
  };
}

describe('hero/skills — effets purs par rang (Novice/Expert/Maître)', () => {
  const catalog: Record<string, HeroSkillDef> = {
    logistics: { id: 'logistics', ranks: [{ movementBonusPct: 10 }, { movementBonusPct: 20 }, { movementBonusPct: 30 }] },
    scouting: { id: 'scouting', ranks: [{ visionBonus: 1 }, { visionBonus: 2 }, { visionBonus: 3 }] },
    estates: { id: 'estates', ranks: [{ goldPerDay: 100 }, { goldPerDay: 250 }, { goldPerDay: 500 }] },
    luck: { id: 'luck', ranks: [{ luckBonus: 1 }, { luckBonus: 2 }, { luckBonus: 3 }] },
    leadership: { id: 'leadership', ranks: [{ moraleBonus: 1 }, { moraleBonus: 2 }, { moraleBonus: 3 }] },
    archery: { id: 'archery', ranks: [{ rangedDamagePct: 10 }, { rangedDamagePct: 20 }, { rangedDamagePct: 30 }] },
    wisdom: {
      id: 'wisdom',
      school: 'fire', // A6 : réduction de mana filtrée par école
      ranks: [{ manaCostReductionPct: 10 }, { manaCostReductionPct: 20 }, { manaCostReductionPct: 30 }],
    },
  };

  it('somme les effets du rang courant, 0 pour une compétence non apprise', () => {
    const hero = baseHero({ skills: { logistics: 2, scouting: 1, luck: 3 } });
    expect(heroMovementBonus(hero, catalog)).toBe(20);
    expect(heroVisionBonus(hero, catalog)).toBe(1);
    expect(heroLuck(hero, catalog)).toBe(3);
    expect(heroGoldPerDay(hero, catalog)).toBe(0); // non apprise
    expect(heroMorale(hero, catalog)).toBe(0);
    expect(heroRangedPct(hero, catalog)).toBe(0);
    expect(heroManaCostReduction(hero, catalog, 'fire')).toBe(0);
  });

  it('cumule plusieurs compétences distinctes', () => {
    const hero = baseHero({ skills: { estates: 3, wisdom: 1 } });
    expect(heroGoldPerDay(hero, catalog)).toBe(500);
    // A6 : la réduction ne s'applique qu'à l'école de la compétence (Feu) ;
    // un sort d'une autre école n'en bénéficie pas.
    expect(heroManaCostReduction(hero, catalog, 'fire')).toBe(10);
    expect(heroManaCostReduction(hero, catalog, 'water')).toBe(0);
  });
});

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
    ammo: null,
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
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: false,
    finished: false,
    winner: null,
    ...over,
  };
  initLedger(combat);
  return combat;
}

function baseState(catalog: Record<string, CombatUnitDef>): GameState {
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config: testConfig(),
    unitCatalog: catalog,
  };
}

describe('Commandement branché au moral de pile (remédiation R5 CO4)', () => {
  const catalog = { def: unit({ id: 'def', nativeTerrain: 'grass' }) };
  const skillCatalog: Record<string, HeroSkillDef> = {
    leadership: { id: 'leadership', ranks: [{ moraleBonus: 1 }, { moraleBonus: 2 }, { moraleBonus: 3 }] },
  };

  function moralWithLeadership(rank?: number): number {
    const hero = rank !== undefined ? baseHero({ id: 'hero-atk', skills: { leadership: rank } }) : undefined;
    const s = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'def', count: 3, pos: { col: 0, row: 0 } });
    // Terrain swamp ≠ nativeTerrain grass, un seul groupe ⇒ moral de base 0.
    const combat = combatState([s], { terrain: 'swamp', attackerHeroId: hero?.id ?? null });
    const state: GameState = { ...baseState(catalog), skillCatalog, heroes: hero ? [hero] : [], combat };
    return moraleOf(s, combat, state);
  }

  it('sans Commandement : moral de base inchangé', () => {
    expect(moralWithLeadership()).toBe(0);
  });

  it('Commandement rang 2 ajoute +2 au moral de la pile du camp du héros', () => {
    expect(moralWithLeadership(2)).toBe(2);
  });
});

describe('computeMultiplier — bonus héros (heroDamagePct/heroArmorPct)', () => {
  it('heroDamagePct augmente les dégâts (Attaque au corps/Tir)', () => {
    const base = computeMultiplier({
      strikerAttack: 5,
      targetDefense: 5,
      targetDefending: false,
      targetMarks: 0,
      meleePenalized: false,
      rules: RULES,
    });
    const withMelee = computeMultiplier({
      strikerAttack: 5,
      targetDefense: 5,
      targetDefending: false,
      targetMarks: 0,
      meleePenalized: false,
      rules: RULES,
      heroDamagePct: 0.2,
    });
    expect(base).toBeCloseTo(1);
    expect(withMelee).toBeCloseTo(1.2);
  });

  it('heroArmorPct réduit les dégâts subis (Armure)', () => {
    const withArmor = computeMultiplier({
      strikerAttack: 5,
      targetDefense: 5,
      targetDefending: false,
      targetMarks: 0,
      meleePenalized: false,
      rules: RULES,
      heroArmorPct: 0.3,
    });
    expect(withArmor).toBeCloseTo(0.7);
  });
});

describe('compétences de combat — intégration via performStrike/applyAction', () => {
  it('Armure (compétence du héros défenseur) réduit les dégâts subis', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 5, defense: 0, damage: [10, 10], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    const skillCatalog: Record<string, HeroSkillDef> = {
      armor: { id: 'armor', ranks: [{ armorReductionPct: 10 }, { armorReductionPct: 20 }, { armorReductionPct: 30 }] },
    };

    function damageWithArmor(rank?: number): number {
      const defHero = rank !== undefined ? baseHero({ id: 'hero-def', skills: { armor: rank } }) : undefined;
      const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
      const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
      const combat = combatState([attacker, defender], defHero ? { defenderHeroId: defHero.id } : {});
      const state: GameState = { ...baseState(catalog), skillCatalog, heroes: defHero ? [defHero] : [], combat };
      const events: GameEvent[] = [];
      produce(state, (draft) => {
        applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
      });
      return (events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>).damage;
    }

    // diff=5-5=0 → mult=1 sans compétence : dégâts round(10)=10.
    expect(damageWithArmor()).toBe(10);
    // rang 3 (-30%) : round(10×0,7)=7.
    expect(damageWithArmor(3)).toBe(7);
  });

  it('Attaque au corps (compétence du héros attaquant) augmente les dégâts de mêlée', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 0, defense: 0, damage: [10, 10], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 0, damage: [1, 1], speed: 1 } }),
    };
    const skillCatalog: Record<string, HeroSkillDef> = {
      melee: { id: 'melee', ranks: [{ meleeDamagePct: 10 }, { meleeDamagePct: 20 }, { meleeDamagePct: 30 }] },
    };

    function damageWithMelee(rank?: number): number {
      const atkHero = rank !== undefined ? baseHero({ id: 'hero-atk', skills: { melee: rank } }) : undefined;
      const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
      const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
      const combat = combatState([attacker, defender], atkHero ? { attackerHeroId: atkHero.id } : {});
      const state: GameState = { ...baseState(catalog), skillCatalog, heroes: atkHero ? [atkHero] : [], combat };
      const events: GameEvent[] = [];
      produce(state, (draft) => {
        applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
      });
      return (events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>).damage;
    }

    // diff=0 → mult=1 sans compétence : dégâts 10.
    expect(damageWithMelee()).toBe(10);
    // rang 2 (+20%) : round(10×1,2)=12.
    expect(damageWithMelee(2)).toBe(12);
  });

  it('Chance (compétence, bornée [0,3]) augmente la fréquence des coups de chance', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 5, defense: 0, damage: [4, 4], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 0, damage: [1, 1], speed: 1 } }),
    };
    const skillCatalog: Record<string, HeroSkillDef> = {
      luck: { id: 'luck', ranks: [{ luckBonus: 1 }, { luckBonus: 2 }, { luckBonus: 3 }] },
    };

    function luckyCount(skills: Record<string, number>, seeds: number[]): number {
      let count = 0;
      for (const seed of seeds) {
        const h = baseHero({ skills });
        const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
        const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
        const combat = combatState([attacker, defender], { attackerHeroId: h.id });
        const state: GameState = { ...baseState(catalog), rng: seedRng(seed), skillCatalog, heroes: [h], combat };
        const events: GameEvent[] = [];
        produce(state, (draft) => {
          applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
        });
        if ((events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>)?.lucky) {
          count++;
        }
      }
      return count;
    }

    const seeds = Array.from({ length: 200 }, (_, i) => i);
    expect(luckyCount({}, seeds)).toBe(0); // aucune compétence ⇒ luck=0 ⇒ jamais de coup de chance
    expect(luckyCount({ luck: 3 }, seeds)).toBeGreaterThan(0); // rang 3 ⇒ 12 %/coup ⇒ au moins un coup sur 200 essais
  });
});

describe('attribut héros (Attaque/Défense) branché dans computeMultiplier — décision plan #4', () => {
  it('un héros +10 Attaque augmente les dégâts ; sans héros lié (arène), comportement inchangé', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 5, defense: 0, damage: [10, 10], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };

    function damage(attackHeroBonus?: number): number {
      const atkHero =
        attackHeroBonus !== undefined
          ? baseHero({ attributes: { attack: attackHeroBonus, defense: 0, power: 0, knowledge: 0 } })
          : undefined;
      const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
      const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
      const combat = combatState([attacker, defender], atkHero ? { attackerHeroId: atkHero.id } : {});
      const state: GameState = { ...baseState(catalog), heroes: atkHero ? [atkHero] : [], combat };
      const events: GameEvent[] = [];
      produce(state, (draft) => {
        applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
      });
      return (events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>).damage;
    }

    // diff=5-5=0 → mult=1 (arène, aucun héros lié) : dégâts round(10)=10.
    expect(damage()).toBe(10);
    // héros +10 attaque ⇒ diff=15-5=10 → mult=1+0,05×10=1,5 : dégâts round(15)=15.
    expect(damage(10)).toBe(15);
  });
});
