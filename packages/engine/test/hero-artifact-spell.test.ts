import { describe, expect, it } from 'vitest';
import { validate } from '../src/core/engine';
import { heroKnownSpellIds } from '../src/hero/artifacts';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { ArtifactDef, SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * H-ARTEQUIP.2 — un artefact équipé (`grantsSpell`) enseigne un sort : il devient
 * castable comme un sort appris (union `heroKnownSpellIds`), sans muter
 * `hero.spells`. Générique (ids opaques), zéro faction.
 */

const BOLT: SpellDef = { id: 'art-bolt', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 6, perPower: 2 };
const GRIMOIRE: ArtifactDef = { id: 'art-grimoire', bonus: { power: 1 }, grantsSpell: 'art-bolt' };
const PLAIN: ArtifactDef = { id: 'art-plain', bonus: { attack: 1 } };

function unit(id: string): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(equipped: (string | null)[]): HeroState {
  const artifacts = Array.from({ length: 10 }, (_, i) => equipped[i] ?? null);
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {}, visitLuck: 0,
    spells: [], artifacts, pendingSkillChoices: [], pendingAttributeChoices: [],
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

function combatState(h: HeroState): GameState {
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 2, pos: { col: 0, row: 2 } }),
    stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 5, pos: { col: 10, row: 2 } }),
  ];
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog: { 'art-bolt': BOLT },
    artifactCatalog: { 'art-grimoire': GRIMOIRE, 'art-plain': PLAIN }, heroes: [h], combat,
  };
}

describe('H-ARTEQUIP.2 — artefact enseignant un sort', () => {
  it('heroKnownSpellIds fait l’union des sorts appris et des sorts d’artefacts équipés', () => {
    const h = hero(['art-grimoire']);
    expect(heroKnownSpellIds(h, { 'art-grimoire': GRIMOIRE })).toEqual(['art-bolt']);
    // Sans doublon si déjà appris.
    expect(heroKnownSpellIds({ ...h, spells: ['art-bolt'] }, { 'art-grimoire': GRIMOIRE })).toEqual(['art-bolt']);
    // Artefact sans grantsSpell ⇒ aucun ajout.
    expect(heroKnownSpellIds(hero(['art-plain']), { 'art-plain': PLAIN })).toEqual([]);
  });

  it('un sort d’artefact équipé est castable (validate passe) alors qu’il n’est pas appris', () => {
    const state = combatState(hero(['art-grimoire']));
    expect(state.heroes[0]?.spells).not.toContain('art-bolt');
    expect(validate(state, { type: 'CastSpell', spellId: 'art-bolt', targetStackId: 'defender-0' })).toBeNull();
  });

  it('artefact retiré ⇒ le sort n’est plus castable (spellNotKnown)', () => {
    const state = combatState(hero([])); // aucun artefact équipé
    expect(validate(state, { type: 'CastSpell', spellId: 'art-bolt', targetStackId: 'defender-0' })?.code).toBe(
      'spellNotKnown',
    );
  });
});
