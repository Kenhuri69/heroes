import type { OffsetPos } from './hex';
import type { ResourceId } from '../core/state';
import type { SpellStatus } from '../hero/types';

/**
 * Types du combat hex — SURFACE FIGÉE en cadrage (plan phase-2.4) : les lots
 * A (règles), B (IA) et C (scène) programment contre ces formes. Toute
 * évolution passe par la session principale.
 */

/** Pile d'armée hors combat (héros, gardien, armée d'arène) : id d'unité + effectif. */
export interface ArmyStack {
  unitId: string;
  count: number;
}

/**
 * Définition d'unité résolue par le pipeline de contenu et embarquée dans
 * `StartGame.unitCatalog`. `groupId` = id du paquet d'origine, opaque pour le
 * moteur (malus moral multi-groupes, bonus `mark` au même camp — doc 02 §5.3).
 */
export interface CombatUnitDef {
  id: string;
  groupId: string;
  nativeTerrain: string;
  stats: {
    hp: number;
    attack: number;
    defense: number;
    damage: [number, number];
    speed: number;
  };
  abilities: { id: string; params?: Record<string, unknown> | undefined }[];
  /** Coût de recrutement en ville (doc 02 §4) — absent ⇒ gratuit (unités hors habitation). */
  recruitCost?: Partial<Record<ResourceId, number>>;
  /** Croissance hebdomadaire de l'habitation (doc 02 §4.1) — absent ⇒ pas de stock généré. */
  growthPerWeek?: number;
}

export type CombatSideId = 'attacker' | 'defender';

/** Pile engagée en combat. `firstHp` = PV restants de la première créature (doc 02 §5.3). */
export interface CombatStack {
  id: string; // `${side}-${slot}`
  side: CombatSideId;
  slot: number;
  unitId: string;
  count: number;
  firstHp: number;
  pos: OffsetPos;
  /** Ripostes restantes ce round (1/round — doc 02 §5.2, ∞ via capacité future). */
  retaliationsLeft: number;
  /** A choisi Attendre ce round : rejoue en fin de round, vitesse croissante. */
  waited: boolean;
  /** Défense ×1,3 jusqu'à son prochain tour (doc 02 §5.2). */
  defending: boolean;
  /** Munitions restantes (null = pas un tireur). */
  ammo: number | null;
  /** Charges de Marque subies, 0–3 (doc 05 §3.1, générique). */
  marks: number;
  /** Tours d'immobilisation restants (doc 05 §3.1 `pinningShot`) : saute son tour tant que > 0. */
  immobilizedRounds: number;
  /** Forme démon activée (capacité `demonform`, doc 05 §4) : bascule à la 1ʳᵉ attaque. */
  transformed: boolean;
  /** A déjà agi ce round (vagues par vitesse décroissante — doc 02 §5.2). */
  acted: boolean;
  /** Statuts temporaires de sorts (buff/debuff, doc 02 §1.4) — vide par défaut. */
  statuses: SpellStatus[];
}

export interface CombatState {
  /** Terrain d'aventure du combat (bonus natif +1 vitesse/+1 moral — doc 02 §5.1). */
  terrain: string;
  round: number;
  obstacles: OffsetPos[];
  stacks: CombatStack[];
  /** Pile dont c'est le tour (id), null si combat terminé. */
  activeStackId: string | null;
  /** Camp contrôlé par le joueur ; l'autre camp est joué par l'IA moteur. */
  playerSide: CombatSideId;
  /** Contexte aventure — null en arène `/#arena`. */
  heroId: string | null;
  guardianObjectId: string | null;
  /** Héros liés aux camps (attributs + sorts, doc 02 §5) — null si sans héros. */
  attackerHeroId: string | null;
  defenderHeroId: string | null;
  /** Le héros du camp joueur a déjà lancé un sort ce round (1/round, doc 02 §5.2). */
  heroCastThisRound: boolean;
  finished: boolean;
  winner: CombatSideId | null;
}

/** Action de la pile ACTIVE du camp joueur (doc 02 §5.2). */
export type CombatActionInput =
  | { type: 'move'; to: OffsetPos }
  /** Mêlée : `from` = hex d'où frapper (déplacement inclus) ; tir : omis. */
  | { type: 'attack'; targetStackId: string; from?: OffsetPos }
  | { type: 'wait' }
  | { type: 'defend' };
