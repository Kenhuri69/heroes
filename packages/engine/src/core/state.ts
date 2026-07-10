import type { AdventureConfig } from '../adventure/config';
import type { AdventureMapDef, GridPos } from '../adventure/map';
import type { ArmyStack, CombatState, CombatUnitDef } from '../combat/types';
import type { BuildingDef, TownState } from '../town/types';
import type { ArtifactDef, HeroSkillDef, SkillRankEffect, SpellDef } from '../hero/types';
import type { FactionBonus } from '../faction/types';
import type { GameOutcome, ScenarioState } from '../scenario/types';
import type { QuestState } from '../quest/types';
import type { RngState } from './rng';

/** Les 7 ressources du jeu (doc 02 §3). Les montants vivent dans les données. */
export const RESOURCE_IDS = [
  'gold',
  'wood',
  'ore',
  'crystal',
  'gems',
  'sulfur',
  'mercury',
] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];
export type Resources = Record<ResourceId, number>;

export interface PlayerState {
  id: string;
  resources: Resources;
  /**
   * Ressources de faction (doc 05 §3.3, doc 06 §3 `factionResources`) — carte
   * générique id→montant, le moteur ne connaît aucun nom de ressource de
   * faction. `{}` pour les factions sans ressource de faction déclarée.
   */
  factionResources: Record<string, number>;
  /** Brouillard exploré, 0/1 par tuile row-major (doc 02 §2.1) — par joueur. */
  explored: number[];
  /** Qui joue ce joueur (doc 02 §6, plan phase-3.5) — l'IA ne joue que `'ai'`. */
  controller: 'human' | 'ai';
  /** Éliminé (sans ville ni héros) — ne joue plus, exclu des vivants. */
  eliminated: boolean;
  /**
   * Grâce de reprise de ville (doc 02 §4.1). Sentinelle :
   * `-1` = n'a **jamais** possédé de ville (héros de survie — jamais sur le
   * minuteur) ; `0` = possède une ville ; `n>0` = jours écoulés depuis la perte
   * de sa dernière ville. Au-delà de `RETAKE_GRACE_DAYS`, un joueur qui garde un
   * héros est éliminé. La règle ne s'arme qu'une fois une ville possédée.
   */
  townlessDays: number;
  /**
   * Contrat de chasse actif (doc 05 §3.3) — assigné au passage de semaine si le
   * joueur possède un bâtiment `huntContract` ; `null` sinon. La cible est un
   * objet neutre de la carte ; la vaincre crédite la récompense puis remet à
   * `null`. Générique : `resource` est un id opaque (ressource de faction).
   */
  huntContract: { targetObjectId: string; gold: number; resource: string; amount: number } | null;
  /**
   * Équipe / alliance (doc 02 §6) — entier opaque. **`0` = sans alliance** :
   * ennemi de tous, y compris des autres joueurs à `0` (partie chacun-pour-soi,
   * comportement historique). Deux joueurs de MÊME équipe **non nulle** sont
   * alliés (`areAllies`) : ils ne s'assiègent pas et partagent la victoire.
   */
  team: number;
}

/**
 * Deux joueurs sont-ils alliés ? Générique (aucune faction) : même équipe **non
 * nulle** et ids distincts. `team === 0` (défaut) = sans alliance ⇒ jamais allié,
 * donc les parties chacun-pour-soi se comportent comme avant l'ajout des équipes.
 */
export function areAllies(
  a: Pick<PlayerState, 'id' | 'team'>,
  b: Pick<PlayerState, 'id' | 'team'>,
): boolean {
  return a.id !== b.id && a.team !== 0 && a.team === b.team;
}

/** Attributs primaires du héros (doc 02 §1.1) — effets câblés au MVP. */
export interface HeroAttributes {
  attack: number;
  defense: number;
  power: number;
  knowledge: number;
}

