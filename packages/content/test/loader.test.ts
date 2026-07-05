import { describe, expect, it } from 'vitest';
import {
  buildArtifactCatalog,
  buildBuildingCatalog,
  buildSkillCatalog,
  buildSpellCatalog,
  checkCoreNameKeys,
  checkPackNameKeys,
  loadContent,
  loadFactionPack,
  loadMap,
  PackError,
  resolveStartingTowns,
  type ReadJson,
} from '../src/loader';
import {
  abilityCatalogSchema,
  artifactSchema,
  buildingCatalogSchema,
  buildingSchema,
  skillSchema,
  spellSchema,
  type GameConfig,
} from '../src/schemas';

/** Fixture : arborescence data/ en mémoire, clonable et corruptible par test. */
function makeData(): Record<string, unknown> {
  return {
    'core/abilities.json': { abilities: ['flying', 'shooter', 'mark'] },
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
    'core/spells.json': { spells: [makeSpell()] },
    'core/skills.json': { skills: [makeSkill()] },
    'core/artifacts.json': { artifacts: [makeArtifact()] },
    'maps/mini.map.json': makeMap(),
    'factions/index.json': { factions: ['proto'] },
    'factions/proto/manifest.json': {
      id: 'proto',
      schemaVersion: 1,
      name: '@loc:faction.name',
      nativeTerrain: 'grass',
      keyResources: ['crystal', 'gems'],
      factionResources: [{ id: 'essence', icon: 'icons/essence.png', cap: 999 }],
      spellSchool: null,
      tiers: 7,
      sharedGrowthGroups: { duo: ['t1-grunt', 't2-archer'] },
      units: ['t1-grunt', 't2-archer'],
      aiProfile: { aggression: 0.5, focusFire: 0.5, preferredTargets: 'nearest' },
    },
    'factions/proto/units/t1-grunt.json': {
      id: 't1-grunt',
      tier: 1,
      name: '@loc:unit.t1-grunt.name',
      stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 },
      growthPerWeek: 14,
      cost: { gold: 30, essence: 1 },
      abilities: [],
    },
    'factions/proto/units/t2-archer.json': {
      id: 't2-archer',
      tier: 2,
      name: '@loc:unit.t2-archer.name',
      stats: { hp: 8, attack: 5, defense: 2, damage: [2, 4], speed: 5 },
      growthPerWeek: 9,
      cost: { gold: 80 },
      abilities: [{ id: 'shooter', params: { ammo: 12 } }],
    },
    'factions/proto/locales/fr.json': {
      'faction.name': 'Prototype',
      'unit.t1-grunt.name': 'Recrue',
      'unit.t2-archer.name': 'Archère',
    },
    'factions/proto/locales/en.json': {
      'faction.name': 'Prototype',
      'unit.t1-grunt.name': 'Recruit',
      'unit.t2-archer.name': 'Archer',
    },
  };
}

