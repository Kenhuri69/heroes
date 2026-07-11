import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { GameEvent } from '../src/core/events';
import { maybeHeroAction } from '../src/combat/ai';
import { validateCastSpell } from '../src/hero';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * C-AIPARITY (doc 02 §5.5) : l'IA joue les actions du HÉROS de son camp —
 * sort (1/round par camp) puis attaque héroïque (1×/combat). Mêmes conventions
 * locales que `hero-spells.test.ts` (état minimal, sans StartGame).
 */

const SPELLS: Record<string, SpellDef> = {
  bolt: { id: 'bolt', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 10, perPower: 2 },
  heal: { id: 'heal', school: 'water', circle: 1, manaCost: 5, kind: 'heal', base: 10, perPower: 3 },
};

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
    spellCharges: 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...partial,
  };
}

function hero(over: Partial<HeroState> & { id: string }): HeroState {
  return {
    playerId: 'p2',
    pos: { x: 0, y: 0 },
    movementPoints: 0,
    level: 1,
    xp: 0,
    attributes: { attack: 0, defense: 0, power: 3, knowledge: 2 },
    mana: 20,
    manaMax: 20,
    spells: [],
    skills: {},
    visitLuck: 0,
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
    ...over,
  };
}

/** Combat où le camp JOUEUR est l'attaquant et le héros IA est côté défenseur. */
function aiHeroState(
  h: HeroState,
  opts: { heroAttack?: { base: number; perPower: number; perAttack: number }; stacks?: CombatStack[] } = {},
): GameState {
  const catalog = { u: unit({ id: 'u' }) };
  const stacks = opts.stacks ?? [
    stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'u', count: 5, pos: { col: 0, row: 0 } }),
    stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'u', count: 5, pos: { col: 5, row: 5 } }),
  ];
  const combat: CombatState = {
    terrain: 'grass',
    phase: 'battle',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: 'defender-0',
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    finished: false,
    attackerHeroId: null,
    defenderHeroId: h.id,
    heroCastThisRound: [],
    heroAttackUsed: [],
    winner: null,
  };
  const base = testConfig();
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config: { ...base, combat: { ...base.combat, heroAttack: opts.heroAttack } },
    unitCatalog: catalog,
    spellCatalog: SPELLS,
    heroes: [h],
    combat,
  };
}

function run(state: GameState, side: 'attacker' | 'defender'): { acted: boolean; events: GameEvent[]; next: GameState } {
  const events: GameEvent[] = [];
  let acted = false;
  const next = produce(state, (draft) => {
    acted = maybeHeroAction(draft, events, side);
  });
  return { acted, events, next };
}

describe('C-AIPARITY — maybeHeroAction', () => {
  it('le héros IA lance son sort de dégâts sur l’ennemi (1/round par camp), mana débitée', () => {
    const h = hero({ id: 'hero-ai', spells: ['bolt'] });
    const state = aiHeroState(h);
    const { acted, events, next } = run(state, 'defender');
    expect(acted).toBe(true);
    const cast = events.find((e) => e.type === 'SpellCast');
    expect(cast).toMatchObject({ heroId: 'hero-ai', spellId: 'bolt', targetId: 'attacker-0' });
    expect(next.heroes[0]?.mana).toBe(15); // 20 − 5
    expect(next.combat?.heroCastThisRound).toContain('defender');
    // Même round : plus de sort (et pas d'attaque héroïque configurée) ⇒ no-op.
    const again = run(next, 'defender');
    expect(again.acted).toBe(false);
  });

  it('soin : cible l’allié le plus blessé ; personne de blessé ⇒ conserve la mana', () => {
    const h = hero({ id: 'hero-ai', spells: ['heal'] });
    const wounded = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'u', count: 5, pos: { col: 5, row: 5 }, firstHp: 2 });
    const enemy = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'u', count: 5, pos: { col: 0, row: 0 } });
    const state = aiHeroState(h, { stacks: [enemy, wounded] });
    const { acted, events } = run(state, 'defender');
    expect(acted).toBe(true);
    expect(events.find((e) => e.type === 'SpellCast')).toMatchObject({ spellId: 'heal', targetId: 'defender-0' });

    // Aucun blessé : la mana est conservée (pas de lancer).
    const intact = aiHeroState(h);
    expect(run(intact, 'defender').acted).toBe(false);
  });

  it('mana insuffisante ⇒ aucun sort', () => {
    const h = hero({ id: 'hero-ai', spells: ['bolt'], mana: 3 });
    const state = aiHeroState(h);
    expect(run(state, 'defender').acted).toBe(false);
  });

  it('attaque héroïque : 1×/combat, sur la cible qui maximise pertes × valeur', () => {
    const h = hero({ id: 'hero-ai', spells: [] });
    const state = aiHeroState(h, { heroAttack: { base: 10, perPower: 2, perAttack: 0 } });
    const { acted, events, next } = run(state, 'defender');
    expect(acted).toBe(true);
    expect(events.find((e) => e.type === 'HeroStruck')).toMatchObject({ side: 'defender', targetId: 'attacker-0' });
    expect(next.combat?.heroAttackUsed).toContain('defender');
    // Déjà utilisée ⇒ no-op.
    expect(run(next, 'defender').acted).toBe(false);
  });

  it('le lancer IA ne bloque PAS le sort du joueur (verrou par camp)', () => {
    const h = hero({ id: 'hero-ai', spells: ['bolt'] });
    const playerHero = hero({ id: 'hero-player', playerId: 'p1', spells: ['bolt'] });
    const state = aiHeroState(h);
    const withPlayer: GameState = {
      ...state,
      heroes: [h, playerHero],
      combat: {
        ...(state.combat as CombatState),
        attackerHeroId: 'hero-player',
        activeStackId: 'attacker-0',
        heroCastThisRound: ['defender'], // l'IA a déjà lancé ce round
      },
    };
    // La COMMANDE joueur reste valide : le verrou est par camp, plus partagé.
    expect(
      validateCastSpell(withPlayer, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'defender-0' }),
    ).toBeNull();
  });

  it('sans héros lié au camp : no-op', () => {
    const h = hero({ id: 'hero-ai', spells: ['bolt'] });
    const state = aiHeroState(h);
    const combat = state.combat as CombatState;
    const noHero: GameState = { ...state, combat: { ...combat, defenderHeroId: null } };
    expect(run(noHero, 'defender').acted).toBe(false);
  });
});
