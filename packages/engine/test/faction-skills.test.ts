import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyFactionVictoryEffects } from '../src/faction/effects';
import { rollSkillChoices } from '../src/hero/level-up';
import type { CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import type { HeroSkillDef } from '../src/hero/types';
import type { TownState } from '../src/town/types';

/**
 * Lot F-SKILLS — compétences de faction (faction de TEST générique) :
 * (1) Nécromancie GRADUÉE : le rang de `scaleSkillId` choisit le % de
 *     `raiseUndeadOnVictory` (`percentByRank`), repli sur `percentHpRaised` ;
 * (2) POOL gaté : une compétence taguée `factionId` n'est proposée qu'aux héros
 *     de cette faction.
 */

function hero(over: Partial<HeroState>): HeroState {
  return {
    id: 'h1', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    visitMorale: 0,
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '', ...over,
  };
}

const CATALOG: Record<string, CombatUnitDef> = {
  skel: { id: 'skel', groupId: 'g', nativeTerrain: 'grass', stats: { hp: 6, attack: 3, defense: 3, damage: [1, 2], speed: 4 }, abilities: [{ id: 'undead' }] },
  grunt: { id: 'grunt', groupId: 'g', nativeTerrain: 'grass', stats: { hp: 10, attack: 5, defense: 5, damage: [1, 2], speed: 4 }, abilities: [] },
};

// Bonus gradué : 10/15/20 % par rang, repli 15 %.
const FACTION_CATALOG = {
  'facA': { bonuses: [{ type: 'raiseUndeadOnVictory' as const, unitId: 'skel', percentHpRaised: 15, capBase: 20, capPerExisting: 2, scaleSkillId: 'necromancy', percentByRank: [10, 15, 20] }] },
};

/** Relève après victoire avec un héros de rang de Nécromancie donné (0 = non appris). */
function raisedAt(necroRank: number): number {
  const combat = { attackerHeroId: 'h1', defenderHeroId: null } as unknown as CombatState;
  const h = hero({ factionId: 'facA', skills: necroRank > 0 ? { necromancy: necroRank } : {} });
  const casualties = [{ side: 'defender' as const, unitId: 'grunt', lost: 50 }]; // 500 PV vivants tués
  const events: GameEvent[] = [];
  const state = { ...createEmptyState(), unitCatalog: CATALOG, factionCatalog: FACTION_CATALOG, heroes: [h] } as GameState;
  const next = produce(state, (draft) => {
    applyFactionVictoryEffects(draft, combat, draft.heroes[0]!, casualties, 'defender', events);
  });
  return next.heroes[0]?.army.find((s) => s.unitId === 'skel')?.count ?? 0;
}

describe('F-SKILLS — Nécromancie graduée', () => {
  it('le rang choisit le % : Novice < repli plat < Maître (10 < 15 < 20 %)', () => {
    const flat = raisedAt(0); // repli percentHpRaised = 15 % ⇒ floor(500*.15/6)=12
    const novice = raisedAt(1); // 10 % ⇒ floor(500*.10/6)=8
    const master = raisedAt(3); // 20 % ⇒ floor(500*.20/6)=16
    expect(novice).toBe(8);
    expect(flat).toBe(12);
    expect(master).toBe(16);
    expect(novice).toBeLessThan(flat);
    expect(flat).toBeLessThan(master);
  });
});

// Bonus gradué compétence ET bâtiment : +3 %/niveau du bâtiment `amp`.
const FACTION_CATALOG_BLD = {
  facA: { bonuses: [{ type: 'raiseUndeadOnVictory' as const, unitId: 'skel', percentHpRaised: 15, capBase: 20, capPerExisting: 2, scaleSkillId: 'necromancy', percentByRank: [10, 15, 20], scaleBuildingId: 'amp', percentPerBuildingLevel: 3 }] },
};

/**
 * Relève après victoire avec un Amplificateur de niveau `ampLevel` dans une ville
 * appartenant à `townOwner` (héros = joueur 'p1'). Rang de Nécromancie 0 (repli
 * plat 15 %) pour garder de la marge sous le plafond.
 */
function raisedWithAmplifier(ampLevel: number, townOwner: string): number {
  const combat = { attackerHeroId: 'h1', defenderHeroId: null } as unknown as CombatState;
  const h = hero({ factionId: 'facA' });
  const casualties = [{ side: 'defender' as const, unitId: 'grunt', lost: 50 }]; // 500 PV vivants tués
  const towns =
    ampLevel > 0
      ? [{ ownerPlayerId: townOwner, buildings: { amp: ampLevel } } as unknown as TownState]
      : [];
  const events: GameEvent[] = [];
  const state = { ...createEmptyState(), unitCatalog: CATALOG, factionCatalog: FACTION_CATALOG_BLD, heroes: [h], towns } as GameState;
  const next = produce(state, (draft) => {
    applyFactionVictoryEffects(draft, combat, draft.heroes[0]!, casualties, 'defender', events);
  });
  return next.heroes[0]?.army.find((s) => s.unitId === 'skel')?.count ?? 0;
}

describe('F-SKILLS — Nécromancie graduée par bâtiment', () => {
  it('l’Amplificateur augmente la relève par niveau (15 % → 18 % → 21 %)', () => {
    // floor(500 × p% / 6), plafond 20 : 15 %→12, 18 %→15, 21 %→17.
    expect(raisedWithAmplifier(0, 'p1')).toBe(12);
    expect(raisedWithAmplifier(1, 'p1')).toBe(15);
    expect(raisedWithAmplifier(2, 'p1')).toBe(17);
  });

  it('seules les villes du VAINQUEUR comptent (amplificateur adverse ignoré)', () => {
    expect(raisedWithAmplifier(2, 'p2')).toBe(12); // ville de p2 ⇒ aucun bonus
  });
});

describe('F-SKILLS — pool de compétences gaté par faction', () => {
  const skillCatalog: Record<string, HeroSkillDef> = {
    logistics: { id: 'logistics', ranks: [{ movementBonusPct: 10 }, { movementBonusPct: 20 }, { movementBonusPct: 30 }] },
    necromancy: { id: 'necromancy', ranks: [{}, {}, {}], factionId: 'facA' },
  };

  function choices(factionId: string): string[] {
    const state = { ...createEmptyState(), rng: seedRng(1), skillCatalog } as GameState;
    let picks: string[] = [];
    produce(state, (draft) => { picks = rollSkillChoices(draft, hero({ factionId })); });
    return picks;
  }

  it('propose la compétence de faction au héros de la faction', () => {
    expect(choices('facA')).toContain('necromancy');
  });

  it('ne propose PAS la compétence de faction à un héros d’une autre faction', () => {
    const other = choices('facB');
    expect(other).not.toContain('necromancy');
    expect(other).toContain('logistics'); // la commune reste proposée
  });
});
