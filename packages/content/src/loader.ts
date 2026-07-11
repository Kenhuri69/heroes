import { z } from 'zod';
import {
  abilityCatalogSchema,
  artifactCatalogSchema,
  buildingCatalogSchema,
  COMMON_RESOURCE_IDS,
  factionIndexSchema,
  gameConfigSchema,
  localeSchema,
  manifestSchema,
  mapFileSchema,
  campaignSchema,
  scenarioIndexSchema,
  scenarioSchema,
  skillCatalogSchema,
  spellCatalogSchema,
  unitSchema,
  heroIdentitySchema,
  warMachineCatalogSchema,
  dailyTemplatesFileSchema,
  type AbilityCatalog,
  type Artifact,
  type DailyTemplate,
  type HeroIdentity,
  type WarMachine,
  type Building,
  type FactionBonus,
  type HouseEffect,
  type GameConfig,
  type Locale,
  type Manifest,
  type MapFile,
  type Campaign,
  type Scenario,
  type ScenarioObjectives,
  type ResolvedArtifact,
  type ResolvedBuilding,
  type ResolvedSkill,
  type ResolvedSpell,
  type Skill,
  type Spell,
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
  /** Bâtiments propres au paquet (dwellings + spéciaux) — vide si pas de `manifest.town`. */
  buildings: Building[];
  /**
   * Héros nommés (doc 16 État 16.9) — identité data-driven, séparable par
   * `origin` (`canon` = univers tiers / `original` = création propre). Vide si
   * le manifeste ne déclare aucun héros. Non consommé par le moteur (staging).
   */
  heroes: HeroIdentity[];
}

export interface LoadedContent {
  abilityCatalog: AbilityCatalog;
  config: GameConfig;
  /** Locales de l'UI générique (menu, options, toasts) — data/core/locales/. */
  coreLocales: Record<(typeof LOCALE_LANGS)[number], Locale>;
  /** Bâtiments communs à toutes les villes — data/core/buildings.json (doc 02 §4.1). */
  coreBuildings: Building[];
  /** Sorts communs (4 écoles + neutre) — data/core/spells.json (doc 02 §1.4, plan phase-3.2). */
  coreSpells: Spell[];
  /** Compétences secondaires du pool commun — data/core/skills.json (doc 02 §1.3). */
  coreSkills: Skill[];
  /** Artefacts communs — data/core/artifacts.json (doc 02 §1.1, plan phase-3.2). */
  coreArtifacts: Artifact[];
  /** Machines de guerre communes — data/core/war-machines.json (doc 02 §5, Alpha 4.12). */
  coreWarMachines: WarMachine[];
  /** Gabarits de quêtes journalières du mode libre — data/core/daily-templates.json (doc 13, N4c). */
  dailyTemplates: DailyTemplate[];
  packs: FactionPack[];
  /**
   * Scénarios solo résolus — data/scenarios/ (plan phase-3.5, lot T). Vide tant
   * que `loadScenarios` n'a pas été appelé sur ce rapport : une étape
   * distincte de `loadContent`, car elle a besoin du contenu déjà chargé
   * (factions, unités, bâtiments) pour résoudre ses propres règles croisées.
   */
  scenarios: Scenario[];
  /**
   * Campagnes résolues — data/factions/<id>/story/ (doc 13, N3a). Vide tant que
   * `loadCampaigns` n'a pas été appelé (étape distincte, après les scénarios).
   */
  campaigns: Campaign[];
}

export interface LoadReport {
  content: LoadedContent;
  /** Paquets rejetés — jamais de crash en jeu, un rapport précis (doc 06 §1). */
  rejected: { id: string; errors: string[] }[];
  /** Scénarios rejetés (plan phase-3.5) — même forme que `rejected`. */
  rejectedScenarios: { id: string; errors: string[] }[];
  /** Campagnes rejetées (doc 13, N3a) — même forme que `rejected`. */
  rejectedCampaigns: { id: string; errors: string[] }[];
  /**
   * Erreurs des règles croisées de `config.newGame` (armée/artefacts/ville de
   * départ) — rapportées, PAS levées (remédiation R5 CO9) : une régression dans
   * un seul paquet (rejeté gracieusement) ne doit pas casser tout le boot. La
   * partie « Nouvelle partie » échouera proprement à la validation moteur ; le
   * menu et le contenu valide restent chargeables. `content:check` les signale.
   */
  configErrors: string[];
}

