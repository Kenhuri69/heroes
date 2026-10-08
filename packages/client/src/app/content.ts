import {
  generateMap,
  knownArtifactIds,
  knownUnitIds,
  standardMapOptions,
  loadContent,
  loadMap,
  loadScenarios,
  loadCampaigns,
  type LoadReport,
  type ReadJson,
  type ResolvedMap,
  type Scenario,
} from '@heroes/content';
import { townMapUrl, unitSpriteUrl } from '../render/assets';

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

/**
 * Ensembles d'ids connus passés à `loadMap` pour ses règles croisées (B47/B48) :
 * unités, artefacts, sorts, compétences, machines de guerre — les mêmes que
 * `content:check` (un typo de carte casse en CI, pas au boot).
 */
function mapKnownIds(
  report: LoadReport,
): [ReadonlySet<string>, ReadonlySet<string>, ReadonlySet<string>, ReadonlySet<string>, ReadonlySet<string>] {
  return [
    knownUnitIds(report),
    knownArtifactIds(report),
    new Set(report.content.coreSpells.map((s) => s.id)),
    new Set(report.content.coreSkills.map((s) => s.id)),
    new Set(report.content.coreWarMachines.map((w) => w.id)),
  ];
}

/** Charge la carte par défaut de la config, validée contre elle (doc 02 §2.1). */
export async function loadDefaultMap(report: LoadReport): Promise<ResolvedMap> {
  const config = report.content.config;
  return loadMap(readJsonFromSite, config.newGame.map, config, ...mapKnownIds(report));
}

/** Charge la carte d'un scénario (même chemin de résolution que `loadDefaultMap`). */
export async function loadScenarioMap(report: LoadReport, scenario: Scenario): Promise<ResolvedMap> {
  const config = report.content.config;
  return loadMap(readJsonFromSite, scenario.map, config, ...mapKnownIds(report));
}

/**
 * Carte aléatoire (doc 09, Live 6.2) : générée déterministiquement depuis `seed`
 * (`generateMap`), puis résolue **par le même `loadMap`** que les cartes du dépôt
 * — un shim `readJson` sert la carte en mémoire, TOUTE la validation croisée
 * (schéma, franchissabilité, unités des gardiens) s'applique donc sans détour.
 */
export async function resolveGeneratedMap(
  report: LoadReport,
  seed: number,
  /**
   * Options de génération (« Nouvelle partie », doc 09) : taille de carte,
   * nombre de positions de départ (= nombre de joueurs), densité de ressources
   * globale (bas/riche) et densités PAR CATÉGORIE (gardiens / mines / bâtiments
   * événement / objets à ramasser). Absentes ⇒ défauts de `generateMap` (24×24,
   * 2 départs, densité standard) — l'escarmouche 2 joueurs reste inchangée.
   */
  opts: {
    width?: number;
    height?: number;
    startPositionCount?: number;
    resourceMultiplier?: number;
    guardianDensity?: number;
    mineDensity?: number;
    eventBuildingDensity?: number;
    pickupDensity?: number;
    /** Souterrain (L10.5) : seconde couche + escaliers. Défaut : carte plate. */
    underground?: boolean;
  } = {},
): Promise<ResolvedMap> {
  const config = report.content.config;
  // Options communes au client et à la CLI `map:gen` (lot LE8) : à graine égale,
  // même carte. Le client juge « peint » d'après son registre d'assets.
  const generated = generateMap('random', seed, {
    ...standardMapOptions(report, {
      hasUnitArt: (unitId, factionId) => unitSpriteUrl(unitId, factionId) !== undefined,
      hasTownArt: (factionId) => townMapUrl(factionId) !== undefined,
    }),
    ...opts,
  });
  const readJson: ReadJson = (path) =>
    path === 'maps/random.map.json' ? Promise.resolve(generated) : readJsonFromSite(path);
  return loadMap(readJson, 'random', config, ...mapKnownIds(report));
}
