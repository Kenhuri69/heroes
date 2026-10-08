import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  generateMap,
  knownArtifactIds,
  knownUnitIds,
  loadContent,
  loadMap,
  standardMapOptions,
  type MapGenOptions,
  type ReadJson,
} from '@heroes/content';
import { DATA_DIR, readJsonFromDisk } from './data-dir';

/**
 * `pnpm map:gen <id> <seed> [--clé=valeur…]` (doc 09, Live 6.2) : génère une
 * carte aléatoire DÉTERMINISTE (`generateMap`), la **valide par le vrai
 * `loadMap`** (schéma + règles croisées, avec les unités connues du contenu
 * chargé) puis l'écrit dans `data/maps/<id>.map.json`. Jamais d'export invalide.
 *
 * Lot LE8 : mêmes options que le client (`standardMapOptions`) ⇒ à graine et
 * réglages égaux, la CLI produit la carte de « Nouvelle partie ». Les réglages
 * (taille, joueurs, densités, souterrain) se passent en `--clé=valeur`.
 */

/** Staging des illustrations (racine du dépôt) — même convention que le registre client. */
const ASSETS_DIR = join(DATA_DIR, '..', 'assets');
const hasAsset = (key: string): boolean =>
  existsSync(join(ASSETS_DIR, `${key}.png`)) || existsSync(join(ASSETS_DIR, `${key}.jpg`));

/** Miroir disque de `unitSpriteUrl` (client) : sprite de faction, sinon celui de la base d'une élite, sinon core. */
function hasUnitArt(unitId: string, factionId: string): boolean {
  const base = unitId.endsWith('-elite') ? unitId.slice(0, -'-elite'.length) : undefined;
  return (
    hasAsset(`units/${factionId}/${unitId}`) ||
    (base !== undefined && hasAsset(`units/${factionId}/${base}`)) ||
    hasAsset(`units/core/${unitId}`)
  );
}

/** Réglages de « Nouvelle partie » acceptés en ligne de commande. */
const NUMERIC_OPTIONS = [
  'width',
  'height',
  'startPositionCount',
  'resourceMultiplier',
  'guardianDensity',
  'mineDensity',
  'eventBuildingDensity',
  'pickupDensity',
] as const;

function parseOptions(args: string[]): MapGenOptions | null {
  const opts: MapGenOptions = {};
  for (const arg of args) {
    const m = /^--([A-Za-z]+)=(.+)$/.exec(arg);
    if (!m) return null;
    const [, key, value] = m as unknown as [string, string, string];
    if (key === 'underground') {
      if (value !== 'true' && value !== 'false') return null;
      opts.underground = value === 'true';
    } else if ((NUMERIC_OPTIONS as readonly string[]).includes(key) && Number.isFinite(Number(value))) {
      opts[key as (typeof NUMERIC_OPTIONS)[number]] = Number(value);
    } else return null;
  }
  return opts;
}

async function main(): Promise<void> {
  const id = process.argv[2];
  const seed = Number(process.argv[3]);
  const extra = parseOptions(process.argv.slice(4));
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !Number.isInteger(seed) || !extra) {
    console.error(
      `usage: pnpm map:gen <id-en-kebab-case> <seed-entier> [--${NUMERIC_OPTIONS.join('=… --')}=… --underground=true|false]`,
    );
    process.exit(2);
  }

  const report = await loadContent(readJsonFromDisk);
  const units = knownUnitIds(report);
  const map = generateMap(id, seed, {
    ...standardMapOptions(report, { hasUnitArt, hasTownArt: (factionId) => hasAsset(`map/town-${factionId}`) }),
    ...extra,
  });

  // Validation par le même `loadMap` que les cartes du dépôt (shim en mémoire).
  const readJson: ReadJson = (path) =>
    path === `maps/${id}.map.json` ? Promise.resolve(map) : readJsonFromDisk(path);
  await loadMap(readJson, id, report.content.config, units, knownArtifactIds(report));

  const rel = join('maps', `${id}.map.json`);
  await writeFile(join(DATA_DIR, rel), `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  console.log(
    `✓ carte '${id}' (seed ${seed}) — ${map.width}×${map.height}, ${map.objects.length} objet(s) → data/${rel}`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
