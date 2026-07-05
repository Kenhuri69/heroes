import type { AdventureConfig } from '../adventure/config';
import type { AdventureMapDef, GridPos } from '../adventure/map';
import type { ArmyStack, CombatState, CombatUnitDef } from '../combat/types';
import type { BuildingDef, TownState } from '../town/types';
import type { ArtifactDef, HeroSkillDef, SpellDef } from '../hero/types';
import type { FactionBonus } from '../faction/types';
import type { GameOutcome, ScenarioState } from '../scenario/types';
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
  /** Sorts connus (ids du catalogue) — lançables selon cercle/mana. */
  spells: string[];
  /** Équipement d'artefacts, 10 slots (doc 08 §2.3) — null = vide. */
  artifacts: (string | null)[];
  /** Propositions de compétence en attente d'un `ChooseSkill` (doc 02 §1.2). */
  pendingSkillChoices: string[];
  /** Maison du héros (doc 06 §4) — id opaque pour le moteur, '' = aucune. */
  factionId: string;
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
 * introduit en 4.4.)
 */
export const CURRENT_SAVE_VERSION = 3;

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
   * Objectifs du scénario par joueur (doc 02 §6, plan phase-3.5) — `null` en
   * partie libre : aucune évaluation de fin de partie.
   */
  scenario: ScenarioState | null;
  /** Issue de la partie (doc 02 §6) — `null` tant qu'elle est en cours. */
  outcome: GameOutcome | null;
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
    scenario: null,
    outcome: null,
  };
}

export function weekOf(day: number): number {
  return Math.floor((day - 1) / 7) + 1;
}

export function emptyResources(): Resources {
  return { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 };
}
