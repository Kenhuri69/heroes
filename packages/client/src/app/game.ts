import {
  emptyResources,
  humanPlayerId,
  isAdjacent,
  rollRange,
  seedRng,
  type ArmyStack,
  type ArtifactDef,
  type BuildingDef,
  type Command,
  type CombatUnitDef,
  type FactionBonus,
  type GameState,
  type HeroAttributes,
  type HeroSkillDef,
  type HeroState,
  type PlayerSetup,
  type QuestState,
  type ResolvedHeroDef,
  type Resources,
  type ScenarioState,
  type SkillRankEffect,
  type SpellDef,
  type SpellSchool,
  type TownState,
} from '@heroes/engine';
import {
  buildArtifactCatalog,
  buildBuildingCatalog,
  buildFactionCatalog,
  buildGrowthGroupCatalog,
  buildHeroRoster,
  buildHouseCatalog,
  buildScenarioObjectives,
  buildSkillCatalog,
  buildSpellCatalog,
  resolveStartingTowns,
  type FactionPack,
  type GameConfig,
  type LoadReport,
  type ResolvedMap,
  type Scenario,
} from '@heroes/content';

/** Catalogue d'effets de faction résolu contenu → moteur (doc 06, plan phase-3.4). */
export type FactionCatalog = Record<string, { bonuses: FactionBonus[] }>;

export function buildFactionSetup(report: LoadReport): FactionCatalog {
  return buildFactionCatalog(report) as FactionCatalog;
}

/** Catalogue des Maisons résolu contenu → moteur (doc 16 §3.1) — pour `StartGame.houseCatalog`. */
export type HouseCatalog = Record<string, { effects: SkillRankEffect[] }>;

export function buildHouseSetup(report: LoadReport): HouseCatalog {
  return buildHouseCatalog(report) as HouseCatalog;
}

/** Roster de héros nommés résolu contenu → moteur (H-NAMED.1) — pour `StartGame.heroRoster`. */
export type HeroRosterCatalog = Record<string, ResolvedHeroDef>;

export function buildHeroRosterSetup(report: LoadReport): HeroRosterCatalog {
  return buildHeroRoster(report) as HeroRosterCatalog;
}

/** Groupes de croissance partagée résolus contenu → moteur (doc 05 §3.1/§8) — pour `StartGame.growthGroups`. */
export function buildGrowthGroupSetup(report: LoadReport): Record<string, string[]> {
  return buildGrowthGroupCatalog(report);
}

/** Id du joueur humain en NOUVELLE PARTIE (convention du client, cf. `newGameCommand`). */
export const PLAYER_ID = 'player-1';

/**
 * Id du joueur humain **actif** de la partie EN COURS (hot-seat, Alpha 4.15) : si
 * le joueur dont c'est le tour est humain, c'est lui — tout le HUD (héros,
 * villes, brouillard, sélection, toasts) suit alors le joueur courant en
 * multi-humain local. Sinon (tour d'une IA, transitoire dans la boucle) : repli
 * sur le premier humain, puis `PLAYER_ID` (remédiation R3/CL5). Comportement
 * solo inchangé : le joueur actif y est toujours l'unique humain.
 */
export function humanId(game: GameState): string {
  const active = game.players[game.currentPlayer];
  if (active?.controller === 'human') return active.id;
  return humanPlayerId(game) ?? PLAYER_ID;
}

/** Héros du joueur humain (doc 08 §2.1, lot UX U4) — dans l'ordre du tableau moteur. */
export function humanHeroes(game: GameState): HeroState[] {
  const id = humanId(game);
  return game.heroes.filter((h) => h.playerId === id);
}

/**
 * Héros humain « sélectionné » (doc 08 §2.1) : celui dont l'id est
 * `selectedHeroId`, sinon le premier héros humain (repli robuste — le contenu MVP
 * n'en donne qu'un ; la sélection se généralise à N sans changement moteur).
 */
export function resolveSelectedHero(
  game: GameState,
  selectedHeroId: string | null,
): HeroState | undefined {
  const mine = humanHeroes(game);
  return mine.find((h) => h.id === selectedHeroId) ?? mine[0];
}

/**
 * Héros du joueur humain adjacents (8 directions) à `hero` (UX-HEROSWAP, doc 02
 * §1.5) — candidats à une rencontre/transfert. Présentation pure : le moteur
 * revalide l'adjacence au dispatch.
 */
export function adjacentFriendlyHeroes(game: GameState, hero: HeroState): HeroState[] {
  return humanHeroes(game).filter((h) => h.id !== hero.id && isAdjacent(h.pos, hero.pos));
}

