import { produce } from 'immer';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkCombatEnd } from '../src/combat/turns';
import { initLedger, recordLoss } from '../src/combat/state-helpers';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import {
  createEmptyState,
  emptyResources,
  type GameState,
  type HeroState,
  type PlayerState,
} from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { FactionBonus } from '../src/faction/types';

/**
 * Interpréteur d'effets de faction déclaratifs post-victoire (doc 06 §4,
 * plan phase-3.4 lot O) : `raiseUndeadOnVictory`. Les IDs de test 'necro' /
 * 'skel' / 'wolf' / 'zombie' sont arbitraires — aucun identifiant de maison
 * réelle du jeu n'apparaît ici : le moteur ne doit connaître que le `type`
 * générique du bonus, jamais une maison.
 *
 * Style local (comme `hero-spells.test.ts`) : combat construit à la main,
 * pertes déjà enregistrées via `recordLoss`, puis `checkCombatEnd` appelé
 * directement — évite de dépendre du RNG de combat pour isoler l'effet.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-group`,
    nativeTerrain: 'grass',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
    ...over,
  };
}

const CATALOG: Record<string, CombatUnitDef> = {
  grunt: unit({ id: 'grunt', stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 } }),
  // Unité défenseure VIVANTE (pas de capacité `undead`) — ses PV tués comptent.
  wolf: unit({ id: 'wolf', stats: { hp: 10, attack: 4, defense: 3, damage: [2, 3], speed: 6 } }),
  // Unité défenseure MORTE-VIVANTE — ses PV tués ne comptent PAS (doc 04).
  zombie: unit({ id: 'zombie', stats: { hp: 8, attack: 2, defense: 1, damage: [1, 2], speed: 3 }, abilities: [{ id: 'undead' }] }),
  // Unité ressuscitée (morte-vivante elle aussi).
  skel: unit({ id: 'skel', stats: { hp: 5, attack: 4, defense: 3, damage: [1, 3], speed: 5 }, abilities: [{ id: 'undead' }] }),
  ...Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [
      `filler-${i + 1}`,
      unit({ id: `filler-${i + 1}`, stats: { hp: 1, attack: 1, defense: 1, damage: [1, 1], speed: 1 } }),
    ]),
  ),
};

const NECRO_BONUS: FactionBonus = {
  type: 'raiseUndeadOnVictory',
  unitId: 'skel',
  percentHpRaised: 100,
  capBase: 20,
  capPerExisting: 2,
};

const FACTION_CATALOG: Record<string, { bonuses: FactionBonus[] }> = {
  necro: { bonuses: [NECRO_BONUS] },
};

function hero(over: Partial<HeroState> = {}): HeroState {
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
    name: '',
    specialtyId: '',
    specialtyEffects: [],
    warMachines: [],
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
    round: 3,
    obstacles: [],
    stacks,
    activeStackId: null,
    playerSide: 'attacker',
    heroId: 'hero-1',
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId: 'hero-1',
    defenderHeroId: null,
    heroCastThisRound: false,
    heroAttackUsed: [],
    finished: false,
    winner: null,
    ...over,
  };
  initLedger(combat);
  return combat;
}

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    ...createEmptyState(),
    started: true,
    config: null, // grantHeroCombatXp/applyFactionVictoryEffects n'en dépendent pas
    unitCatalog: CATALOG,
    ...over,
  };
}

/** Pile attaquante vivante et victorieuse. */
function attackerAlive(unitId: string, count: number): CombatStack {
  return stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId, count, pos: { col: 0, row: 0 } });
}

/** Pile défenseure entièrement anéantie (count 0) — les pertes sont enregistrées séparément. */
function defenderDead(unitId: string): CombatStack {
  return stack({ id: 'defender-0', side: 'defender', slot: 0, unitId, count: 0, pos: { col: 7, row: 0 } });
}

function runCheckCombatEnd(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    checkCombatEnd(draft, events);
  });
  return { state: next, events };
}

