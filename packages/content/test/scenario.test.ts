import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildScenarioObjectives,
  loadContent,
  loadScenarios,
  type LoadReport,
  type ReadJson,
} from '../src/loader';
import { scenarioSchema } from '../src/schemas';

/**
 * Scénarios solo (plan phase-3.5, lot T) : `scenarioSchema` + `loadScenarios` +
 * `buildScenarioObjectives`. Deux suites :
 * - contenu réel (`data/scenarios/`) : preuve que les 3 scénarios livrés
 *   valident sans rejet et sont exploitables par le moteur ;
 * - fixture en mémoire : preuve que chaque règle croisée rejette proprement
 *   (jamais de crash), sans littéral de nom de faction (garde-fou ci.yml).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('scénarios réels (data/scenarios/)', () => {
  it('valident tous sans rejet', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const scenarioReport = await loadScenarios(readJsonFromDisk, report);
    expect(scenarioReport.rejectedScenarios).toEqual([]);
    expect(scenarioReport.content.scenarios.length).toBeGreaterThanOrEqual(3);
  });

  it('buildScenarioObjectives produit des objectifs pour chaque joueur', async () => {
    const report = await loadContent(readJsonFromDisk);
    const scenarioReport = await loadScenarios(readJsonFromDisk, report);
    for (const scenario of scenarioReport.content.scenarios) {
      const objectives = buildScenarioObjectives(scenario);
      for (const player of scenario.players) {
        expect(objectives[player.id]).toBeDefined();
        expect(objectives[player.id]?.victory.type).toBeTruthy();
        expect(objectives[player.id]?.defeat.type).toBeTruthy();
      }
    }
  });

  it('chaque joueur référence une faction chargée et une armée de départ connue', async () => {
    const report = await loadContent(readJsonFromDisk);
    const knownFactionIds = new Set(report.content.packs.map((p) => p.manifest.id));
    const knownUnitIds = new Set(report.content.packs.flatMap((p) => p.units.map((u) => u.id)));
    const scenarioReport = await loadScenarios(readJsonFromDisk, report);
    for (const scenario of scenarioReport.content.scenarios) {
      for (const player of scenario.players) {
        expect(knownFactionIds.has(player.factionId)).toBe(true);
        for (const stack of player.startingArmy) expect(knownUnitIds.has(stack.unitId)).toBe(true);
      }
    }
  });

  it('au moins un des 3 scénarios livrés couvre chacun des 4 types de condition', async () => {
    const report = await loadContent(readJsonFromDisk);
    const scenarioReport = await loadScenarios(readJsonFromDisk, report);
    const types = new Set(
      scenarioReport.content.scenarios.flatMap((s) =>
        Object.values(s.objectives).flatMap((o) => [o.victory.type, o.defeat.type]),
      ),
    );
    expect(types).toEqual(
      new Set(['eliminateAllEnemies', 'captureTown', 'defeatHero', 'surviveDays']),
    );
  });
});

/** Fixture minimale en mémoire — clonable et corruptible par test (comme loader.test.ts). */
function makeData(): Record<string, unknown> {
  return {
    'core/abilities.json': { abilities: ['flying'] },
    'core/config.json': makeConfig(),
    'core/locales/fr.json': { 'menu.continue': 'Continuer' },
    'core/locales/en.json': { 'menu.continue': 'Continue' },
    'core/buildings.json': {
      buildings: [
        {
          id: 'townHall',
          maxLevel: 1,
          levels: [
            { cost: {}, requires: [], effect: { type: 'income', resource: 'gold', amount: 500 } },
          ],
        },
      ],
    },
    'core/spells.json': { spells: [{ id: 's', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 6, perPower: 2 }] },
    'core/skills.json': {
      skills: [{ id: 'sk', ranks: [{ movementBonusPct: 10 }, { movementBonusPct: 20 }, { movementBonusPct: 30 }] }],
    },
    'core/artifacts.json': { artifacts: [{ id: 'art', bonus: { attack: 1 } }] },
    'maps/mini.map.json': {
      id: 'mini',
      schemaVersion: 1,
      width: 4,
      height: 3,
      legend: { g: 'grass' },
      tiles: ['gggg', 'gggg', 'gggg'],
      roads: ['0000', '0000', '0000'],
      objects: [],
      startPositions: [{ x: 0, y: 0 }, { x: 3, y: 2 }],
    },
    'factions/index.json': { factions: ['proto'] },
    'factions/proto/manifest.json': {
      id: 'proto',
      schemaVersion: 1,
      name: '@loc:faction.name',
      nativeTerrain: 'plains',
      keyResources: ['crystal', 'gems'],
      factionResources: [],
      spellSchool: null,
      tiers: 7,
      sharedGrowthGroups: {},
      units: ['t1-grunt'],
      aiProfile: { aggression: 0.5, focusFire: 0.5, preferredTargets: 'nearest' },
    },
    'factions/proto/units/t1-grunt.json': {
      id: 't1-grunt',
      tier: 1,
      name: '@loc:unit.t1-grunt.name',
      stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 },
      growthPerWeek: 14,
      cost: { gold: 30 },
      abilities: [],
    },
    'factions/proto/locales/fr.json': { 'faction.name': 'Prototype', 'unit.t1-grunt.name': 'Recrue' },
    'factions/proto/locales/en.json': { 'faction.name': 'Prototype', 'unit.t1-grunt.name': 'Recruit' },
    'scenarios/index.json': { scenarios: ['duel'] },
    'scenarios/duel.scenario.json': makeScenario(),
  };
}