/** Villes du joueur humain (doc 08 §2.1) — plusieurs possibles par capture. */
export function humanTowns(game: GameState): TownState[] {
  const id = humanId(game);
  return game.towns.filter((t) => t.ownerPlayerId === id);
}

/**
 * Archétype d'avatar d'un héros (doc 08 §5, lot U5-D) — dérivé des attributs
 * (présentation client) : `might` si attaque+défense ≥ pouvoir+savoir, `magic`
 * sinon. Sert à choisir l'avatar `heroes/<faction>-<archetype>`.
 */
export function heroArchetype(attributes: HeroAttributes): 'might' | 'magic' {
  return attributes.attack + attributes.defense >= attributes.power + attributes.knowledge
    ? 'might'
    : 'magic';
}

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
  // Machines de guerre communes (doc 02 §5, Alpha 4.12) — fusionnées dans le
  // catalogue d'unités : le moteur ne voit qu'un `CombatUnitDef` par id. Groupe
  // opaque `war-machine` (pas une faction ; pas de bonus de terrain natif).
  for (const wm of report.content.coreWarMachines) {
    catalog[wm.id] = {
      id: wm.id,
      groupId: 'war-machine',
      nativeTerrain: '',
      stats: wm.stats,
      abilities: wm.abilities,
      recruitCost: wm.cost as Partial<Resources>,
    };
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
  /** Nom du héros (H-NAMED) — réf `@loc:` ou '' si non fourni par les données. */
  startingName: string;
  /** Spécialité résolue (id + effets déclaratifs), ou null si non fournie. */
  startingSpecialty: { id: string; effects: SkillRankEffect[] } | null;
}

const NO_HERO_SETUP: HeroSetup = {
  spellCatalog: {},
  skillCatalog: {},
  artifactCatalog: {},
  startingSpells: [],
  startingArtifacts: [],
  startingAttributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
  startingName: '',
  startingSpecialty: null,
};

/** Résout les catalogues héros et la dotation de départ depuis le contenu chargé. */
export function buildHeroSetup(report: LoadReport): HeroSetup {
  const spellCatalog = buildSpellCatalog(report) as Record<string, SpellDef>;
  const skillCatalog = buildSkillCatalog(report) as Record<string, HeroSkillDef>;
  const artifactCatalog = buildArtifactCatalog(report) as Record<string, ArtifactDef>;
  const newGame = report.content.config.newGame;
  // Guilde des mages MVP (décision plan phase-3.2 #7) : le héros connaît d'emblée
  // tous les sorts de cercle ≤ 3 des écoles UNIVERSELLES, PLUS ceux de l'école de
  // SA faction (C3) — un héros Haven n'apprend pas les sorts de Traque (arcane).
  // L'école de faction est une donnée (manifeste `spellSchool`), pas un cas en dur.
  const universalSchools = new Set<SpellSchool>(['fire', 'water', 'earth', 'air', 'neutral']);
  const startingFactionId = newGame.startingTown?.factionId ?? '';
  const factionSchool = report.content.packs.find((p) => p.manifest.id === startingFactionId)?.manifest.spellSchool ?? null;
  const startingSpells = Object.values(spellCatalog)
    .filter((s) => s.circle <= 3 && (universalSchools.has(s.school) || s.school === factionSchool))
    .map((s) => s.id);
  // Spécialité de héros (H-NAMED, doc 02 §1.2) : id + effets déclaratifs résolus
  // depuis les données (l'`id` séparé des champs d'effet). null si non fournie.
  const spec = newGame.startingHeroSpecialty;
  const startingSpecialty = spec
    ? { id: spec.id, effects: [Object.fromEntries(Object.entries(spec).filter(([k]) => k !== 'id')) as SkillRankEffect] }
    : null;
  return {
    spellCatalog,
    skillCatalog,
    artifactCatalog,
    startingSpells,
    startingArtifacts: newGame.startingArtifacts ?? [],
    startingAttributes: newGame.startingHero ?? { attack: 0, defense: 0, power: 0, knowledge: 0 },
    startingName: newGame.startingHeroName ?? '',
    startingSpecialty,
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
  houseCatalog: HouseCatalog = {},
  growthGroups: Record<string, string[]> = {},
  heroRoster: HeroRosterCatalog = {},
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
  // Villes **neutres** de la carte (Alpha 4.13) : tout objet `town` qui n'est
  // pas une ville de départ (référencée par `townSetup.towns`) devient une ville
  // sans propriétaire, dotée de sa garnison de données — assiégeable (doc 02 §4.1).
  const startTownIds = new Set(townSetup.towns.map((t) => t.id));
  const neutralTowns: TownState[] = map.objects.flatMap((obj) =>
    obj.type === 'town' && !startTownIds.has(obj.id)
      ? [
          {
            id: obj.id,
            ownerPlayerId: null,
            pos: { x: obj.pos.x, y: obj.pos.y },
            factionId: obj.factionId ?? '',
            buildings: {},
            builtToday: false,
            garrison: (obj.garrison ?? []).map((s) => ({ ...s })),
            stock: {},
            spellPool: [],
            sharedGrowthChoice: {},
          },
        ]
      : [],
  );
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
        ...(heroSetup.startingName ? { startingName: heroSetup.startingName } : {}),
        ...(heroSetup.startingSpecialty ? { startingSpecialtyId: heroSetup.startingSpecialty.id } : {}),
      },
    ],
    map: adventureMap,
    config: config.adventure,
    unitCatalog,
    buildingCatalog: townSetup.buildingCatalog,
    towns: [...townSetup.towns, ...neutralTowns],
    spellCatalog: heroSetup.spellCatalog,
    skillCatalog: heroSetup.skillCatalog,
    artifactCatalog: heroSetup.artifactCatalog,
    startingArtifacts: heroSetup.startingArtifacts,
    factionCatalog,
    houseCatalog,
    ...(heroSetup.startingSpecialty
      ? {
          specialtyCatalog: {
            [heroSetup.startingSpecialty.id]: { effects: heroSetup.startingSpecialty.effects },
          },
        }
      : {}),
    growthGroups,
    // Roster de héros nommés (M-TAVERN) : sans lui, la Taverne n'offre personne.
    heroRoster,
  };
}