/** Charge et valide tout le contenu déclaré dans data/factions/index.json. */
export async function loadContent(readJson: ReadJson): Promise<LoadReport> {
  const catalog = abilityCatalogSchema.parse(await readJson('core/abilities.json'));
  const config = parseFile(gameConfigSchema, await readJson('core/config.json'), 'config.json');
  const index = factionIndexSchema.parse(await readJson('factions/index.json'));
  const coreLocales = {} as LoadedContent['coreLocales'];
  for (const lang of LOCALE_LANGS) {
    const path = `core/locales/${lang}.json`;
    coreLocales[lang] = parseFile(localeSchema, await readJson(path), path);
  }
  const coreBuildingsFile = parseFile(
    buildingCatalogSchema,
    await readJson('core/buildings.json'),
    'core/buildings.json',
  );
  const coreBuildings = coreBuildingsFile.buildings;
  {
    // Bâtiments communs : erreur bloquante directe (comme config/abilities), pas de rejet partiel.
    const errors: string[] = [];
    checkUniqueBuildingIds(errors, 'core/buildings.json', coreBuildings.map((b) => b.id));
    checkBuildingRequires(
      errors,
      'core/buildings.json',
      coreBuildings,
      new Map(coreBuildings.map((b) => [b.id, b.maxLevel])),
    );
    if (errors.length > 0) throw new PackError(errors);
  }
  const coreSpells = parseFile(
    spellCatalogSchema,
    await readJson('core/spells.json'),
    'core/spells.json',
  ).spells;
  const coreSkills = parseFile(
    skillCatalogSchema,
    await readJson('core/skills.json'),
    'core/skills.json',
  ).skills;
  const coreArtifacts = parseFile(
    artifactCatalogSchema,
    await readJson('core/artifacts.json'),
    'core/artifacts.json',
  ).artifacts;
  const coreWarMachines = parseFile(
    warMachineCatalogSchema,
    await readJson('core/war-machines.json'),
    'core/war-machines.json',
  ).warMachines;
  const dailyTemplates = parseFile(
    dailyTemplatesFileSchema,
    await readJson('core/daily-templates.json'),
    'core/daily-templates.json',
  ).templates;
  {
    // Sorts/compétences/artefacts/machines communs : erreur bloquante directe (comme bâtiments), pas de rejet partiel.
    const errors: string[] = [];
    checkUniqueIds(errors, 'core/spells.json', coreSpells.map((s) => s.id), 'sort');
    checkUniqueIds(errors, 'core/skills.json', coreSkills.map((s) => s.id), 'compétence');
    checkUniqueIds(errors, 'core/artifacts.json', coreArtifacts.map((a) => a.id), 'artefact');
    checkUniqueIds(errors, 'core/war-machines.json', coreWarMachines.map((w) => w.id), 'machine de guerre');
    checkUniqueIds(errors, 'core/daily-templates.json', dailyTemplates.map((tpl) => tpl.id), 'gabarit journalier');
    if (errors.length > 0) throw new PackError(errors);
  }
  const report: LoadReport = {
    content: {
      abilityCatalog: catalog,
      config,
      coreLocales,
      coreBuildings,
      coreSpells,
      coreSkills,
      coreArtifacts,
      coreWarMachines,
      dailyTemplates,
      packs: [],
      scenarios: [],
      campaigns: [],
    },
    rejected: [],
    rejectedScenarios: [],
    rejectedCampaigns: [],
    configErrors: [],
  };
  for (const id of index.factions) {
    try {
      report.content.packs.push(
        await loadFactionPack(readJson, id, catalog, coreBuildings, coreSpells, coreSkills),
      );
    } catch (e) {
      report.rejected.push({ id, errors: describeError(e) });
    }
  }
  // Règle croisée (remédiation R5 CO2) : unicité GLOBALE des ids d'unités entre
  // paquets acceptés — sinon la fusion des catalogues (client `buildUnitCatalog`)
  // et des locales écrase silencieusement l'une des définitions (même classe de
  // bug que la collision de nom de faction corrigée en 3.7).
  {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const pack of report.content.packs) {
      for (const unit of pack.units) {
        if (seen.has(unit.id)) duplicates.add(unit.id);
        seen.add(unit.id);
      }
    }
    if (duplicates.size > 0)
      throw new PackError(
        [...duplicates].map(
          (uid) =>
            `unité '${uid}' définie dans plusieurs paquets — les ids d'unités doivent être globalement uniques`,
        ),
      );
  }
  // Règle croisée (remédiation R5 CO3) : le terrain natif d'un paquet doit
  // exister dans la config — sinon le bonus de terrain natif (vitesse/moral,
  // doc 02 §5.1/§5.3) est mort, aucune tuile ne pouvant jamais correspondre.
  {
    const errors: string[] = [];
    for (const pack of report.content.packs) {
      const nt = pack.manifest.nativeTerrain;
      if (!(nt in config.adventure.terrains))
        errors.push(
          `factions/${pack.manifest.id}/manifest.json: nativeTerrain '${nt}' inconnu de config.terrains`,
        );
    }
    if (errors.length > 0) throw new PackError(errors);
  }
  // Règles croisées de `config.newGame` (remédiation R5 CO9) : RAPPORTÉES, pas
  // levées — une régression dans un seul paquet rejeté ne casse pas tout le boot.
  const known = knownUnitIds(report);
  for (const stack of config.newGame.startingArmy) {
    if (!known.has(stack.unitId))
      report.configErrors.push(
        `config.json: newGame.startingArmy — unité inconnue des paquets '${stack.unitId}'`,
      );
  }
  const knownArtifacts = new Set(coreArtifacts.map((a) => a.id));
  for (const artifactId of config.newGame.startingArtifacts ?? []) {
    if (!knownArtifacts.has(artifactId))
      report.configErrors.push(
        `config.json: newGame.startingArtifacts — artefact inconnu '${artifactId}'`,
      );
  }
  // La ville de départ résout (faction connue, bâtiments/niveaux valides) — même
  // dégradation : un échec est rapporté, pas propagé au boot.
  try {
    resolveStartingTowns(config, report);
  } catch (e) {
    report.configErrors.push(...describeError(e));
  }
  return report;
}

/**
 * Remédiation R4 (CO5) : tout sort / compétence / artefact chargé doit avoir
 * une clé de nom `<prefix>.<id>` dans les DEUX locales core (fr + en) — sinon
 * l'UI affiche l'id brut (« trait-de-feu », « logistics »…). Retourne la liste
 * des clés manquantes (vide = OK). Enforced par `content:check`.
 */
export function checkCoreNameKeys(report: LoadReport): string[] {
  const errors: string[] = [];
  const { fr, en } = report.content.coreLocales;
  const check = (prefix: string, ids: string[]): void => {
    for (const id of ids) {
      const key = `${prefix}.${id}`;
      if (!(key in fr)) errors.push(`core/locales/fr.json: clé de nom manquante '${key}'`);
      if (!(key in en)) errors.push(`core/locales/en.json: clé de nom manquante '${key}'`);
    }
  };
  check('spell', report.content.coreSpells.map((s) => s.id));
  check('skill', report.content.coreSkills.map((s) => s.id));
  check('artifact', report.content.coreArtifacts.map((a) => a.id));
  // R4b (CO6) : bâtiments COMMUNS (townHall/fort/guilde…) — nommés au niveau core.
  check('building', report.content.coreBuildings.map((b) => b.id));
  return errors;
}

/**
 * Remédiation R4b (CO6/CO7) : les noms de bâtiments de faction (dwellings,
 * Cercles) et de ressources de faction vivent dans les locales de PAQUET (doc
 * 06 : le core ne connaît aucune faction). Exige `building.<id>` et
 * `factionResource.<id>` en fr + en pour chaque paquet chargé.
 */
export function checkPackNameKeys(report: LoadReport): string[] {
  const errors: string[] = [];
  for (const pack of report.content.packs) {
    const { fr, en } = pack.locales;
    const need = (key: string): void => {
      if (!(key in fr)) errors.push(`factions/${pack.manifest.id}/locales/fr.json: clé de nom manquante '${key}'`);
      if (!(key in en)) errors.push(`factions/${pack.manifest.id}/locales/en.json: clé de nom manquante '${key}'`);
    };
    for (const b of pack.buildings) need(`building.${b.id}`);
    for (const r of pack.manifest.factionResources) need(`factionResource.${r.id}`);
    // Maisons (doc 16 §3.1) : le nom localisé (`house.name`, un `@loc:…`) doit
    // résoudre dans les deux locales du paquet.
    for (const h of pack.manifest.houses) {
      const key = h.name.startsWith('@loc:') ? h.name.slice('@loc:'.length) : h.name;
      need(key);
    }
  }
  return errors;
}

