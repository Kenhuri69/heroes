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
  type Command,
  type CombatUnitDef,
  type PlayerSetup,
  type TownState,
} from '../../engine/src/index';
import { buildBuildingCatalog, loadContent, type ReadJson } from '../src/loader';

/**
 * 5ᵉ faction data-driven (Beta, doc 17 — les elfes noirs de HoMM) : native du
 * terrain `rough`, lineup complet de 7 tiers de base + 7 variantes améliorées.
 * Identifiée par ses PROPRIÉTÉS (terrain natif + 7 tiers de base), JAMAIS par son
 * id littéral — le garde-fou de modularité (ci.yml) interdit tout nom de faction
 * dans `packages/`. Preuve que le pipeline data-driven encaisse une faction
 * entière sans code moteur dédié (5ᵉ test de modularité, doc 06).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

type Packs = Awaited<ReturnType<typeof loadContent>>['content']['packs'];

/** Unités de BASE (une par tier) — celles référencées par `manifest.town.dwellings`. */
function baseUnits(pack: Packs[number]) {
  const baseIds = new Set((pack.manifest.town?.dwellings ?? []).map((d) => d.unitId));
  return pack.units.filter((u) => baseIds.has(u.id));
}

/** La faction cible : native du terrain accidenté (souterrain), 7 tiers de base. */
function findRoughFaction(packs: Packs) {
  return packs.find((p) => p.manifest.nativeTerrain === 'rough' && baseUnits(p).length === 7);
}

/** Carte minimale 3×3, tout en herbe — seule une ville y est posée (doc 02 §4). */
function testMap(): AdventureMapDef {
  const terrain = Array.from({ length: 9 }, () => 'grass');
  return {
    id: 'grass-test-map',
    width: 3,
    height: 3,
    terrain,
    road: terrain.map(() => false),
    objects: [],
    triggers: [],
    startPositions: [{ x: 0, y: 0 }],
  };
}

