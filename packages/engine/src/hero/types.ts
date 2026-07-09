import type { ResourceId } from '../core/state';

/**
 * Types compétences / sorts / artefacts — SURFACE FIGÉE en cadrage
 * (plan phase-3.2). Lots K (règles), L (contenu), M (UI) programment contre
 * ces formes. Le moteur ne connaît aucune faction : tout est id + données.
 */

/**
 * École de magie d'un sort (doc 02 §1.4). **Chaîne opaque pour le moteur** (D11) :
 * le moteur ne compare que l'égalité d'école (réduction de mana par école, A6) et
 * n'énumère aucune école — l'ensemble valide est défini par les **données** et
 * validé par `@heroes/content` (écoles génériques fire/water/earth/air/neutral +
 * écoles de faction, ex. `traque`). Ajouter une école de faction = donnée +
 * registre de contenu, jamais un diff moteur.
 */
export type SpellSchool = string;
export type SpellKind = 'damage' | 'heal' | 'buff' | 'debuff' | 'applyMarks' | 'adventure';

/**
 * Effet déclaratif d'un sort d'**aventure** (doc 02 §1.4, Alpha 4.16) — lancé sur
 * la carte, hors combat. Union extensible : `townPortal` (téléportation vers une
 * ville possédée) au v1 ; Vision, etc. = ajout de cas + données, jamais de faction.
 */
export type AdventureEffect = { type: 'townPortal' };

/** Définition résolue d'un sort (doc 02 §1.4), embarquée dans le catalogue. */
export interface SpellDef {
  id: string;
  school: SpellSchool;
  circle: number; // 1..5
  manaCost: number;
  kind: SpellKind;
  /** Dégâts/soin = base + perPower × Pouvoir (doc 02 §1.1). */
  base: number;
  perPower: number;
  /** Modificateurs temporaires pour buff/debuff (durée = Pouvoir rounds, min 1). */
  attackMod?: number;
  defenseMod?: number;
  speedMod?: number;
  /** Charges de Marque appliquées (sort `applyMarks`, doc 05 §6 — école Traque). */
  marks?: number;
  /**
   * Zone d'effet (C7) : `splash` = la pile ciblée + les piles du même camp qui lui
   * sont adjacentes sur la grille hex (Boule de feu…). Absent = mono-cible.
   */
  area?: 'splash';
  /** Effet hors combat d'un sort `adventure` (doc 02 §1.4, Alpha 4.16). */
  adventure?: AdventureEffect;
}

/** Rangs Novice/Expert/Maître d'une compétence (doc 02 §1.3) — effets par rang. */
export interface SkillRankEffect {
  movementBonusPct?: number;
  visionBonus?: number;
  goldPerDay?: number;
  meleeDamagePct?: number;
  rangedDamagePct?: number;
  armorReductionPct?: number;
  luckBonus?: number;
  moraleBonus?: number;
  manaCostReductionPct?: number;
  spellCircleUnlock?: number;
  learnCircle?: number;
}

export interface HeroSkillDef {
  id: string;
  /** 3 rangs (index 0 = Novice) — doc 02 §1.3. */
  ranks: SkillRankEffect[];
  /**
   * École visée par une compétence de magie (« Magie par école ×4 », doc 02
   * §1.3) : sa réduction de coût de mana ne s'applique QU'aux sorts de cette
   * école (A6). Absente pour les compétences non magiques.
   */
  school?: SpellSchool;
}

/** Bonus déclaratifs cumulatifs d'un artefact (doc 02 §1.1, doc 08 §2.3). */
export interface ArtifactDef {
  id: string;
  bonus: {
    attack?: number;
    defense?: number;
    power?: number;
    knowledge?: number;
    luck?: number;
    morale?: number;
    manaMax?: number;
  };
}

/** Statut temporaire appliqué à une pile par un sort (buff/debuff). */
export interface SpellStatus {
  spellId: string;
  attackMod: number;
  defenseMod: number;
  speedMod: number;
  roundsLeft: number;
}

/** Coût de recrutement partiel — réexport pratique pour les données de sort. */
export type PartialResources = Partial<Record<ResourceId, number>>;
