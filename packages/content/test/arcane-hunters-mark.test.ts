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
import {
  buildBuildingCatalog,
  buildGrowthGroupCatalog,
  loadContent,
  type ReadJson,
} from '../src/loader';

/**
 * Arcane Hunters — signature « Marque du Chasseur » (plan phase-4.2, doc 05) :
 * test de modularité #3. La Marque n'a demandé AUCUN diff moteur (capacité
 * générique `mark` + bonus `markBonusPerStack` déjà au moteur depuis 2.4, cf.
 * `combat-damage.test.ts`) : la faction est donc du **pur contenu** (comme la
 * première faction data-only). Le paquet est identifié par sa PROPRIÉTÉ
 * signature (majorité d'unités portant `mark`), jamais par son id littéral —
 * garde-fou de modularité (ci.yml).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

/**
 * Unités de BASE du lineup (référencées par les dwellings). Depuis les upgrades
 * (Alpha 4.11), `pack.units` inclut aussi les variantes améliorées : la
 * signature de faction se lit sur le lineup de base.
 */
function baseUnits(pack: Awaited<ReturnType<typeof loadContent>>['content']['packs'][number]) {
  const ids = new Set((pack.manifest.town?.dwellings ?? []).map((d) => d.unitId));
  return pack.units.filter((u) => ids.has(u.id));
}

/** La faction « chasseurs » : celle dont la majorité des unités DE BASE portent `mark`. */
function findMarkFaction(packs: Awaited<ReturnType<typeof loadContent>>['content']['packs']) {
  return packs.find((p) => {
    const base = baseUnits(p);
    const marked = base.filter((u) => u.abilities.some((a) => a.id === 'mark'));
    return base.length >= 6 && marked.length >= base.length - 1;
  });
}

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

describe('Arcane Hunters (plan phase-4.2) — signature Marque & lineup data-only', () => {
  it('charge le lineup complet, majorité d’unités porteuses de `mark`', async () => {
    const { content } = await loadContent(readJsonFromDisk);
    const pack = findMarkFaction(content.packs);
    expect(pack, 'faction signature `mark` absente — content:check devrait échouer').toBeDefined();
    const base = baseUnits(pack!);
    expect(base.length).toBeGreaterThanOrEqual(7);
    // La signature vit dans les données : (presque) toute l'unité de base porte `mark`.
    const marked = base.filter((u) => u.abilities.some((a) => a.id === 'mark'));
    expect(marked.length).toBeGreaterThanOrEqual(base.length - 1);
    // Nom localisé fr/en présent (clé propre au paquet).
    const nameKey = pack!.manifest.name.slice('@loc:'.length);
    expect(pack!.locales.fr[nameKey]).toBeTruthy();
    expect(pack!.locales.en[nameKey]).toBeTruthy();
  });

  it('recrute une unité de chaque tier depuis une ville aux habitations construites', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = findMarkFaction(report.content.packs);
    if (!pack) throw new Error('faction signature `mark` absente');

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
          mercury: 100,
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
    // Le T8 se paie en Essence (ressource de faction) : on en dote le joueur
    // (le gain en jeu vient des combats, doc 05 §3.3 — hors périmètre ici).
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p1' ? { ...p, factionResources: { ...p.factionResources, essence: 10_000 } } : p,
      ),
    };
    // Chaque tier de BASE est recrutable indépendamment (dwelling niveau 1 ;
    // les variantes améliorées exigeraient le niveau 2 — Alpha 4.11). 8 tiers >
    // 7 piles de garnison : on ne les cumule pas, on prouve que chacun passe.
    for (const unit of baseUnits(pack)) {
      const { events } = apply(state, {
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
    }
  });
});

describe('D9 — Tableau des Contrats gaté par la Taverne', () => {
  it('la ville de la maison à Marque inclut la Taverne et son contrat la requiert', async () => {
    const report = await loadContent(readJsonFromDisk);
    // Maison repérée sans coder son id en dur (garde-fou faction).
    const pack = findMarkFaction(report.content.packs)!;
    expect(pack.manifest.town?.buildings).toContain('tavern');
    const catalog = buildBuildingCatalog(report);
    // Bâtiment de contrat de chasse repéré par son EFFET, jamais par un id de faction.
    const contracts = Object.values(catalog).find((b) =>
      b.levels.some((l) => l.effect.type === 'huntContract'),
    )!;
    expect(contracts.levels[0]!.requires.some((r) => r.building === 'tavern')).toBe(true);
    expect(contracts.levels[0]!.requires.some((r) => r.building === 'townHall')).toBe(false);
  });
});

describe('4.20 — croissance partagée apex (double sommet)', () => {
  it('la faction déclare un groupe de croissance partagée de ses 2 unités de plus haut tier', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = findMarkFaction(report.content.packs)!;
    // Un groupe déclaré, de 2 membres — repéré par sa forme, pas par un id de faction.
    const groups = Object.values(pack.manifest.sharedGrowthGroups);
    expect(groups).toHaveLength(1);
    const members = groups[0]!;
    expect(members).toHaveLength(2);
    // Les membres sont les deux tiers les plus hauts du lineup de base (apex).
    const byTier = new Map(baseUnits(pack).map((u) => [u.id, u.tier]));
    const tiers = members.map((id) => byTier.get(id)).sort((a, b) => (a ?? 0) - (b ?? 0));
    const maxTier = Math.max(...baseUnits(pack).map((u) => u.tier));
    expect(tiers).toEqual([maxTier - 1, maxTier]);
  });

  it('buildGrowthGroupCatalog fusionne les groupes (prêt pour StartGame.growthGroups)', async () => {
    const report = await loadContent(readJsonFromDisk);
    const catalog = buildGrowthGroupCatalog(report);
    const pack = findMarkFaction(report.content.packs)!;
    for (const [group, members] of Object.entries(pack.manifest.sharedGrowthGroups)) {
      expect(catalog[group]).toEqual(members);
    }
  });
});