/**
 * Lot N1 (doc 13 §3.5) : les textes d'ambiance (`*.lore`) sont optionnels, mais
 * s'ils existent ils doivent être en **parité fr/en** (un seul côté = régression
 * i18n). En prime, le champ `loreKey` d'une unité, s'il est posé, doit résoudre
 * dans les DEUX locales du paquet. Retourne la liste des manques (vide = OK).
 */
export function checkLoreParity(report: LoadReport): string[] {
  const errors: string[] = [];
  const parity = (label: string, fr: Record<string, string>, en: Record<string, string>): void => {
    for (const k of Object.keys(fr))
      if (k.endsWith('.lore') && !(k in en)) errors.push(`${label}/en.json: texte d'ambiance manquant '${k}'`);
    for (const k of Object.keys(en))
      if (k.endsWith('.lore') && !(k in fr)) errors.push(`${label}/fr.json: texte d'ambiance manquant '${k}'`);
  };
  parity('core/locales', report.content.coreLocales.fr, report.content.coreLocales.en);
  for (const pack of report.content.packs) {
    parity(`factions/${pack.manifest.id}/locales`, pack.locales.fr, pack.locales.en);
    for (const u of pack.units) {
      if (!u.loreKey) continue;
      const key = u.loreKey.startsWith('@loc:') ? u.loreKey.slice('@loc:'.length) : u.loreKey;
      if (!(key in pack.locales.fr))
        errors.push(`factions/${pack.manifest.id}/locales/fr.json: loreKey de '${u.id}' introuvable '${key}'`);
      if (!(key in pack.locales.en))
        errors.push(`factions/${pack.manifest.id}/locales/en.json: loreKey de '${u.id}' introuvable '${key}'`);
    }
  }
  return errors;
}

/** IDs d'unités de tous les paquets valides — pour les règles croisées (armée, gardiens). */
export function knownUnitIds(report: LoadReport): Set<string> {
  return new Set(report.content.packs.flatMap((p) => p.units.map((u) => u.id)));
}

/** Table id → tier des unités connues — pour graduer la force des gardiens générés. */
export function knownUnitTiers(report: LoadReport): Record<string, number> {
  const tiers: Record<string, number> = {};
  for (const p of report.content.packs) for (const u of p.units) tiers[u.id] = u.tier;
  return tiers;
}

/** IDs d'artefacts communs — pour la règle croisée des artefacts posés sur une carte. */
export function knownArtifactIds(report: LoadReport): Set<string> {
  return new Set(report.content.coreArtifacts.map((a) => a.id));
}

/** Charge un paquet et applique les règles croisées (doc 06 §5.3). */
export async function loadFactionPack(
  readJson: ReadJson,
  id: string,
  catalog: AbilityCatalog,
  /** Bâtiments communs (data/core/buildings.json) — résolus par `manifest.town.buildings`. */
  coreBuildings: Building[] = [],
  /** Sorts communs (data/core/spells.json) — cross-validation de `grantSpell.spellId` + roster. */
  coreSpells: Spell[] = [],
  /** Compétences communes (data/core/skills.json) — cross-validation des `startingSkills` du roster. */
  coreSkills: Skill[] = [],
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

  // Effets de faction (plan phase-3.4) : unitId doit exister dans le paquet et
  // porter la capacité requise par l'effet (ex. `undead` pour la relève).
  for (const bonus of manifest.factionBonuses) {
    if (bonus.type === 'raiseUndeadOnVictory') {
      const unit = units.find((u) => u.id === bonus.unitId);
      if (!unit) {
        errors.push(
          `manifest.json: factionBonuses(raiseUndeadOnVictory) — unité inconnue '${bonus.unitId}'`,
        );
      } else if (!unit.abilities.some((a) => a.id === 'undead')) {
        errors.push(
          `manifest.json: factionBonuses(raiseUndeadOnVictory) — unité '${bonus.unitId}' sans capacité 'undead'`,
        );
      }
    } else if (bonus.type === 'gainFactionResourceOnVictory') {
      if (!manifest.factionResources.some((r) => r.id === bonus.resource)) {
        errors.push(
          `manifest.json: factionBonuses(gainFactionResourceOnVictory) — ressource inconnue '${bonus.resource}' (absente de factionResources)`,
        );
      }
    }
  }

  // Héros nommés (doc 16 État 16.9) — identité data-driven, convention
  // `heroes/<id>.json`. L'identité (avatar/bio) est staging ; les champs
  // GAMEPLAY optionnels (H-NAMED.1 : attributs/spécialité/compétences/sorts) sont
  // consommés par le moteur (`buildHeroRoster` → StartGame). Règles croisées ici.
  const heroes: HeroIdentity[] = [];
  const houseIds = new Set(manifest.houses.map((h) => h.id));
  const knownSkillIds = new Set([...coreSkills.map((s) => s.id), ...manifest.heroSkills]);
  const rosterSpellIds = new Set(coreSpells.map((s) => s.id));
  for (const heroId of manifest.heroes) {
    const path = `heroes/${heroId}.json`;
    const hero = parseFile(heroIdentitySchema, await readJson(`${base}/${path}`), path);
    if (hero.id !== heroId) errors.push(`${path}: id '${hero.id}' ≠ fichier '${heroId}'`);
    if (hero.startingHouseId && !houseIds.has(hero.startingHouseId))
      errors.push(`${path}: startingHouseId — Maison inconnue '${hero.startingHouseId}'`);
    // Gameplay (H-NAMED.1) : compétences/sorts de départ validés vs les catalogues.
    for (const skillId of Object.keys(hero.startingSkills))
      if (!knownSkillIds.has(skillId))
        errors.push(`${path}: compétence de départ inconnue '${skillId}'`);
    for (const spellId of hero.startingSpells)
      if (!rosterSpellIds.has(spellId)) errors.push(`${path}: sort de départ inconnu '${spellId}'`);
    heroes.push(hero);
  }
  if (new Set(heroes.map((h) => h.id)).size !== heroes.length)
    errors.push('manifest.json: héros en double dans `heroes`');

  const locales = {} as FactionPack['locales'];
  for (const lang of LOCALE_LANGS) {
    const path = `locales/${lang}.json`;
    locales[lang] = parseFile(localeSchema, await readJson(`${base}/${path}`), path);
  }
  for (const key of collectLocRefs({ manifest, units, heroes })) {
    for (const lang of LOCALE_LANGS) {
      if (!(key in locales[lang])) errors.push(`locales/${lang}.json: clé manquante '${key}'`);
    }
  }

  // Ville de faction (doc 02 §4, plan phase-3.1) — bâtiments propres (dwellings/spéciaux).
  const buildings: Building[] = [];
  if (manifest.town) {
    const path = 'buildings.json';
    const file = parseFile(buildingCatalogSchema, await readJson(`${base}/${path}`), path);
    buildings.push(...file.buildings);

    const coreBuildingIds = new Set(coreBuildings.map((b) => b.id));
    const coreSpellIds = new Set(coreSpells.map((s) => s.id));
    const ownIds = buildings.map((b) => b.id);
    checkUniqueBuildingIds(errors, path, ownIds);
    for (const id of ownIds) {
      if (coreBuildingIds.has(id))
        errors.push(`${path}: id de bâtiment '${id}' entre en collision avec un bâtiment commun`);
    }

    const visibleMaxLevel = new Map<string, number>([
      ...coreBuildings.map((b): [string, number] => [b.id, b.maxLevel]),
      ...buildings.map((b): [string, number] => [b.id, b.maxLevel]),
    ]);
    checkBuildingRequires(errors, path, buildings, visibleMaxLevel);
    for (const b of buildings) {
      b.levels.forEach((level, i) => {
        const eff = level.effect;
        if (eff.type === 'dwelling' && !unitIds.has(eff.unitId))
          errors.push(
            `${path}: ${b.id} niveau ${i + 1} — dwelling vers unité inconnue '${eff.unitId}'`,
          );
        // Choix de Maison (doc 16) : la Maison ciblée doit être déclarée au manifeste.
        if (eff.type === 'houseChoice' && !manifest.houses.some((h) => h.id === eff.houseId))
          errors.push(
            `${path}: ${b.id} niveau ${i + 1} — houseChoice vers Maison inconnue '${eff.houseId}'`,
          );
        // Bâtiment enseignant (F-BUILDEFF.3) : le sort enseigné doit exister.
        if (eff.type === 'grantSpell' && !coreSpellIds.has(eff.spellId))
          errors.push(
            `${path}: ${b.id} niveau ${i + 1} — grantSpell vers sort inconnu '${eff.spellId}'`,
          );
      });
    }

    const knownBuildingIds = new Set([...coreBuildingIds, ...ownIds]);
    for (const bId of manifest.town.buildings) {
      if (!knownBuildingIds.has(bId))
        errors.push(`manifest.json: town.buildings — bâtiment inconnu '${bId}'`);
    }
    const byId = new Map(buildings.map((b) => [b.id, b]));
    for (const d of manifest.town.dwellings) {
      if (!unitIds.has(d.unitId))
        errors.push(`manifest.json: town.dwellings — unité inconnue '${d.unitId}'`);
      if (!manifest.town.buildings.includes(d.buildingId))
        errors.push(
          `manifest.json: town.dwellings — bâtiment '${d.buildingId}' absent de town.buildings`,
        );
      const def = byId.get(d.buildingId);
      if (
        def &&
        !def.levels.some(
          (l) => l.effect.type === 'dwelling' && l.effect.tier === d.tier && l.effect.unitId === d.unitId,
        )
      ) {
        errors.push(
          `manifest.json: town.dwellings — '${d.buildingId}' ne définit pas l'effet dwelling(tier=${d.tier}, unitId='${d.unitId}')`,
        );
      }
    }
  }

  if (errors.length > 0) throw new PackError(errors);
  return { manifest, units, locales, buildings, heroes };
}

