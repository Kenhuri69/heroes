import { z } from 'zod';
import {
  abilityCatalogSchema,
  artifactCatalogSchema,
  buildingCatalogSchema,
  COMMON_RESOURCE_IDS,
  factionIndexSchema,
  gameConfigSchema,
  localeSchema,
  manifestSchema,
  mapFileSchema,
  skillCatalogSchema,
  spellCatalogSchema,
  unitSchema,
  type AbilityCatalog,
  type Artifact,
  type Building,
  type FactionBonus,
  type GameConfig,
  type Locale,
  type Manifest,
  type MapFile,
  type ResolvedArtifact,
  type ResolvedBuilding,
  type ResolvedSkill,
  type ResolvedSpell,
  type Skill,
  type Spell,
  type Unit,
} from './schemas';

/**
 * Lecture abstraite d'un JSON par chemin relatif à `data/` — fetch côté
 * navigateur, fs côté CLI. Doit rejeter (throw) si le fichier est absent
 * ou n'est pas du JSON.
 */
export type ReadJson = (path: string) => Promise<unknown>;

export const LOCALE_LANGS = ['fr', 'en'] as const;

export interface FactionPack {
  manifest: Manifest;
  units: Unit[];
  locales: Record<(typeof LOCALE_LANGS)[number], Locale>;
  /** Bâtiments propres au paquet (dwellings + spéciaux) — vide si pas de `manifest.town`. */
  buildings: Building[];
}

export interface LoadedContent {
  abilityCatalog: AbilityCatalog;
  config: GameConfig;
  /** Locales de l'UI générique (menu, options, toasts) — data/core/locales/. */
  coreLocales: Record<(typeof LOCALE_LANGS)[number], Locale>;
  /** Bâtiments communs à toutes les villes — data/core/buildings.json (doc 02 §4.1). */
  coreBuildings: Building[];
  /** Sorts communs (4 écoles + neutre) — data/core/spells.json (doc 02 §1.4, plan phase-3.2). */
  coreSpells: Spell[];
  /** Compétences secondaires du pool commun — data/core/skills.json (doc 02 §1.3). */
  coreSkills: Skill[];
  /** Artefacts communs — data/core/artifacts.json (doc 02 §1.1, plan phase-3.2). */
  coreArtifacts: Artifact[];
  packs: FactionPack[];
}

export interface LoadReport {
  content: LoadedContent;
  /** Paquets rejetés — jamais de crash en jeu, un rapport précis (doc 06 §1). */
  rejected: { id: string; errors: string[] }[];
}

/** Charge et valide tout le contenu déclaré dans data/factions/index.json. */
export async function loadContent(readJson: ReadJson): Promise<LoadReport> {
  const catalog = abilityCatalogSchema.parse(await readJson('core/abilities.json'));
  const config = parseFile(gameConfigSchema, await readJson('core/config.json'), 'config.json');
  const index = factionIndexSchema.parse(await readJson('factions/index.json'));
  const coreLocales = {} as LoadedContent['coreLocales'];
  for (const lang of LOCALE_LANGS) {
    const path = `core/locales/${lang}.json`;
    coreLocales[lang] = parseFile(localeSchema, await readJson(path), path);
  }
  const coreBuildingsFile = parseFile(
    buildingCatalogSchema,
    await readJson('core/buildings.json'),
    'core/buildings.json',
  );
  const coreBuildings = coreBuildingsFile.buildings;
  {
    // Bâtiments communs : erreur bloquante directe (comme config/abilities), pas de rejet partiel.
    const errors: string[] = [];
    checkUniqueBuildingIds(errors, 'core/buildings.json', coreBuildings.map((b) => b.id));
    checkBuildingRequires(
      errors,
      'core/buildings.json',
      coreBuildings,
      new Map(coreBuildings.map((b) => [b.id, b.maxLevel])),
    );
    if (errors.length > 0) throw new PackError(errors);
  }
  const coreSpells = parseFile(
    spellCatalogSchema,
    await readJson('core/spells.json'),
    'core/spells.json',
  ).spells;
  const coreSkills = parseFile(
    skillCatalogSchema,
    await readJson('core/skills.json'),
    'core/skills.json',
  ).skills;
  const coreArtifacts = parseFile(
    artifactCatalogSchema,
    await readJson('core/artifacts.json'),
    'core/artifacts.json',
  ).artifacts;
  {
    // Sorts/compétences/artefacts communs : erreur bloquante directe (comme bâtiments), pas de rejet partiel.
    const errors: string[] = [];
    checkUniqueIds(errors, 'core/spells.json', coreSpells.map((s) => s.id), 'sort');
    checkUniqueIds(errors, 'core/skills.json', coreSkills.map((s) => s.id), 'compétence');
    checkUniqueIds(errors, 'core/artifacts.json', coreArtifacts.map((a) => a.id), 'artefact');
    if (errors.length > 0) throw new PackError(errors);
  }
  const report: LoadReport = {
    content: {
      abilityCatalog: catalog,
      config,
      coreLocales,
      coreBuildings,
      coreSpells,
      coreSkills,
      coreArtifacts,
      packs: [],
    },
    rejected: [],
  };
  for (const id of index.factions) {
    try {
      report.content.packs.push(await loadFactionPack(readJson, id, catalog, coreBuildings));
    } catch (e) {
      report.rejected.push({ id, errors: describeError(e) });
    }
  }
  // Règle croisée : l'armée de départ ne référence que des unités chargées.
  const known = knownUnitIds(report);
  for (const stack of config.newGame.startingArmy) {
    if (!known.has(stack.unitId)) {
      throw new PackError([
        `config.json: newGame.startingArmy — unité inconnue des paquets '${stack.unitId}'`,
      ]);
    }
  }
  // Règle croisée : les artefacts de départ ne référencent que des artefacts chargés.
  const knownArtifacts = new Set(coreArtifacts.map((a) => a.id));
  for (const artifactId of config.newGame.startingArtifacts ?? []) {
    if (!knownArtifacts.has(artifactId)) {
      throw new PackError([
        `config.json: newGame.startingArtifacts — artefact inconnu '${artifactId}'`,
      ]);
    }
  }
  // Règle croisée : la ville de départ résout (faction connue, bâtiments/niveaux valides).
  resolveStartingTowns(config, report);
  return report;
}

