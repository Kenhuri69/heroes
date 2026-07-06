import type { BuildingDef, BuildingLevel, TownState } from './types';

export type BuildRequirement = { building: string; level: number };

/** Statut d'un bâtiment vis-à-vis de la prochaine construction (vue UI). */
export type BuildStatus = 'built' | 'available' | 'locked';

/**
 * Renvoie la définition du NIVEAU CONSTRUIT d'un bâtiment dans une ville
 * donnée (`undefined` si le bâtiment n'est pas construit ou inconnu du
 * catalogue). `town.buildings[id]` est 1-based (niveau 1 = `levels[0]`).
 */
export function builtLevelOf(
  town: TownState,
  catalog: Record<string, BuildingDef>,
  buildingId: string,
): BuildingLevel | undefined {
  const level = town.buildings[buildingId];
  if (!level) return undefined;
  return catalog[buildingId]?.levels[level - 1];
}

/** Le tier `unitId` est-il débloqué par un dwelling construit dans cette ville ? */
export function unitIsRecruitable(
  town: TownState,
  catalog: Record<string, BuildingDef>,
  unitId: string,
): boolean {
  for (const buildingId of Object.keys(town.buildings)) {
    const level = builtLevelOf(town, catalog, buildingId);
    if (level?.effect.type === 'dwelling' && level.effect.unitId === unitId) return true;
  }
  return false;
}

/**
 * Liste des unités recrutables dans la ville : l'unité du **niveau construit**
 * de chaque dwelling (cohérent avec `unitIsRecruitable`, qui ne regarde que le
 * niveau haut). Pour un dwelling gradué (Alpha 4.11 : niveau 1 = base, niveau 2
 * = amélioré), seule la variante du niveau construit est exposée — recruter
 * l'amélioré remplace la base une fois le niveau 2 bâti. Ordre stable (ordre
 * d'insertion des bâtiments).
 */
export function builtDwellings(
  town: TownState,
  catalog: Record<string, BuildingDef>,
): string[] {
  const unitIds: string[] = [];
  for (const buildingId of Object.keys(town.buildings)) {
    const effect = builtLevelOf(town, catalog, buildingId)?.effect;
    if (effect?.type === 'dwelling' && !unitIds.includes(effect.unitId)) unitIds.push(effect.unitId);
  }
  return unitIds;
}

/**
 * Prérequis de bâtiment NON satisfaits pour la prochaine construction (liste
 * vide si le bâtiment est au max ou inconnu). Source unique partagée par le
 * validateur (`validateBuildStructure`) et l'UI (liste « prérequis manquant »).
 */
export function missingRequirements(
  town: TownState,
  catalog: Record<string, BuildingDef>,
  buildingId: string,
): BuildRequirement[] {
  const currentLevel = town.buildings[buildingId] ?? 0;
  const nextLevel = catalog[buildingId]?.levels[currentLevel];
  if (!nextLevel) return [];
  return nextLevel.requires.filter((req) => (town.buildings[req.building] ?? 0) < req.level);
}

/**
 * Id d'un bâtiment déjà bâti du même groupe exclusif (doc 05 §3.2), ou
 * `undefined`. Source unique partagée validateur / UI.
 */
export function exclusiveRivalId(
  town: TownState,
  catalog: Record<string, BuildingDef>,
  buildingId: string,
): string | undefined {
  const group = catalog[buildingId]?.exclusiveGroup;
  if (!group) return undefined;
  return Object.keys(town.buildings).find(
    (id) => id !== buildingId && (town.buildings[id] ?? 0) >= 1 && catalog[id]?.exclusiveGroup === group,
  );
}

/**
 * Statut de la prochaine construction d'un bâtiment pour l'UI :
 * `built` (au max / inconnu), `locked` (rival exclusif bâti ou prérequis
 * manquant), `available` sinon. Mêmes règles que `validateBuildStructure`
 * (via les helpers partagés), sans le coût (l'UI l'affiche séparément).
 */
export function buildStatus(
  town: TownState,
  catalog: Record<string, BuildingDef>,
  buildingId: string,
): BuildStatus {
  const def = catalog[buildingId];
  if (!def) return 'built';
  const currentLevel = town.buildings[buildingId] ?? 0;
  if (currentLevel >= def.maxLevel || !def.levels[currentLevel]) return 'built';
  if (exclusiveRivalId(town, catalog, buildingId)) return 'locked';
  return missingRequirements(town, catalog, buildingId).length === 0 ? 'available' : 'locked';
}