function makeConfig(): GameConfig {
  return {
    adventure: {
      movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
      visionRadius: 5,
      terrains: { grass: { moveCost: 100 }, water: { moveCost: null } },
      market: { sellRate: 25, buyRate: 50 },
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

function makeMap(): Record<string, unknown> {
  return {
    id: 'mini',
    schemaVersion: 1,
    width: 4,
    height: 3,
    legend: { g: 'grass', w: 'water' },
    tiles: ['gggg', 'ggwg', 'gggg'],
    roads: ['0000', '1100', '0000'],
    objects: [
      { id: 'gold-1', type: 'resource', x: 3, y: 0, resource: 'gold', amount: 100 },
      { id: 'guard-1', type: 'guardian', x: 3, y: 2, unitId: 't1-grunt', count: 5 },
    ],
    startPositions: [{ x: 0, y: 0 }],
  };
}

/** Sort valide minimal, réutilisé pour les cas schéma (doc 02 §1.4). */
function makeSpell(): unknown {
  return {
    id: 'boule-de-feu',
    school: 'fire',
    circle: 1,
    manaCost: 5,
    kind: 'damage',
    base: 6,
    perPower: 2,
  };
}

/** Compétence valide minimale, réutilisée pour les cas schéma (doc 02 §1.3). */
function makeSkill(): unknown {
  return {
    id: 'logistics',
    ranks: [{ movementBonusPct: 10 }, { movementBonusPct: 20 }, { movementBonusPct: 30 }],
  };
}

/** Artefact valide minimal, réutilisé pour les cas schéma (doc 02 §1.1). */
function makeArtifact(): unknown {
  return { id: 'lame-aiguisee', bonus: { attack: 2 } };
}

function reader(data: Record<string, unknown>): ReadJson {
  return (path) => {
    if (!(path in data)) return Promise.reject(new Error(`fichier introuvable: ${path}`));
    return Promise.resolve(structuredClone(data[path]));
  };
}

describe('loadContent', () => {
  it('charge et valide un paquet complet', async () => {
    const report = await loadContent(reader(makeData()));
    expect(report.rejected).toEqual([]);
    const pack = report.content.packs[0];
    expect(pack?.manifest.id).toBe('proto');
    expect(pack?.units.map((u) => u.id)).toEqual(['t1-grunt', 't2-archer']);
    expect(pack?.locales.fr['unit.t2-archer.name']).toBe('Archère');
  });

  it('R5 CO2 — rejette une collision d’id d’unité entre deux paquets', async () => {
    const data = makeData();
    // Second paquet valide qui réutilise l’id d’unité 't1-grunt' du premier.
    data['factions/index.json'] = { factions: ['proto', 'proto2'] };
    data['factions/proto2/manifest.json'] = {
      id: 'proto2',
      schemaVersion: 1,
      name: '@loc:faction.name',
      nativeTerrain: 'grass',
      keyResources: ['crystal', 'gems'],
      factionResources: [],
      spellSchool: null,
      tiers: 7,
      sharedGrowthGroups: {},
      units: ['t1-grunt'],
      aiProfile: { aggression: 0.5, focusFire: 0.5, preferredTargets: 'nearest' },
    };
    data['factions/proto2/units/t1-grunt.json'] = {
      id: 't1-grunt',
      tier: 1,
      name: '@loc:unit.t1-grunt.name',
      stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 },
      growthPerWeek: 14,
      cost: { gold: 30 },
      abilities: [],
    };
    data['factions/proto2/locales/fr.json'] = { 'faction.name': 'P2', 'unit.t1-grunt.name': 'Recrue2' };
    data['factions/proto2/locales/en.json'] = { 'faction.name': 'P2', 'unit.t1-grunt.name': 'Recruit2' };
    await expect(loadContent(reader(data))).rejects.toThrow(/globalement uniques/);
  });

  it('R4 CO5 — checkCoreNameKeys détecte les noms fr/en manquants', async () => {
    const report = await loadContent(reader(makeData()));
    const errors = checkCoreNameKeys(report).join();
    expect(errors).toMatch(/spell\.boule-de-feu/);
    expect(errors).toMatch(/skill\.logistics/);
    expect(errors).toMatch(/artifact\.lame-aiguisee/);
  });

  it('R4 CO5 — checkCoreNameKeys vide quand fr ET en portent la clé', async () => {
    const data = makeData();
    for (const lang of ['fr', 'en'] as const) {
      const loc = data[`core/locales/${lang}.json`] as Record<string, string>;
      loc['spell.boule-de-feu'] = 'x';
      loc['skill.logistics'] = 'x';
      loc['artifact.lame-aiguisee'] = 'x';
      loc['building.townHall'] = 'x'; // bâtiment commun (CO6)
    }
    const report = await loadContent(reader(data));
    expect(checkCoreNameKeys(report)).toEqual([]);
  });

  it('R4b CO6/CO7 — checkPackNameKeys détecte les noms de paquet manquants', async () => {
    const data = makeData();
    withTown(data); // ajoute le bâtiment de faction 'proto-dwelling-t1'
    const report = await loadContent(reader(data));
    const errors = checkPackNameKeys(report).join();
    expect(errors).toMatch(/building\.proto-dwelling-t1/); // dwelling (CO6)
    expect(errors).toMatch(/factionResource\.essence/); // ressource de faction (CO7)
  });

  it('R4b CO6/CO7 — checkPackNameKeys vide quand le paquet porte les clés fr+en', async () => {
    const data = makeData();
    withTown(data);
    for (const lang of ['fr', 'en'] as const) {
      const loc = data[`factions/proto/locales/${lang}.json`] as Record<string, string>;
      loc['building.proto-dwelling-t1'] = 'x';
      loc['factionResource.essence'] = 'x';
    }
    const report = await loadContent(reader(data));
    expect(checkPackNameKeys(report)).toEqual([]);
  });

  it('R5 CO3 — rejette un terrain natif absent de la config', async () => {
    const data = makeData();
    (data['factions/proto/manifest.json'] as { nativeTerrain: string }).nativeTerrain = 'lande-brumeuse';
    await expect(loadContent(reader(data))).rejects.toThrow(
      /nativeTerrain 'lande-brumeuse' inconnu de config\.terrains/,
    );
  });

  it('rejette une stat invalide avec le fichier et le champ en cause', async () => {
    const data = makeData();
    (data['factions/proto/units/t1-grunt.json'] as { stats: { hp: unknown } }).stats.hp = -5;
    const report = await loadContent(reader(data));
    expect(report.content.packs).toEqual([]);
    expect(report.rejected[0]?.id).toBe('proto');
    expect(report.rejected[0]?.errors.join()).toContain('units/t1-grunt.json: stats.hp');
  });

  it('rejette une capacité absente du catalogue', async () => {
    const data = makeData();
    (data['factions/proto/units/t2-archer.json'] as { abilities: unknown[] }).abilities = [
      { id: 'demonform' },
    ];
    const report = await loadContent(reader(data));
    expect(report.rejected[0]?.errors.join()).toContain("capacité inconnue au catalogue 'demonform'");
  });

  it('rejette une clé de locale manquante (dans la langue fautive uniquement)', async () => {
    const data = makeData();
    delete (data['factions/proto/locales/en.json'] as Record<string, string>)[
      'unit.t1-grunt.name'
    ];
    const report = await loadContent(reader(data));
    const errors = report.rejected[0]?.errors ?? [];
    expect(errors).toContain("locales/en.json: clé manquante 'unit.t1-grunt.name'");
    expect(errors.join()).not.toContain('locales/fr.json');
  });

  it('rejette coût en ressource inconnue, tier hors manifeste et groupe orphelin', async () => {
    const data = makeData();
    (data['factions/proto/units/t1-grunt.json'] as { cost: object }).cost = { gold: 30, vapeur: 2 };
    (data['factions/proto/units/t2-archer.json'] as { tier: number }).tier = 8;
    (data['factions/proto/manifest.json'] as { sharedGrowthGroups: object }).sharedGrowthGroups = {
      apex: ['t7-titan', 't1-grunt'],
    };
    const report = await loadContent(reader(data));
    const all = (report.rejected[0]?.errors ?? []).join('\n');
    expect(all).toContain("ressource de coût inconnue 'vapeur'");
    expect(all).toContain('tier 8 > tiers du manifeste (7)');
    expect(all).toContain("sharedGrowthGroups.apex référence l'unité inconnue 't7-titan'");
  });

  it('un fichier manquant rejette le paquet sans crasher le chargement', async () => {
    const data = makeData();
    delete data['factions/proto/units/t2-archer.json'];
    const report = await loadContent(reader(data));
    expect(report.rejected[0]?.errors.join()).toContain('fichier introuvable');
  });

  it('un paquet invalide n’empêche pas les autres de charger', async () => {
    const data = makeData();
    (data['factions/index.json'] as { factions: string[] }).factions = ['ghost', 'proto'];
    const report = await loadContent(reader(data));
    expect(report.rejected.map((r) => r.id)).toEqual(['ghost']);
    expect(report.content.packs.map((p) => p.manifest.id)).toEqual(['proto']);
  });

  it('refuse les points d’extension non câblés (abilityModules/hooks non vides)', async () => {
    const data = makeData();
    (data['factions/proto/manifest.json'] as { abilityModules?: string[] }).abilityModules = [
      'abilities/demonform',
    ];
    const report = await loadContent(reader(data));
    expect(report.rejected[0]?.errors.join()).toContain('abilityModules');
  });

  it('charge et valide la config (config.json corrompue = erreur précise)', async () => {
    const report = await loadContent(reader(makeData()));
    expect(report.content.config.adventure.terrains['grass']?.moveCost).toBe(100);

    const data = makeData();
    (data['core/config.json'] as { adventure: { visionRadius: unknown } }).adventure.visionRadius =
      -1;
    await expect(loadContent(reader(data))).rejects.toThrow(/config\.json.*visionRadius/s);
  });
});

describe('loadMap', () => {
  it('résout légende, routes et objets vers la forme moteur', async () => {
    const map = await loadMap(reader(makeData()), 'mini', makeConfig());
    expect(map.width).toBe(4);
    expect(map.terrain[1 * 4 + 2]).toBe('water');
    expect(map.road[1 * 4 + 0]).toBe(true);
    expect(map.road[0]).toBe(false);
    expect(map.objects[0]).toEqual({
      id: 'gold-1',
      type: 'resource',
      pos: { x: 3, y: 0 },
      resource: 'gold',
      amount: 100,
    });
    expect(map.objects[1]).toEqual({
      id: 'guard-1',
      type: 'guardian',
      pos: { x: 3, y: 2 },
      unitId: 't1-grunt',
      count: 5,
    });
    expect(map.startPositions).toEqual([{ x: 0, y: 0 }]);
  });

  it('vérifie les unités des gardiens quand les paquets sont fournis', async () => {
    const known = new Set(['t1-grunt']);
    await expect(loadMap(reader(makeData()), 'mini', makeConfig(), known)).resolves.toBeTruthy();
    const err = await loadMap(reader(makeData()), 'mini', makeConfig(), new Set()).catch(
      (e: unknown) => e,
    );
    expect((err as PackError).errors.join()).toContain(
      "gardien 'guard-1' — unité inconnue des paquets 't1-grunt'",
    );
  });

  it("R5 CO9 — rapporte (sans throw) une armée de départ référençant une unité inconnue", async () => {
    const data = makeData();
    (data['core/config.json'] as GameConfig).newGame.startingArmy = [
      { unitId: 't9-dragon', count: 1 },
    ];
    // Boot résilient : pas d'exception, l'erreur est rapportée et le contenu
    // valide reste chargé (le menu fonctionne, « Nouvelle partie » échouera au moteur).
    const report = await loadContent(reader(data));
    expect(report.configErrors.join()).toMatch(/startingArmy.*t9-dragon/s);
    expect(report.content.packs.map((p) => p.manifest.id)).toEqual(['proto']);
  });

  it('rejette avec un rapport précis : dimensions, char inconnu, terrain hors config', async () => {
    const data = makeData();
    const map = data['maps/mini.map.json'] as {
      tiles: string[];
      legend: Record<string, string>;
    };
    map.tiles = ['gggg', 'ggxg', 'ggg'];
    map.legend['z'] = 'lava';
    const err = await loadMap(reader(data), 'mini', makeConfig()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PackError);
    const all = (err as PackError).errors.join('\n');
    expect(all).toContain("tiles[1][2] — char inconnu 'x'");
    expect(all).toContain('tiles[2] — 3 char(s) pour width=4');
    expect(all).toContain("terrain inconnu de la config 'lava'");
  });

  it('rejette objet ou départ infranchissable / hors carte', async () => {
    const data = makeData();
    const map = data['maps/mini.map.json'] as {
      objects: { x: number; y: number }[];
      startPositions: { x: number; y: number }[];
    };
    map.objects[0] = { ...map.objects[0], x: 2, y: 1 } as (typeof map.objects)[0]; // eau
    map.startPositions.push({ x: 9, y: 0 }); // hors carte
    const err = await loadMap(reader(data), 'mini', makeConfig()).catch((e: unknown) => e);
    const all = (err as PackError).errors.join('\n');
    expect(all).toContain("objet 'gold-1' sur tuile infranchissable (2,1)");
    expect(all).toContain('startPositions[1] hors carte');
  });
});

/** Bâtiment valide minimal, réutilisé pour les cas schéma (doc 02 §4.1). */
function makeBuilding(): unknown {
  return {
    id: 'townhall',
    maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'income', resource: 'gold', amount: 500 } }],
  };
}