/**
 * Construit la commande `StartGame` multi-joueurs d'un scénario résolu (doc
 * 02 §6, plan phase-3.5 lot U). `map` est déjà résolue par le contenu — même
 * chemin que `newGameCommand`/`loadDefaultMap` (le scénario ne porte que l'id
 * `scenario.map` ; sa résolution async vit dans `app/content.ts`, hors de ce
 * module qui ne fait que construire des données, jamais de fetch).
 *
 * Les joueurs sont ordonnés par `startPositionIndex` croissant : le moteur
 * assigne le héros du joueur à l'index i de `players` à `map.startPositions[i]`
 * (`StartGame` handler, `core/engine.ts`).
 *
 * Dotation héros (attributs/sorts) : celle par défaut du contenu
 * (`buildHeroSetup`), identique pour tous les joueurs humains et IA — garde
 * simple (décision de portée du lot U), le scénario ne surcharge que
 * ressources/armée/ville/faction/contrôleur.
 */
/**
 * Résout les quêtes de campagne d'un scénario (doc 13, N2b) en `QuestState`
 * moteur : on dépouille les champs CÔTÉ CLIENT (`titleKey`/`descriptionKey`/
 * `dialogBefore`/`kind`) — le moteur ne connaît que conditions + récompenses.
 * `undefined` si le scénario n'a pas de quêtes (pas de campagne).
 */
export function buildQuestState(scenario: Scenario): QuestState | undefined {
  if (!scenario.quests || scenario.quests.length === 0) return undefined;
  return {
    quests: scenario.quests.map((q) => ({
      def: {
        id: q.id,
        ...(q.playerId !== undefined ? { playerId: q.playerId } : {}),
        steps: q.steps.map((s) => ({ id: s.id, condition: s.condition })),
        rewards: q.rewards,
      },
      stepIndex: 0,
      status: 'active' as const,
    })),
  };
}

/**
 * Report de héros entre chapitres de campagne (doc 13 §4.1, N3a) — snapshot du
 * héros humain injecté dans le chapitre suivant. Client-only (hors `GameState`).
 */
export interface HeroCarry {
  level: number;
  xp: number;
  attributes: HeroAttributes;
  skills: Record<string, number>;
  spells: string[];
  artifacts: (string | null)[];
}