/** IDs d'unités de tous les paquets valides — pour les règles croisées (armée, gardiens). */
export function knownUnitIds(report: LoadReport): Set<string> {
  return new Set(report.content.packs.flatMap((p) => p.units.map((u) => u.id)));
}

/** Charge un paquet et applique les règles croisées (doc 06 §5.3). */
export async function loadFactionPack(
  readJson: ReadJson,
  id: string,
  catalog: AbilityCatalog,
  /** Bâtiments communs (data/core/buildings.json) — résolus par `manifest.town.buildings`. */
  coreBuildings: Building[] = [],
): Promise<FactionPack> {
  const base = `factions/${id}`;
  const manifest = parseFile(manifestSchema, await readJson(`${base}/manifest.json`), 'manifest.json');
  const errors: string[] = [];

  if (manifest.id !== id) {
    errors.push(`manifest.json: id '${manifest.id}' ≠ dossier '${id}'`);
  }

  const units: Unit[] = [];
  for (const unitId of manifest.units) {
    const path = `units/${unitId}.json`;
    const unit = parseFile(unitSchema, await readJson(`${base}/${path}`), path);
    if (unit.id !== unitId) errors.push(`${path}: id '${unit.id}' ≠ fichier '${unitId}'`);
    if (unit.tier > manifest.tiers)
      errors.push(`${path}: tier ${unit.tier} > tiers du manifeste (${manifest.tiers})`);
    for (const ref of unit.abilities) {
      if (!catalog.abilities.includes(ref.id))
        errors.push(`${path}: capacité inconnue au catalogue '${ref.id}'`);
    }
    const knownResources = new Set<string>([
      ...COMMON_RESOURCE_IDS,
      ...manifest.factionResources.map((r) => r.id),
    ]);
    for (const res of Object.keys(unit.cost)) {
      if (!knownResources.has(res)) errors.push(`${path}: ressource de coût inconnue '${res}'`);
    }
    units.push(unit);
  }

  const unitIds = new Set(units.map((u) => u.id));
  if (unitIds.size !== units.length) errors.push('manifest.json: unités en double dans `units`');
  for (const [group, members] of Object.entries(manifest.sharedGrowthGroups)) {
    for (const member of members) {
      if (!unitIds.has(member))
        errors.push(`manifest.json: sharedGrowthGroups.${group} référence l'unité inconnue '${member}'`);
    }
  }

  // Effets de faction (plan phase-3.4) : unitId doit exister dans le paquet et
  // porter la capacité requise par l'effet (ex. `undead` pour la relève).
  for (const bonus of manifest.factionBonuses) {
    if (bonus.type === 'raiseUndeadOnVictory') {
      const unit = units.find((u) => u.id === bonus.unitId);
      if (!unit) {
        errors.push(
          `manifest.json: factionBonuses(raiseUndeadOnVictory) — unité inconnue '${bonus.unitId}'`,
        );
      } else if (!unit.abilities.some((a) => a.id === 'undead')) {
        errors.push(
          `manifest.json: factionBonuses(raiseUndeadOnVictory) — unité '${bonus.unitId}' sans capacité 'undead'`,
        );
      }
    }
  }

  const locales = {} as FactionPack['locales'];
  for (const lang of LOCALE_LANGS) {
    const path = `locales/${lang}.json`;
    locales[lang] = parseFile(localeSchema, await readJson(`${base}/${path}`), path);
  }
  for (const key of collectLocRefs({ manifest, units })) {
    for (const lang of LOCALE_LANGS) {
      if (!(key in locales[lang])) errors.push(`locales/${lang}.json: clé manquante '${key}'`);
    }
  }

  // Ville de faction (doc 02 §4, plan phase-3.1) — bâtiments propres (dwellings/spéciaux).
  const buildings: Building[] = [];
  if (manifest.town) {
    const path = 'buildings.json';
    const file = parseFile(buildingCatalogSchema, await readJson(`${base}/${path}`), path);
    buildings.push(...file.buildings);

    const coreBuildingIds = new Set(coreBuildings.map((b) => b.id));
    const ownIds = buildings.map((b) => b.id);
    checkUniqueBuildingIds(errors, path, ownIds);
    for (const id of ownIds) {
      if (coreBuildingIds.has(id))
        errors.push(`${path}: id de bâtiment '${id}' entre en collision avec un bâtiment commun`);
    }

    const visibleMaxLevel = new Map<string, number>([
      ...coreBuildings.map((b): [string, number] => [b.id, b.maxLevel]),
      ...buildings.map((b): [string, number] => [b.id, b.maxLevel]),
    ]);
    checkBuildingRequires(errors, path, buildings, visibleMaxLevel);
    for (const b of buildings) {
      b.levels.forEach((level, i) => {
        if (level.effect.type === 'dwelling' && !unitIds.has(level.effect.unitId))
          errors.push(
            `${path}: ${b.id} niveau ${i + 1} — dwelling vers unité inconnue '${level.effect.unitId}'`,
          );
      });
    }

    const knownBuildingIds = new Set([...coreBuildingIds, ...ownIds]);
    for (const bId of manifest.town.buildings) {
      if (!knownBuildingIds.has(bId))
        errors.push(`manifest.json: town.buildings — bâtiment inconnu '${bId}'`);
    }
    const byId = new Map(buildings.map((b) => [b.id, b]));
    for (const d of manifest.town.dwellings) {
      if (!unitIds.has(d.unitId))
        errors.push(`manifest.json: town.dwellings — unité inconnue '${d.unitId}'`);
      if (!manifest.town.buildings.includes(d.buildingId))
        errors.push(
          `manifest.json: town.dwellings — bâtiment '${d.buildingId}' absent de town.buildings`,
        );
      const def = byId.get(d.buildingId);
      if (
        def &&
        !def.levels.some(
          (l) => l.effect.type === 'dwelling' && l.effect.tier === d.tier && l.effect.unitId === d.unitId,
        )
      ) {
        errors.push(
          `manifest.json: town.dwellings — '${d.buildingId}' ne définit pas l'effet dwelling(tier=${d.tier}, unitId='${d.unitId}')`,
        );
      }
    }
  }

  if (errors.length > 0) throw new PackError(errors);
  return { manifest, units, locales, buildings };
}

