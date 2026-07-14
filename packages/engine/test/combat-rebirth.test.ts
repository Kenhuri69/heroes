import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events';
import { handleStackDeath } from '../src/combat/death';
import { recordLoss, stackLostSoFar } from '../src/combat/state-helpers';
import { resurrectStack } from '../src/combat/spell-effect';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';

/**
 * CAP-LIFE.2 — capacité générique `rebirth` (renaissance) : une pile qui meurt
 * renaît UNE fois à `pct`% de son effectif d'origine, puis meurt définitivement.
 * Ids OPAQUES (aucun id de faction) — la capacité est portée par les données.
 */

function unit(id: string, abilities: CombatUnitDef['abilities'] = []): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [1, 2], speed: 5 },
    abilities,
  };
}

function stack(id: string, unitId: string, count: number): CombatStack {
  return {
    id, side: 'attacker', slot: 0, unitId, count, pos: { col: 0, row: 0 },
    firstHp: 10, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
    marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
  };
}

function combatWith(catalog: Record<string, CombatUnitDef>, stacks: CombatStack[]): CombatState {
  return {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
    heroAttackUsed: [], winner: null,
    // Le catalogue n'est pas sur CombatState ; les helpers reçoivent `def` en argument.
  } as CombatState;
}

describe('CAP-LIFE.2 — rebirth', () => {
  it('une pile rebirth(50) tuée renaît à 50 % de son effectif d’origine et reste sur le plateau', () => {
    const def = unit('phoenix', [{ id: 'rebirth', params: { pct: 50 } }]);
    const s = stack('a0', 'phoenix', 10);
    const combat = combatWith({ phoenix: def }, [s]);
    // Simule la mort : 10 créatures perdues, effectif à 0.
    recordLoss(combat, s, 10);
    s.count = 0;
    s.firstHp = 0;
    const events: GameEvent[] = [];
    handleStackDeath(combat, s, def, events);
    // Renée à floor(0,5 × 10) = 5, PV de tête pleins, toujours présente.
    expect(s.count).toBe(5);
    expect(s.firstHp).toBe(def.stats.hp);
    expect(combat.stacks).toContain(s);
    expect(events).toContainEqual({ type: 'StackReborn', stackId: 'a0', count: 5 });
    expect(combat.rebornStackIds).toContain('a0');
  });

  it('la 2ᵉ mort est définitive (retrait du plateau, StackDied)', () => {
    const def = unit('phoenix', [{ id: 'rebirth', params: { pct: 50 } }]);
    const s = stack('a0', 'phoenix', 10);
    const combat = combatWith({ phoenix: def }, [s]);
    recordLoss(combat, s, 10);
    s.count = 0;
    handleStackDeath(combat, s, def, []); // 1ʳᵉ mort ⇒ renaît
    // 2ᵉ mort : la renaissance est consommée.
    recordLoss(combat, s, s.count);
    s.count = 0;
    const events: GameEvent[] = [];
    handleStackDeath(combat, s, def, events);
    expect(combat.stacks).not.toContain(s);
    expect(events).toContainEqual({ type: 'StackDied', stackId: 'a0' });
  });

  it('une pile sans rebirth meurt normalement (non-régression)', () => {
    const def = unit('grunt');
    const s = stack('a0', 'grunt', 4);
    const combat = combatWith({ grunt: def }, [s]);
    recordLoss(combat, s, 4);
    s.count = 0;
    const events: GameEvent[] = [];
    handleStackDeath(combat, s, def, events);
    expect(combat.stacks).not.toContain(s);
    expect(events).toEqual([{ type: 'StackDied', stackId: 'a0' }]);
    expect(combat.rebornStackIds).toBeUndefined();
  });

  it('renaissance plancher à 1 créature même sous 50 % d’un petit effectif', () => {
    const def = unit('phoenix', [{ id: 'rebirth', params: { pct: 50 } }]);
    const s = stack('a0', 'phoenix', 1);
    const combat = combatWith({ phoenix: def }, [s]);
    recordLoss(combat, s, 1);
    s.count = 0;
    handleStackDeath(combat, s, def, []);
    // floor(0,5 × 1) = 0 ⇒ plancher 1.
    expect(s.count).toBe(1);
  });
});

describe('Revue 2026-07 — B4 : plafonds intra-pile et ledger décrémenté à la relève', () => {
  it('la renaissance lit les pertes de SA pile, pas celles d’une autre pile du même unitId', () => {
    const def = unit('phoenix', [{ id: 'rebirth', params: { pct: 50 } }]);
    const a = stack('a0', 'phoenix', 4);
    const b = stack('a1', 'phoenix', 10);
    const combat = combatWith({ phoenix: def }, [a, b]);
    recordLoss(combat, b, 10); // l'AUTRE pile a perdu 10
    recordLoss(combat, a, 4); // celle-ci n'en a perdu que 4
    a.count = 0;
    a.firstHp = 0;
    const events: GameEvent[] = [];
    handleStackDeath(combat, a, def, events);
    // 50 % de SES 4 pertes = 2 — jamais floor(0.5 × 14) = 7 (agrégat par unitId).
    expect(combat.stacks.find((s) => s.id === 'a0')?.count).toBe(2);
  });

  it('résurrection : jamais au-delà de l’effectif initial après un cycle mort → relève → mort', () => {
    const def = unit('grunt');
    const s = stack('a0', 'grunt', 10);
    const combat = combatWith({ grunt: def }, [s]);
    const draft = { unitCatalog: { grunt: def } } as never;
    // Round 1 : 5 meurent, puis un gros soin relève tout.
    s.count = 5;
    recordLoss(combat, s, 5);
    expect(resurrectStack(draft, combat, s, 500).revived).toBe(5);
    expect(s.count).toBe(10);
    // Round 2 : 5 meurent à nouveau — le plafond doit rester 10 (pas 15 : sans le
    // décrément du ledger, les 5 relevées puis retuées comptaient deux fois).
    s.count = 5;
    recordLoss(combat, s, 5);
    resurrectStack(draft, combat, s, 500);
    expect(s.count).toBe(10);
    expect(stackLostSoFar(combat, s)).toBe(0);
  });
});