export function scenarioStartCommand(
  report: LoadReport,
  scenario: Scenario,
  seed: number,
  map: ResolvedMap,
  /** Report de héros (chapitre de campagne > 1) — dote le héros humain. */
  heroCarry?: HeroCarry,
): Command {
  const heroSetup = buildHeroSetup(report);
  const buildingCatalog = buildBuildingCatalog(report) as Record<string, BuildingDef>;
  const quests = buildQuestState(scenario);
  const orderedPlayers = [...scenario.players].sort(
    (a, b) => a.startPositionIndex - b.startPositionIndex,
  );
  if (map.startPositions.length < orderedPlayers.length) {
    throw new Error(
      `scenarioStartCommand: ${orderedPlayers.length} joueur(s) pour ${map.startPositions.length} ` +
        `position(s) de départ sur la carte '${map.id}'`,
    );
  }

  const players: PlayerSetup[] = orderedPlayers.map((p): PlayerSetup => {
    const startingResources: Resources = { ...emptyResources() };
    for (const [id, amount] of Object.entries(p.startingResources)) {
      startingResources[id as keyof Resources] = amount ?? 0;
    }
    return {
      id: p.id,
      startingResources,
      startingArmy: p.startingArmy.map((s) => ({ ...s })),
      startingAttributes: { ...heroSetup.startingAttributes },
      startingSpells: [...heroSetup.startingSpells],
      startingFactionId: p.factionId,
      controller: p.controller,
      ...(p.startingArtifacts ? { startingArtifacts: [...p.startingArtifacts] } : {}),
    };
  });

  // Report de héros (doc 13 §4.1, N3a) : le héros humain reprend niveau/XP/
  // attributs/compétences/sorts/artefacts du chapitre précédent.
  if (heroCarry) {
    const human = players.find((pl) => pl.controller === 'human');
    if (human) {
      human.startingLevel = heroCarry.level;
      human.startingXp = heroCarry.xp;
      human.startingAttributes = { ...heroCarry.attributes };
      human.startingSkills = { ...heroCarry.skills };
      human.startingSpells = [...heroCarry.spells];
      human.startingArtifacts = [...heroCarry.artifacts];
    }
  }

  const towns: TownState[] = orderedPlayers.flatMap((p) => {
    if (!p.startingTown) return [];
    const buildings: Record<string, number> = {};
    for (const pb of p.startingTown.prebuilt) buildings[pb.building] = pb.level;
    return [
      {
        id: p.startingTown.id,
        ownerPlayerId: p.id,
        pos: { x: p.startingTown.x, y: p.startingTown.y },
        factionId: p.factionId,
        buildings,
        builtToday: false,
        garrison: [],
        stock: {},
        spellPool: [],
        sharedGrowthChoice: {},
      },
    ];
  });

  // Villes **neutres** de la carte (Alpha 4.13) : tout objet `town` qui n'est pas
  // la ville de départ d'un joueur devient une ville sans propriétaire, dotée de
  // sa garnison de données — assiégeable par un héros (doc 02 §4.1).
  const startTownIds = new Set(towns.map((t) => t.id));
  for (const obj of map.objects) {
    if (obj.type !== 'town' || startTownIds.has(obj.id)) continue;
    towns.push({
      id: obj.id,
      ownerPlayerId: null,
      pos: { x: obj.pos.x, y: obj.pos.y },
      factionId: obj.factionId ?? '',
      buildings: {},
      builtToday: false,
      garrison: (obj.garrison ?? []).map((s) => ({ ...s })),
      stock: {},
      spellPool: [],
      sharedGrowthChoice: {},
    });
  }

  // Les objets `town` de la carte vivent dans `GameState.towns`, jamais dans
  // les objets d'aventure du moteur (resource/guardian) — voir `newGameCommand`.
  const adventureMap = {
    ...map,
    objects: map.objects.filter((o) => o.type !== 'town'),
  };

  return {
    type: 'StartGame',
    seed,
    players,
    map: adventureMap,
    config: report.content.config.adventure,
    unitCatalog: buildUnitCatalog(report),
    buildingCatalog,
    towns,
    spellCatalog: heroSetup.spellCatalog,
    skillCatalog: heroSetup.skillCatalog,
    artifactCatalog: heroSetup.artifactCatalog,
    startingArtifacts: heroSetup.startingArtifacts,
    factionCatalog: buildFactionSetup(report),
    houseCatalog: buildHouseSetup(report),
    heroRoster: buildHeroRosterSetup(report),
    growthGroups: buildGrowthGroupSetup(report),
    scenario: { objectives: buildScenarioObjectives(scenario) },
    ...(quests ? { quests } : {}),
  };
}

// --- Escarmouche vs IA (Alpha 4.14) ----------------------------------------

/** Cran de difficulté d'une escarmouche (doc 09) — label i18n côté client seul. */
export type SkirmishDifficulty = 'facile' | 'normal' | 'difficile';

/** Configuration d'une escarmouche choisie par le joueur (aucune donnée en dur). */
export interface SkirmishConfig {
  humanFactionId: string;
  /** Faction de l'adversaire (IA ou joueur 2 en hot-seat). */
  aiFactionId: string;
  difficulty: SkirmishDifficulty;
  /** Adversaire : IA (défaut) ou 2ᵉ joueur humain local (hot-seat, Alpha 4.15). */
  opponent?: 'ai' | 'human';
  /** Carte aléatoire générée (doc 09, Live 6.2) — sinon la carte par défaut. */
  randomMap?: boolean;
}