/** Ajoute une ville (manifest.town + buildings.json) au paquet `proto` de `makeData()`. */
function withTown(data: Record<string, unknown>, dwellingRequires: unknown[] = [], unitId = 't1-grunt'): void {
  (data['factions/proto/manifest.json'] as { town?: unknown }).town = {
    buildings: ['proto-dwelling-t1'],
    dwellings: [{ tier: 1, unitId, buildingId: 'proto-dwelling-t1' }],
  };
  data['factions/proto/buildings.json'] = {
    buildings: [
      {
        id: 'proto-dwelling-t1',
        maxLevel: 1,
        levels: [
          {
            cost: { gold: 300 },
            requires: dwellingRequires,
            effect: { type: 'dwelling', tier: 1, unitId },
          },
        ],
      },
    ],
  };
}

describe('buildingSchema', () => {
  it('charge un bâtiment valide', () => {
    expect(buildingSchema.safeParse(makeBuilding()).success).toBe(true);
  });

  it('rejette levels.length ≠ maxLevel', () => {
    const building = makeBuilding() as { maxLevel: number };
    building.maxLevel = 2;
    const result = buildingSchema.safeParse(building);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join()).toContain(
        'levels.length doit être égal à maxLevel',
      );
    }
  });

  it('rejette un revenu en ressource inconnue', () => {
    const building = makeBuilding() as { levels: { effect: { resource: string } }[] };
    building.levels[0]!.effect.resource = 'mana';
    expect(buildingSchema.safeParse(building).success).toBe(false);
  });
});

