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
 * Recrutement d'une faction complète à 7 tiers, chargée depuis le contenu réel
 * (plan phase-3.3, doc 03) : preuve que le pipeline data-driven encaisse une
 * faction entière sans code moteur dédié. Le paquet est identifié par ses
 * PROPRIÉTÉS (faction native de l'herbe, 7 tiers) et non par son id littéral —
 * le garde-fou de modularité (ci.yml) interdit tout nom de faction en dur dans
 * `packages/`, y compris les tests (cf. `content-check.ts`, qui lit
 * `pack.manifest.id` dynamiquement).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

/** La faction cible : native de l'herbe, lineup complet de 7 tiers (doc 03 §3). */
function findSevenTierGrassFaction(packs: Awaited<ReturnType<typeof loadContent>>['content']['packs']) {
  return packs.find((p) => p.manifest.nativeTerrain === 'grass' && p.units.length === 7);
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

describe('faction data-driven à 7 tiers (plan phase-3.3) — chargement & recrutement', () => {
  it('charge la faction (7 unités, locales fr/en présentes) sans rejet', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = findSevenTierGrassFaction(report.content.packs);
    expect(pack).toBeDefined();
    expect(pack?.units).toHaveLength(7);
    // Nom de faction présent dans les deux langues (valeur non assertée en dur
    // pour ne pas réintroduire de littéral de nom de faction).
    expect(pack?.locales.fr['faction.name']).toBeTruthy();
    expect(pack?.locales.en['faction.name']).toBeTruthy();
  });

  it('résout les stats et capacités attendues pour chaque tier (doc 03 §3)', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = findSevenTierGrassFaction(report.content.packs);
    const byTier = new Map(pack?.units.map((u) => [u.tier, u]));

    const t2 = byTier.get(2); // archer
    expect(t2?.stats.hp).toBe(10);
    expect(t2?.stats.attack).toBe(4);
    expect(t2?.abilities).toEqual([{ id: 'shooter', params: { ammo: 12 } }]);

    const t5 = byTier.get(5); // prêtresse
    expect(t5?.abilities).toEqual([{ id: 'shooter', params: { ammo: 8 } }]);

    const t4 = byTier.get(4); // griffon
    expect(t4?.stats.hp).toBe(30);
    expect(t4?.abilities).toEqual([{ id: 'flying' }]);

    const t7 = byTier.get(7); // ange
    expect(t7?.stats.hp).toBe(180);
    expect(t7?.stats.attack).toBe(22);
    expect(t7?.abilities).toEqual([{ id: 'flying' }]);
  });

  it('recrute une unité de chacun des 7 tiers depuis une ville aux habitations construites', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = findSevenTierGrassFaction(report.content.packs);
    if (!pack) throw new Error('faction à 7 tiers absente — content:check devrait échouer');

    // Catalogue d'unités moteur — même mapping que `client/src/app/game.ts:buildUnitCatalog`
    // (le coût en données d'unité devient `recruitCost` moteur).
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

    // Habitations construites : dérivées du manifeste de la faction (tier → buildingId).
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
    };

    const players: PlayerSetup[] = [
      {
        id: 'p1',
        startingResources: {
          ...emptyResources(),
          gold: 100_000,
          wood: 100,
          ore: 100,
          crystal: 100,
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

    for (const unit of pack.units) {
      const { state: next, events } = apply(state, {
        type: 'RecruitUnits',
        townId: 'town-1',
        unitId: unit.id,
        count: 1,
      });
      expect(events).toContainEqual({
        type: 'UnitsRecruited',
        townId: 'town-1',
        unitId: unit.id,
        count: 1,
      });
      state = next;
    }

    const garrison = state.towns[0]?.garrison ?? [];
    expect(garrison).toHaveLength(7);
    for (const unit of pack.units) {
      expect(garrison).toContainEqual({ unitId: unit.id, count: 1 });
    }

    // Coût total débité (or uniquement, pour ne pas dépendre de l'ordre de recrutement).
    const totalGoldCost = pack.units.reduce((sum, u) => sum + (u.cost['gold'] ?? 0), 0);
    expect(state.players[0]?.resources.gold).toBe(100_000 - totalGoldCost);
  });
});
