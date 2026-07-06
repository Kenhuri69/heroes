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
import { buildBuildingCatalog, buildFactionCatalog, loadContent, type ReadJson } from '../src/loader';

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

/**
 * La faction cible : native de l'herbe, lineup complet de 7 tiers de BASE
 * (doc 03 §3). Le compte de base (via les dwellings) distingue Haven (7) de la
 * faction de test (1), là où `manifest.tiers` ou `units.length` ne le font plus
 * (la faction de test déclare aussi 7 tiers ; `units` inclut les améliorées — 4.11).
 */
function findSevenTierGrassFaction(packs: Awaited<ReturnType<typeof loadContent>>['content']['packs']) {
  return packs.find((p) => p.manifest.nativeTerrain === 'grass' && baseUnits(p).length === 7);
}

/**
 * Unités de BASE du lineup (une par tier) — celles référencées par
 * `manifest.town.dwellings`. Depuis les upgrades (Alpha 4.11), `pack.units`
 * contient aussi les variantes améliorées (`-elite`, recrutables au dwelling
 * niveau 2) : les tests de lineup/recrutement de base filtrent sur celles-ci.
 */
function baseUnits(pack: Awaited<ReturnType<typeof loadContent>>['content']['packs'][number]) {
  const baseIds = new Set((pack.manifest.town?.dwellings ?? []).map((d) => d.unitId));
  return pack.units.filter((u) => baseIds.has(u.id));
}

/**
 * La faction morte-vivante : identifiée par son effet de faction déclaratif
 * (plan phase-3.4), pas par son id littéral — le garde-fou de modularité
 * interdit tout nom de faction en dur dans `packages/`.
 */
function findUndeadFaction(packs: Awaited<ReturnType<typeof loadContent>>['content']['packs']) {
  return packs.find((p) => p.manifest.factionBonuses.some((b) => b.type === 'raiseUndeadOnVictory'));
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
    expect(baseUnits(pack!)).toHaveLength(7); // 7 tiers de base (+ variantes améliorées)
    // Nom de faction présent dans les deux langues (valeur non assertée en dur
    // pour ne pas réintroduire de littéral de nom de faction). Clé propre au
    // paquet (`@loc:faction.<id>.name`), lue depuis le manifeste.
    const nameKey = pack?.manifest.name.slice('@loc:'.length) ?? '';
    expect(pack?.locales.fr[nameKey]).toBeTruthy();
    expect(pack?.locales.en[nameKey]).toBeTruthy();
  });

  it('résout les stats et capacités attendues pour chaque tier (doc 03 §3)', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = findSevenTierGrassFaction(report.content.packs);
    const byTier = new Map(baseUnits(pack!).map((u) => [u.tier, u]));

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

    // On recrute les unités de BASE (dwellings au niveau 1) — les variantes
    // améliorées exigeraient le dwelling niveau 2 (Alpha 4.11).
    const base = baseUnits(pack);
    for (const unit of base) {
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
    for (const unit of base) {
      expect(garrison).toContainEqual({ unitId: unit.id, count: 1 });
    }

    // Coût total débité (or uniquement, pour ne pas dépendre de l'ordre de recrutement).
    const totalGoldCost = base.reduce((sum, u) => sum + (u.cost['gold'] ?? 0), 0);
    expect(state.players[0]?.resources.gold).toBe(100_000 - totalGoldCost);
  });
});

/**
 * Faction morte-vivante (plan phase-3.4, doc 04) : test de modularité n°1 —
 * l'effet de faction `raiseUndeadOnVictory` est un pur point de données,
 * identifié par sa PROPRIÉTÉ déclarative (jamais par un id littéral, cf.
 * garde-fou de modularité ci.yml).
 */