describe('applyFactionVictoryEffects — raiseUndeadOnVictory', () => {
  it('lève des squelettes proportionnels aux PV vivants tués, ajoutés en nouvelle pile', () => {
    const h = hero({ factionId: 'necro' });
    const combat = combatState([attackerAlive('grunt', 50), defenderDead('wolf')]);
    recordLoss(combat, 'defender', 'wolf', 5); // PV vivants tués = 10 × 5 = 50
    const state = baseState({ factionCatalog: FACTION_CATALOG, heroes: [h], combat });
    const { state: next, events } = runCheckCombatEnd(state);
    const result = next.heroes.find((x) => x.id === 'hero-1');
    // raised = floor(50 × 100 / 100 / hp_skel(5)) = 10 ; plafond 20+2×0=20 ⇒ inchangé.
    expect(result?.army).toEqual([
      { unitId: 'grunt', count: 50 },
      { unitId: 'skel', count: 10 },
    ]);
    expect(events).toContainEqual({ type: 'UndeadRaised', heroId: 'hero-1', unitId: 'skel', count: 10 });
  });

  it("les morts d'unités undead ne comptent pas dans les PV vivants tués (aucun effet)", () => {
    const h = hero({ factionId: 'necro' });
    const combat = combatState([attackerAlive('grunt', 50), defenderDead('zombie')]);
    recordLoss(combat, 'defender', 'zombie', 20); // undead ⇒ 0 PV vivant compté
    const state = baseState({ factionCatalog: FACTION_CATALOG, heroes: [h], combat });
    const { state: next, events } = runCheckCombatEnd(state);
    const result = next.heroes.find((x) => x.id === 'hero-1');
    expect(result?.army).toEqual([{ unitId: 'grunt', count: 50 }]);
    expect(events.some((e) => e.type === 'UndeadRaised')).toBe(false);
  });

  it('plafonne à capBase + capPerExisting × effectif courant (0 existant ici)', () => {
    const h = hero({ factionId: 'necro' });
    const combat = combatState([attackerAlive('grunt', 10), defenderDead('wolf')]);
    recordLoss(combat, 'defender', 'wolf', 100); // PV vivants tués = 1000 ⇒ raised naïf 200
    const state = baseState({ factionCatalog: FACTION_CATALOG, heroes: [h], combat });
    const { state: next, events } = runCheckCombatEnd(state);
    const result = next.heroes.find((x) => x.id === 'hero-1');
    expect(result?.army.find((s) => s.unitId === 'skel')?.count).toBe(20); // plafond capBase
    expect(events).toContainEqual({ type: 'UndeadRaised', heroId: 'hero-1', unitId: 'skel', count: 20 });
  });

  it('fusionne dans la pile skel déjà engagée dans le combat ; le plafond dépend de son effectif', () => {
    const h = hero({ factionId: 'necro' });
    const combat = combatState([
      attackerAlive('grunt', 10),
      stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'skel', count: 5, pos: { col: 0, row: 1 } }),
      defenderDead('wolf'),
    ]);
    recordLoss(combat, 'defender', 'wolf', 100); // raised naïf 200 ; plafond 20+2×5=30
    const state = baseState({ factionCatalog: FACTION_CATALOG, heroes: [h], combat });
    const { state: next, events } = runCheckCombatEnd(state);
    const result = next.heroes.find((x) => x.id === 'hero-1');
    const skelStacks = result?.army.filter((s) => s.unitId === 'skel') ?? [];
    expect(skelStacks).toHaveLength(1); // fusion, pas de doublon
    expect(skelStacks[0]?.count).toBe(35); // 5 existants + 30 (plafonné)
    expect(events).toContainEqual({ type: 'UndeadRaised', heroId: 'hero-1', unitId: 'skel', count: 30 });
  });

  it('armée déjà à 7 piles distinctes sans skel : pas de nouvelle pile, pas d’événement', () => {
    const fillers = Array.from({ length: 6 }, (_, i) =>
      stack({
        id: `attacker-f${i}`,
        side: 'attacker',
        slot: i + 1,
        unitId: `filler-${i + 1}`,
        count: 1,
        pos: { col: 0, row: i + 1 },
      }),
    );
    const combat = combatState([attackerAlive('grunt', 10), ...fillers, defenderDead('wolf')]);
    recordLoss(combat, 'defender', 'wolf', 5); // raised naïf > 0
    const h = hero({ factionId: 'necro' });
    const state = baseState({ factionCatalog: FACTION_CATALOG, heroes: [h], combat });
    const { state: next, events } = runCheckCombatEnd(state);
    const result = next.heroes.find((x) => x.id === 'hero-1');
    expect(result?.army).toHaveLength(7); // grunt + 6 filler, inchangé
    expect(result?.army.some((s) => s.unitId === 'skel')).toBe(false);
    expect(events.some((e) => e.type === 'UndeadRaised')).toBe(false);
  });

  it("factionId '' : aucun effet même si le catalogue de faction est renseigné", () => {
    const h = hero({ factionId: '' });
    const combat = combatState([attackerAlive('grunt', 50), defenderDead('wolf')]);
    recordLoss(combat, 'defender', 'wolf', 5);
    const state = baseState({ factionCatalog: FACTION_CATALOG, heroes: [h], combat });
    const { state: next, events } = runCheckCombatEnd(state);
    const result = next.heroes.find((x) => x.id === 'hero-1');
    expect(result?.army).toEqual([{ unitId: 'grunt', count: 50 }]);
    expect(events.some((e) => e.type === 'UndeadRaised')).toBe(false);
  });

  it('unité ressuscitée absente du catalogue : no-op défensif, pas de crash', () => {
    const h = hero({ factionId: 'necro' });
    const combat = combatState([attackerAlive('grunt', 50), defenderDead('wolf')]);
    recordLoss(combat, 'defender', 'wolf', 5);
    const catalogWithoutSkel = { ...CATALOG };
    delete catalogWithoutSkel.skel;
    const state = baseState({
      factionCatalog: FACTION_CATALOG,
      heroes: [h],
      combat,
      unitCatalog: catalogWithoutSkel,
    });
    expect(() => runCheckCombatEnd(state)).not.toThrow();
    const { state: next, events } = runCheckCombatEnd(state);
    const result = next.heroes.find((x) => x.id === 'hero-1');
    expect(result?.army).toEqual([{ unitId: 'grunt', count: 50 }]);
    expect(events.some((e) => e.type === 'UndeadRaised')).toBe(false);
  });
});

