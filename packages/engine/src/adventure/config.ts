/**
 * Constantes d'équilibrage de l'aventure — chargées depuis
 * `data/core/config.json` (doc 02 : jamais en dur) et embarquées dans l'état
 * par `StartGame` : la partie reste re-simulable même si les données changent.
 */

export interface TerrainRule {
  /** Coût d'entrée sur la tuile en points de mouvement ; null = infranchissable. */
  moveCost: number | null;
}

export interface AdventureConfig {
  /** Points de mouvement quotidiens : base + perSpeed × vitesse la plus lente (doc 02 §1.5). */
  movement: {
    base: number;
    perSpeed: number;
    /** Coût ×0,75 sur route (doc 02 §1.5). */
    roadMultiplier: number;
    /** Pas en diagonale : coût ×1,41 ≈ √2 (doc 02 §1.5). */
    diagonalMultiplier: number;
  };
  /** Portée de vision du héros en tuiles, distance de Tchebychev (doc 02 §1.5). */
  visionRadius: number;
  terrains: Record<string, TerrainRule>;
}

/**
 * Points de mouvement quotidiens du héros. Sans armée (Phase 2.3, le combat
 * arrive en 2.4), seule la base compte — le terme `perSpeed × vitesse la plus
 * lente` s'activera avec les armées.
 */
export function dailyMovementPoints(config: AdventureConfig): number {
  return config.movement.base;
}