/** Un `id` de bâtiment ne doit apparaître qu'une fois dans la liste donnée. */
function checkUniqueBuildingIds(errors: string[], path: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${path}: id de bâtiment en double '${id}'`);
    seen.add(id);
  }
}

/** Un `id` (de `noun`) ne doit apparaître qu'une fois dans la liste donnée. */
function checkUniqueIds(errors: string[], path: string, ids: string[], noun: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${path}: id de ${noun} en double '${id}'`);
    seen.add(id);
  }
}

/** Prérequis résolubles vers un bâtiment visible, à un niveau ≤ son maxLevel (doc 02 §4.1). */
function checkBuildingRequires(
  errors: string[],
  path: string,
  buildings: Building[],
  visibleMaxLevel: ReadonlyMap<string, number>,
): void {
  for (const b of buildings) {
    b.levels.forEach((level, i) => {
      for (const req of level.requires) {
        const max = visibleMaxLevel.get(req.building);
        if (max === undefined) {
          errors.push(`${path}: ${b.id} niveau ${i + 1} — prérequis vers bâtiment inconnu '${req.building}'`);
        } else if (req.level > max) {
          errors.push(
            `${path}: ${b.id} niveau ${i + 1} — prérequis '${req.building}' niveau ${req.level} > maxLevel (${max})`,
          );
        }
      }
    });
  }
}

/**
 * Agrège les bâtiments communs (core) et de faction en un catalogue unique,
 * prêt pour `GameState.buildingCatalog` (doc 02 §4.1, plan phase-3.1). `name`
 * (locale) est retiré : hors de la forme `BuildingDef` figée du moteur.
 */
export function buildBuildingCatalog(report: LoadReport): Record<string, ResolvedBuilding> {
  const catalog: Record<string, ResolvedBuilding> = {};
  // `factionId` = origine opaque : id du paquet pour un bâtiment de faction,
  // undefined pour un bâtiment commun (core). Une ville ne peut construire que
  // les bâtiments core + ceux de sa propre faction (`validateBuildStructure`).
  const add = (list: Building[], origin: string, factionId?: string): void => {
    for (const b of list) {
      if (catalog[b.id])
        throw new PackError([`buildBuildingCatalog: id de bâtiment en double '${b.id}' (${origin})`]);
      catalog[b.id] = {
        id: b.id,
        maxLevel: b.maxLevel,
        levels: b.levels,
        ...(b.exclusiveGroup !== undefined ? { exclusiveGroup: b.exclusiveGroup } : {}),
        ...(factionId !== undefined ? { factionId } : {}),
      };
    }
  };
  add(report.content.coreBuildings, 'core');
  for (const pack of report.content.packs) add(pack.buildings, pack.manifest.id, pack.manifest.id);
  return catalog;
}

/**
 * Catalogue des sorts, prêt pour `GameState.spellCatalog` (doc 02 §1.4, plan
 * phase-3.2 lot K). `name` (locale) est retiré : hors de la forme `SpellDef`
 * figée du moteur. Core seul en 3.2 — l'extension par faction (écoles
 * propres, doc 05) rejoindra cet agrégat comme `buildBuildingCatalog`.
 */
