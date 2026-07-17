import {
  generateMap,
  knownArtifactIds,
  knownUnitIds,
  knownUnitTiers,
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
  } = {},
): Promise<ResolvedMap> {
  const config = report.content.config;
  const units = knownUnitIds(report);
  // Palette de gardiens : uniquement les unités qui ONT un sprite peint — un
  // gardien tiré d'une unité sans art resterait le fanion gris de repli pour
  // toujours (plan map-design-issues P1 : factions de test/beta sans art). Repli
  // sur toutes les unités si AUCUN art n'est présent (build sans assets :
  // mieux vaut des gardiens procéduraux que pas de gardiens du tout).
  const painted = report.content.packs.flatMap((p) =>
    p.units.filter((u) => unitSpriteUrl(u.id, p.manifest.id) !== undefined).map((u) => u.id),
  );
  // Villes neutres : factions dont le château de carte est peint (même logique
  // que la palette de gardiens — pas de donjon gris anonyme sur une carte
  // aléatoire). Les factions de test sans château peint en sont écartées.
  const townFactions = report.content.packs
    .map((p) => p.manifest.id)
    .filter((id) => townMapUrl(id) !== undefined);
  const generated = generateMap('random', seed, {
    guardianUnits: painted.length > 0 ? painted : [...units],
    unitTiers: knownUnitTiers(report),
    artifactIds: [...knownArtifactIds(report)],
    // Rareté graduée en profondeur (doc 18 C2, lot 3.2) : commun près du départ,
    // rare au fond — lue depuis le catalogue core (défaut 1 si absente).
    artifactRarity: Object.fromEntries(
      report.content.coreArtifacts.map((a) => [a.id, a.rarity ?? 1]),
    ),
    townFactionIds: townFactions,
    ...opts,
  });
  const readJson: ReadJson = (path) =>
    path === 'maps/random.map.json' ? Promise.resolve(generated) : readJsonFromSite(path);
  return loadMap(readJson, 'random', config, ...mapKnownIds(report));
}