/**
 * Réglage de difficulté = **levier de données** (doc 09) : l'IA reçoit une armée
 * et des ressources mises à l'échelle, plus un Fort prébâti en difficile. Le
 * moteur ne voit que des nombres — **jamais** un enum de difficulté ni un nom de
 * faction. L'humain reste à la ligne de base (multiplicateurs 1, pas de Fort).
 */
const DIFFICULTY_TUNING: Record<
  SkirmishDifficulty,
  { aiArmyMult: number; aiResourceMult: number; aiFort: boolean }
> = {
  facile: { aiArmyMult: 0.6, aiResourceMult: 1, aiFort: false },
  normal: { aiArmyMult: 1, aiResourceMult: 1, aiFort: false },
  difficile: { aiArmyMult: 1.6, aiResourceMult: 1.5, aiFort: true },
};

/** Effectif de base de la pile T1 de départ (mis à l'échelle pour l'IA). */
const SKIRMISH_BASE_ARMY = 30;

/**
 * Unité T1 et habitation T1 d'une faction, dérivées **génériquement** de son
 * manifeste (`town.dwellings` tier 1) — repli sur la 1ʳᵉ unité de tier 1 du
 * paquet si la faction n'a pas de ville en données. Jamais un id en dur.
 */
function factionT1(pack: FactionPack): { unitId: string; dwellingBuilding: string | null } {
  const dwelling = pack.manifest.town?.dwellings.find((d) => d.tier === 1);
  if (dwelling) return { unitId: dwelling.unitId, dwellingBuilding: dwelling.buildingId };
  const unit = pack.units.find((u) => u.tier === 1) ?? pack.units[0];
  return { unitId: unit?.id ?? '', dwellingBuilding: null };
}

/** Ressources pleines depuis le barème `newGame`, multipliées et arrondies. */
function skirmishResources(config: GameConfig, mult: number): Resources {
  const res: Resources = { ...emptyResources() };
  for (const [id, amount] of Object.entries(config.newGame.startingResources)) {
    res[id as keyof Resources] = Math.round((amount ?? 0) * mult);
  }
  return res;
}

/**
 * Construit la commande `StartGame` d'une escarmouche 1 humain vs 1 IA (doc 09) :
 * scénario **généré à l'exécution** — mêmes rouages que `scenarioStartCommand`,
 * mais joueurs/villes/objectifs synthétisés depuis `config` plutôt que lus dans
 * un fichier. Chaque joueur démarre aux `map.startPositions[0/1]` avec sa ville
 * (townHall + habitation T1) et une pile de sa T1 ; la difficulté met l'IA à
 * l'échelle (données). Objectifs : `eliminateAllEnemies` / `defeatHero`.
 */