export function buildSpellCatalog(report: LoadReport): Record<string, ResolvedSpell> {
  const catalog: Record<string, ResolvedSpell> = {};
  for (const s of report.content.coreSpells) {
    if (catalog[s.id]) throw new PackError([`buildSpellCatalog: id de sort en double '${s.id}'`]);
    catalog[s.id] = {
      id: s.id,
      school: s.school,
      circle: s.circle,
      manaCost: s.manaCost,
      kind: s.kind,
      base: s.base,
      perPower: s.perPower,
      ...(s.attackMod !== undefined && { attackMod: s.attackMod }),
      ...(s.defenseMod !== undefined && { defenseMod: s.defenseMod }),
      ...(s.speedMod !== undefined && { speedMod: s.speedMod }),
      // `marks` (sort applyMarks, doc 05 §6) était perdu ici — le moteur le lit
      // pourtant (`spell.marks ?? 0`) ; propagé désormais, comme `adventure`.
      ...(s.marks !== undefined && { marks: s.marks }),
      // Effet hors combat d'un sort `adventure` (doc 02 §1.4, Alpha 4.16).
      ...(s.adventure !== undefined && { adventure: s.adventure }),
    };
  }
  return catalog;
}

/**
 * Catalogue des compétences secondaires, prêt pour `GameState.skillCatalog`
 * (doc 02 §1.3, plan phase-3.2 lot K). `name` (locale) est retiré : hors de
 * la forme `HeroSkillDef` figée du moteur.
 */
export function buildSkillCatalog(report: LoadReport): Record<string, ResolvedSkill> {
  const catalog: Record<string, ResolvedSkill> = {};
  for (const s of report.content.coreSkills) {
    if (catalog[s.id])
      throw new PackError([`buildSkillCatalog: id de compétence en double '${s.id}'`]);
    catalog[s.id] = { id: s.id, ranks: s.ranks };
  }
  // F-SKILLS : estampille chaque compétence listée par un manifeste
  // (`heroSkills`) de l'id de sa faction ⇒ le tirage de niveau ne la propose
  // qu'aux héros de cette faction (`eligibleSkills`, doc 02 §1.3).
  for (const pack of report.content.packs) {
    for (const skillId of pack.manifest.heroSkills) {
      const skill = catalog[skillId];
      if (skill) skill.factionId = pack.manifest.id;
    }
  }
  return catalog;
}

/**
 * Catalogue des artefacts, prêt pour `GameState.artifactCatalog` (doc 02
 * §1.1, doc 08 §2.3, plan phase-3.2 lot K). `name` (locale) est retiré : hors
 * de la forme `ArtifactDef` figée du moteur.
 */
export function buildArtifactCatalog(report: LoadReport): Record<string, ResolvedArtifact> {
  const catalog: Record<string, ResolvedArtifact> = {};
  for (const a of report.content.coreArtifacts) {
    if (catalog[a.id])
      throw new PackError([`buildArtifactCatalog: id d'artefact en double '${a.id}'`]);
    catalog[a.id] = { id: a.id, bonus: a.bonus, slot: a.slot };
  }
  return catalog;
}

/**
 * Catalogue des effets de faction, prêt pour `StartGame.factionCatalog` /
 * `GameState.factionCatalog` (plan phase-3.4) — indexé par `factionId`, lu
 * par l'interpréteur générique du moteur post-victoire. `factionBonuses` est
 * déjà sous forme résolue (`FactionBonus`), aucune traduction nécessaire.
 */
export function buildFactionCatalog(report: LoadReport): Record<string, { bonuses: FactionBonus[] }> {
  const catalog: Record<string, { bonuses: FactionBonus[] }> = {};
  for (const pack of report.content.packs) {
    // F-RESON.1 : estampille le cap de la ressource sur chaque bonus de gain
    // (dérivé de `factionResources[].cap` du même paquet). Le loader valide déjà
    // que la ressource du bonus est déclarée ⇒ le cap existe toujours.
    const capByResource = new Map(pack.manifest.factionResources.map((r) => [r.id, r.cap]));
    const bonuses = pack.manifest.factionBonuses.map((b) => {
      if (b.type !== 'gainFactionResourceOnVictory') return b;
      const cap = capByResource.get(b.resource);
      return cap !== undefined ? { ...b, cap } : b;
    });
    catalog[pack.manifest.id] = { bonuses };
  }
  return catalog;
}

/**
 * Catalogue des Maisons, prêt pour `StartGame.houseCatalog` (doc 16 §3.1) —
 * indexé par `houseId` → effets déclaratifs résolus, agrégés par le moteur au
 * même titre que les compétences. Les Maisons vivent dans les manifestes de
 * faction ; leur id est unique tous paquets confondus (relève d'un doublon).
 */
export function buildHouseCatalog(report: LoadReport): Record<string, { effects: HouseEffect[] }> {
  const catalog: Record<string, { effects: HouseEffect[] }> = {};
  for (const pack of report.content.packs) {
    for (const house of pack.manifest.houses) {
      if (catalog[house.id])
        throw new PackError([`buildHouseCatalog: id de Maison en double '${house.id}'`]);
      catalog[house.id] = { effects: house.effects };
    }
  }
  return catalog;
}

/**
 * Roster de héros nommés prêt pour `StartGame.heroRoster` (H-NAMED.1, doc 02 §1.2) —
 * indexé par `heroId`, **uniquement** pour les fiches `heroes/<id>.json` PORTANT le
 * gameplay (`attributes`). Les fiches identity-only (staging 16.9 : avatar/bio) sont
 * ignorées (non jouées en jeu). La spécialité de signature est éclatée en
 * `specialtyId` + `specialtyEffects` (mêmes effets déclaratifs que Maisons/compétences).
 */
export function buildHeroRoster(
  report: LoadReport,
): Record<string, {
  factionId: string;
  name: string;
  attributes: { attack: number; defense: number; power: number; knowledge: number };
  specialtyId: string;
  specialtyEffects: HouseEffect[];
  startingSkills: Record<string, number>;
  startingSpells: string[];
}> {
  const roster: ReturnType<typeof buildHeroRoster> = {};
  for (const pack of report.content.packs) {
    for (const h of pack.heroes) {
      if (!h.attributes) continue; // fiche identity-only (staging) — non jouée
      let specialtyId = '';
      let specialtyEffects: HouseEffect[] = [];
      if (h.specialtyEffect) {
        const { id, ...eff } = h.specialtyEffect; // éclate la spécialité en id + effets
        specialtyId = id;
        specialtyEffects = [eff];
      }
      roster[h.id] = {
        factionId: pack.manifest.id,
        name: h.name,
        attributes: { ...h.attributes },
        specialtyId,
        specialtyEffects,
        startingSkills: { ...h.startingSkills },
        startingSpells: [...h.startingSpells],
      };
    }
  }
  return roster;
}