/** Un `id` de bâtiment ne doit apparaître qu'une fois dans la liste donnée. */
function checkUniqueBuildingIds(errors: string[], path: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${path}: id de bâtiment en double '${id}'`);
    seen.add(id);
  }
}

/** Un `id` (de `noun`) ne doit apparaître qu'une fois dans la liste donnée. */
function checkUniqueIds(errors: string[], path: string, ids: string[], noun: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${path}: id de ${noun} en double '${id}'`);
    seen.add(id);
  }
}

/** Prérequis résolubles vers un bâtiment visible, à un niveau ≤ son maxLevel (doc 02 §4.1). */
function checkBuildingRequires(
  errors: string[],
  path: string,
  buildings: Building[],
  visibleMaxLevel: ReadonlyMap<string, number>,
): void {
  for (const b of buildings) {
    b.levels.forEach((level, i) => {
      for (const req of level.requires) {
        const max = visibleMaxLevel.get(req.building);
        if (max === undefined) {
          errors.push(`${path}: ${b.id} niveau ${i + 1} — prérequis vers bâtiment inconnu '${req.building}'`);
        } else if (req.level > max) {
          errors.push(
            `${path}: ${b.id} niveau ${i + 1} — prérequis '${req.building}' niveau ${req.level} > maxLevel (${max})`,
          );
        }
      }
    });
  }
}