const HUNTER_BONUS: FactionBonus = {
  type: 'gainFactionResourceOnVictory',
  resource: 'essence',
  amount: 10,
};
const HUNTER_CATALOG: Record<string, { bonuses: FactionBonus[] }> = {
  hunter: { bonuses: [HUNTER_BONUS] },
};

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    resources: emptyResources(),
    factionResources: {},
    explored: [],
    controller: 'human',
    eliminated: false,
    townlessDays: 0,
    huntContract: null,
    team: 0,
    ...over,
  };
}

describe('applyFactionVictoryEffects — gainFactionResourceOnVictory', () => {
  it('crédite le joueur du héros vainqueur de la ressource déclarée', () => {
    const h = hero({ factionId: 'hunter' });
    const combat = combatState([attackerAlive('grunt', 5), defenderDead('wolf')]);
    recordLoss(combat, 'defender', 'wolf', 3);
    const state = baseState({ factionCatalog: HUNTER_CATALOG, heroes: [h], players: [player()], combat });
    const { state: next, events } = runCheckCombatEnd(state);
    expect(next.players.find((p) => p.id === 'p1')?.factionResources['essence']).toBe(10);
    expect(events).toContainEqual({
      type: 'FactionResourceGained',
      playerId: 'p1',
      resource: 'essence',
      amount: 10,
    });
  });

  it('accumule sur un stock existant', () => {
    const h = hero({ factionId: 'hunter' });
    const combat = combatState([attackerAlive('grunt', 5), defenderDead('wolf')]);
    recordLoss(combat, 'defender', 'wolf', 3);
    const state = baseState({
      factionCatalog: HUNTER_CATALOG,
      heroes: [h],
      players: [player({ factionResources: { essence: 5 } })],
      combat,
    });
    const { state: next } = runCheckCombatEnd(state);
    expect(next.players.find((p) => p.id === 'p1')?.factionResources['essence']).toBe(15);
  });

  it("factionId '' : aucun gain de ressource de faction", () => {
    const h = hero({ factionId: '' });
    const combat = combatState([attackerAlive('grunt', 5), defenderDead('wolf')]);
    recordLoss(combat, 'defender', 'wolf', 3);
    const state = baseState({ factionCatalog: HUNTER_CATALOG, heroes: [h], players: [player()], combat });
    const { state: next, events } = runCheckCombatEnd(state);
    expect(next.players.find((p) => p.id === 'p1')?.factionResources).toEqual({});
    expect(events.some((e) => e.type === 'FactionResourceGained')).toBe(false);
  });
});

describe('propriété : après relève, l’armée du héros reste ≤ 7 piles', () => {
  it('quels que soient l’effectif pré-existant et les PV vivants tués', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 500 }),
        fc.boolean(),
        (rawFillerCount, wolfLost, hasSkelStack) => {
          // Contrainte : l'armée engagée dans le combat (avant l'effet) doit
          // rester ≤ 7 piles (grunt + fillers + skel éventuel), comme le
          // garantirait `StartCombat`/`StartGame` en jeu réel.
          const fillerCount = Math.min(rawFillerCount, hasSkelStack ? 5 : 6);
          const fillers = Array.from({ length: fillerCount }, (_, i) =>
            stack({
              id: `attacker-f${i}`,
              side: 'attacker',
              slot: i + 1,
              unitId: `filler-${i + 1}`,
              count: 1,
              pos: { col: 0, row: i + 1 },
            }),
          );
          const skelStack = hasSkelStack
            ? [
                stack({
                  id: 'attacker-skel',
                  side: 'attacker',
                  slot: fillerCount + 1,
                  unitId: 'skel',
                  count: 3,
                  pos: { col: 0, row: fillerCount + 1 },
                }),
              ]
            : [];
          const combat = combatState([attackerAlive('grunt', 10), ...fillers, ...skelStack, defenderDead('wolf')]);
          recordLoss(combat, 'defender', 'wolf', wolfLost);
          const h = hero({ factionId: 'necro' });
          const state = baseState({ factionCatalog: FACTION_CATALOG, heroes: [h], combat });
          const { state: next } = runCheckCombatEnd(state);
          const result = next.heroes.find((x) => x.id === 'hero-1');
          expect(result?.army.length ?? 0).toBeLessThanOrEqual(7);
        },
      ),
      { numRuns: 50 },
    );
  });
});