function makeConfig(): unknown {
  return {
    adventure: {
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
    },
    newGame: { map: 'mini', startingResources: { gold: 2000 }, startingArmy: [] },
    display: { strengthBands: [{ max: null, key: 'legion' }] },
  };
}

/** Scénario valide minimal — 2 joueurs, référence la faction/carte/unité de `makeData()`. */
function makeScenario(): unknown {
  return {
    id: 'duel',
    schemaVersion: 1,
    name: '@loc:scenario.duel.name',
    map: 'mini',
    players: [
      {
        id: 'player-1',
        controller: 'human',
        factionId: 'proto',
        startPositionIndex: 0,
        startingArmy: [{ unitId: 't1-grunt', count: 5 }],
      },
      {
        id: 'ai-1',
        controller: 'ai',
        factionId: 'proto',
        startPositionIndex: 1,
        startingArmy: [{ unitId: 't1-grunt', count: 3 }],
      },
    ],
    objectives: {
      'player-1': {
        victory: { type: 'eliminateAllEnemies' },
        defeat: { type: 'defeatHero', heroId: 'hero-player-1' },
      },
      'ai-1': {
        victory: { type: 'defeatHero', heroId: 'hero-player-1' },
        defeat: { type: 'eliminateAllEnemies' },
      },
    },
  };
}

function reader(data: Record<string, unknown>): ReadJson {
  return (path) => {
    if (!(path in data)) return Promise.reject(new Error(`fichier introuvable: ${path}`));
    return Promise.resolve(structuredClone(data[path]));
  };
}

async function loadReport(data: Record<string, unknown>): Promise<LoadReport> {
  return loadContent(reader(data));
}

describe('loadScenarios — règles croisées', () => {
  it('charge un scénario valide', async () => {
    const data = makeData();
    const report = await loadReport(data);
    const scenarioReport = await loadScenarios(reader(data), report);
    expect(scenarioReport.rejectedScenarios).toEqual([]);
    expect(scenarioReport.content.scenarios.map((s) => s.id)).toEqual(['duel']);
  });

  it('rejette une carte inconnue', async () => {
    const data = makeData();
    (data['scenarios/duel.scenario.json'] as { map: string }).map = 'fantome';
    const report = await loadReport(data);
    const scenarioReport = await loadScenarios(reader(data), report);
    expect(scenarioReport.content.scenarios).toEqual([]);
    expect(scenarioReport.rejectedScenarios[0]?.id).toBe('duel');
    expect(scenarioReport.rejectedScenarios[0]?.errors.join()).toContain("carte 'fantome' invalide");
  });

  it('rejette une faction inconnue', async () => {
    const data = makeData();
    (data['scenarios/duel.scenario.json'] as { players: { factionId: string }[] }).players[0]!.factionId =
      'fantome';
    const report = await loadReport(data);
    const scenarioReport = await loadScenarios(reader(data), report);
    expect(scenarioReport.rejectedScenarios[0]?.errors.join()).toContain("faction inconnue 'fantome'");
  });

  it('rejette un startPositionIndex hors bornes de la carte', async () => {
    const data = makeData();
    (
      data['scenarios/duel.scenario.json'] as { players: { startPositionIndex: number }[] }
    ).players[0]!.startPositionIndex = 5;
    const report = await loadReport(data);
    const scenarioReport = await loadScenarios(reader(data), report);
    expect(scenarioReport.rejectedScenarios[0]?.errors.join()).toContain('startPositionIndex 5 ≥');
  });

  it('rejette une unité d’armée inconnue', async () => {
    const data = makeData();
    (
      data['scenarios/duel.scenario.json'] as {
        players: { startingArmy: { unitId: string; count: number }[] }[];
      }
    ).players[0]!.startingArmy = [{ unitId: 't9-fantome', count: 1 }];
    const report = await loadReport(data);
    const scenarioReport = await loadScenarios(reader(data), report);
    expect(scenarioReport.rejectedScenarios[0]?.errors.join()).toContain(
      "unité d'armée inconnue 't9-fantome'",
    );
  });

  it("un scénario invalide n'empêche pas les autres de charger", async () => {
    const data = makeData();
    (data['scenarios/index.json'] as { scenarios: string[] }).scenarios = ['duel', 'ghost'];
    const report = await loadReport(data);
    const scenarioReport = await loadScenarios(reader(data), report);
    expect(scenarioReport.content.scenarios.map((s) => s.id)).toEqual(['duel']);
    expect(scenarioReport.rejectedScenarios.map((r) => r.id)).toEqual(['ghost']);
  });
});

describe('scenarioSchema', () => {
  it('rejette un scénario avec un joueur sans objectifs', () => {
    const scenario = makeScenario() as { objectives: Record<string, unknown> };
    delete scenario.objectives['ai-1'];
    const result = scenarioSchema.safeParse(scenario);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join()).toContain(
        'chaque joueur doit avoir des objectifs',
      );
    }
  });
});
