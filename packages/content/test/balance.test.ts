import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  apply,
  createEmptyState,
  emptyResources,
  type AdventureConfig,
  type AdventureMapDef,
  type ArmyStack,
  type CombatUnitDef,
  type GameState,
} from '../../engine/src/index';
import { loadContent, type ReadJson } from '../src/loader';

/**
 * Sanity check d'équilibrage grossier (plan phase-3.6, doc 01 §5) : deux
 * factions à 7 tiers, armées de **valeur (or) égale**, auto-combat déterministe
 * sur plusieurs seeds et les deux rôles attaquant/défenseur. On ne vérifie PAS
 * un winrate fin (45–55 %, réservé à `faction:sim` en Alpha, doc 06 §5.6) mais
 * l'absence de **déséquilibre béant** : aucune faction ne domine > 85 % des
 * duels à budget égal. Déterministe (RNG seedé) — pas de flakiness.
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');
const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

function testMap(): AdventureMapDef {
  const terrain = Array.from({ length: 9 }, () => 'grass');
  return {
    id: 'balance-test-map',
    width: 3,
    height: 3,
    terrain,
    road: terrain.map(() => false),
    objects: [],
    triggers: [],
    startPositions: [{ x: 0, y: 0 }],
  };
}

function testConfig(): AdventureConfig {
  return {
    movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
    visionRadius: 5,
    terrains: { grass: { moveCost: 100 }, swamp: { moveCost: 150 } },
    hero: {
      xpPerHpKilled: 1,
      levelCurve: { base: 1000, exponent: 1.9 },
      maxLevel: 30,
      attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 },
    },
    combat: {
      attackDefenseStep: 0.05,
      damageBonusMax: 0.6,
      damageReductionMax: 0.7,
      defendDefenseMultiplier: 1.3,
      rangedMeleePenalty: 0.5,
      moraleChancePerPoint: 0.04,
      luckChancePerPoint: 0.04,
      markBonusPerStack: 0.08,
      marksMax: 3,
      obstaclesMin: 2,
      obstaclesMax: 5,
    },
  };
}

function startedGame(seed: number, unitCatalog: Record<string, CombatUnitDef>): GameState {
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed,
    players: [{ id: 'p1', startingResources: emptyResources() }],
    map: testMap(),
    config: testConfig(),
    unitCatalog,
  }).state;
}

/** Vainqueur d'un auto-combat sur une carte neutre (terrain non natif des deux camps). */
function autoResolve(
  unitCatalog: Record<string, CombatUnitDef>,
  attacker: ArmyStack[],
  defender: ArmyStack[],
  terrain: string,
  seed: number,
): 'attacker' | 'defender' | null {
  let state = startedGame(seed, unitCatalog);
  state = apply(state, { type: 'StartCombat', attacker, defender, terrain }).state;
  if (!state.combat) return null;
  const { events } = apply(state, { type: 'AutoCombat' });
  const ended = events.find((e) => e.type === 'CombatEnded');
  return ended && ended.type === 'CombatEnded' ? ended.winner : null;
}

describe('équilibrage grossier (plan phase-3.6) — deux factions à 7 tiers, valeur égale', () => {
  it('aucune faction ne domine > 85 % des duels à budget or égal', async () => {
    const report = await loadContent(readJsonFromDisk);
    const packs = report.content.packs;
    // Deux factions à 7 tiers de terrains natifs distincts (identifiées par
    // propriété, pas par nom — garde-fou de modularité).
    const seven = packs.filter((p) => p.units.length === 7);
    expect(seven.length).toBeGreaterThanOrEqual(2);
    const a = seven[0]!;
    const b = seven[1]!;

    const unitCatalog: Record<string, CombatUnitDef> = {};
    for (const pack of packs) {
      for (const u of pack.units) {
        unitCatalog[u.id] = {
          id: u.id,
          groupId: pack.manifest.id,
          nativeTerrain: pack.manifest.nativeTerrain,
          stats: u.stats,
          abilities: u.abilities,
          recruitCost: u.cost,
          growthPerWeek: u.growthPerWeek,
        };
      }
    }

    // Terrain neutre : ni `a` ni `b` ne l'a en natif (pas de bonus de vitesse
    // asymétrique). Herbe si aucune des deux n'est native de l'herbe, sinon marais.
    const nativeTerrains = new Set([a.manifest.nativeTerrain, b.manifest.nativeTerrain]);
    const terrain = !nativeTerrains.has('grass') ? 'grass' : !nativeTerrains.has('swamp') ? 'swamp' : 'grass';

    const budget = 5000; // or : effectifs = floor(budget / coût unitaire) par tier
    const byTierA = new Map(a.units.map((u) => [u.tier, u]));
    const byTierB = new Map(b.units.map((u) => [u.tier, u]));

    let aWins = 0;
    let total = 0;
    // Quelques tiers représentatifs × plusieurs seeds × les deux rôles.
    for (const tier of [1, 3, 5, 7]) {
      const ua = byTierA.get(tier);
      const ub = byTierB.get(tier);
      if (!ua || !ub) continue;
      const ca = Math.max(1, Math.floor(budget / (ua.cost['gold'] ?? budget)));
      const cb = Math.max(1, Math.floor(budget / (ub.cost['gold'] ?? budget)));
      const armyA: ArmyStack[] = [{ unitId: ua.id, count: ca }];
      const armyB: ArmyStack[] = [{ unitId: ub.id, count: cb }];
      for (const seed of [1, 2, 3, 4, 5]) {
        // Rôle 1 : a attaque.
        const w1 = autoResolve(unitCatalog, armyA, armyB, terrain, seed);
        if (w1) {
          total += 1;
          if (w1 === 'attacker') aWins += 1;
        }
        // Rôle 2 : b attaque (annule l'avantage du premier coup).
        const w2 = autoResolve(unitCatalog, armyB, armyA, terrain, seed + 100);
        if (w2) {
          total += 1;
          if (w2 === 'defender') aWins += 1; // a est défenseur ici
        }
      }
    }

    expect(total).toBeGreaterThan(0);
    const aWinRate = aWins / total;
    // Anti-blowout : ni `a` ni `b` ne gagne plus de 85 % des duels à valeur égale.
    expect(aWinRate).toBeGreaterThan(0.15);
    expect(aWinRate).toBeLessThan(0.85);
  });
});