describe('ville de faction (manifest.town / buildings.json)', () => {
  it('charge un paquet avec une ville valide', async () => {
    const data = makeData();
    withTown(data);
    const report = await loadContent(reader(data));
    expect(report.rejected).toEqual([]);
    const pack = report.content.packs[0];
    expect(pack?.buildings.map((b) => b.id)).toEqual(['proto-dwelling-t1']);
  });

  it('rejette un prérequis vers un bâtiment inconnu', async () => {
    const data = makeData();
    withTown(data, [{ building: 'donjon-fantome', level: 1 }]);
    const report = await loadContent(reader(data));
    expect(report.rejected[0]?.errors.join()).toContain(
      "prérequis vers bâtiment inconnu 'donjon-fantome'",
    );
  });

  it('rejette un dwelling vers une unité inconnue', async () => {
    const data = makeData();
    withTown(data, [], 't9-fantome');
    const report = await loadContent(reader(data));
    expect(report.rejected[0]?.errors.join()).toContain(
      "dwelling vers unité inconnue 't9-fantome'",
    );
  });

  it('buildBuildingCatalog agrège core + faction sans collision', async () => {
    const data = makeData();
    withTown(data);
    const report = await loadContent(reader(data));
    const catalog = buildBuildingCatalog(report);
    expect(Object.keys(catalog).sort()).toEqual(['proto-dwelling-t1', 'townHall']);
    expect(catalog['townHall']?.maxLevel).toBe(1);
    expect(catalog['proto-dwelling-t1']?.levels[0]?.effect).toEqual({
      type: 'dwelling',
      tier: 1,
      unitId: 't1-grunt',
    });
  });

  it('résout la ville de départ (owner, prebuilt appliqués)', async () => {
    const data = makeData();
    withTown(data);
    const report = await loadContent(reader(data));
    const config: GameConfig = {
      ...makeConfig(),
      newGame: {
        ...makeConfig().newGame,
        startingTown: {
          id: 'town-1',
          factionId: 'proto',
          x: 0,
          y: 0,
          prebuilt: [
            { building: 'townHall', level: 1 },
            { building: 'proto-dwelling-t1', level: 1 },
          ],
        },
      },
    };
    const towns = resolveStartingTowns(config, report);
    expect(towns).toEqual([
      {
        id: 'town-1',
        ownerPlayerId: 'player-1',
        pos: { x: 0, y: 0 },
        factionId: 'proto',
        buildings: { townHall: 1, 'proto-dwelling-t1': 1 },
        builtToday: false,
        garrison: [],
        stock: {},
      },
    ]);
  });

  it('rejette une ville de départ vers une faction inconnue', async () => {
    const data = makeData();
    const report = await loadContent(reader(data));
    const config: GameConfig = {
      ...makeConfig(),
      newGame: {
        ...makeConfig().newGame,
        startingTown: {
          id: 'town-1',
          factionId: 'fantome',
          x: 0,
          y: 0,
          prebuilt: [{ building: 'townHall', level: 1 }],
        },
      },
    };
    expect(() => resolveStartingTowns(config, report)).toThrow(/faction inconnue 'fantome'/);
  });

  it('R5 CO1 — loadFactionPack sans bâtiments communs échoue sur un prérequis core, réussit avec', async () => {
    const data = makeData();
    withTown(data, [{ building: 'townHall', level: 1 }]); // la ville requiert un bâtiment commun
    const catalog = abilityCatalogSchema.parse(data['core/abilities.json']);
    const read = reader(data);
    // Sans les bâtiments communs (le bug historique de `faction:validate`) :
    // le prérequis vers 'townHall' est irrésoluble.
    await expect(loadFactionPack(read, 'proto', catalog, [])).rejects.toThrow(/townHall/);
    // Avec les bâtiments communs : la ville résout.
    const coreBuildings = buildingCatalogSchema.parse(data['core/buildings.json']).buildings;
    const pack = await loadFactionPack(read, 'proto', catalog, coreBuildings);
    expect(pack.buildings.map((b) => b.id)).toEqual(['proto-dwelling-t1']);
  });
});

