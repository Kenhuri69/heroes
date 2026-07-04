import {
  emptyResources,
  type ArtifactDef,
  type BuildingDef,
  type Command,
  type CombatUnitDef,
  type FactionBonus,
  type HeroAttributes,
  type HeroSkillDef,
  type Resources,
  type SpellDef,
  type TownState,
} from '@heroes/engine';
import {
  buildArtifactCatalog,
  buildBuildingCatalog,
  buildFactionCatalog,
  buildSkillCatalog,
  buildSpellCatalog,
  resolveStartingTowns,
  type GameConfig,
  type LoadReport,
  type ResolvedMap,
} from '@heroes/content';

/** Catalogue d'effets de faction résolu contenu → moteur (doc 06, plan phase-3.4). */
export type FactionCatalog = Record<string, { bonuses: FactionBonus[] }>;

export function buildFactionSetup(report: LoadReport): FactionCatalog {
  return buildFactionCatalog(report) as FactionCatalog;
}

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

/**
 * Catalogues héros (sorts/compétences/artefacts) + dotation de départ, résolus
 * contenu → moteur (doc 06, plan phase-3.2). Le moteur ne reçoit que des
 * données ; le gating MVP (sorts de cercle ≤ 3, décision 3.2 #7) est appliqué
 * ici, hors du moteur.
 */
export interface HeroSetup {
  spellCatalog: Record<string, SpellDef>;
  skillCatalog: Record<string, HeroSkillDef>;
  artifactCatalog: Record<string, ArtifactDef>;
  startingSpells: string[];
  startingArtifacts: string[];
  startingAttributes: HeroAttributes;
}

const NO_HERO_SETUP: HeroSetup = {
  spellCatalog: {},
  skillCatalog: {},
  artifactCatalog: {},
  startingSpells: [],
  startingArtifacts: [],
  startingAttributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
};

/** Résout les catalogues héros et la dotation de départ depuis le contenu chargé. */
export function buildHeroSetup(report: LoadReport): HeroSetup {
  const spellCatalog = buildSpellCatalog(report) as Record<string, SpellDef>;
  const skillCatalog = buildSkillCatalog(report) as Record<string, HeroSkillDef>;
  const artifactCatalog = buildArtifactCatalog(report) as Record<string, ArtifactDef>;
  const newGame = report.content.config.newGame;
  // Guilde des mages MVP (décision plan phase-3.2 #7) : le héros connaît d'emblée
  // tous les sorts de cercle ≤ 3. Sagesse/Magie (cercles 4/5) = raffinement 3.3+.
  const startingSpells = Object.values(spellCatalog)
    .filter((s) => s.circle <= 3)
    .map((s) => s.id);
  return {
    spellCatalog,
    skillCatalog,
    artifactCatalog,
    startingSpells,
    startingArtifacts: newGame.startingArtifacts ?? [],
    startingAttributes: newGame.startingHero ?? { attack: 0, defense: 0, power: 0, knowledge: 0 },
  };
}

/** Construit la commande `StartGame` depuis les données validées — rien en dur. */
export function newGameCommand(
  seed: number,
  config: GameConfig,
  map: ResolvedMap,
  unitCatalog: Record<string, CombatUnitDef>,
  townSetup: TownSetup = { buildingCatalog: {}, towns: [] },
  heroSetup: HeroSetup = NO_HERO_SETUP,
  factionCatalog: FactionCatalog = {},
): Command {
  const startingResources: Resources = { ...emptyResources() };
  for (const [id, amount] of Object.entries(config.newGame.startingResources)) {
    startingResources[id as keyof Resources] = amount ?? 0;
  }
  // Le héros joue la faction de sa ville de départ (doc 06) — ses bonus de
  // faction (ex. Nécromancie) s'appliquent alors post-victoire. Défaut ''.
  const startingFactionId = config.newGame.startingTown?.factionId ?? '';
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
        startingAttributes: { ...heroSetup.startingAttributes },
        startingSpells: [...heroSetup.startingSpells],
        startingFactionId,
      },
    ],
    map: adventureMap,
    config: config.adventure,
    unitCatalog,
    buildingCatalog: townSetup.buildingCatalog,
    towns: townSetup.towns,
    spellCatalog: heroSetup.spellCatalog,
    skillCatalog: heroSetup.skillCatalog,
    artifactCatalog: heroSetup.artifactCatalog,
    startingArtifacts: heroSetup.startingArtifacts,
    factionCatalog,
  };
}
