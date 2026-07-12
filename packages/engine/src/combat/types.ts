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
  /**
   * Tier de l'unité (doc 02 §4) — estampillé depuis les données. Utilisé par les
   * effets ciblant les hauts tiers (F-BUILDEFF.5, Cercle Abîme). Optionnel :
   * absent pour les unités hors habitation (machines de guerre) ⇒ traité comme 0.
   */
  tier?: number;
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
  /** Charges de sort restantes (`spellcaster`, doc 02 §5.4, A2h) — 0 pour toute unité non lanceuse. */
  spellCharges: number;
  /** Charges de Marque subies, 0–3 (doc 05 §3.1, générique). */
  marks: number;
  /** Tours d'immobilisation restants (doc 05 §3.1 `pinningShot`) : saute son tour tant que > 0. */
  immobilizedRounds: number;
  /** Forme démon activée (capacité `demonform`, doc 05 §4) : bascule à la 1ʳᵉ attaque. */
  transformed: boolean;
  /**
   * Paliers de Symbiose accumulés (capacité `symbiosis`, doc 14 §2, Beta 5.3) :
   * +1 à chaque Défense, remis à 0 sur un déplacement/une attaque volontaire (la
   * riposte ne réinitialise pas), plafonné à `maxStacks`. Bonus Att/Déf = paliers
   * × params. 0 pour toute unité sans la capacité.
   */
  symbiosisStacks: number;
  /** A déjà agi ce round (vagues par vitesse décroissante — doc 02 §5.2). */
  acted: boolean;
  /**
   * Furtivité (F-SCHOOLS.7, doc 05 §6 « Mue Éphémère ») : tant que `true`, la pile
   * est INCIBLABLE par l'ennemi (attaque/tir/sort/frappe de héros) ; retombe quand
   * elle prend sa prochaine action réelle. **Optionnel** : absent pour toute pile
   * non furtive (jamais posé hors sort).
   */
  stealthed?: boolean;
  /** Statuts temporaires de sorts (buff/debuff, doc 02 §1.4) — vide par défaut. */
  statuses: SpellStatus[];
}

export interface CombatState {
  /** Terrain d'aventure du combat (bonus natif +1 vitesse/+1 moral — doc 02 §5.1). */
  terrain: string;
  /**
   * Phase du combat (C-TACTICS, doc 02 §5.1) : `'placement'` = phase de placement
   * tactique préalable (le camp joueur repositionne ses piles dans sa bande via
   * `PlaceStack`, `activeStackId` null, aucun tour joué) ; `'battle'` = combat en
   * cours. Un combat sans compétence Tactique démarre directement en `'battle'`.
   */
  phase: 'placement' | 'battle';
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
  /** Ville assiégée (doc 02 §4.1, Alpha 4.13) — null hors combat de ville ; capture à la victoire. */
  townId: string | null;
  /** Bonus de défense « murs » du Fort accordé aux piles défenseure (0 hors siège). */
  wallDefenseBonus: number;
  /** Héros liés aux camps (attributs + sorts, doc 02 §5) — null si sans héros. */
  attackerHeroId: string | null;
  defenderHeroId: string | null;
  /**
   * Camps dont le héros a déjà lancé un sort CE round (1/round par camp,
   * doc 02 §5.2) — remis à vide au changement de round. Liste par camp (comme
   * `heroAttackUsed`) depuis C-AIPARITY : l'IA lance aussi, un booléen partagé
   * créait une course entre les deux camps.
   */
  heroCastThisRound: CombatSideId[];
  /** Camps ayant déjà utilisé l'attaque de leur héros ce combat (1×/combat, C1). */
  heroAttackUsed: CombatSideId[];
  /**
   * Heure de la Curée (F-SCHOOLS.6, doc 05 §6) : tant que présent, les attaques
   * du camp `side` contre une pile MARQUÉE n'essuient aucune riposte. `roundsLeft`
   * décroît au passage de round (retiré à 0). **Optionnel** ⇒ vieilles saves
   * gracieuses (pas de bump de version) et combats sans Curée l'omettent.
   */
  markedNoRetaliation?: { side: CombatSideId; roundsLeft: number };
  finished: boolean;
  winner: CombatSideId | null;
}

/** Action de la pile ACTIVE du camp joueur (doc 02 §5.2). */
export type CombatActionInput =
  | { type: 'move'; to: OffsetPos }
  /** Mêlée : `from` = hex d'où frapper (déplacement inclus) ; tir : omis. */
  | { type: 'attack'; targetStackId: string; from?: OffsetPos }
  /** Lancer de sort d'unité (`spellcaster`, A2h) : la pile active lance son sort embarqué. */
  | { type: 'castSpell'; targetStackId: string }
  | { type: 'wait' }
  | { type: 'defend' };