export function skirmishStartCommand(
  report: LoadReport,
  config: SkirmishConfig,
  seed: number,
  map: ResolvedMap,
  /** Quêtes journalières générées (doc 13, N4c) — embarquées comme pour un scénario. */
  quests?: QuestState,
): Command {
  if (map.startPositions.length < 2)
    throw new Error(`skirmishStartCommand: carte '${map.id}' — moins de 2 positions de départ`);
  const packById = (id: string): FactionPack => {
    const pack = report.content.packs.find((p) => p.manifest.id === id);
    if (!pack) throw new Error(`skirmishStartCommand: faction inconnue '${id}'`);
    return pack;
  };
  const heroSetup = buildHeroSetup(report);
  const buildingCatalog = buildBuildingCatalog(report) as Record<string, BuildingDef>;
  const tuning = DIFFICULTY_TUNING[config.difficulty];
  const gameConfig = report.content.config;

  const humanPack = packById(config.humanFactionId);
  const oppPack = packById(config.aiFactionId);
  const humanT1 = factionT1(humanPack);
  const oppT1 = factionT1(oppPack);

  // Hot-seat (adversaire humain) : parité stricte, pas de mise à l'échelle de
  // difficulté — celle-ci n'a de sens que contre l'IA.
  const opponent = config.opponent ?? 'ai';
  const armyMult = opponent === 'human' ? 1 : tuning.aiArmyMult;
  const resourceMult = opponent === 'human' ? 1 : tuning.aiResourceMult;
  const oppFort = opponent === 'human' ? false : tuning.aiFort;

  const seats = [
    {
      id: 'player-1',
      controller: 'human' as const,
      factionId: config.humanFactionId,
      army: [{ unitId: humanT1.unitId, count: SKIRMISH_BASE_ARMY }],
      resources: skirmishResources(gameConfig, 1),
      dwelling: humanT1.dwellingBuilding,
      fort: false,
    },
    {
      id: 'player-2',
      controller: opponent,
      factionId: config.aiFactionId,
      army: [{ unitId: oppT1.unitId, count: Math.round(SKIRMISH_BASE_ARMY * armyMult) }],
      resources: skirmishResources(gameConfig, resourceMult),
      dwelling: oppT1.dwellingBuilding,
      fort: oppFort,
    },
  ];

  const players: PlayerSetup[] = seats.map((s) => ({
    id: s.id,
    startingResources: s.resources,
    startingArmy: s.army.filter((a) => a.count > 0) as ArmyStack[],
    startingAttributes: { ...heroSetup.startingAttributes },
    startingSpells: [...heroSetup.startingSpells],
    startingFactionId: s.factionId,
    controller: s.controller,
  }));

  const towns: TownState[] = seats.map((s, i) => {
    const buildings: Record<string, number> = { townHall: 1 };
    if (s.dwelling) buildings[s.dwelling] = 1;
    if (s.fort) buildings['fort'] = 1;
    const pos = map.startPositions[i]!;
    return {
      id: `town-${s.id}`,
      ownerPlayerId: s.id,
      pos: { x: pos.x, y: pos.y },
      factionId: s.factionId,
      buildings,
      builtToday: false,
      garrison: [],
      stock: {},
      spellPool: [],
      sharedGrowthChoice: {},
    };
  });

  // Villes neutres de la carte (Alpha 4.13) — tout objet `town` non attribué.
  const startTownIds = new Set(towns.map((t) => t.id));
  for (const obj of map.objects) {
    if (obj.type !== 'town' || startTownIds.has(obj.id)) continue;
    towns.push({
      id: obj.id,
      ownerPlayerId: null,
      pos: { x: obj.pos.x, y: obj.pos.y },
      factionId: obj.factionId ?? '',
      buildings: {},
      builtToday: false,
      garrison: (obj.garrison ?? []).map((st) => ({ ...st })),
      stock: {},
      spellPool: [],
      sharedGrowthChoice: {},
    });
  }

  const objectives: ScenarioState['objectives'] = {};
  for (const s of seats) {
    objectives[s.id] = {
      victory: { type: 'eliminateAllEnemies' },
      defeat: { type: 'defeatHero', heroId: `hero-${s.id}` },
    };
  }

  const adventureMap = { ...map, objects: map.objects.filter((o) => o.type !== 'town') };

  return {
    type: 'StartGame',
    seed,
    players,
    map: adventureMap,
    config: gameConfig.adventure,
    unitCatalog: buildUnitCatalog(report),
    buildingCatalog,
    towns,
    spellCatalog: heroSetup.spellCatalog,
    skillCatalog: heroSetup.skillCatalog,
    artifactCatalog: heroSetup.artifactCatalog,
    startingArtifacts: heroSetup.startingArtifacts,
    factionCatalog: buildFactionSetup(report),
    houseCatalog: buildHouseSetup(report),
    heroRoster: buildHeroRosterSetup(report),
    growthGroups: buildGrowthGroupSetup(report),
    scenario: { objectives },
    ...(quests ? { quests } : {}),
  };
}

// --- Nouvelle partie configurable (doc 09, écran de configuration) ----------

/** Siège d'une nouvelle partie, déjà résolu (aucun « Aléatoire » ni slot fermé). */
export interface NewGameSeat {
  controller: 'human' | 'ai';
  factionId: string;
  /** Équipe/alliance (doc 02 §6) — 0 = sans alliance ; même n° = alliés. */
  team: number;
}

/**
 * Configuration résolue d'une « Nouvelle partie » (les choix « Aléatoire » sont
 * tirés depuis le seed AVANT d'arriver ici, dans `main.ts`). N joueurs sur une
 * carte générée à la taille choisie ; `resourceMultiplier` = réglage bas/riche
 * du **stock de départ** (la densité d'objets de la carte est réglée à la
 * génération, cf. `resolveGeneratedMap`).
 */
export interface NewGameSetupConfig {
  seats: NewGameSeat[];
  difficulty: SkirmishDifficulty;
  resourceMultiplier: number;
}

/** Sentinelle « laisser au tirage aléatoire » d'un paramètre de configuration. */
export const RANDOM = 'random';

/** Crans de difficulté proposés (mêmes que l'escarmouche) — pour le tirage aléatoire. */
export const NEWGAME_DIFFICULTIES: SkirmishDifficulty[] = ['facile', 'normal', 'difficile'];

/**
 * Taille de carte → dimension carrée (tuiles). Rendu chunké + culling au viewport
 * (`Tilemap`) rend les grandes cartes jouables ; plafond schéma = 256 (`schemas.ts`).
 */