/**
 * Agrège les bâtiments communs (core) et de faction en un catalogue unique,
 * prêt pour `GameState.buildingCatalog` (doc 02 §4.1, plan phase-3.1). `name`
 * (locale) est retiré : hors de la forme `BuildingDef` figée du moteur.
 */
export function buildBuildingCatalog(report: LoadReport): Record<string, ResolvedBuilding> {
  const catalog: Record<string, ResolvedBuilding> = {};
  const add = (list: Building[], origin: string): void => {
    for (const b of list) {
      if (catalog[b.id])
        throw new PackError([`buildBuildingCatalog: id de bâtiment en double '${b.id}' (${origin})`]);
      catalog[b.id] = { id: b.id, maxLevel: b.maxLevel, levels: b.levels };
    }
  };
  add(report.content.coreBuildings, 'core');
  for (const pack of report.content.packs) add(pack.buildings, pack.manifest.id);
  return catalog;
}

/**
 * Catalogue des sorts, prêt pour `GameState.spellCatalog` (doc 02 §1.4, plan
 * phase-3.2 lot K). `name` (locale) est retiré : hors de la forme `SpellDef`
 * figée du moteur. Core seul en 3.2 — l'extension par faction (écoles
 * propres, doc 05) rejoindra cet agrégat comme `buildBuildingCatalog`.
 */
export function buildSpellCatalog(report: LoadReport): Record<string, ResolvedSpell> {
  const catalog: Record<string, ResolvedSpell> = {};
  for (const s of report.content.coreSpells) {
    if (catalog[s.id]) throw new PackError([`buildSpellCatalog: id de sort en double '${s.id}'`]);
    catalog[s.id] = {
      id: s.id,
      school: s.school,
      circle: s.circle,
      manaCost: s.manaCost,
      kind: s.kind,
      base: s.base,
      perPower: s.perPower,
      ...(s.attackMod !== undefined && { attackMod: s.attackMod }),
      ...(s.defenseMod !== undefined && { defenseMod: s.defenseMod }),
      ...(s.speedMod !== undefined && { speedMod: s.speedMod }),
    };
  }
  return catalog;
}

/**
 * Catalogue des compétences secondaires, prêt pour `GameState.skillCatalog`
 * (doc 02 §1.3, plan phase-3.2 lot K). `name` (locale) est retiré : hors de
 * la forme `HeroSkillDef` figée du moteur.
 */
export function buildSkillCatalog(report: LoadReport): Record<string, ResolvedSkill> {
  const catalog: Record<string, ResolvedSkill> = {};
  for (const s of report.content.coreSkills) {
    if (catalog[s.id])
      throw new PackError([`buildSkillCatalog: id de compétence en double '${s.id}'`]);
    catalog[s.id] = { id: s.id, ranks: s.ranks };
  }
  return catalog;
}

/**
 * Catalogue des artefacts, prêt pour `GameState.artifactCatalog` (doc 02
 * §1.1, doc 08 §2.3, plan phase-3.2 lot K). `name` (locale) est retiré : hors
 * de la forme `ArtifactDef` figée du moteur.
 */
export function buildArtifactCatalog(report: LoadReport): Record<string, ResolvedArtifact> {
  const catalog: Record<string, ResolvedArtifact> = {};
  for (const a of report.content.coreArtifacts) {
    if (catalog[a.id])
      throw new PackError([`buildArtifactCatalog: id d'artefact en double '${a.id}'`]);
    catalog[a.id] = { id: a.id, bonus: a.bonus };
  }
  return catalog;
}

/**
 * Catalogue des effets de faction, prêt pour `StartGame.factionCatalog` /
 * `GameState.factionCatalog` (plan phase-3.4) — indexé par `factionId`, lu
 * par l'interpréteur générique du moteur post-victoire. `factionBonuses` est
 * déjà sous forme résolue (`FactionBonus`), aucune traduction nécessaire.
 */
