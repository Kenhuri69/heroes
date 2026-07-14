import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { grantXp } from '../src/adventure/experience';
import { seedRng } from '../src/core/rng';
import {
  createEmptyState,
  type GameState,
  type HeroAttributes,
  type HeroState,
} from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { ResolvedHeroDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * H-NAMED.3 (doc 02 §1.2) — le gain d'attribut par niveau suit un profil PAR
 * ARCHÉTYPE (`config.attributeWeightsByArchetype`) sélectionné via l'entrée de
 * roster du héros (`heroRoster[rosterId].archetype`) ; repli sur le profil GLOBAL
 * si l'archétype est absent/inconnu. Le héros IA prend le tirage auto pondéré :
 * on l'exerce pour observer le biais statistiquement (seed fixe, déterministe).
 */

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'h', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [],
    xp: 0, level: 1, attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0, manaMax: 0, skills: {}, visitLuck: 0, visitMorale: 0, spells: [],
    artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [],
    name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
    ...over,
  };
}

function rosterEntry(archetype?: 'might' | 'magic'): ResolvedHeroDef {
  return {
    factionId: 'test',
    name: 'X',
    ...(archetype ? { archetype } : {}),
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    specialtyId: '',
    specialtyEffects: [],
    startingSkills: {},
    startingSpells: [],
  };
}

/**
 * Fait monter un héros IA de nombreux niveaux et retourne la somme des attributs
 * gagnés. `config` (aventure) porte les profils ; le héros pointe sur une entrée
 * de roster `r1`. Seed fixe ⇒ déterministe.
 */
function gainedAttributes(archetype: 'might' | 'magic' | undefined): HeroAttributes {
  const config = testConfig();
  // Profils très contrastés pour un signal net (100 % sur une paire d'attributs).
  config.hero.attributeWeightsByArchetype = {
    might: { attack: 1, defense: 1, power: 0, knowledge: 0 },
    magic: { attack: 0, defense: 0, power: 1, knowledge: 1 },
  };
  const h = hero({ rosterId: 'r1', xp: 0 });
  const state: GameState = {
    ...createEmptyState(),
    started: true,
    rng: seedRng(42),
    config,
    heroRoster: { r1: rosterEntry(archetype) },
    heroes: [h],
    players: [
      { id: 'p1', resources: { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0 }, factionResources: {}, explored: [], controller: 'ai', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
    ] as never,
  };
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    grantXp(draft, events, 'h', 5_000_000); // XP massive ⇒ nombreux niveaux d'un coup
  });
  const g = next.heroes[0]!.attributes;
  return { attack: g.attack, defense: g.defense, power: g.power, knowledge: g.knowledge };
}

describe('H-NAMED.3 — profil de gain d’attribut par archétype', () => {
  it('archétype might : ne gagne QUE Attaque/Défense (profil 1/1/0/0)', () => {
    const g = gainedAttributes('might');
    expect(g.power).toBe(0);
    expect(g.knowledge).toBe(0);
    expect(g.attack + g.defense).toBeGreaterThan(0);
  });

  it('archétype magic : ne gagne QUE Pouvoir/Savoir (profil 0/0/1/1)', () => {
    const g = gainedAttributes('magic');
    expect(g.attack).toBe(0);
    expect(g.defense).toBe(0);
    expect(g.power + g.knowledge).toBeGreaterThan(0);
  });

  it('sans archétype connu : repli sur le profil global (les 4 attributs possibles)', () => {
    // testConfig global = 30/30/20/20 ⇒ les 4 attributs peuvent sortir. Sur un grand
    // nombre de niveaux, au moins un Pouvoir ou Savoir sort (impossible avec le
    // profil might 1/1/0/0), prouvant que le repli n'utilise PAS un profil d'archétype.
    const g = gainedAttributes(undefined);
    expect(g.attack + g.defense + g.power + g.knowledge).toBeGreaterThan(0);
    expect(g.power + g.knowledge).toBeGreaterThan(0);
  });
});
