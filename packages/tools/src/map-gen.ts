import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  generateMap,
  knownArtifactIds,
  knownUnitIds,
  knownUnitTiers,
  loadContent,
  loadMap,
  type ReadJson,
} from '@heroes/content';
import { DATA_DIR, readJsonFromDisk } from './data-dir';

/**
 * `pnpm map:gen <id> <seed>` (doc 09, Live 6.2) : génère une carte aléatoire
 * DÉTERMINISTE (`generateMap`), la **valide par le vrai `loadMap`** (schéma +
 * règles croisées, avec les unités connues du contenu chargé) puis l'écrit dans
 * `data/maps/<id>.map.json`. Jamais d'export invalide.
 */
async function main(): Promise<void> {
  const id = process.argv[2];
  const seed = Number(process.argv[3]);
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !Number.isInteger(seed)) {
    console.error('usage: pnpm map:gen <id-en-kebab-case> <seed-entier>');
    process.exit(2);
  }

  const report = await loadContent(readJsonFromDisk);
  const units = knownUnitIds(report);
  const map = generateMap(id, seed, {
    guardianUnits: [...units],
    unitTiers: knownUnitTiers(report),
    artifactIds: [...knownArtifactIds(report)],
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