export function buildFactionCatalog(report: LoadReport): Record<string, { bonuses: FactionBonus[] }> {
  const catalog: Record<string, { bonuses: FactionBonus[] }> = {};
  for (const pack of report.content.packs) {
    catalog[pack.manifest.id] = { bonuses: pack.manifest.factionBonuses };
  }
  return catalog;
}

/** Ville de départ résolue — même forme que le `TownState` initial du moteur. */
export interface ResolvedStartingTown {
  id: string;
  ownerPlayerId: string;
  pos: { x: number; y: number };
  factionId: string;
  buildings: Record<string, number>;
  builtToday: boolean;
  garrison: never[];
  stock: Record<string, number>;
}

/**
 * Résout `config.newGame.startingTown` en `TownState`-like (owner `player-1`,
 * garnison vide — le héros a `startingArmy`, doc 02 §4). Vérifie que la
 * faction et les bâtiments préconstruits sont connus (règle croisée).
 */
export function resolveStartingTowns(config: GameConfig, report: LoadReport): ResolvedStartingTown[] {
  const start = config.newGame.startingTown;
  if (!start) return [];
  if (!report.content.packs.some((p) => p.manifest.id === start.factionId)) {
    throw new PackError([`config.json: newGame.startingTown — faction inconnue '${start.factionId}'`]);
  }
  const catalog = buildBuildingCatalog(report);
  const buildings: Record<string, number> = {};
  for (const pb of start.prebuilt) {
    const def = catalog[pb.building];
    if (!def)
      throw new PackError([`config.json: newGame.startingTown.prebuilt — bâtiment inconnu '${pb.building}'`]);
    if (pb.level > def.maxLevel) {
      throw new PackError([
        `config.json: newGame.startingTown.prebuilt — niveau ${pb.level} > maxLevel (${def.maxLevel}) pour '${pb.building}'`,
      ]);
    }
    buildings[pb.building] = pb.level;
  }
  return [
    {
      id: start.id,
      ownerPlayerId: 'player-1',
      pos: { x: start.x, y: start.y },
      factionId: start.factionId,
      buildings,
      builtToday: false,
      garrison: [],
      stock: {},
    },
  ];
}

/** Carte résolue, prête pour `StartGame` — même forme que l'`AdventureMapDef` du moteur. */
export type ResolvedMapObject =
  | {
      id: string;
      type: 'resource';
      pos: { x: number; y: number };
      resource: string;
      amount: number;
    }
  | {
      id: string;
      type: 'guardian';
      pos: { x: number; y: number };
      unitId: string;
      count: number;
    }
  | {
      id: string;
      type: 'town';
      pos: { x: number; y: number };
    };

export interface ResolvedMap {
  id: string;
  width: number;
  height: number;
  terrain: string[];
  road: boolean[];
  objects: ResolvedMapObject[];
  startPositions: { x: number; y: number }[];
}

/**
 * Charge et valide une carte `maps/<id>.map.json` contre la config (terrains
 * connus, franchissabilité des départs et objets) — doc 02 §2.1. Rejet en
 * `PackError` agrégée, comme les paquets de faction.
 */
