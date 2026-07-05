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
  loadScenarios,
  PackError,
} from '@heroes/content';
import { DATA_DIR, readJsonFromDisk } from './data-dir';

const report = await loadContent(readJsonFromDisk);

for (const pack of report.content.packs) {
  const bonusSuffix =
    pack.manifest.factionBonuses.length > 0
      ? `, ${pack.manifest.factionBonuses.length} effet(s) de faction`
      : '';
  console.log(`✓ ${pack.manifest.id} — ${pack.units.length} unité(s), locales fr/en OK${bonusSuffix}`);
}
for (const rejected of report.rejected) {
  console.error(`✗ ${rejected.id}`);
  for (const err of rejected.errors) console.error(`    ${err}`);
}
// Erreurs de `config.newGame` (armée/artefacts/ville de départ) — rapportées et
// non bloquantes au boot (remédiation CO9), mais échec de `content:check` (CI).
for (const err of report.configErrors) console.error(`✗ config.newGame — ${err}`);

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

// Scénarios : data/scenarios/index.json + data/scenarios/<id>.scenario.json (plan phase-3.5).
let badScenarios = false;
let scenarioCount = 0;
try {
  const scenarioReport = await loadScenarios(readJsonFromDisk, report);
  scenarioCount = scenarioReport.content.scenarios.length;
  for (const scenario of scenarioReport.content.scenarios) {
    console.log(`✓ scénario ${scenario.id} — ${scenario.players.length} joueur(s)`);
  }
  for (const rejected of scenarioReport.rejectedScenarios) {
    badScenarios = true;
    console.error(`✗ scénario ${rejected.id}`);
    for (const err of rejected.errors) console.error(`    ${err}`);
  }
} catch (e) {
  badScenarios = true;
  console.error(`✗ scénarios`);
  const errors = e instanceof PackError ? e.errors : [String(e)];
  for (const err of errors) console.error(`    ${err}`);
}

if (
  report.rejected.length > 0 ||
  report.configErrors.length > 0 ||
  badMaps > 0 ||
  badBuildingCatalog ||
  badSpellCatalog ||
  badSkillCatalog ||
  badArtifactCatalog ||
  badScenarios
) {
  console.error(
    `\ncontent:check — ${report.rejected.length} paquet(s), ${badMaps} carte(s)` +
      `${report.configErrors.length > 0 ? ` et ${report.configErrors.length} erreur(s) config.newGame` : ''}` +
      `${badBuildingCatalog ? ' et un arbre de bâtiments' : ''}` +
      `${badSpellCatalog ? ' et un catalogue de sorts' : ''}` +
      `${badSkillCatalog ? ' et un catalogue de compétences' : ''}` +
      `${badArtifactCatalog ? " et un catalogue d'artefacts" : ''}` +
      `${badScenarios ? ' et des scénarios' : ''}` +
      ' invalide(s).',
  );
  process.exit(1);
}
console.log(
  `\ncontent:check — ${report.content.packs.length} paquet(s), ${mapFiles.length} carte(s) et ` +
    `${scenarioCount} scénario(s) valides.`,
);