export interface HeroState {
  id: string;
  playerId: string;
  pos: GridPos;
  /** Points de mouvement restants aujourd'hui (doc 02 §1.5), restaurés chaque jour. */
  movementPoints: number;
  /** Armée du héros, ≤ 7 piles (doc 02 §5.1) — vide tant que rien n'est recruté. */
  army: ArmyStack[];
  /** Progression (doc 02 §1.2) : XP cumulée, niveau (cap en config), attributs. */
  xp: number;
  level: number;
  attributes: HeroAttributes;
  /** Magie (doc 02 §1.1) : mana courant / max = Savoir × 10. */
  mana: number;
  manaMax: number;
  /** Compétences secondaires (doc 02 §1.3) : id → rang 1..3, ≤ 6. */
  skills: Record<string, number>;
  /**
   * Chance de fontaine (doc 02 §2.2, lieu de bonus `luck`) — s'ajoute à la
   * chance du héros en combat puis est consommée à la fin du prochain combat.
   */
  visitLuck: number;
  /** Sorts connus (ids du catalogue) — lançables selon cercle/mana. */
  spells: string[];
  /** Équipement d'artefacts, 10 slots (doc 08 §2.3) — null = vide. */
  artifacts: (string | null)[];
  /** Propositions de compétence en attente d'un `ChooseSkill` (doc 02 §1.2). */
  pendingSkillChoices: string[];
  /** Maison du héros (doc 06 §4) — id opaque pour le moteur, '' = aucune. */
  factionId: string;
  /**
   * Allégeance de Maison (doc 16 §3.1) — id opaque, '' = aucune. Distinct de
   * `factionId` (la faction) : une faction peut proposer plusieurs Maisons, et
   * le héros en choisit une à la création.
   */
  houseId: string;
  /**
   * Effets déclaratifs RÉSOLUS de la Maison (doc 16 §3.1) — mêmes champs que les
   * compétences (`SkillRankEffect`), résolus depuis le manifeste à la création du
   * héros et agrégés dans `hero/skills.ts` au même titre que les compétences.
   * `[]` = aucune Maison. Le moteur ne compare jamais qu'un id ('' vs autre),
   * jamais un nom de faction/Maison.
   */
  houseEffects: SkillRankEffect[];
  /**
   * Machines de guerre possédées (doc 02 §5, Alpha 4.12) — ids d'unités du
   * catalogue, ≤ 1 de chaque. Achetées à la Forge ; elles rejoignent le camp du
   * héros en combat comme piles supplémentaires (hors cap 7 de l'armée).
   */
  warMachines: string[];
}

export interface Calendar {
  /** Jour absolu, commence à 1. Semaine = floor((day-1)/7)+1 (doc 02 §2.3). */
  day: number;
}

/**
 * L'état complet d'une partie — un seul arbre JSON-sérialisable (doc 07 §3) :
 * c'est à la fois le format de sauvegarde et le futur état re-simulable serveur.
 * Carte et constantes d'équilibrage sont EMBARQUÉES par `StartGame` : le
 * journal de commandes reste re-simulable même si les données évoluent.
 */
/**
 * Version de forme de la sauvegarde — source unique de vérité (doc 07 §4).
 * À **incrémenter** dès que la forme de `GameState` change de façon incompatible
 * (nouveaux champs requis, renommage…). Le chargement rejette proprement toute
 * sauvegarde d'une autre version plutôt que d'adopter un état malformé.
 * (v2 : couvre les champs `factionCatalog`/`scenario`/`outcome`/`controller`/
 * `eliminated` introduits en 3.4/3.5. v3 : `PlayerState.factionResources`
 * introduit en 4.4. v4 : `PlayerState.townlessDays` + `AdventureMapDef.triggers`
 * introduits par le comblement MVP — triggers de carte & grâce de reprise.
 * v5 : `PlayerState.huntContract` — contrats de chasse, doc 05 §3.3.
 * v6 : `HeroState.warMachines` — machines de guerre, doc 02 §5.
 * v7 : `GameState.quests` — système de quêtes générique, doc 13 §6.2 (N2a).
 * v8 : objets de carte `mine`/`treasure`/`artifact`/`visitable`/`dwelling`,
 * `GameState.pendingTreasure` et `HeroState.visitLuck` — éléments de carte
 * manquants, doc 02 §2.2.
 * v9 : `TownState.spellPool` — pool de sorts de la guilde des mages (G2), doc
 * 02 §4.1.
 * v10 : `HeroState.houseId` + `HeroState.houseEffects` — allégeance de Maison
 * (signature Vox Arcana `houseAllegiance`, doc 16 §3.1).
 * v11 : `GameState.houseCatalog` — catalogue des Maisons embarqué, lu par
 * l'effet de bâtiment `houseChoice` (« Le Choixpeau », doc 16 §3.1/§5).
 * v12 : `CombatState.heroAttackUsed` — attaque du héros 1×/combat (C1), doc 02 §5.2.
 * v13 : `PlayerState.team` — alliances/équipes (doc 02 §6) : joueurs alliés qui
 * ne s'assiègent pas et partagent la victoire ; `0` = sans alliance.
 * v14 : `GameState.growthGroups` + `TownState.sharedGrowthChoice` — croissance
 * partagée « apex » (doc 05 §3.1/§8) : un groupe d'unités partage 1 croissance
 * hebdo, le joueur choisit le destinataire.
 * v15 : `SpellStatus.damageDealtMod` — malédiction `curseOnHit` « Faux funeste »
 * (Cavalier funeste, doc 04 §3, A2c) : réduit multiplicativement les dégâts
 * infligés par la pile maudite.)
 */
export const CURRENT_SAVE_VERSION = 15;