/**
 * Catalogue des groupes de croissance partagée (doc 05 §3.1/§8), prêt pour
 * `StartGame.growthGroups` / `GameState.growthGroups` — fusion des
 * `sharedGrowthGroups` de tous les paquets, indexé par id de groupe → membres.
 * Les labels de groupe doivent être uniques tous paquets confondus (relève d'un
 * doublon, comme les Maisons) : le moteur ne connaît que des ids opaques.
 */
export function buildGrowthGroupCatalog(report: LoadReport): Record<string, string[]> {
  const catalog: Record<string, string[]> = {};
  for (const pack of report.content.packs) {
    for (const [group, members] of Object.entries(pack.manifest.sharedGrowthGroups)) {
      if (catalog[group])
        throw new PackError([`buildGrowthGroupCatalog: id de groupe en double '${group}'`]);
      catalog[group] = [...members];
    }
  }
  return catalog;
}

/** Ville de départ résolue — même forme que le `TownState` initial du moteur. */
export interface ResolvedStartingTown {
  id: string;
  ownerPlayerId: string;
  pos: { x: number; y: number };
  factionId: string;
  buildings: Record<string, number>;
  builtToday: boolean;
  garrison: never[];
  stock: Record<string, number>;
}

/**
 * Résout `config.newGame.startingTown` en `TownState`-like (owner `player-1`,
 * garnison vide — le héros a `startingArmy`, doc 02 §4). Vérifie que la
 * faction et les bâtiments préconstruits sont connus (règle croisée).
 */
export function resolveStartingTowns(config: GameConfig, report: LoadReport): ResolvedStartingTown[] {
  const start = config.newGame.startingTown;
  if (!start) return [];
  if (!report.content.packs.some((p) => p.manifest.id === start.factionId)) {
    throw new PackError([`config.json: newGame.startingTown — faction inconnue '${start.factionId}'`]);
  }
  const catalog = buildBuildingCatalog(report);
  const buildings: Record<string, number> = {};
  for (const pb of start.prebuilt) {
    const def = catalog[pb.building];
    if (!def)
      throw new PackError([`config.json: newGame.startingTown.prebuilt — bâtiment inconnu '${pb.building}'`]);
    if (pb.level > def.maxLevel) {
      throw new PackError([
        `config.json: newGame.startingTown.prebuilt — niveau ${pb.level} > maxLevel (${def.maxLevel}) pour '${pb.building}'`,
      ]);
    }
    buildings[pb.building] = pb.level;
  }
  return [
    {
      id: start.id,
      ownerPlayerId: 'player-1',
      pos: { x: start.x, y: start.y },
      factionId: start.factionId,
      buildings,
      builtToday: false,
      garrison: [],
      stock: {},
    },
  ];
}

/** Carte résolue, prête pour `StartGame` — même forme que l'`AdventureMapDef` du moteur. */
export type ResolvedMapObject =
  | {
      id: string;
      type: 'resource';
      pos: { x: number; y: number };
      resource: string;
      amount: number;
    }
  | {
      id: string;
      type: 'guardian';
      pos: { x: number; y: number };
      unitId: string;
      count: number;
      /** Gardien errant (doc 02 §2.2) — absent = statique. */
      roamRadius?: number;
    }
  | {
      id: string;
      type: 'visitable';
      pos: { x: number; y: number };
      effect:
        | { kind: 'luck'; amount: number }
        | { kind: 'movement'; amount: number }
        | { kind: 'levelXp' }
        | { kind: 'resource'; resource: string; amount: number }
        | { kind: 'vision'; amount: number }
        | { kind: 'permanentStat'; attribute: 'attack' | 'defense' | 'power' | 'knowledge'; amount: number };
      frequency: 'oncePerHero' | 'oncePerHeroPerWeek';
      /** État initial : personne n'a visité. */
      visits: Record<string, number>;
    }
  | {
      id: string;
      type: 'dwelling';
      pos: { x: number; y: number };
      unitId: string;
      stock: number;
      /** Toujours neutre en sortie de données — capturée en jeu (M-DWELLOWN). */
      ownerId: string | null;
    }
  | {
      id: string;
      type: 'mine';
      pos: { x: number; y: number };
      resource: string;
      /** Revenu par jour (doc 02 §2.2). */
      amount: number;
      /** Toujours neutre en sortie de données — capturée en jeu. */
      ownerId: string | null;
    }
  | {
      id: string;
      type: 'treasure';
      pos: { x: number; y: number };
      gold: number;
      xp: number;
    }
  | {
      id: string;
      type: 'artifact';
      pos: { x: number; y: number };
      artifactId: string;
    }
  | {
      id: string;
      type: 'monolith';
      pos: { x: number; y: number };
      pairId: string;
    }
  | {
      id: string;
      type: 'town';
      pos: { x: number; y: number };
      /** Ville neutre (Alpha 4.13) : faction + garnison assiégeable. Absents = ville de départ. */
      factionId?: string;
      garrison?: { unitId: string; count: number }[];
    };

/** Effet de trigger résolu — identique à `TriggerEffect` du moteur (doc 02 §2.1). */
export type ResolvedTriggerEffect =
  | { kind: 'grantResource'; resource: string; amount: number }
  | { kind: 'message'; textKey: string };

/** Trigger résolu — forme moteur `MapTriggerDef` (`pos` déplié, `fired` initial). */
export interface ResolvedMapTrigger {
  id: string;
  on: { kind: 'visit'; pos: { x: number; y: number } } | { kind: 'day'; day: number };
  effect: ResolvedTriggerEffect;
  fired: boolean;
}

