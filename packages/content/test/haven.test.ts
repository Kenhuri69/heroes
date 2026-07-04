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
 * Racine data/ du monorepo, comme `packages/tools/src/data-dir.ts` — mais ce
 * test lit le contenu réel (pas de fixtures en mémoire) : preuve que le
 * paquet Haven livré en 3.3 charge et recrute via le pipeline data-driven.
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

/** Carte minimale 3×3, tout en herbe — seule une ville y est posée (doc 02 §4). */
function testMap(): AdventureMapDef {
  const terrain = Array.from({ length: 9 }, () => 'grass');
  return {
    id: 'haven-test-map',
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

describe('faction Haven — contenu 100% data-driven (plan phase-3.3)', () => {
  it('charge le paquet haven (7 unités, locales fr/en OK) sans rejet', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = report.content.packs.find((p) => p.manifest.id === 'haven');
    expect(pack).toBeDefined();
    expect(pack?.units).toHaveLength(7);
    expect(pack?.locales.fr['faction.name']).toBe('Havre');
    expect(pack?.locales.en['faction.name']).toBe('Haven');
  });

  it('résout les stats et capacités attendues pour chaque tier', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = report.content.packs.find((p) => p.manifest.id === 'haven');
    const byId = new Map(pack?.units.map((u) => [u.id, u]));

    const archer = byId.get('t2-archer');
    expect(archer?.tier).toBe(2);
    expect(archer?.stats.hp).toBe(10);
    expect(archer?.stats.attack).toBe(4);
    expect(archer?.abilities).toEqual([{ id: 'shooter', params: { ammo: 12 } }]);

    const pretresse = byId.get('t5-pretresse');
    expect(pretresse?.abilities).toEqual([{ id: 'shooter', params: { ammo: 8 } }]);

    const griffon = byId.get('t4-griffon');
    expect(griffon?.stats.hp).toBe(30);
    expect(griffon?.abilities).toEqual([{ id: 'flying' }]);

    const ange = byId.get('t7-ange');
    expect(ange?.tier).toBe(7);
    expect(ange?.stats.hp).toBe(180);
    expect(ange?.stats.attack).toBe(22);
    expect(ange?.abilities).toEqual([{ id: 'flying' }]);
  });

  it('recrute une unité de chacun des 7 tiers depuis une ville aux 7 habitations construites', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = report.content.packs.find((p) => p.manifest.id === 'haven');
    if (!pack) throw new Error('paquet haven absent — content:check devrait échouer');

    // Catalogue d'unités moteur — même mapping que `client/src/app/game.ts:buildUnitCatalog`
    // (le coût de recrutement en données d'unité devient `recruitCost` moteur).
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
    for (let tier = 1; tier <= 7; tier += 1) buildings[`haven-dwelling-t${tier}`] = 1;

    const stock: Record<string, number> = {};
    for (const unit of pack.units) stock[unit.id] = 5;

    const town: TownState = {
      id: 'town-1',
      ownerPlayerId: 'p1',
      pos: { x: 0, y: 0 },
      factionId: 'haven',
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