export interface GameState {
  saveVersion: number;
  /** Partie non démarrée tant que `StartGame` n'a pas été appliquée. */
  started: boolean;
  rng: RngState;
  calendar: Calendar;
  players: PlayerState[];
  /** Index du joueur dont c'est le tour. */
  currentPlayer: number;
  config: AdventureConfig | null;
  map: AdventureMapDef | null;
  heroes: HeroState[];
  /** Catalogue d'unités résolu par le contenu (doc 06) — le moteur ne voit que des IDs. */
  unitCatalog: Record<string, CombatUnitDef>;
  /** Catalogue de bâtiments résolu par le contenu (doc 06). */
  buildingCatalog: Record<string, BuildingDef>;
  /** Catalogues héros résolus par le contenu (doc 06). */
  spellCatalog: Record<string, SpellDef>;
  skillCatalog: Record<string, HeroSkillDef>;
  artifactCatalog: Record<string, ArtifactDef>;
  /** Villes de la partie (doc 02 §4) — vide tant qu'aucune n'est placée. */
  towns: TownState[];
  /** Combat en cours (doc 02 §5) — null hors combat. */
  combat: CombatState | null;
  /**
   * Effets de faction déclaratifs résolus par le contenu (doc 06 §4), indexés
   * par `factionId` — le moteur applique le `type` générique sans jamais
   * connaître de nom de faction.
   */
  factionCatalog: Record<string, { bonuses: FactionBonus[] }>;
  /**
   * Catalogue des Maisons résolu par le contenu (doc 16 §3.1), indexé par
   * `houseId` → effets déclaratifs. Embarqué par `StartGame` ; lu à la
   * construction du « Choixpeau » (effet `houseChoice`) pour stamper les héros —
   * le moteur ne connaît que des ids opaques.
   */
  houseCatalog: Record<string, { effects: SkillRankEffect[] }>;
  /**
   * Groupes de croissance partagée (doc 05 §3.1/§8), indexés par id de groupe
   * opaque → unités membres. Résolu par le contenu depuis les manifestes
   * (`sharedGrowthGroups`), embarqué par `StartGame`. Les membres d'un même
   * groupe **partagent une seule croissance hebdomadaire** ; le joueur choisit le
   * destinataire par ville (`TownState.sharedGrowthChoice`). `{}` = aucun groupe.
   * Le moteur ne connaît que des ids opaques — aucun nom de faction.
   */
  growthGroups: Record<string, string[]>;
  /**
   * Objectifs du scénario par joueur (doc 02 §6, plan phase-3.5) — `null` en
   * partie libre : aucune évaluation de fin de partie.
   */
  scenario: ScenarioState | null;
  /** Issue de la partie (doc 02 §6) — `null` tant qu'elle est en cours. */
  outcome: GameOutcome | null;
  /**
   * Trésor foulé en attente du choix or/XP (doc 02 §2.2) — posé par le
   * mouvement, résolu par `ResolveTreasure`. `MoveHero`/`EndTurn` sont refusés
   * tant qu'il est posé ; `null` sinon.
   */
  pendingTreasure: {
    heroId: string;
    playerId: string;
    objectId: string;
    gold: number;
    xp: number;
  } | null;
  /**
   * Quêtes de campagne (doc 13 §6.2, N2a) — embarquées par `StartGame`, `null`
   * hors campagne (partie libre / scénario nu). Le moteur évalue des conditions
   * génériques ; il ne connaît ni texte ni dialogue.
   */
  quests: QuestState | null;
}

export function createEmptyState(): GameState {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    started: false,
    rng: { hi: 0, lo: 0, incHi: 0, incLo: 0 },
    calendar: { day: 1 },
    players: [],
    currentPlayer: 0,
    config: null,
    map: null,
    heroes: [],
    unitCatalog: {},
    buildingCatalog: {},
    spellCatalog: {},
    skillCatalog: {},
    artifactCatalog: {},
    towns: [],
    combat: null,
    factionCatalog: {},
    houseCatalog: {},
    growthGroups: {},
    scenario: null,
    outcome: null,
    pendingTreasure: null,
    quests: null,
  };
}

export function weekOf(day: number): number {
  return Math.floor((day - 1) / 7) + 1;
}

/**
 * Id du joueur humain (contrôleur `'human'`) de la partie — la vérité est le
 * champ `controller`, pas une convention `'player-1'` (remédiation R3/CL5 : un
 * scénario peut nommer autrement son joueur humain). `null` hors partie ou si
 * aucun joueur humain (partie IA-vs-IA). Le premier humain trouvé en MVP solo.
 */
export function humanPlayerId(state: GameState): string | null {
  return state.players.find((p) => p.controller === 'human')?.id ?? null;
}

export function emptyResources(): Resources {
  return { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 };
}
