import { z } from 'zod';
import {
  abilityCatalogSchema,
  COMMON_RESOURCE_IDS,
  factionIndexSchema,
  localeSchema,
  manifestSchema,
  unitSchema,
  type AbilityCatalog,
  type Locale,
  type Manifest,
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
  const index = factionIndexSchema.parse(await readJson('factions/index.json'));
  const report: LoadReport = { content: { abilityCatalog: catalog, packs: [] }, rejected: [] };
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
