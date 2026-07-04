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
}

export type FactionBonus = RaiseUndeadOnVictoryBonus;