export async function loadMap(
  readJson: ReadJson,
  id: string,
  config: GameConfig,
  /** Unités connues des paquets chargés — vérifie les gardiens si fourni. */
  knownUnitIds?: ReadonlySet<string>,
): Promise<ResolvedMap> {
  const path = `maps/${id}.map.json`;
  const file = parseFile(mapFileSchema, await readJson(path), path);
  const errors: string[] = [];
  if (file.id !== id) errors.push(`${path}: id '${file.id}' ≠ fichier '${id}'`);

  checkRows(errors, path, 'tiles', file.tiles, file);
  checkRows(errors, path, 'roads', file.roads, file);
  for (const [y, row] of file.tiles.entries()) {
    for (const [x, char] of [...row].entries()) {
      if (!(char in file.legend)) errors.push(`${path}: tiles[${y}][${x}] — char inconnu '${char}'`);
    }
  }
  for (const [y, row] of file.roads.entries()) {
    for (const [x, char] of [...row].entries()) {
      if (char !== '0' && char !== '1')
        errors.push(`${path}: roads[${y}][${x}] — attendu '0' ou '1', reçu '${char}'`);
    }
  }
  for (const terrain of Object.values(file.legend)) {
    if (!(terrain in config.adventure.terrains))
      errors.push(`${path}: legend — terrain inconnu de la config '${terrain}'`);
  }

  const passable = (x: number, y: number): boolean => {
    const char = file.tiles[y]?.[x];
    const terrain = char !== undefined ? file.legend[char] : undefined;
    const rule = terrain !== undefined ? config.adventure.terrains[terrain] : undefined;
    return rule !== undefined && rule.moveCost !== null;
  };
  const inBounds = (x: number, y: number): boolean => x < file.width && y < file.height;

  const seen = new Set<string>();
  for (const obj of file.objects) {
    if (seen.has(obj.id)) errors.push(`${path}: objects — id en double '${obj.id}'`);
    seen.add(obj.id);
    if (!inBounds(obj.x, obj.y)) errors.push(`${path}: objet '${obj.id}' hors carte`);
    else if (!passable(obj.x, obj.y))
      errors.push(`${path}: objet '${obj.id}' sur tuile infranchissable (${obj.x},${obj.y})`);
    if (obj.type === 'guardian' && knownUnitIds && !knownUnitIds.has(obj.unitId))
      errors.push(`${path}: gardien '${obj.id}' — unité inconnue des paquets '${obj.unitId}'`);
  }
  for (const [i, pos] of file.startPositions.entries()) {
    if (!inBounds(pos.x, pos.y)) errors.push(`${path}: startPositions[${i}] hors carte`);
    else if (!passable(pos.x, pos.y))
      errors.push(`${path}: startPositions[${i}] infranchissable (${pos.x},${pos.y})`);
    if (file.objects.some((o) => o.x === pos.x && o.y === pos.y))
      errors.push(`${path}: startPositions[${i}] occupée par un objet`);
  }

  // Règle croisée : la ville de départ (config) référence un objet `town` de cette carte.
  if (config.newGame.startingTown && config.newGame.map === id) {
    const start = config.newGame.startingTown;
    const townObj = file.objects.find((o) => o.type === 'town' && o.id === start.id);
    if (!townObj) {
      errors.push(`${path}: ville de départ '${start.id}' absente des objets de la carte`);
    } else if (townObj.x !== start.x || townObj.y !== start.y) {
      errors.push(
        `${path}: ville de départ '${start.id}' — position carte (${townObj.x},${townObj.y}) ≠ config (${start.x},${start.y})`,
      );
    }
  }

  if (errors.length > 0) throw new PackError(errors);
  return resolveMap(file);
}

/** Déplie légende et rangées vers la forme row-major consommée par le moteur. */
function resolveMap(file: MapFile): ResolvedMap {
  return {
    id: file.id,
    width: file.width,
    height: file.height,
    terrain: file.tiles.flatMap((row) => [...row].map((c) => file.legend[c] as string)),
    road: file.roads.flatMap((row) => [...row].map((c) => c === '1')),
    objects: file.objects.map((obj): ResolvedMapObject => {
      const pos = { x: obj.x, y: obj.y };
      if (obj.type === 'resource')
        return { id: obj.id, type: obj.type, pos, resource: obj.resource, amount: obj.amount };
      if (obj.type === 'guardian')
        return { id: obj.id, type: obj.type, pos, unitId: obj.unitId, count: obj.count };
      return { id: obj.id, type: obj.type, pos };
    }),
    startPositions: file.startPositions.map(({ x, y }) => ({ x, y })),
  };
}

function checkRows(
  errors: string[],
  path: string,
  layer: string,
  rows: string[],
  file: MapFile,
): void {
  if (rows.length !== file.height)
    errors.push(`${path}: ${layer} — ${rows.length} rangée(s) pour height=${file.height}`);
  for (const [y, row] of rows.entries()) {
    if (row.length !== file.width)
      errors.push(`${path}: ${layer}[${y}] — ${row.length} char(s) pour width=${file.width}`);
  }
}

/** Toutes les références `@loc:` d'un paquet (name du manifeste + unités). */
function collectLocRefs(pack: { manifest: Manifest; units: Unit[] }): string[] {
  const refs = [pack.manifest.name, ...pack.units.map((u) => u.name)];
  return refs.map((r) => r.slice('@loc:'.length));
}

export class PackError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join('\n'));
    this.name = 'PackError';
  }
}

function parseFile<S extends z.ZodTypeAny>(schema: S, data: unknown, file: string): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data as z.output<S>;
  throw new PackError(
    result.error.issues.map(
      (i) => `${file}: ${i.path.length ? i.path.join('.') : '(racine)'} — ${i.message}`,
    ),
  );
}

function describeError(e: unknown): string[] {
  if (e instanceof PackError) return e.errors;
  return [e instanceof Error ? e.message : String(e)];
}
