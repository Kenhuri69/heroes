import {
  emptyResources,
  type BuildingDef,
  type Command,
  type CombatUnitDef,
  type Resources,
  type TownState,
} from '@heroes/engine';
import {
  buildBuildingCatalog,
  resolveStartingTowns,
  type GameConfig,
  type LoadReport,
  type ResolvedMap,
} from '@heroes/content';

export const PLAYER_ID = 'player-1';

/**
 * Catalogue d'unités résolu contenu → moteur (doc 06) : le moteur ne reçoit
 * que des données ; `groupId` = id du paquet, opaque pour lui.
 */
export function buildUnitCatalog(report: LoadReport): Record<string, CombatUnitDef> {
  const catalog: Record<string, CombatUnitDef> = {};
  for (const pack of report.content.packs) {
    for (const unit of pack.units) {
      catalog[unit.id] = {
        id: unit.id,
        groupId: pack.manifest.id,
        nativeTerrain: pack.manifest.nativeTerrain,
        stats: unit.stats,
        abilities: unit.abilities,
        // Économie de ville (doc 02 §4) : coût de recrutement et croissance
        // hebdo vivent dans les données d'unité — exposés au moteur ici.
        recruitCost: unit.cost as Partial<Resources>,
        growthPerWeek: unit.growthPerWeek,
      };
    }
  }
  return catalog;
}

/** Catalogue de bâtiments + villes initiales résolus contenu → moteur (doc 06). */
export function buildTownSetup(report: LoadReport): TownSetup {
  return {
    buildingCatalog: buildBuildingCatalog(report) as Record<string, BuildingDef>,
    towns: resolveStartingTowns(report.content.config, report) as unknown as TownState[],
  };
}

/**
 * Catalogue de bâtiments et villes initiales : résolus par le contenu (lot I) ;
 * en attendant le schéma `building`, vides (aucune ville). L'intégration 3.1
 * remplace ces défauts par la résolution réelle.
 */
export interface TownSetup {
  buildingCatalog: Record<string, BuildingDef>;
  towns: TownState[];
}

/** Construit la commande `StartGame` depuis les données validées — rien en dur. */
export function newGameCommand(
  seed: number,
  config: GameConfig,
  map: ResolvedMap,
  unitCatalog: Record<string, CombatUnitDef>,
  townSetup: TownSetup = { buildingCatalog: {}, towns: [] },
): Command {
  const startingResources: Resources = { ...emptyResources() };
  for (const [id, amount] of Object.entries(config.newGame.startingResources)) {
    startingResources[id as keyof Resources] = amount ?? 0;
  }
  // Les objets `town` de la carte de contenu vivent dans `GameState.towns`,
  // pas dans les objets d'aventure du moteur (resource/guardian) — on les retire.
  const adventureMap = {
    ...map,
    objects: map.objects.filter((o) => o.type !== 'town'),
  };
  return {
    type: 'StartGame',
    seed,
    players: [
      {
        id: PLAYER_ID,
        startingResources,
        startingArmy: config.newGame.startingArmy.map((s) => ({ ...s })),
      },
    ],
    map: adventureMap,
    config: config.adventure,
    unitCatalog,
    buildingCatalog: townSetup.buildingCatalog,
    towns: townSetup.towns,
  };
}