export const MAP_SIZE_DIMENSIONS = { small: 64, medium: 96, large: 128, huge: 256 } as const;
export type MapSize = keyof typeof MAP_SIZE_DIMENSIONS;
/** Ordre d'affichage / tirage aléatoire des tailles. */
export const MAP_SIZE_ORDER = ['small', 'medium', 'large', 'huge'] as const;

/**
 * Réglage bas/standard/riche : `start` = échelle du stock de départ ; `mapDensity`
 * = échelle de la densité d'objets de la carte générée (ressources/mines/trésors).
 */
export const RESOURCE_LEVEL_TUNING = {
  bas: { start: 0.5, mapDensity: 0.6 },
  standard: { start: 1, mapDensity: 1 },
  riche: { start: 2, mapDensity: 1.6 },
} as const;
export type ResourceLevel = keyof typeof RESOURCE_LEVEL_TUNING;

/** Slot de joueur tel que choisi à l'écran (avant résolution des « Aléatoire »). */
export interface NewGameSlot {
  /** `off` = siège fermé (ignoré). */
  controller: 'human' | 'ai' | 'off';
  /** Id de faction, ou `RANDOM` pour un tirage. */
  factionId: string;
  /** Couleur du joueur (0xRRGGBB) — présentation client uniquement (lot 6.4). */
  color: number;
  /** Équipe/alliance (doc 02 §6) — 0 = sans alliance ; même n° = alliés. */
  team: number;
}

/** Configuration BRUTE émise par l'écran « Nouvelle partie » (paramètres possiblement `RANDOM`). */
export interface NewGameRawConfig {
  slots: NewGameSlot[];
  mapSize: MapSize | typeof RANDOM;
  resourceLevel: ResourceLevel | typeof RANDOM;
  difficulty: SkirmishDifficulty | typeof RANDOM;
  seed: number;
}

/** Configuration résolue : sièges + réglages moteur, + options de génération de carte. */
export interface ResolvedNewGame {
  setup: NewGameSetupConfig;
  map: { width: number; height: number; startPositionCount: number; resourceMultiplier: number };
  /**
   * Couleur par id de joueur (`player-{i+1}`, aligné sur `newGameStartCommand`).
   * Présentation client (posée dans `store.playerColors`) — hors moteur.
   */
  colors: Record<string, number>;
}

/**
 * Résout une config brute : chaque paramètre laissé sur `RANDOM` est tiré
 * **déterministiquement** depuis `seed` (RNG seedé moteur — reproductible, jamais
 * `Math.random`). Les slots fermés sont écartés. Fonction pure (testable) : le
 * `main.ts` n'a plus qu'à générer la carte et construire la commande.
 */
export function resolveNewGameConfig(
  raw: NewGameRawConfig,
  factionIds: string[],
  seed: number,
): ResolvedNewGame {
  let rng = seedRng(seed);
  const pick = <T>(arr: readonly T[]): T => {
    const r = rollRange(rng, 0, arr.length - 1);
    rng = r.state;
    return arr[r.value]!;
  };
  const openSlots = raw.slots.filter((s) => s.controller !== 'off');
  const seats: NewGameSeat[] = openSlots.map((s) => ({
    controller: s.controller === 'ai' ? 'ai' : 'human',
    factionId: s.factionId === RANDOM ? pick(factionIds) : s.factionId,
    team: s.team,
  }));
  // Couleur par joueur, alignée sur l'ordre des sièges (= `player-{i+1}` du moteur).
  const colors: Record<string, number> = {};
  openSlots.forEach((s, i) => {
    colors[`player-${i + 1}`] = s.color;
  });
  const mapSize: MapSize = raw.mapSize === RANDOM ? pick(MAP_SIZE_ORDER) : raw.mapSize;
  const resourceLevel: ResourceLevel =
    raw.resourceLevel === RANDOM ? pick(['bas', 'standard', 'riche'] as const) : raw.resourceLevel;
  const difficulty: SkirmishDifficulty =
    raw.difficulty === RANDOM ? pick(NEWGAME_DIFFICULTIES) : raw.difficulty;
  const dim = MAP_SIZE_DIMENSIONS[mapSize];
  const res = RESOURCE_LEVEL_TUNING[resourceLevel];
  return {
    setup: { seats, difficulty, resourceMultiplier: res.start },
    map: { width: dim, height: dim, startPositionCount: seats.length, resourceMultiplier: res.mapDensity },
    colors,
  };
}

/**
 * Construit le `StartGame` d'une nouvelle partie à N joueurs — généralisation de
 * `skirmishStartCommand` : mêmes rouages (villes T1 synthétisées, objectifs
 * eliminate/defeatHero, villes neutres de la carte), mais un nombre quelconque
 * de sièges humains (hot-seat) et/ou IA. La difficulté ne met à l'échelle QUE
 * les sièges IA (armée + ressources + Fort) ; les humains restent à la base. Le
 * réglage bas/riche multiplie le stock de départ de TOUS les joueurs.
 */