/** Config d'aventure minimale — mêmes valeurs que `data/core/config.json`. */
function testConfig(): AdventureConfig {
  return {
    movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
    visionRadius: 5,
    terrains: { grass: { moveCost: 100 } },
    hero: {
      xpPerHpKilled: 1,
      levelCurve: { base: 1000, exponent: 1.9 },
      maxLevel: 30,
      attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 },
    },
    combat: {
      attackDefenseStep: 0.05,
      heroDefenseStep: 0.025,
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

describe('5ᵉ faction (native de `rough`, elfes noirs) — pipeline data-driven (doc 17)', () => {
  it('charge la faction (14 unités = 7 base + 7 améliorées, locales fr/en) sans rejet', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = findRoughFaction(report.content.packs);
    expect(pack).toBeDefined();
    expect(baseUnits(pack!)).toHaveLength(7);
    expect(pack?.units).toHaveLength(14);
    // Nom de faction propre au paquet, présent dans les deux langues.
    const nameKey = pack?.manifest.name.slice('@loc:'.length) ?? '';
    expect(pack?.locales.fr[nameKey]).toBeTruthy();
    expect(pack?.locales.en[nameKey]).toBeTruthy();
    // Aucune ressource de faction ; signature Magie Irrésistible déclarée (lot 17.3).
    expect(pack?.manifest.factionResources).toEqual([]);
    const sig = pack?.manifest.factionBonuses.find((b) => b.type === 'irresistibleMagic');
    expect(sig).toBeDefined();
    if (sig?.type === 'irresistibleMagic') {
      expect(sig.spellBonusPercent).toBeGreaterThan(0);
      expect(sig.resistancePierce).toBeGreaterThan(0);
      expect(sig.resistancePierce).toBeLessThanOrEqual(1);
    }
    // Trois héros nommés — deux canon (Raelag/Shadya) + un original (Olivier),
    // tous avec gameplay résolu (attributs).
    expect(pack?.heroes).toHaveLength(3);
    for (const h of pack?.heroes ?? []) {
      expect(['canon', 'original']).toContain(h.origin);
      expect(h.attributes).toBeDefined();
    }
    // Le héros original de la faction (id gardé hors du littéral : le garde-fou CI
    // interdit un id de faction dans packages/) — retrouvé par son origine.
    const olivier = pack?.heroes.find((h) => h.origin === 'original');
    expect(olivier).toBeDefined();
    expect(olivier?.specialtyEffect?.conditional?.unitId).toBe('t1-eclaireur');
  });

  it('résout les capacités attendues du lineup (doc 17 §3, catalogue générique)', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = findRoughFaction(report.content.packs);
    const byTier = new Map(baseUnits(pack!).map((u) => [u.tier, u]));
    // T1 tireur empoisonné, T2 sans riposte, T3 immunité au moral, T6 attaque de zone,
    // T7 dragon volant apeurant, résistant à la magie.
    expect(byTier.get(1)?.abilities.map((a) => a.id).sort()).toEqual(['poisonSting', 'shooter']);
    expect(byTier.get(2)?.abilities).toEqual([{ id: 'noRetaliation' }]);
    expect(byTier.get(3)?.abilities.map((a) => a.id)).toContain('moraleImmune');
    expect(byTier.get(6)?.abilities.map((a) => a.id)).toContain('areaAttack');
    const t7 = byTier.get(7)?.abilities.map((a) => a.id) ?? [];
    expect(t7).toEqual(expect.arrayContaining(['flying', 'fear', 'magicResistance']));
  });

  it('recrute une unité de chacun des 7 tiers depuis une ville aux habitations construites', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = findRoughFaction(report.content.packs);
    if (!pack) throw new Error('5ᵉ faction absente — content:check devrait échouer');

    const unitCatalog: Record<string, CombatUnitDef> = {};
    for (const unit of pack.units) {
      unitCatalog[unit.id] = {
        id: unit.id,
        groupId: pack.manifest.id,
        nativeTerrain: pack.manifest.nativeTerrain,
        stats: unit.stats,
        abilities: unit.abilities,
        recruitCost: unit.cost,
        growthPerWeek: unit.growthPerWeek,
      };
    }
    const buildingCatalog = buildBuildingCatalog(report);
    const buildings: Record<string, number> = { townHall: 1, fort: 1, mageGuild: 1 };
    for (const dwelling of pack.manifest.town?.dwellings ?? []) buildings[dwelling.buildingId] = 1;
    const stock: Record<string, number> = {};
    for (const unit of pack.units) stock[unit.id] = 5;

    const town: TownState = {
      id: 'town-1',
      ownerPlayerId: 'p1',
      pos: { x: 0, y: 0 },
      factionId: pack.manifest.id,
      buildings,
      builtToday: false,
      garrison: [],
      stock,
      spellPool: [],
      sharedGrowthChoice: {},
    };
    const players: PlayerSetup[] = [
      {
        id: 'p1',
        startingResources: {
          ...emptyResources(),
          gold: 100_000,
          wood: 100,
          ore: 100,
          sulfur: 100,
          gems: 100,
        },
      },
    ];
    const startCmd: Command = {
      type: 'StartGame',
      seed: 1,
      players,
      map: testMap(),
      config: testConfig(),
      unitCatalog,
      buildingCatalog,
      towns: [town],
    };
    let state = apply(createEmptyState(), startCmd).state;
    const base = baseUnits(pack);
    for (const unit of base) {
      const { state: next, events } = apply(state, {
        type: 'RecruitUnits',
        townId: 'town-1',
        unitId: unit.id,
        count: 1,
      });
      expect(events).toContainEqual({ type: 'UnitsRecruited', townId: 'town-1', unitId: unit.id, count: 1 });
      state = next;
    }
    expect(state.towns[0]?.garrison ?? []).toHaveLength(7);
  });
});