export interface ResolvedMap {
  id: string;
  width: number;
  height: number;
  terrain: string[];
  road: boolean[];
  objects: ResolvedMapObject[];
  triggers: ResolvedMapTrigger[];
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
  /** Unités connues des paquets chargés — vérifie les gardiens si fourni. */
  knownUnitIds?: ReadonlySet<string>,
  /** Artefacts connus (data/core/artifacts.json) — vérifie les artefacts au sol si fourni. */
  knownArtifactIds?: ReadonlySet<string>,
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
    if (obj.type === 'guardian' && knownUnitIds && !knownUnitIds.has(obj.unitId))
      errors.push(`${path}: gardien '${obj.id}' — unité inconnue des paquets '${obj.unitId}'`);
    if (obj.type === 'dwelling' && knownUnitIds && !knownUnitIds.has(obj.unitId))
      errors.push(`${path}: habitation '${obj.id}' — unité inconnue des paquets '${obj.unitId}'`);
    if (obj.type === 'treasure' && obj.gold + obj.xp <= 0)
      errors.push(`${path}: trésor '${obj.id}' — aucun gain (or et XP à zéro)`);
    if (obj.type === 'artifact' && knownArtifactIds && !knownArtifactIds.has(obj.artifactId))
      errors.push(`${path}: artefact '${obj.id}' — inconnu de core/artifacts.json '${obj.artifactId}'`);
    // M-GUARDLINK (doc 02 §2.2) : un `guardedBy` doit désigner un gardien de la carte.
    if ('guardedBy' in obj && obj.guardedBy !== undefined &&
        !file.objects.some((g) => g.type === 'guardian' && g.id === obj.guardedBy))
      errors.push(`${path}: objet '${obj.id}' — gardien lié inconnu '${obj.guardedBy}'`);
  }
  // M-NAV a (doc 02 §2.1) : chaque `pairId` de monolithe doit lier EXACTEMENT 2
  // monolithes (un jumeau, pas plus) — sinon le téléport serait ambigu/orphelin.
  const monolithPairs = new Map<string, number>();
  for (const obj of file.objects)
    if (obj.type === 'monolith') monolithPairs.set(obj.pairId, (monolithPairs.get(obj.pairId) ?? 0) + 1);
  for (const [pairId, count] of monolithPairs)
    if (count !== 2)
      errors.push(`${path}: paire de monolithes '${pairId}' — ${count} monolithe(s), exactement 2 attendus`);
  for (const [i, pos] of file.startPositions.entries()) {
    if (!inBounds(pos.x, pos.y)) errors.push(`${path}: startPositions[${i}] hors carte`);
    else if (!passable(pos.x, pos.y))
      errors.push(`${path}: startPositions[${i}] infranchissable (${pos.x},${pos.y})`);
    if (file.objects.some((o) => o.x === pos.x && o.y === pos.y))
      errors.push(`${path}: startPositions[${i}] occupée par un objet`);
  }

  // Règle croisée : la ville de départ (config) référence un objet `town` de cette carte.
  if (config.newGame.startingTown && config.newGame.map === id) {
    const start = config.newGame.startingTown;
    const townObj = file.objects.find((o) => o.type === 'town' && o.id === start.id);
    if (!townObj) {
      errors.push(`${path}: ville de départ '${start.id}' absente des objets de la carte`);
    } else if (townObj.x !== start.x || townObj.y !== start.y) {
      errors.push(
        `${path}: ville de départ '${start.id}' — position carte (${townObj.x},${townObj.y}) ≠ config (${start.x},${start.y})`,
      );
    }
  }

  if (errors.length > 0) throw new PackError(errors);
  return resolveMap(file);
}

/**
 * Charge et valide `data/scenarios/index.json` + chaque `<id>.scenario.json`
 * (plan phase-3.5, lot T). Étape distincte de `loadContent` : elle a besoin du
 * contenu déjà chargé (factions, unités, bâtiments) pour ses règles croisées
 * (carte connue, faction chargée, index de départ valide, unités d'armée
 * connues). Rejet propre par scénario — jamais de crash, comme les paquets de
 * faction. Retourne `report` augmenté de `content.scenarios`/`rejectedScenarios`.
 */
export async function loadScenarios(readJson: ReadJson, report: LoadReport): Promise<LoadReport> {
  const index = parseFile(
    scenarioIndexSchema,
    await readJson('scenarios/index.json'),
    'scenarios/index.json',
  );
  const knownFactionIds = new Set(report.content.packs.map((p) => p.manifest.id));
  const knownUnits = knownUnitIds(report);
  const knownArtifacts = knownArtifactIds(report);
  const buildingCatalog = buildBuildingCatalog(report);

  const scenarios: Scenario[] = [];
  const rejectedScenarios: { id: string; errors: string[] }[] = [];
  for (const id of index.scenarios) {
    try {
      scenarios.push(
        await loadScenario(
          readJson,
          id,
          report.content.config,
          knownFactionIds,
          knownUnits,
          knownArtifacts,
          buildingCatalog,
        ),
      );
    } catch (e) {
      rejectedScenarios.push({ id, errors: describeError(e) });
    }
  }
  return {
    ...report,
    content: { ...report.content, scenarios },
    rejectedScenarios,
  };
}

/**
 * Charge les campagnes déclarées par les manifestes (`manifest.story`, doc 13,
 * N3a) — étape distincte après `loadScenarios` (chaque chapitre référence un
 * scénario déjà chargé). Règles croisées : `factionId` connu, chaque
 * `chapter.scenario` existe parmi les scénarios chargés. Retourne `report`
 * augmenté de `content.campaigns`/`rejectedCampaigns`.
 */
export async function loadCampaigns(readJson: ReadJson, report: LoadReport): Promise<LoadReport> {
  const knownScenarioIds = new Set(report.content.scenarios.map((s) => s.id));
  const campaigns: Campaign[] = [];
  const rejectedCampaigns: { id: string; errors: string[] }[] = [];
  for (const pack of report.content.packs) {
    const rel = pack.manifest.story;
    if (!rel) continue;
    const path = `factions/${pack.manifest.id}/${rel}`;
    try {
      const campaign = parseFile(campaignSchema, await readJson(path), path);
      const errors: string[] = [];
      if (campaign.factionId !== pack.manifest.id)
        errors.push(`${path}: factionId '${campaign.factionId}' ≠ paquet '${pack.manifest.id}'`);
      for (const ch of campaign.chapters) {
        if (!knownScenarioIds.has(ch.scenario))
          errors.push(`${path}: chapitre '${ch.id}' référence un scénario inconnu '${ch.scenario}'`);
      }
      if (errors.length > 0) throw new PackError(errors);
      campaigns.push(campaign);
    } catch (e) {
      rejectedCampaigns.push({ id: pack.manifest.id, errors: describeError(e) });
    }
  }
  return {
    ...report,
    content: { ...report.content, campaigns },
    rejectedCampaigns,
  };
}