export function newGameStartCommand(
  report: LoadReport,
  config: NewGameSetupConfig,
  seed: number,
  map: ResolvedMap,
): Command {
  if (map.startPositions.length < config.seats.length) {
    throw new Error(
      `newGameStartCommand: ${config.seats.length} joueur(s) pour ` +
        `${map.startPositions.length} position(s) de départ sur '${map.id}'`,
    );
  }
  const packById = (id: string): FactionPack => {
    const pack = report.content.packs.find((p) => p.manifest.id === id);
    if (!pack) throw new Error(`newGameStartCommand: faction inconnue '${id}'`);
    return pack;
  };
  const heroSetup = buildHeroSetup(report);
  const buildingCatalog = buildBuildingCatalog(report) as Record<string, BuildingDef>;
  const tuning = DIFFICULTY_TUNING[config.difficulty];
  const gameConfig = report.content.config;

  const seats = config.seats.map((seat, i) => {
    const t1 = factionT1(packById(seat.factionId));
    const isAi = seat.controller === 'ai';
    const armyMult = isAi ? tuning.aiArmyMult : 1;
    // Réglage bas/riche sur le stock, cumulé avec le bonus de ressources IA.
    const resourceMult = config.resourceMultiplier * (isAi ? tuning.aiResourceMult : 1);
    return {
      id: `player-${i + 1}`,
      controller: seat.controller,
      factionId: seat.factionId,
      team: seat.team,
      army: [{ unitId: t1.unitId, count: Math.round(SKIRMISH_BASE_ARMY * armyMult) }],
      resources: skirmishResources(gameConfig, resourceMult),
      dwelling: t1.dwellingBuilding,
      fort: isAi ? tuning.aiFort : false,
    };
  });

  const players: PlayerSetup[] = seats.map((s) => ({
    id: s.id,
    startingResources: s.resources,
    startingArmy: s.army.filter((a) => a.count > 0) as ArmyStack[],
    startingAttributes: { ...heroSetup.startingAttributes },
    startingSpells: [...heroSetup.startingSpells],
    startingFactionId: s.factionId,
    controller: s.controller,
    team: s.team,
  }));

  const towns: TownState[] = seats.map((s, i) => {
    const buildings: Record<string, number> = { townHall: 1 };
    if (s.dwelling) buildings[s.dwelling] = 1;
    if (s.fort) buildings['fort'] = 1;
    const pos = map.startPositions[i]!;
    return {
      id: `town-${s.id}`,
      ownerPlayerId: s.id,
      pos: { x: pos.x, y: pos.y },
      factionId: s.factionId,
      buildings,
      builtToday: false,
      garrison: [],
      stock: {},
      spellPool: [],
      sharedGrowthChoice: {},
    };
  });

  // Villes neutres de la carte (Alpha 4.13) — tout objet `town` non attribué.
  const startTownIds = new Set(towns.map((t) => t.id));
  for (const obj of map.objects) {
    if (obj.type !== 'town' || startTownIds.has(obj.id)) continue;
    towns.push({
      id: obj.id,
      ownerPlayerId: null,
      pos: { x: obj.pos.x, y: obj.pos.y },
      factionId: obj.factionId ?? '',
      buildings: {},
      builtToday: false,
      garrison: (obj.garrison ?? []).map((st) => ({ ...st })),
      stock: {},
      spellPool: [],
      sharedGrowthChoice: {},
    });
  }

  const objectives: ScenarioState['objectives'] = {};
  for (const s of seats) {
    objectives[s.id] = {
      victory: { type: 'eliminateAllEnemies' },
      defeat: { type: 'defeatHero', heroId: `hero-${s.id}` },
    };
  }

  const adventureMap = { ...map, objects: map.objects.filter((o) => o.type !== 'town') };

  return {
    type: 'StartGame',
    seed,
    players,
    map: adventureMap,
    config: gameConfig.adventure,
    unitCatalog: buildUnitCatalog(report),
    buildingCatalog,
    towns,
    spellCatalog: heroSetup.spellCatalog,
    skillCatalog: heroSetup.skillCatalog,
    artifactCatalog: heroSetup.artifactCatalog,
    startingArtifacts: heroSetup.startingArtifacts,
    factionCatalog: buildFactionSetup(report),
    growthGroups: buildGrowthGroupSetup(report),
    // Roster de héros nommés (M-TAVERN) : sans lui, la Taverne n'offre personne.
    heroRoster: buildHeroRosterSetup(report),
    scenario: { objectives },
  };
}
