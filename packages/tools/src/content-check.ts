import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { knownUnitIds, loadContent, loadMap, PackError } from '@heroes/content';
import { DATA_DIR, readJsonFromDisk } from './data-dir';

const report = await loadContent(readJsonFromDisk);

for (const pack of report.content.packs) {
  console.log(`✓ ${pack.manifest.id} — ${pack.units.length} unité(s), locales fr/en OK`);
}
for (const rejected of report.rejected) {
  console.error(`✗ ${rejected.id}`);
  for (const err of rejected.errors) console.error(`    ${err}`);
}

// Cartes : tout data/maps/*.map.json est validé contre la config (doc 02 §2.1).
const mapFiles = (await readdir(join(DATA_DIR, 'maps'))).filter((f) => f.endsWith('.map.json'));
let badMaps = 0;
for (const file of mapFiles.sort()) {
  const id = file.slice(0, -'.map.json'.length);
  try {
    const map = await loadMap(readJsonFromDisk, id, report.content.config, knownUnitIds(report));
    console.log(`✓ carte ${id} — ${map.width}×${map.height}, ${map.objects.length} objet(s)`);
  } catch (e) {
    badMaps += 1;
    console.error(`✗ carte ${id}`);
    const errors = e instanceof PackError ? e.errors : [String(e)];
    for (const err of errors) console.error(`    ${err}`);
  }
}
if (!mapFiles.includes(`${report.content.config.newGame.map}.map.json`)) {
  badMaps += 1;
  console.error(`✗ config.json: carte par défaut introuvable '${report.content.config.newGame.map}'`);
}

if (report.rejected.length > 0 || badMaps > 0) {
  console.error(
    `\ncontent:check — ${report.rejected.length} paquet(s) et ${badMaps} carte(s) invalide(s).`,
  );
  process.exit(1);
}
console.log(
  `\ncontent:check — ${report.content.packs.length} paquet(s) et ${mapFiles.length} carte(s) valides.`,
);
