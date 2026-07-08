import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import {
  createEmptyState,
  emptyResources,
  type GameState,
  type HeroState,
} from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { SpellDef } from '../src/hero/types';
import type { TownState } from '../src/town/types';
import { testConfig, testMap, testCatalog } from './fixtures';

/**
 * Sorts d'aventure (doc 02 §1.4, Alpha 4.16) : lancés sur la CARTE, hors combat.
 * `ville-portail` téléporte le héros vers une ville possédée et décompte la mana ;
 * la mana se restaure chaque jour.
 */
const PORTAL: SpellDef = {
  id: 'ville-portail',
  school: 'air',
  circle: 3,
  manaCost: 16,
  kind: 'adventure',
  base: 0,
  perPower: 0,
  adventure: { type: 'townPortal' },
};
const BOLT: SpellDef = {
  id: 'bolt',
  school: 'fire',
  circle: 1,
  manaCost: 5,
  kind: 'damage',
  base: 10,
  perPower: 2,
};

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-player-1',
    playerId: 'player-1',
    pos: { x: 0, y: 0 },
    movementPoints: 100,
    army: [{ unitId: 'red-grunt', count: 5 }],
    xp: 0,
    level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 4 },
    mana: 40,
    manaMax: 40,
    skills: {},
    visitLuck: 0,
    spells: ['ville-portail'],
    artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [],
    factionId: '',
    houseId: '',
    houseEffects: [],
    warMachines: [],
    ...over,
  };
}

function state(heroOver: Partial<HeroState> = {}, townOwner: string | null = 'player-1'): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.map = testMap();
  s.rng = seedRng(1);
  s.currentPlayer = 0;
  s.players = [
    { id: 'player-1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: 0, huntContract: null },
  ];
  s.heroes = [hero(heroOver)];
  const town: TownState = { id: 't1', ownerPlayerId: townOwner, pos: { x: 8, y: 8 }, factionId: '', buildings: {}, builtToday: false, garrison: [], stock: {}, spellPool: [] };
  s.towns = [town];
  s.unitCatalog = testCatalog();
  s.spellCatalog = { 'ville-portail': PORTAL, bolt: BOLT };
  return s;
}

describe('CastAdventureSpell — Ville-portail', () => {
  it('téléporte le héros vers sa ville et décompte la mana', () => {
    const { state: next, events } = apply(state(), {
      type: 'CastAdventureSpell',
      heroId: 'hero-player-1',
      spellId: 'ville-portail',
      playerId: 'player-1',
    });
    expect(next.heroes[0]?.pos).toEqual({ x: 8, y: 8 });
    expect(next.heroes[0]?.mana).toBe(24); // 40 − 16
    expect(events.some((e) => e.type === 'AdventureSpellCast')).toBe(true);
  });

  it('révèle le brouillard autour de la ville d’arrivée', () => {
    const { state: next } = apply(state(), {
      type: 'CastAdventureSpell',
      heroId: 'hero-player-1',
      spellId: 'ville-portail',
      playerId: 'player-1',
    });
    const map = next.map!;
    const idx = 8 * map.width + 8;
    expect(next.players[0]?.explored[idx]).toBe(1);
  });

  it('B4 — n’atterrit pas sur une tuile occupée par un autre héros (voisine libre)', () => {
    const s = state();
    // Un autre héros du joueur occupe déjà la tuile de la ville (8,8).
    s.heroes.push(hero({ id: 'hero-blocker', pos: { x: 8, y: 8 }, spells: [] }));
    const { state: next } = apply(s, {
      type: 'CastAdventureSpell',
      heroId: 'hero-player-1',
      spellId: 'ville-portail',
      playerId: 'player-1',
    });
    const moved = next.heroes.find((h) => h.id === 'hero-player-1')!;
    const blocker = next.heroes.find((h) => h.id === 'hero-blocker')!;
    expect(moved.pos).not.toEqual(blocker.pos); // pas de superposition
    // Atterrit sur une tuile voisine de la ville (distance de Tchebychev 1).
    expect(Math.max(Math.abs(moved.pos.x - 8), Math.abs(moved.pos.y - 8))).toBe(1);
  });

  it('refuse en combat', () => {
    const s = state();
    s.combat = { finished: false } as unknown as GameState['combat'];
    expect(validate(s, { type: 'CastAdventureSpell', heroId: 'hero-player-1', spellId: 'ville-portail', playerId: 'player-1' })?.code).toBe('combatActive');
  });

  it('refuse sans mana suffisante', () => {
    expect(
      validate(state({ mana: 5 }), { type: 'CastAdventureSpell', heroId: 'hero-player-1', spellId: 'ville-portail', playerId: 'player-1' })?.code,
    ).toBe('notEnoughMana');
  });

  it('refuse sans ville possédée', () => {
    expect(
      validate(state({}, null), { type: 'CastAdventureSpell', heroId: 'hero-player-1', spellId: 'ville-portail', playerId: 'player-1' })?.code,
    ).toBe('invalidAction');
  });

  it('refuse un sort qui n’est pas d’aventure', () => {
    const s = state({ spells: ['bolt'] });
    expect(
      validate(s, { type: 'CastAdventureSpell', heroId: 'hero-player-1', spellId: 'bolt', playerId: 'player-1' })?.code,
    ).toBe('invalidAction');
  });

  it('restaure la mana à la bascule de jour', () => {
    const s = state({ mana: 8 });
    // Un seul joueur : EndTurn passe directement au jour suivant.
    const { state: next } = apply(s, { type: 'EndTurn', playerId: 'player-1' });
    expect(next.calendar.day).toBe(2);
    expect(next.heroes[0]?.mana).toBe(40); // restaurée à manaMax (knowledge 4 × 10)
  });
});
