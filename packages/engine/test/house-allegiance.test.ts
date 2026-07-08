import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type HeroState } from '../src/core/state';
import type { HeroSkillDef, SkillRankEffect } from '../src/hero/types';
import {
  heroArmorPct,
  heroGoldPerDay,
  heroLuck,
  heroManaCostReduction,
  heroMeleePct,
  heroMorale,
  heroMovementBonus,
  heroRangedPct,
  heroVisionBonus,
} from '../src/hero/skills';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Allégeance de Maison (doc 16 §3.1, signature `houseAllegiance`) — les effets
 * de Maison réutilisent le vocabulaire des compétences et s'agrègent AU MÊME
 * TITRE dans `hero/skills.ts`, seul point du moteur qui les interprète.
 *
 * Garde-fou CI « zéro nom de faction dans le moteur » : ce fichier n'emploie que
 * des ids FICTIFS de Maison ('house-lion', 'house-eagle'…), jamais un id de
 * `data/factions/index.json`.
 */

const EMPTY_SKILLS: Record<string, HeroSkillDef> = {};

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
    houseId: '',
    houseEffects: [],
    warMachines: [],
    ...over,
  };
}

describe('houseAllegiance — effets de Maison agrégés comme des compétences', () => {
  it('un héros sans Maison ([]) n’ajoute aucun bonus', () => {
    const h = baseHero();
    expect(heroGoldPerDay(h, EMPTY_SKILLS)).toBe(0);
    expect(heroMeleePct(h, EMPTY_SKILLS)).toBe(0);
    expect(heroMorale(h, EMPTY_SKILLS)).toBe(0);
    expect(heroManaCostReduction(h, EMPTY_SKILLS, 'fire')).toBe(0);
  });

  it('les effets de Maison alimentent chaque accesseur', () => {
    const effects: SkillRankEffect[] = [
      {
        goldPerDay: 250,
        meleeDamagePct: 10,
        moraleBonus: 1,
        luckBonus: 1,
        armorReductionPct: 5,
        rangedDamagePct: 8,
        movementBonusPct: 10,
        visionBonus: 2,
        manaCostReductionPct: 15,
      },
    ];
    const h = baseHero({ houseId: 'house-lion', houseEffects: effects });
    expect(heroGoldPerDay(h, EMPTY_SKILLS)).toBe(250);
    expect(heroMeleePct(h, EMPTY_SKILLS)).toBe(10);
    expect(heroMorale(h, EMPTY_SKILLS)).toBe(1);
    expect(heroLuck(h, EMPTY_SKILLS)).toBe(1);
    expect(heroArmorPct(h, EMPTY_SKILLS)).toBe(5);
    expect(heroRangedPct(h, EMPTY_SKILLS)).toBe(8);
    expect(heroMovementBonus(h, EMPTY_SKILLS)).toBe(10);
    expect(heroVisionBonus(h, EMPTY_SKILLS)).toBe(2);
    // La réduction de mana d'une Maison s'applique quelle que soit l'école (≠ A6).
    expect(heroManaCostReduction(h, EMPTY_SKILLS, 'fire')).toBe(15);
    expect(heroManaCostReduction(h, EMPTY_SKILLS, 'water')).toBe(15);
  });

  it('Maison et compétences se CUMULENT sur le même champ', () => {
    const catalog: Record<string, HeroSkillDef> = {
      estates: { id: 'estates', ranks: [{ goldPerDay: 100 }] },
    };
    const h = baseHero({ skills: { estates: 1 }, houseEffects: [{ goldPerDay: 250 }] });
    expect(heroGoldPerDay(h, catalog)).toBe(350);
  });

  it('plusieurs effets de Maison se somment', () => {
    const h = baseHero({ houseEffects: [{ goldPerDay: 100 }, { goldPerDay: 50 }] });
    expect(heroGoldPerDay(h, EMPTY_SKILLS)).toBe(150);
  });
});

describe('houseAllegiance — StartGame résout hero.houseEffects', () => {
  function started(startingHouseId?: string) {
    const players: PlayerSetup[] = [
      {
        id: 'p1',
        startingResources: emptyResources(),
        ...(startingHouseId ? { startingHouseId } : {}),
      },
    ];
    return apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map: testMap(),
      config: testConfig(),
      unitCatalog: testCatalog(),
      buildingCatalog: {},
      towns: [],
      houseCatalog: { 'house-eagle': { effects: [{ manaCostReductionPct: 15 }] } },
    }).state;
  }

  it('résout les effets depuis houseCatalog + startingHouseId', () => {
    const hero = started('house-eagle').heroes[0]!;
    expect(hero.houseId).toBe('house-eagle');
    expect(hero.houseEffects).toEqual([{ manaCostReductionPct: 15 }]);
    // Effet réellement branché : réduction de coût de mana côté combat.
    expect(heroManaCostReduction(hero, EMPTY_SKILLS, 'water')).toBe(15);
  });

  it('aucune Maison ⇒ houseId "" et houseEffects []', () => {
    const hero = started().heroes[0]!;
    expect(hero.houseId).toBe('');
    expect(hero.houseEffects).toEqual([]);
  });
});
