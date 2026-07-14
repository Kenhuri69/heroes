import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { xpForLevel } from '../src/adventure/experience';
import type { MapObjectDef } from '../src/adventure/map';
import { moraleOf } from '../src/combat/state-helpers';
import type { CombatState } from '../src/combat/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Lot 2 du comblement (doc 02 §2.2) : lieux de bonus visitables, habitations
 * hors ville, gardiens errants. Mines/trésors/artefacts : `map-objects.test.ts`.
 */

/** Catalogue de test enrichi d'économie (coût de recrutement + croissance hebdo). */
function catalogWithEconomy() {
  const catalog = testCatalog();
  catalog['red-grunt'] = {
    ...catalog['red-grunt']!,
    recruitCost: { gold: 30 },
    growthPerWeek: 6,
  };
  return catalog;
}

function startedWith(
  objects: MapObjectDef[],
  gold = 0,
): GameState {
  const map = testMap();
  map.objects = objects;
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 42,
    players: [{ id: 'p1', startingResources: { ...emptyResources(), gold } }],
    map,
    config: testConfig(),
    unitCatalog: catalogWithEconomy(),
  }).state;
}

function move(state: GameState, path: { x: number; y: number }[]) {
  return apply(state, { type: 'MoveHero', heroId: 'hero-p1', path });
}

