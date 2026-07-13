/**
 * Effet de faction déclaratif appliqué post-victoire (doc 06 §4 — la
 * Nécromancie « est en fait déclarative ») : le moteur interprète le `type`
 * générique avec ses paramètres de données, sans jamais connaître de nom de
 * faction. Union à une seule variante au lot O ; toute nouvelle variante
 * s'ajoute ici sans toucher au reste du moteur.
 */
export interface RaiseUndeadOnVictoryBonus {
  type: 'raiseUndeadOnVictory';
  /** Unité ressuscitée (doit porter la capacité `undead` — vérifié côté contenu). */
  unitId: string;
  /** % des PV vivants tués côté défenseur convertis en PV ressuscités. */
  percentHpRaised: number;
  /** Plafond de base par combat. */
  capBase: number;
  /** Plafond additionnel par unité déjà présente dans l'armée du héros. */
  capPerExisting: number;
  /**
   * Nécromancie graduée (F-SKILLS, doc 04 §2) : compétence dont le RANG du héros
   * pilote le pourcentage. Si le héros connaît `scaleSkillId` (rang 1..3) et que
   * `percentByRank[rang-1]` est défini, on l'utilise au lieu de `percentHpRaised`.
   * Absents ⇒ pourcentage plat (`percentHpRaised`), comportement historique.
   */
  scaleSkillId?: string;
  percentByRank?: number[];
}

/**
 * Gain d'une ressource de faction (doc 05 §3.3) à chaque combat gagné en tant
 * qu'attaquant. `resource` est un id opaque (déclaré dans
 * `manifest.factionResources`) — le moteur ne connaît aucun nom de ressource.
 */
export interface GainFactionResourceOnVictoryBonus {
  type: 'gainFactionResourceOnVictory';
  resource: string;
  amount: number;
  /**
   * Plafond de la ressource (F-RESON.1, doc 16 §3.2 / doc 05 §3.3) — **estampillé
   * par le loader** depuis `manifest.factionResources[].cap`, jamais authored. Le
   * gain post-victoire est plafonné à cette valeur. Optionnel ⇒ vieilles saves
   * gracieuses (absent = non plafonné). Le moteur ne lit qu'un nombre opaque.
   */
  cap?: number;
}

/**
 * Bonus de combat PASSIF de faction (F-BONUS, doc 03 §2 / doc 06 §4) : points
 * plats accordés à l'armée du héros de cette faction pendant tout combat —
 * Ferveur (`morale`), Formation (`defense`), variante offensive (`attack`).
 * Interprété par les helpers par-camp du combat, jamais un nom de faction.
 */
export interface CombatBonus {
  type: 'combatBonus';
  attack?: number;
  defense?: number;
  morale?: number;
}

/**
 * Fléau persistant (F-BONUS, doc 04 §2) : les sorts de MALÉDICTION (`debuff`)
 * lancés par le héros de cette faction durent `rounds` de plus. Générique — le
 * moteur ajoute un nombre de rounds à la durée du statut, jamais un nom de faction.
 */
export interface CurseDurationBonus {
  type: 'curseDurationBonus';
  rounds: number;
}

export type FactionBonus =
  | RaiseUndeadOnVictoryBonus
  | GainFactionResourceOnVictoryBonus
  | CombatBonus
  | CurseDurationBonus;
