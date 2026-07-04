import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildArtifactCatalog,
  buildBuildingCatalog,
  buildSkillCatalog,
  buildSpellCatalog,
  knownUnitIds,
  loadContent,
  loadMap,
  PackError,
} from '@heroes/content';
import { DATA_DIR, readJsonFromDisk } from './data-dir';

const report = await loadContent(readJsonFromDisk);

for (const pack of report.content.packs) {
  console.log(`✓ ${pack.manifest.id} — ${pack.units.length} unité(s), locales fr/en OK`);
}
for (const rejected of report.rejected) {
  console.error(`✗ ${rejected.id}`);
  for (const err of rejected.errors) console.error(`    ${err}`);
}

// Arbre de bâtiments : agrège core + paquets valides, détecte les collisions d'id.
let badBuildingCatalog = false;
try {
  const catalog = buildBuildingCatalog(report);
  console.log(`✓ arbre de bâtiments — ${Object.keys(catalog).length} bâtiment(s) résolu(s)`);
} catch (e) {
  badBuildingCatalog = true;
  console.error(`✗ arbre de bâtiments`);
  const errors = e instanceof PackError ? e.errors : [String(e)];
  for (const err of errors) console.error(`    ${err}`);
}

// Sorts / compétences / artefacts : catalogues core (plan phase-3.2 lot L).
let badSpellCatalog = false;
try {
  const catalog = buildSpellCatalog(report);
  console.log(`✓ catalogue de sorts — ${Object.keys(catalog).length} sort(s) résolu(s)`);
} catch (e) {
  badSpellCatalog = true;
  console.error(`✗ catalogue de sorts`);
  const errors = e instanceof PackError ? e.errors : [String(e)];
  for (const err of errors) console.error(`    ${err}`);
}

let badSkillCatalog = false;
try {
  const catalog = buildSkillCatalog(report);
  console.log(`✓ catalogue de compétences — ${Object.keys(catalog).length} compétence(s) résolue(s)`);
} catch (e) {
  badSkillCatalog = true;
  console.error(`✗ catalogue de compétences`);
  const errors = e instanceof PackError ? e.errors : [String(e)];
  for (const err of errors) console.error(`    ${err}`);
}

let badArtifactCatalog = false;
try {
  const catalog = buildArtifactCatalog(report);
  console.log(`✓ catalogue d'artefacts — ${Object.keys(catalog).length} artefact(s) résolu(s)`);
} catch (e) {
  badArtifactCatalog = true;
  console.error(`✗ catalogue d'artefacts`);
  const errors = e instanceof PackError ? e.errors : [String(e)];
  for (const err of errors) console.error(`    ${err}`);
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

if (
  report.rejected.length > 0 ||
  badMaps > 0 ||
  badBuildingCatalog ||
  badSpellCatalog ||
  badSkillCatalog ||
  badArtifactCatalog
) {
  console.error(
    `\ncontent:check — ${report.rejected.length} paquet(s), ${badMaps} carte(s)` +
      `${badBuildingCatalog ? ' et un arbre de bâtiments' : ''}` +
      `${badSpellCatalog ? ' et un catalogue de sorts' : ''}` +
      `${badSkillCatalog ? ' et un catalogue de compétences' : ''}` +
      `${badArtifactCatalog ? " et un catalogue d'artefacts" : ''}` +
      ' invalide(s).',
  );
  process.exit(1);
}
console.log(
  `\ncontent:check — ${report.content.packs.length} paquet(s) et ${mapFiles.length} carte(s) valides.`,
);