describe('spellSchema', () => {
  it('charge un sort valide', () => {
    expect(spellSchema.safeParse(makeSpell()).success).toBe(true);
  });

  it('rejette un buff sans modificateur', () => {
    const spell = { ...(makeSpell() as Record<string, unknown>), kind: 'buff', base: 0 };
    const result = spellSchema.safeParse(spell);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join()).toContain(
        'buff/debuff: au moins un modificateur',
      );
    }
  });

  it('rejette un sort de dégâts avec base = 0', () => {
    const spell = { ...(makeSpell() as Record<string, unknown>), base: 0 };
    const result = spellSchema.safeParse(spell);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join()).toContain(
        'damage/heal: base doit être > 0',
      );
    }
  });

  it('rejette un cercle hors 1..5', () => {
    const spell = { ...(makeSpell() as Record<string, unknown>), circle: 6 };
    expect(spellSchema.safeParse(spell).success).toBe(false);
  });

  it('rejette une école inconnue', () => {
    const spell = { ...(makeSpell() as Record<string, unknown>), school: 'lumiere' };
    expect(spellSchema.safeParse(spell).success).toBe(false);
  });
});

describe('skillSchema', () => {
  it('charge une compétence valide', () => {
    expect(skillSchema.safeParse(makeSkill()).success).toBe(true);
  });

  it('rejette un nombre de rangs ≠ 3', () => {
    const skill = { ...(makeSkill() as Record<string, unknown>), ranks: [{ movementBonusPct: 10 }] };
    expect(skillSchema.safeParse(skill).success).toBe(false);
  });

  it('rejette un rang vide', () => {
    const skill = {
      ...(makeSkill() as Record<string, unknown>),
      ranks: [{}, { movementBonusPct: 20 }, { movementBonusPct: 30 }],
    };
    const result = skillSchema.safeParse(skill);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join()).toContain(
        'au moins un effet par rang',
      );
    }
  });
});