describe('lieux de bonus visitables (doc 02 §2.2)', () => {
  const stable: MapObjectDef = {
    id: 'ecurie',
    type: 'visitable',
    pos: { x: 2, y: 0 },
    effect: { kind: 'movement', amount: 400 },
    frequency: 'oncePerHeroPerWeek',
    visits: {},
  };

  it("l'écurie ajoute des PM en passant, une fois par héros et par semaine", () => {
    const s0 = startedWith([stable]);
    const base = s0.heroes[0]!.movementPoints; // 1500 (armée vide)
    const { state, events } = move(s0, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    // 2 pas d'herbe (200) puis +400 d'écurie — le héros ne s'arrête pas.
    expect(state.heroes[0]?.movementPoints).toBe(base - 200 + 400);
    expect(events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'ecurie',
      effect: { kind: 'movement', amount: 400 },
      amount: 400,
    });
    // Re-visite la même semaine : aucun second bonus.
    const back = move(state, [{ x: 1, y: 0 }]).state;
    const again = move(back, [{ x: 2, y: 0 }]);
    expect(again.state.heroes[0]?.movementPoints).toBe(base - 200 + 400 - 200);
    expect(again.events.some((e) => e.type === 'BonusVisited')).toBe(false);
  });

  it("l'arbre du savoir donne l'XP du niveau suivant, une seule fois par héros", () => {
    const tree: MapObjectDef = {
      id: 'arbre',
      type: 'visitable',
      pos: { x: 2, y: 0 },
      effect: { kind: 'levelXp' },
      frequency: 'oncePerHero',
      visits: {},
    };
    const { state, events } = move(startedWith([tree]), [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.level).toBe(2);
    expect(state.heroes[0]?.xp).toBe(xpForLevel(testConfig().hero, 2));
    expect(events.some((e) => e.type === 'HeroLevelUp')).toBe(true);
    const obj = state.map?.objects.find((o) => o.id === 'arbre');
    expect(obj?.type === 'visitable' && obj.visits['hero-p1']).toBe(-1); // à vie
  });

  it("la pierre du savoir accorde un montant FIXE d'XP, une seule fois par héros (M-VISIT)", () => {
    const stone: MapObjectDef = {
      id: 'pierre',
      type: 'visitable',
      pos: { x: 2, y: 0 },
      effect: { kind: 'experience', amount: 1000 },
      frequency: 'oncePerHero',
      visits: {},
    };
    const { state, events } = move(startedWith([stone]), [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.xp).toBe(1000);
    expect(events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'pierre',
      effect: { kind: 'experience', amount: 1000 },
      amount: 1000,
    });
    const obj = state.map?.objects.find((o) => o.id === 'pierre');
    expect(obj?.type === 'visitable' && obj.visits['hero-p1']).toBe(-1); // à vie
  });

  it("l'arène accorde un bonus d'attribut PERMANENT, une seule fois par héros (M-VISIT)", () => {
    const arena: MapObjectDef = {
      id: 'arene',
      type: 'visitable',
      pos: { x: 2, y: 0 },
      effect: { kind: 'permanentStat', attribute: 'attack', amount: 1 },
      frequency: 'oncePerHero',
      visits: {},
    };
    const s0 = startedWith([arena]);
    const baseAttack = s0.heroes[0]!.attributes.attack;
    const { state, events } = move(s0, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.attributes.attack).toBe(baseAttack + 1);
    expect(events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'arene',
      effect: { kind: 'permanentStat', attribute: 'attack', amount: 1 },
      amount: 1,
    });
    const obj = state.map?.objects.find((o) => o.id === 'arene');
    expect(obj?.type === 'visitable' && obj.visits['hero-p1']).toBe(-1); // à vie
    // Re-visite : aucun second gain (bonus permanent unique, comme HoMM).
    const back = move(state, [{ x: 1, y: 0 }]).state;
    const again = move(back, [{ x: 2, y: 0 }]);
    expect(again.state.heroes[0]?.attributes.attack).toBe(baseAttack + 1);
    expect(again.events.some((e) => e.type === 'BonusVisited')).toBe(false);
  });

  it("le sanctuaire de sort enseigne un sort au héros, une seule fois (M-VISIT)", () => {
    const shrine = (id: string, x: number): MapObjectDef => ({
      id,
      type: 'visitable',
      pos: { x, y: 0 },
      effect: { kind: 'learnSpell', spellId: 'test-bolt' },
      frequency: 'oncePerHero',
      visits: {},
    });
    const s0 = startedWith([shrine('sanctuaire-a', 2), shrine('sanctuaire-b', 3)]);
    expect(s0.heroes[0]?.spells).not.toContain('test-bolt');
    const { state, events } = move(s0, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.spells).toContain('test-bolt');
    expect(events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'sanctuaire-a',
      effect: { kind: 'learnSpell', spellId: 'test-bolt' },
      amount: 1,
    });
    const first = state.map?.objects.find((o) => o.id === 'sanctuaire-a');
    expect(first?.type === 'visitable' && first.visits['hero-p1']).toBe(-1); // à vie
    // Un 2ᵉ sanctuaire du MÊME sort : appris idempotent (pas de doublon, amount 0).
    const second = move(state, [{ x: 3, y: 0 }]);
    expect(second.state.heroes[0]?.spells.filter((s) => s === 'test-bolt')).toHaveLength(1);
    expect(second.events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'sanctuaire-b',
      effect: { kind: 'learnSpell', spellId: 'test-bolt' },
      amount: 0,
    });
  });

  it('la cabane de la sorcière enseigne une compétence au héros, une seule fois (M-VISIT)', () => {
    const hut = (id: string, x: number): MapObjectDef => ({
      id,
      type: 'visitable',
      pos: { x, y: 0 },
      effect: { kind: 'grantSkill', skillId: 'test-skill' },
      frequency: 'oncePerHero',
      visits: {},
    });
    const s0 = startedWith([hut('cabane-a', 2), hut('cabane-b', 3)]);
    expect(s0.heroes[0]?.skills['test-skill']).toBeUndefined();
    const { state, events } = move(s0, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.skills['test-skill']).toBe(1);
    expect(events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'cabane-a',
      effect: { kind: 'grantSkill', skillId: 'test-skill' },
      amount: 1,
    });
    const first = state.map?.objects.find((o) => o.id === 'cabane-a');
    expect(first?.type === 'visitable' && first.visits['hero-p1']).toBe(-1); // à vie
    // Une 2ᵉ cabane de la MÊME compétence : idempotent (rang inchangé, amount 0).
    const second = move(state, [{ x: 3, y: 0 }]);
    expect(second.state.heroes[0]?.skills['test-skill']).toBe(1);
    expect(second.events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'cabane-b',
      effect: { kind: 'grantSkill', skillId: 'test-skill' },
      amount: 0,
    });
  });

  it('la fabrique donne une machine de guerre au héros, une seule fois (M-VISIT)', () => {
    const workshop = (id: string, x: number): MapObjectDef => ({
      id,
      type: 'visitable',
      pos: { x, y: 0 },
      effect: { kind: 'grantWarMachine', machineId: 'test-machine' },
      frequency: 'oncePerHero',
      visits: {},
    });
    const s0 = startedWith([workshop('fabrique-a', 2), workshop('fabrique-b', 3)]);
    expect(s0.heroes[0]?.warMachines).not.toContain('test-machine');
    const { state, events } = move(s0, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.warMachines).toContain('test-machine');
    expect(events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'fabrique-a',
      effect: { kind: 'grantWarMachine', machineId: 'test-machine' },
      amount: 1,
    });
    const first = state.map?.objects.find((o) => o.id === 'fabrique-a');
    expect(first?.type === 'visitable' && first.visits['hero-p1']).toBe(-1); // à vie
    // Une 2ᵉ fabrique de la MÊME machine : idempotent (pas de doublon, amount 0).
    const second = move(state, [{ x: 3, y: 0 }]);
    expect(second.state.heroes[0]?.warMachines.filter((m) => m === 'test-machine')).toHaveLength(1);
    expect(second.events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'fabrique-b',
      effect: { kind: 'grantWarMachine', machineId: 'test-machine' },
      amount: 0,
    });
  });

  it('le puits de magie restaure la mana à son max, no-op si déjà pleine (M-VISIT)', () => {
    const well = (id: string, x: number): MapObjectDef => ({
      id,
      type: 'visitable',
      pos: { x, y: 0 },
      effect: { kind: 'restoreMana' },
      frequency: 'oncePerHeroPerWeek',
      visits: {},
    });
    const map = testMap();
    map.objects = [well('puits-a', 2), well('puits-b', 3)];
    const started = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 42,
      players: [
        {
          id: 'p1',
          startingResources: emptyResources(),
          // Savoir 5 ⇒ manaMax = 50 (doc 02 §1.1).
          startingAttributes: { attack: 0, defense: 0, power: 0, knowledge: 5 },
        },
      ],
      map,
      config: testConfig(),
      unitCatalog: catalogWithEconomy(),
    }).state;
    expect(started.heroes[0]?.manaMax).toBe(50);
    // Mana dépensée en cours de tour (la recharge quotidienne n'a pas eu lieu).
    const drained = structuredClone(started);
    drained.heroes[0]!.mana = 10;
    const { state, events } = move(drained, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.mana).toBe(50);
    expect(events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'puits-a',
      effect: { kind: 'restoreMana' },
      amount: 40,
    });
    // 2ᵉ puits, mana déjà pleine : visite consommée sans gain (amount 0).
    const second = move(state, [{ x: 3, y: 0 }]);
    expect(second.state.heroes[0]?.mana).toBe(50);
    expect(second.events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'puits-b',
      effect: { kind: 'restoreMana' },
      amount: 0,
    });
  });

  it("le chariot donne un artefact au héros (1er slot libre), une seule fois (M-VISIT)", () => {
    const wagon: MapObjectDef = {
      id: 'depouille',
      type: 'visitable',
      pos: { x: 2, y: 0 },
      effect: { kind: 'grantArtifact', artifactId: 'test-relic' },
      frequency: 'oncePerHero',
      visits: {},
    };
    const s0 = startedWith([wagon]);
    expect(s0.heroes[0]?.artifacts).not.toContain('test-relic');
    const { state, events } = move(s0, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    // 1er slot équipé libre (héros neuf : tous nuls) ⇒ slot 0.
    expect(state.heroes[0]?.artifacts[0]).toBe('test-relic');
    expect(state.heroes[0]?.backpack).toEqual([]);
    expect(events).toContainEqual({
      type: 'BonusVisited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'depouille',
      effect: { kind: 'grantArtifact', artifactId: 'test-relic' },
      amount: 1,
    });
    const obj = state.map?.objects.find((o) => o.id === 'depouille');
    expect(obj?.type === 'visitable' && obj.visits['hero-p1']).toBe(-1); // à vie
    // Re-visite : aucun second gain (oncePerHero consommé).
    const back = move(state, [{ x: 1, y: 0 }]).state;
    const again = move(back, [{ x: 2, y: 0 }]);
    expect(again.events.some((e) => e.type === 'BonusVisited')).toBe(false);
  });

  it("le chariot déborde vers le SAC si les 10 slots équipés sont pleins (M-VISIT)", () => {
    const wagon: MapObjectDef = {
      id: 'depouille',
      type: 'visitable',
      pos: { x: 2, y: 0 },
      effect: { kind: 'grantArtifact', artifactId: 'test-relic' },
      frequency: 'oncePerHero',
      visits: {},
    };
    const s0 = startedWith([wagon]);
    // Sature les 10 slots équipés : le gain doit tomber dans le sac.
    const full = structuredClone(s0);
    full.heroes[0]!.artifacts = Array.from({ length: 10 }, (_, i) => `worn-${i}`);
    const { state } = move(full, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.artifacts).not.toContain('test-relic'); // slots inchangés
    expect(state.heroes[0]?.backpack).toContain('test-relic'); // débordé au sac
  });

  it('le moulin crédite sa ressource fixe au joueur', () => {
    const mill: MapObjectDef = {
      id: 'moulin',
      type: 'visitable',
      pos: { x: 2, y: 0 },
      effect: { kind: 'resource', resource: 'wood', amount: 3 },
      frequency: 'oncePerHeroPerWeek',
      visits: {},
    };
    const { state } = move(startedWith([mill]), [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.players[0]?.resources.wood).toBe(3);
  });

  it('la fontaine pose une chance temporaire, consommée à la fin du prochain combat', () => {
    const fountain: MapObjectDef = {
      id: 'fontaine',
      type: 'visitable',
      pos: { x: 1, y: 0 },
      effect: { kind: 'luck', amount: 2 },
      frequency: 'oncePerHeroPerWeek',
      visits: {},
    };
    const guardian: MapObjectDef = {
      id: 'guard-1',
      type: 'guardian',
      pos: { x: 3, y: 0 },
      unitId: 'red-grunt',
      count: 1,
    };
    let state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 42,
      players: [
        {
          id: 'p1',
          startingResources: emptyResources(),
          startingArmy: [{ unitId: 'red-archer', count: 30 }],
        },
      ],
      map: { ...testMap(), objects: [fountain, guardian] },
      config: testConfig(),
      unitCatalog: catalogWithEconomy(),
    }).state;
    state = move(state, [{ x: 1, y: 0 }]).state;
    expect(state.heroes[0]?.visitLuck).toBe(2);
    // Interception du gardien puis auto-résolution : la chance est consommée.
    state = move(state, [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]).state;
    expect(state.combat).not.toBeNull();
    state = apply(state, { type: 'AutoCombat' }).state;
    expect(state.combat).toBeNull();
    expect(state.heroes[0]?.visitLuck).toBe(0);
  });

  it('le temple pose un moral temporaire, nourrit le combat, consommé à la fin du prochain combat (M-VISIT)', () => {
    const temple: MapObjectDef = {
      id: 'temple',
      type: 'visitable',
      pos: { x: 1, y: 0 },
      effect: { kind: 'morale', amount: 2 },
      frequency: 'oncePerHeroPerWeek',
      visits: {},
    };
    const guardian: MapObjectDef = {
      id: 'guard-1',
      type: 'guardian',
      pos: { x: 3, y: 0 },
      unitId: 'red-grunt',
      count: 1,
    };
    let state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 42,
      players: [
        {
          id: 'p1',
          startingResources: emptyResources(),
          startingArmy: [{ unitId: 'red-archer', count: 30 }],
        },
      ],
      map: { ...testMap(), objects: [temple, guardian] },
      config: testConfig(),
      unitCatalog: catalogWithEconomy(),
    }).state;
    state = move(state, [{ x: 1, y: 0 }]).state;
    expect(state.heroes[0]?.visitMorale).toBe(2);
    // Interception du gardien ⇒ combat en cours : le moral du camp du joueur
    // intègre le +2 (comparé au même combat sans la visite de temple).
    state = move(state, [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]).state;
    const combat = state.combat as CombatState;
    expect(combat).not.toBeNull();
    const mine = combat.stacks.find((s) => s.side === combat.playerSide)!;
    const withTemple = moraleOf(mine, combat, state);
    const zeroed = structuredClone(state);
    zeroed.heroes[0]!.visitMorale = 0;
    const without = moraleOf(mine, zeroed.combat as CombatState, zeroed);
    expect(withTemple - without).toBe(2);
    // Auto-résolution : le moral de temple est consommé (comme la chance).
    state = apply(state, { type: 'AutoCombat' }).state;
    expect(state.combat).toBeNull();
    expect(state.heroes[0]?.visitMorale).toBe(0);
  });
});

