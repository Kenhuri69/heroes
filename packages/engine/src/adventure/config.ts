/**
 * Constantes d'équilibrage de l'aventure — chargées depuis
 * `data/core/config.json` (doc 02 : jamais en dur) et embarquées dans l'état
 * par `StartGame` : la partie reste re-simulable même si les données changent.
 */

export interface TerrainRule {
  /** Coût d'entrée sur la tuile en points de mouvement ; null = infranchissable. */
  moveCost: number | null;
}

/** Constantes des règles de combat (doc 02 §5 + décisions plan phase-2.4). */
export interface CombatRulesConfig {
  /** ±0,05 × (AttTotale − DéfTotale) (doc 02 §5.3). */
  attackDefenseStep: number;
  /** Borne haute du bonus de dégâts (+0,60). */
  damageBonusMax: number;
  /** Borne basse de la réduction (−0,70). */
  damageReductionMax: number;
  /** Défendre : Défense ×1,3 (doc 02 §5.2). */
  defendDefenseMultiplier: number;
  /** Tireur au contact : mêlée à ½ dégâts (doc 02 §5.2). */
  rangedMeleePenalty: number;
  /** Moral : 4 %/point de tour bonus (ou sauté, symétrique — décision n°8). */
  moraleChancePerPoint: number;
  /** Chance : 4 %/point de dégâts doublés (doc 02 §5.3). */
  luckChancePerPoint: number;
  /** `mark` : +8 % de dégâts subis par charge (doc 05 §3.1, générique). */
  markBonusPerStack: number;
  marksMax: number;
  /** Obstacles générés au RNG du combat : 2–5 hexes (doc 02 §5.1). */
  obstaclesMin: number;
  obstaclesMax: number;
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
  combat: CombatRulesConfig;
  hero: HeroProgressionConfig;
  /**
   * Marché (doc 02 §4.1, lot UX U6a) : taux d'échange ressource ↔ or. Le schéma
   * de contenu le rend REQUIS (la prod l'a toujours) ; optionnel ici pour les
   * fixtures de test minimales et la stabilité du golden (config inchangée).
   */
  market?: MarketConfig;
}

/** Taux du marché (doc 02 §4.1) : or par unité de ressource non-or échangée. */
export interface MarketConfig {
  /** Or reçu par unité de ressource non-or vendue. */
  sellRate: number;
  /** Or payé par unité de ressource non-or achetée (spread : ≥ sellRate). */
  buyRate: number;
}

/** Progression du héros (doc 02 §1.2 + décisions plan phase-2.5). */
export interface HeroProgressionConfig {
  /** XP par PV d'unité ennemie tuée en combat (coefficient du doc 02 §1.2). */
  xpPerHpKilled: number;
  /** Courbe : xp(niveau) = base × niveau^exponent (1000 × n^1.9). */
  levelCurve: { base: number; exponent: number };
  maxLevel: number;
  /** Pondérations du +1 attribut/niveau (profil unique en Phase 2, classes au MVP). */
  attributeWeights: { attack: number; defense: number; power: number; knowledge: number };
}

/**
 * Points de mouvement quotidiens du héros : `base + perSpeed × vitesse de la
 * créature la plus lente de l'armée` (doc 02 §1.5). Armée vide ⇒ base seule.
 */
export function dailyMovementPoints(
  config: AdventureConfig,
  army: readonly { unitId: string }[] = [],
  unitCatalog: Record<string, { stats: { speed: number } }> = {},
): number {
  let slowest = Infinity;
  for (const stack of army) {
    const speed = unitCatalog[stack.unitId]?.stats.speed;
    if (speed !== undefined) slowest = Math.min(slowest, speed);
  }
  if (!Number.isFinite(slowest)) return config.movement.base;
  return config.movement.base + config.movement.perSpeed * slowest;
}