describe('faction morte-vivante (plan phase-3.4) — effet de faction & recrutement', () => {
  it('charge le paquet (7 unités toutes undead, locales fr/en) sans rejet', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = findUndeadFaction(report.content.packs);
    expect(pack).toBeDefined();
    expect(baseUnits(pack!)).toHaveLength(7); // 7 tiers de base (+ variantes améliorées)
    // Toutes les unités (base ET améliorées) restent mortes-vivantes.
    for (const unit of pack?.units ?? []) {
      expect(unit.abilities.some((a) => a.id === 'undead')).toBe(true);
    }
    const nameKey = pack?.manifest.name.slice('@loc:'.length) ?? '';
    expect(pack?.locales.fr[nameKey]).toBeTruthy();
    expect(pack?.locales.en[nameKey]).toBeTruthy();
  });

  it('résout le bonus raiseUndeadOnVictory vers une unité undead du paquet', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = findUndeadFaction(report.content.packs);
    if (!pack) throw new Error('faction morte-vivante absente — content:check devrait échouer');

    const factionCatalog = buildFactionCatalog(report);
    const bonuses = factionCatalog[pack.manifest.id]?.bonuses ?? [];
    const raiseBonus = bonuses.find((b) => b.type === 'raiseUndeadOnVictory');
    expect(raiseBonus).toBeDefined();
    if (raiseBonus?.type !== 'raiseUndeadOnVictory') throw new Error('type inattendu');

    const raisedUnit = pack.units.find((u) => u.id === raiseBonus.unitId);
    expect(raisedUnit).toBeDefined();
    expect(raisedUnit?.abilities.some((a) => a.id === 'undead')).toBe(true);
    expect(raiseBonus.percentHpRaised).toBeGreaterThan(0);
    expect(raiseBonus.capBase).toBeGreaterThanOrEqual(0);
    expect(raiseBonus.capPerExisting).toBeGreaterThanOrEqual(0);
  });

  it('recrute une unité de chacun des 7 tiers depuis une ville aux habitations construites', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = findUndeadFaction(report.content.packs);
    if (!pack) throw new Error('faction morte-vivante absente — content:check devrait échouer');

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
    };

    const players: PlayerSetup[] = [
      {
        id: 'p1',
        startingResources: {
          ...emptyResources(),
          gold: 100_000,
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

    // Unités de base (dwellings niveau 1) — les améliorées exigeraient le niveau 2.
    const base = baseUnits(pack);
    for (const unit of base) {
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
    for (const unit of base) {
      expect(garrison).toContainEqual({ unitId: unit.id, count: 1 });
    }
  });
});

/** Catalogue moteur de TOUTES les unités chargées (le moteur ne voit que des ids). */
function buildFullUnitCatalog(
  report: Awaited<ReturnType<typeof loadContent>>,
): Record<string, CombatUnitDef> {
  const catalog: Record<string, CombatUnitDef> = {};
  for (const pack of report.content.packs) {
    for (const unit of pack.units) {
      catalog[unit.id] = {
        id: unit.id,
        groupId: pack.manifest.id,
        nativeTerrain: pack.manifest.nativeTerrain,
        stats: unit.stats,
        abilities: unit.abilities,
        recruitCost: unit.cost,
        growthPerWeek: unit.growthPerWeek,
      };
    }
  }
  return catalog;
}

describe('Nécromancie (plan phase-3.4) — effet de faction post-victoire, données réelles', () => {
  it('un héros mort-vivant qui gagne un combat contre des vivants relève des squelettes', async () => {
    const report = await loadContent(readJsonFromDisk);
    const undead = findUndeadFaction(report.content.packs);
    if (!undead) throw new Error('faction morte-vivante absente — content:check devrait échouer');
    const bonus = undead.manifest.factionBonuses.find((b) => b.type === 'raiseUndeadOnVictory');
    if (!bonus || bonus.type !== 'raiseUndeadOnVictory') throw new Error('bonus raiseUndeadOnVictory absent');
    const skeletonId = bonus.unitId;

    const unitCatalog = buildFullUnitCatalog(report);
    const factionCatalog = buildFactionCatalog(report);

    // Un gardien VIVANT (non-`undead`) : seules ses pertes alimentent la relève.
    const living = report.content.packs
      .flatMap((p) => p.units)
      .find((u) => !u.abilities.some((a) => a.id === 'undead'));
    if (!living) throw new Error('aucune unité vivante dans le contenu');

    // Carte 3×3 herbe, héros en (0,0), gardien vivant adjacent en (1,0).
    const map: AdventureMapDef = {
      ...testMap(),
      objects: [{ id: 'guardian-1', type: 'guardian', pos: { x: 1, y: 0 }, unitId: living.id, count: 50 }],
    };

    // Armée écrasante de squelettes ⇒ victoire déterministe ; le héros joue la
    // faction morte-vivante ⇒ son bonus de faction s'applique post-victoire.
    const players: PlayerSetup[] = [
      {
        id: 'p1',
        startingResources: emptyResources(),
        startingArmy: [{ unitId: skeletonId, count: 500 }],
        startingFactionId: undead.manifest.id,
      },
    ];

    const startCmd: Command = {
      type: 'StartGame',
      seed: 3,
      players,
      map,
      config: testConfig(),
      unitCatalog,
      factionCatalog,
    };
    let state = apply(createEmptyState(), startCmd).state;
    const skeletonsBefore =
      state.heroes[0]?.army.find((s) => s.unitId === skeletonId)?.count ?? 0;

    // Interception du gardien (MoveHero sur sa tuile) puis auto-résolution.
    state = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] }).state;
    expect(state.combat).not.toBeNull(); // combat ouvert par interception
    const { state: after, events } = apply(state, { type: 'AutoCombat' });

    // Victoire + relève : événement UndeadRaised émis pour le squelette du bonus.
    expect(events.some((e) => e.type === 'CombatEnded' && e.winner === 'attacker')).toBe(true);
    const raised = events.find((e) => e.type === 'UndeadRaised');
    expect(raised).toBeDefined();
    if (raised && raised.type === 'UndeadRaised') {
      expect(raised.unitId).toBe(skeletonId);
      expect(raised.count).toBeGreaterThan(0);
    }
    // L'armée du héros contient toujours des squelettes, augmentés de la relève
    // (survivants + relevés) — au moins un squelette de plus que les survivants seuls.
    const hero = after.heroes.find((h) => h.id === 'hero-p1');
    const skeletonsAfter = hero?.army.find((s) => s.unitId === skeletonId)?.count ?? 0;
    expect(skeletonsAfter).toBeGreaterThan(0);
    expect(skeletonsBefore).toBe(500);
  });
});