describe('habitation hors ville (doc 02 §2.2)', () => {
  const dwelling: MapObjectDef = {
    id: 'camp',
    type: 'dwelling',
    pos: { x: 2, y: 0 },
    unitId: 'red-grunt',
    stock: 10,
    ownerId: null,
  };

  it('la visite recrute le maximum abordable dans l’armée du héros', () => {
    // 150 or / 30 l'unité ⇒ 5 recrues, stock 10 → 5.
    const { state, events } = move(startedWith([dwelling], 150), [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.army).toEqual([{ unitId: 'red-grunt', count: 5 }]);
    expect(state.players[0]?.resources.gold).toBe(0);
    const obj = state.map?.objects.find((o) => o.id === 'camp');
    expect(obj?.type === 'dwelling' && obj.stock).toBe(5);
    expect(events).toContainEqual({
      type: 'DwellingRecruited',
      heroId: 'hero-p1',
      playerId: 'p1',
      objectId: 'camp',
      unitId: 'red-grunt',
      count: 5,
    });
  });

  it('sans le sou : aucun recrutement, le stock reste', () => {
    const { state, events } = move(startedWith([dwelling], 0), [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(state.heroes[0]?.army).toEqual([]);
    expect(events.some((e) => e.type === 'DwellingRecruited')).toBe(false);
  });

  it('M-DWELLOWN : une habitation NEUTRE ne croît pas (réassort réservé au propriétaire)', () => {
    let state = startedWith([{ ...dwelling, stock: 5, ownerId: null }]);
    for (let i = 0; i < 7; i++) state = apply(state, { type: 'EndTurn', playerId: 'p1' }).state;
    const obj = state.map?.objects.find((o) => o.id === 'camp');
    expect(obj?.type === 'dwelling' && obj.stock).toBe(5); // inchangé, non capturée
  });

  it('M-DWELLOWN : une habitation POSSÉDÉE croît chaque semaine (plafond 2×)', () => {
    let state = startedWith([{ ...dwelling, stock: 5, ownerId: 'p1' }]);
    for (let i = 0; i < 7; i++) state = apply(state, { type: 'EndTurn', playerId: 'p1' }).state;
    const obj = state.map?.objects.find((o) => o.id === 'camp');
    // Semaine 2 : 5 + 6 = 11 (< plafond 12).
    expect(obj?.type === 'dwelling' && obj.stock).toBe(11);
  });

  it('M-DWELLOWN : fouler une habitation la capture (drapeau du joueur)', () => {
    const { state } = move(startedWith([{ ...dwelling, stock: 5 }], 0), [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    const obj = state.map?.objects.find((o) => o.id === 'camp');
    expect(obj?.type === 'dwelling' && obj.ownerId).toBe('p1');
  });
});

describe('gardiens errants (doc 02 §2.2)', () => {
  function guardian(x: number, y: number, roamRadius?: number): MapObjectDef {
    return {
      id: 'wolf',
      type: 'guardian',
      pos: { x, y },
      unitId: 'blue-wolf',
      count: 3,
      ...(roamRadius !== undefined ? { roamRadius } : {}),
    };
  }

  function afterOneDay(objects: MapObjectDef[]): GameState {
    return apply(startedWith(objects), { type: 'EndTurn', playerId: 'p1' }).state;
  }

  it('avance d’un pas vers le héros à portée au changement de jour', () => {
    // Héros en (0,0), gardien errant en (5,0), rayon 5 ⇒ un pas qui réduit la
    // distance Chebyshev (5→4). Premier candidat gagnant dans l'ordre fixe de
    // DIRECTIONS : (-1,+1) ⇒ (4,1) — déterministe.
    const state = afterOneDay([guardian(5, 0, 5)]);
    const obj = state.map?.objects.find((o) => o.id === 'wolf');
    expect(obj?.pos).toEqual({ x: 4, y: 1 });
  });

  it('reste immobile hors de portée, sans rayon, ou déjà au contact', () => {
    for (const [objects, expected] of [
      [[guardian(5, 0, 3)], { x: 5, y: 0 }], // hors de portée (distance 5 > 3)
      [[guardian(5, 0)], { x: 5, y: 0 }], // statique (pas de roamRadius)
      [[guardian(1, 1, 5)], { x: 1, y: 1 }], // au contact (distance 1)
    ] as const) {
      const state = afterOneDay([...objects]);
      expect(state.map?.objects.find((o) => o.id === 'wolf')?.pos).toEqual(expected);
    }
  });

  it('ne marche jamais sur une tuile occupée ou infranchissable', () => {
    // Gardien en (6,2), héros en (0,0) hors… non : rapprochons — héros (0,0),
    // gardien (2,1), rayon 5 : le meilleur pas serait (1,0)/(1,1) ; on bloque
    // (1,1) par un objet et (1,0) reste le choix — jamais (0,0) (héros).
    const blocker: MapObjectDef = {
      id: 'rock',
      type: 'resource',
      pos: { x: 1, y: 1 },
      resource: 'ore',
      amount: 1,
    };
    const state = afterOneDay([guardian(2, 1, 5), blocker]);
    const obj = state.map?.objects.find((o) => o.id === 'wolf');
    expect(obj?.pos).toEqual({ x: 1, y: 0 });
  });
});