describe('artifactSchema', () => {
  it('charge un artefact valide', () => {
    expect(artifactSchema.safeParse(makeArtifact()).success).toBe(true);
  });

  it('rejette un bonus vide', () => {
    const artifact = { ...(makeArtifact() as Record<string, unknown>), bonus: {} };
    const result = artifactSchema.safeParse(artifact);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message).join()).toContain('bonus vide');
    }
  });
});

describe('catalogues sorts/compétences/artefacts (plan phase-3.2 lot L)', () => {
  it('buildSpellCatalog/buildSkillCatalog/buildArtifactCatalog agrègent le contenu core', async () => {
    const report = await loadContent(reader(makeData()));
    expect(buildSpellCatalog(report)).toEqual({
      'boule-de-feu': {
        id: 'boule-de-feu',
        school: 'fire',
        circle: 1,
        manaCost: 5,
        kind: 'damage',
        base: 6,
        perPower: 2,
      },
    });
    expect(buildSkillCatalog(report)).toEqual({
      logistics: {
        id: 'logistics',
        ranks: [{ movementBonusPct: 10 }, { movementBonusPct: 20 }, { movementBonusPct: 30 }],
      },
    });
    expect(buildArtifactCatalog(report)).toEqual({
      'lame-aiguisee': { id: 'lame-aiguisee', bonus: { attack: 2 } },
    });
  });

  it("R5 CO9 — rapporte (sans throw) des artefacts de départ inconnus", async () => {
    const data = makeData();
    (data['core/config.json'] as GameConfig).newGame.startingArtifacts = ['fantome'];
    const report = await loadContent(reader(data));
    expect(report.configErrors.join()).toMatch(/startingArtifacts.*fantome/s);
  });

  it("R5 CO9 — un paquet rejeté dont l'unité est en startingArmy ne casse pas le boot", async () => {
    const data = makeData();
    // Le paquet devient invalide (stat négative) ⇒ rejeté gracieusement…
    (data['factions/proto/units/t1-grunt.json'] as { stats: { hp: number } }).stats.hp = -1;
    // …mais config.newGame.startingArmy le référence encore.
    (data['core/config.json'] as GameConfig).newGame.startingArmy = [{ unitId: 't1-grunt', count: 1 }];
    const report = await loadContent(reader(data));
    expect(report.rejected.map((r) => r.id)).toEqual(['proto']); // pack rejeté
    expect(report.configErrors.join()).toMatch(/startingArmy.*t1-grunt/s); // erreur rapportée
    // Boot survit : la fonction n'a pas levé, le rapport est exploitable.
    expect(report.content.config.newGame.map).toBe('mini');
  });
});
