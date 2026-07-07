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
  // D3 : un dwelling gradué (niveau 1 = base, niveau 2 = amélioré) rend
  // recrutables les DEUX unités (façon HoMM) — on parcourt TOUS les niveaux
  // construits, pas seulement le plus haut. Sinon le stock de base accumulé
  // avant l'amélioration devient irrécupérable.
  for (const buildingId of Object.keys(town.buildings)) {
    const built = town.buildings[buildingId] ?? 0;
    const def = catalog[buildingId];
    for (let i = 0; i < built; i++) {
      const effect = def?.levels[i]?.effect;
      if (effect?.type === 'dwelling' && effect.unitId === unitId) return true;
    }
  }
  return false;
}

/**
 * Liste des unités recrutables dans la ville : pour un dwelling gradué (Alpha
 * 4.11 : niveau 1 = base, niveau 2 = amélioré), les DEUX variantes sont exposées
 * une fois le niveau 2 bâti (D3, façon HoMM) — on parcourt tous les niveaux
 * construits. Ordre stable (bâtiments puis niveaux).
 */
export function builtDwellings(
  town: TownState,
  catalog: Record<string, BuildingDef>,
): string[] {
  const unitIds: string[] = [];
  for (const buildingId of Object.keys(town.buildings)) {
    const built = town.buildings[buildingId] ?? 0;
    const def = catalog[buildingId];
    for (let i = 0; i < built; i++) {
      const effect = def?.levels[i]?.effect;
      if (effect?.type === 'dwelling' && !unitIds.includes(effect.unitId)) unitIds.push(effect.unitId);
    }
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
