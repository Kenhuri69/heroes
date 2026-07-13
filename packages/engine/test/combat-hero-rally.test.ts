import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger, recordLoss } from '../src/combat/state-helpers';
import { runAutoCombat } from '../src/combat/ai';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { HeroSkillDef } from '../src/hero/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * F-SKILLS.2 — Prière de bataille : action de héros générique gatée par une
 * compétence (`battleResurrectHp`), 1×/combat, qui ressuscite une pile alliée
 * (réutilise le cœur heal-résurrection). Engine-first (piloté par l'IA aussi).
 */

const SKILLS: Record<string, HeroSkillDef> = {
  'battle-prayer': { id: 'battle-prayer', ranks: [{ battleResurrectHp: 30 }, { battleResurrectHp: 60 }, { battleResurrectHp: 100 }] },
};

function unit(id: string, hp: number): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(skills: Record<string, number>): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills, visitLuck: 0,
    spells: [], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, firstHp: 10, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false, defending: false,
    ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...over,
  };
}

function rallyState(skills: Record<string, number>): GameState {
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 2, firstHp: 10, pos: { col: 0, row: 2 } }),
    stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 5, firstHp: 10, pos: { col: 10, row: 2 } }),
  ];
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  recordLoss(combat, 'attacker', 'ally', 3); // la pile alliée a déjà perdu 3 créatures
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally', 10), foe: unit('foe', 10) }, skillCatalog: SKILLS, heroes: [hero(skills)], combat,
  };
}

describe('F-SKILLS.2 — Prière de bataille', () => {
  it('ressuscite la pile alliée (effectif remonte), marque le camp et émet HeroRallied', () => {
    const state = rallyState({ 'battle-prayer': 1 }); // 30 PV
    const { state: next, events } = apply(state, { type: 'HeroRally', targetStackId: 'attacker-0' });
    const ally = next.combat?.stacks.find((s) => s.id === 'attacker-0');
    // pool 20 → min(50, 20+30)=50 ⇒ 5 créatures (3 relevées, plafonné aux pertes).
    expect(ally?.count).toBe(5);
    expect(next.combat?.heroRallyUsed).toContain('attacker');
    const rallied = events.find((e) => e.type === 'HeroRallied');
    expect(rallied).toMatchObject({ side: 'attacker', targetId: 'attacker-0', revived: 3 });
  });

  it('1×/combat : une seconde prière est refusée', () => {
    const state = rallyState({ 'battle-prayer': 1 });
    const once = apply(state, { type: 'HeroRally', targetStackId: 'attacker-0' }).state;
    expect(validate(once, { type: 'HeroRally', targetStackId: 'attacker-0' })?.code).toBe('heroRallyUsed');
  });

  it('sans la compétence : action indisponible', () => {
    const state = rallyState({}); // héros sans battle-prayer
    expect(validate(state, { type: 'HeroRally', targetStackId: 'attacker-0' })?.code).toBe('heroRallyUnavailable');
  });

  it('vise un allié, jamais l’ennemi', () => {
    const state = rallyState({ 'battle-prayer': 1 });
    expect(validate(state, { type: 'HeroRally', targetStackId: 'defender-0' })?.code).toBe('invalidTarget');
  });

  it('l’IA invoque la prière puis le combat se termine (property préservée)', () => {
    const state = rallyState({ 'battle-prayer': 3 });
    const events: GameEvent[] = [];
    const done = produce(state, (d) => runAutoCombat(d, events));
    expect(done.combat).toBeNull(); // se termine
    expect(events.some((e) => e.type === 'HeroRallied')).toBe(true); // l'IA a bien prié
  });
});
