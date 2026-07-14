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
// H-SPELLS.3 — sort d'aventure « Vision » : révèle le brouillard dans un rayon
// autour du héros, sans le déplacer.
const VISION: SpellDef = {
  id: 'clairvoyance',
  school: 'air',
  circle: 2,
  manaCost: 8,
  kind: 'adventure',
  base: 0,
  perPower: 0,
  adventure: { type: 'vision', radius: 3 },
};
// H-SPELLS — sort d'aventure « Marche forcée » : ajoute des PM immédiats au
// héros, sans le déplacer.
const MARCH: SpellDef = {
  id: 'marche-forcee',
  school: 'air',
  circle: 1,
  manaCost: 6,
  kind: 'adventure',
  base: 0,
  perPower: 0,
  adventure: { type: 'movementBonus', amount: 600 },
};
// H-SPELLS — sort d'aventure « Cartographie » : révèle tout le brouillard.
const CARTO: SpellDef = {
  id: 'cartographie',
  school: 'air',
  circle: 4,
  manaCost: 20,
  kind: 'adventure',
  base: 0,
  perPower: 0,
  adventure: { type: 'revealMap' },
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
    visitMorale: 0,
    spells: ['ville-portail'],
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

function state(heroOver: Partial<HeroState> = {}, townOwner: string | null = 'player-1'): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.map = testMap();
  s.rng = seedRng(1);
  s.currentPlayer = 0;
  s.players = [
    { id: 'player-1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
  ];
  s.heroes = [hero(heroOver)];
  const town: TownState = { id: 't1', ownerPlayerId: townOwner, pos: { x: 8, y: 8 }, factionId: '', buildings: {}, builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {} };
  s.towns = [town];
  s.unitCatalog = testCatalog();
  s.spellCatalog = { 'ville-portail': PORTAL, bolt: BOLT, clairvoyance: VISION, 'marche-forcee': MARCH, cartographie: CARTO };
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

describe('CastAdventureSpell — Vision (H-SPELLS.3)', () => {
  it('révèle le brouillard dans le rayon autour du héros, sans le déplacer', () => {
    const { state: next, events } = apply(state({ spells: ['clairvoyance'], pos: { x: 5, y: 5 } }), {
      type: 'CastAdventureSpell',
      heroId: 'hero-player-1',
      spellId: 'clairvoyance',
      playerId: 'player-1',
    });
    const hero = next.heroes[0]!;
    const map = next.map!;
    const explored = next.players[0]!.explored;
    // Le héros ne bouge pas.
    expect(hero.pos).toEqual({ x: 5, y: 5 });
    // Tuile au bord du rayon (3) révélée ; tuile hors rayon (dist 4) non révélée.
    expect(explored[5 * map.width + (5 + 3)]).toBe(1);
    expect(explored[(5 + 4) * map.width + 5] ?? 0).toBe(0);
    // Mana décomptée + événement émis.
    expect(hero.mana).toBe(32); // 40 − 8
    expect(events.some((e) => e.type === 'AdventureSpellCast')).toBe(true);
  });

  it('refuse Vision sans mana suffisante', () => {
    expect(
      validate(state({ spells: ['clairvoyance'], mana: 5 }), {
        type: 'CastAdventureSpell',
        heroId: 'hero-player-1',
        spellId: 'clairvoyance',
        playerId: 'player-1',
      })?.code,
    ).toBe('notEnoughMana');
  });
});

describe('CastAdventureSpell — Marche forcée (H-SPELLS)', () => {
  it('ajoute des PM immédiats au héros sans le déplacer, décompte la mana', () => {
    const { state: next, events } = apply(state({ spells: ['marche-forcee'], movementPoints: 100, pos: { x: 5, y: 5 } }), {
      type: 'CastAdventureSpell',
      heroId: 'hero-player-1',
      spellId: 'marche-forcee',
      playerId: 'player-1',
    });
    const h = next.heroes[0]!;
    expect(h.pos).toEqual({ x: 5, y: 5 }); // pas de déplacement
    expect(h.movementPoints).toBe(700); // 100 + 600
    expect(h.mana).toBe(34); // 40 − 6
    expect(events.some((e) => e.type === 'AdventureSpellCast')).toBe(true);
  });

  it('refuse Marche forcée sans mana suffisante', () => {
    expect(
      validate(state({ spells: ['marche-forcee'], mana: 2 }), {
        type: 'CastAdventureSpell',
        heroId: 'hero-player-1',
        spellId: 'marche-forcee',
        playerId: 'player-1',
      })?.code,
    ).toBe('notEnoughMana');
  });
});

describe('CastAdventureSpell — Cartographie (H-SPELLS)', () => {
  it('révèle tout le brouillard de la carte sans déplacer le héros', () => {
    const { state: next, events } = apply(state({ spells: ['cartographie'], pos: { x: 0, y: 0 } }), {
      type: 'CastAdventureSpell',
      heroId: 'hero-player-1',
      spellId: 'cartographie',
      playerId: 'player-1',
    });
    const h = next.heroes[0]!;
    const map = next.map!;
    const explored = next.players[0]!.explored;
    expect(h.pos).toEqual({ x: 0, y: 0 }); // pas de déplacement
    // Coin opposé (loin du héros) révélé + case centrale.
    expect(explored[(map.height - 1) * map.width + (map.width - 1)]).toBe(1);
    expect(explored[5 * map.width + 5]).toBe(1);
    // Toute la grille est révélée.
    expect(explored.filter((v) => v === 1)).toHaveLength(map.width * map.height);
    expect(h.mana).toBe(20); // 40 − 20
    expect(events.some((e) => e.type === 'AdventureSpellCast')).toBe(true);
  });
});