/** Charge et valide un scénario (règles croisées doc 02 §6, plan phase-3.5). */
async function loadScenario(
  readJson: ReadJson,
  id: string,
  config: GameConfig,
  knownFactionIds: ReadonlySet<string>,
  knownUnits: ReadonlySet<string>,
  knownArtifacts: ReadonlySet<string>,
  buildingCatalog: Record<string, ResolvedBuilding>,
): Promise<Scenario> {
  const path = `scenarios/${id}.scenario.json`;
  const scenario = parseFile(scenarioSchema, await readJson(path), path);
  const errors: string[] = [];
  if (scenario.id !== id) errors.push(`${path}: id '${scenario.id}' ≠ fichier '${id}'`);

  let map: ResolvedMap | undefined;
  try {
    map = await loadMap(readJson, scenario.map, config, knownUnits, knownArtifacts);
  } catch (e) {
    errors.push(
      `${path}: carte '${scenario.map}' invalide — ${describeError(e).join('; ')}`,
    );
  }

  for (const player of scenario.players) {
    if (!knownFactionIds.has(player.factionId))
      errors.push(`${path}: joueur '${player.id}' — faction inconnue '${player.factionId}'`);
    if (map && player.startPositionIndex >= map.startPositions.length)
      errors.push(
        `${path}: joueur '${player.id}' — startPositionIndex ${player.startPositionIndex} ≥ ` +
          `${map.startPositions.length} position(s) de départ de la carte`,
      );
    for (const stack of player.startingArmy) {
      if (!knownUnits.has(stack.unitId))
        errors.push(`${path}: joueur '${player.id}' — unité d'armée inconnue '${stack.unitId}'`);
    }
    if (player.startingTown) {
      for (const pb of player.startingTown.prebuilt) {
        const def = buildingCatalog[pb.building];
        if (!def) errors.push(`${path}: joueur '${player.id}' — bâtiment inconnu '${pb.building}'`);
        else if (pb.level > def.maxLevel)
          errors.push(
            `${path}: joueur '${player.id}' — niveau ${pb.level} > maxLevel (${def.maxLevel}) pour '${pb.building}'`,
          );
      }
      // Remédiation R5 (CO8) : la position de la ville de départ doit être dans
      // la carte et sur une tuile franchissable — sinon la ville est plantée
      // hors carte ou dans l'eau.
      const st = player.startingTown;
      if (map) {
        if (st.x >= map.width || st.y >= map.height) {
          errors.push(`${path}: joueur '${player.id}' — ville de départ hors carte (${st.x},${st.y})`);
        } else {
          const terrain = map.terrain[st.y * map.width + st.x];
          const rule = terrain !== undefined ? config.adventure.terrains[terrain] : undefined;
          if (!rule || rule.moveCost === null)
            errors.push(
              `${path}: joueur '${player.id}' — ville de départ sur tuile infranchissable (${st.x},${st.y})`,
            );
        }
      }
    }
  }

  // Remédiation R5 (CO8) : les objectifs opaques doivent référencer une entité
  // réelle du scénario — une ville de départ (captureTown) ou un héros de joueur
  // (`hero-<playerId>`, cf. `core/engine.ts` StartGame ; defeatHero) — sinon
  // l'objectif n'est jamais satisfiable et le typo passe `content:check`.
  const townIds = new Set(scenario.players.flatMap((p) => (p.startingTown ? [p.startingTown.id] : [])));
  const heroIds = new Set(scenario.players.map((p) => `hero-${p.id}`));
  for (const [playerId, obj] of Object.entries(scenario.objectives)) {
    for (const cond of [obj.victory, obj.defeat]) {
      if (cond.type === 'captureTown' && !townIds.has(cond.townId))
        errors.push(`${path}: objectifs['${playerId}'] — captureTown vers ville inconnue '${cond.townId}'`);
      if (cond.type === 'defeatHero' && !heroIds.has(cond.heroId))
        errors.push(`${path}: objectifs['${playerId}'] — defeatHero vers héros inconnu '${cond.heroId}'`);
    }
  }

  if (errors.length > 0) throw new PackError(errors);
  return scenario;
}

/**
 * Objectifs de scénario prêts pour `StartGame.scenario`/`GameState.scenario`
 * (plan phase-3.5) — `scenario.objectives` est déjà dans la forme résolue
 * (`ScenarioObjectives` par joueur), aucune traduction nécessaire.
 */
export function buildScenarioObjectives(scenario: Scenario): Record<string, ScenarioObjectives> {
  return scenario.objectives;
}

/** Déplie légende et rangées vers la forme row-major consommée par le moteur. */
function resolveMap(file: MapFile): ResolvedMap {
  return {
    id: file.id,
    width: file.width,
    height: file.height,
    terrain: file.tiles.flatMap((row) => [...row].map((c) => file.legend[c] as string)),
    road: file.roads.flatMap((row) => [...row].map((c) => c === '1')),
    objects: file.objects.map((obj): ResolvedMapObject => {
      const pos = { x: obj.x, y: obj.y };
      if (obj.type === 'resource')
        return {
          id: obj.id,
          type: obj.type,
          pos,
          resource: obj.resource,
          amount: obj.amount,
          ...(obj.guardedBy !== undefined ? { guardedBy: obj.guardedBy } : {}),
        };
      if (obj.type === 'guardian')
        return {
          id: obj.id,
          type: obj.type,
          pos,
          unitId: obj.unitId,
          count: obj.count,
          ...(obj.roamRadius !== undefined ? { roamRadius: obj.roamRadius } : {}),
        };
      if (obj.type === 'visitable')
        return { id: obj.id, type: obj.type, pos, effect: obj.effect, frequency: obj.frequency, visits: {} };
      if (obj.type === 'dwelling')
        return { id: obj.id, type: obj.type, pos, unitId: obj.unitId, stock: obj.stock ?? 0, ownerId: null };
      if (obj.type === 'mine')
        return {
          id: obj.id,
          type: obj.type,
          pos,
          resource: obj.resource,
          amount: obj.amount,
          ownerId: null,
        };
      if (obj.type === 'treasure')
        return {
          id: obj.id,
          type: obj.type,
          pos,
          gold: obj.gold,
          xp: obj.xp,
          ...(obj.guardedBy !== undefined ? { guardedBy: obj.guardedBy } : {}),
        };
      if (obj.type === 'artifact')
        return {
          id: obj.id,
          type: obj.type,
          pos,
          artifactId: obj.artifactId,
          ...(obj.guardedBy !== undefined ? { guardedBy: obj.guardedBy } : {}),
        };
      if (obj.type === 'monolith')
        return { id: obj.id, type: obj.type, pos, pairId: obj.pairId };
      return {
        id: obj.id,
        type: obj.type,
        pos,
        ...(obj.factionId !== undefined ? { factionId: obj.factionId } : {}),
        ...(obj.garrison !== undefined ? { garrison: obj.garrison.map((s) => ({ ...s })) } : {}),
      };
    }),
    triggers: (file.triggers ?? []).map((t): ResolvedMapTrigger => ({
      id: t.id,
      on:
        t.on.kind === 'visit'
          ? { kind: 'visit', pos: { x: t.on.x, y: t.on.y } }
          : { kind: 'day', day: t.on.day },
      effect: t.effect,
      fired: false,
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
function collectLocRefs(pack: {
  manifest: Manifest;
  units: Unit[];
  heroes: HeroIdentity[];
}): string[] {
  const refs = [
    pack.manifest.name,
    ...pack.units.map((u) => u.name),
    ...pack.heroes.flatMap((h) => [h.name, h.bio, ...(h.specialty ? [h.specialty] : [])]),
  ];
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
