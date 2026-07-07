import {
  generateMap,
  knownArtifactIds,
  knownUnitIds,
  loadContent,
  loadMap,
  loadScenarios,
  loadCampaigns,
  type LoadReport,
  type ReadJson,
  type ResolvedMap,
  type Scenario,
} from '@heroes/content';

/** Lecteur navigateur : data/ est copié à la racine du site par Vite (publicDir). */
const readJsonFromSite: ReadJson = async (path) => {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!res.ok) throw new Error(`fichier introuvable: ${path} (HTTP ${res.status})`);
  return (await res.json()) as unknown;
};

/**
 * Charge tout le contenu au démarrage : paquets de faction puis scénarios
 * (plan phase-3.5, lot U — `loadScenarios` a besoin des paquets/unités/
 * bâtiments déjà chargés pour ses règles croisées). Un paquet ou un scénario
 * invalide est rejeté avec un rapport en console.error (jamais de crash —
 * doc 06 §1) ; le smoke test échoue donc si le contenu du dépôt casse.
 */
export async function loadGameContent(): Promise<LoadReport> {
  let report = await loadContent(readJsonFromSite);
  report = await loadScenarios(readJsonFromSite, report);
  report = await loadCampaigns(readJsonFromSite, report);
  for (const rejected of report.rejected) {
    console.error(`paquet de faction rejeté : ${rejected.id}\n${rejected.errors.join('\n')}`);
  }
  for (const rejected of report.rejectedScenarios) {
    console.error(`scénario rejeté : ${rejected.id}\n${rejected.errors.join('\n')}`);
  }
  for (const rejected of report.rejectedCampaigns) {
    console.error(`campagne rejetée : ${rejected.id}\n${rejected.errors.join('\n')}`);
  }
  return report;
}

/** Charge la carte par défaut de la config, validée contre elle (doc 02 §2.1). */
export async function loadDefaultMap(report: LoadReport): Promise<ResolvedMap> {
  const config = report.content.config;
  return loadMap(readJsonFromSite, config.newGame.map, config, knownUnitIds(report), knownArtifactIds(report));
}

/** Charge la carte d'un scénario (même chemin de résolution que `loadDefaultMap`). */
export async function loadScenarioMap(report: LoadReport, scenario: Scenario): Promise<ResolvedMap> {
  const config = report.content.config;
  return loadMap(readJsonFromSite, scenario.map, config, knownUnitIds(report), knownArtifactIds(report));
}

/**
 * Carte aléatoire (doc 09, Live 6.2) : générée déterministiquement depuis `seed`
 * (`generateMap`), puis résolue **par le même `loadMap`** que les cartes du dépôt
 * — un shim `readJson` sert la carte en mémoire, TOUTE la validation croisée
 * (schéma, franchissabilité, unités des gardiens) s'applique donc sans détour.
 */
export async function resolveGeneratedMap(report: LoadReport, seed: number): Promise<ResolvedMap> {
  const config = report.content.config;
  const units = knownUnitIds(report);
  const generated = generateMap('random', seed, { guardianUnits: [...units] });
  const readJson: ReadJson = (path) =>
    path === 'maps/random.map.json' ? Promise.resolve(generated) : readJsonFromSite(path);
  return loadMap(readJson, 'random', config, units, knownArtifactIds(report));
}