/**
 * La 4ᵉ maison (Beta, doc 14) : native de l'**eau**, lineup complet de 7 tiers de
 * base. Identifiée par ses PROPRIÉTÉS (terrain natif + 7 tiers), jamais par son id
 * littéral — le garde-fou de modularité interdit tout nom de faction dans
 * `packages/` (y compris les tests/commentaires).
 */
function findSevenTierWaterFaction(packs: Awaited<ReturnType<typeof loadContent>>['content']['packs']) {
  return packs.find((p) => p.manifest.nativeTerrain === 'water' && baseUnits(p).length === 7);
}

describe('4ᵉ faction (native de l’eau) — pipeline data-driven', () => {
  it('charge la faction (14 unités = 7 base + 7 améliorées, locales fr/en)', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);
    const pack = findSevenTierWaterFaction(report.content.packs);
    expect(pack).toBeDefined();
    expect(baseUnits(pack!)).toHaveLength(7);
    expect(pack?.units).toHaveLength(14);
    const nameKey = pack?.manifest.name.slice('@loc:'.length) ?? '';
    expect(pack?.locales.fr[nameKey]).toBeTruthy();
    expect(pack?.locales.en[nameKey]).toBeTruthy();
  });

  it('résout stats/capacités du lineup (doc 14 §3 ; Symbiose ouverte au lot moteur)', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = findSevenTierWaterFaction(report.content.packs);
    const byTier = new Map(baseUnits(pack!).map((u) => [u.tier, u]));
    // T1 volant fragile, T2 tireur, T4 double attaque, T7 colosse.
    expect(byTier.get(1)?.abilities).toEqual([{ id: 'flying' }]);
    expect(byTier.get(2)?.abilities).toEqual([{ id: 'shooter', params: { ammo: 12 } }]);
    expect(byTier.get(4)?.abilities).toEqual([{ id: 'doubleAttack' }]);
    // T7 « colosse » après équilibrage 5.4 (profil escarmouche mobile, doc 14 §3).
    expect(byTier.get(7)?.stats.hp).toBe(125);
    // Signature Symbiose (doc 14 §2, Beta 5.3) : T3/T6/T7 portent la capacité
    // générique `symbiosis` (bonus Att/Déf cumulatif tant que la pile Défend).
    expect(byTier.get(3)?.abilities).toEqual([
      { id: 'symbiosis', params: { attackPerRound: 1, defensePerRound: 1, maxStacks: 4 } },
    ]);
    expect(byTier.get(6)?.abilities).toEqual([
      { id: 'symbiosis', params: { attackPerRound: 2, defensePerRound: 2, maxStacks: 4 } },
    ]);
    expect(byTier.get(7)?.abilities).toEqual([
      { id: 'symbiosis', params: { attackPerRound: 2, defensePerRound: 3, maxStacks: 4 } },
    ]);
  });

  it('recrute une unité de chacun des 7 tiers depuis une ville aux habitations construites', async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = findSevenTierWaterFaction(report.content.packs);
    if (!pack) throw new Error('4ᵉ faction absente — content:check devrait échouer');

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
          mercury: 100,
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
