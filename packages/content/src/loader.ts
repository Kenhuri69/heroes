import { z } from 'zod';
import {
  abilityCatalogSchema,
  COMMON_RESOURCE_IDS,
  factionIndexSchema,
  gameConfigSchema,
  localeSchema,
  manifestSchema,
  mapFileSchema,
  unitSchema,
  type AbilityCatalog,
  type GameConfig,
  type Locale,
  type Manifest,
  type MapFile,
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
}

export interface LoadedContent {
  abilityCatalog: AbilityCatalog;
  config: GameConfig;
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
  const report: LoadReport = {
    content: { abilityCatalog: catalog, config, packs: [] },
    rejected: [],
  };
  for (const id of index.factions) {
    try {
      report.content.packs.push(await loadFactionPack(readJson, id, catalog));
    } catch (e) {
      report.rejected.push({ id, errors: describeError(e) });
    }
  }
  return report;
}

/** Charge un paquet et applique les règles croisées (doc 06 §5.3). */
export async function loadFactionPack(
  readJson: ReadJson,
  id: string,
  catalog: AbilityCatalog,
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

  if (errors.length > 0) throw new PackError(errors);
  return { manifest, units, locales };
}

/** Carte résolue, prête pour `StartGame` — même forme que l'`AdventureMapDef` du moteur. */
export interface ResolvedMap {
  id: string;
  width: number;
  height: number;
  terrain: string[];
  road: boolean[];
  objects: {
    id: string;
    type: 'resource';
    pos: { x: number; y: number };
    resource: string;
    amount: number;
  }[];
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
  }
  for (const [i, pos] of file.startPositions.entries()) {
    if (!inBounds(pos.x, pos.y)) errors.push(`${path}: startPositions[${i}] hors carte`);
    else if (!passable(pos.x, pos.y))
      errors.push(`${path}: startPositions[${i}] infranchissable (${pos.x},${pos.y})`);
    if (file.objects.some((o) => o.x === pos.x && o.y === pos.y))
      errors.push(`${path}: startPositions[${i}] occupée par un objet`);
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
    objects: file.objects.map(({ id, type, x, y, resource, amount }) => ({
      id,
      type,
      pos: { x, y },
      resource,
      amount,
    })),
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
