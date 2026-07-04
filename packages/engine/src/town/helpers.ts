import type { BuildingDef, BuildingLevel, TownState } from './types';

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
