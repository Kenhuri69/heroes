/**
 * Constantes d'équilibrage de l'aventure — chargées depuis
 * `data/core/config.json` (doc 02 : jamais en dur) et embarquées dans l'état
 * par `StartGame` : la partie reste re-simulable même si les données changent.
 */

export interface TerrainRule {
  /** Coût d'entrée sur la tuile en points de mouvement ; null = infranchissable. */
  moveCost: number | null;
}

import type { SkillRankEffectInput } from '../hero/types';

/** Constantes des règles de combat (doc 02 §5 + décisions plan phase-2.4). */
export interface CombatRulesConfig {
  /** ±0,05 × (AttTotale − DéfTotale) sur les stats d'UNITÉS (doc 02 §5.3). */
  attackDefenseStep: number;
  /**
   * Pente défensive de l'attribut Défense du HÉROS : −2,5 %/point (doc 02 §1.1,
   * note §5.3). Distincte de `attackDefenseStep` (unités) ; bornes communes.
   */
  heroDefenseStep: number;
  /** Borne haute du bonus de dégâts (+0,60). */
  damageBonusMax: number;
  /** Borne basse de la réduction (−0,70). */
  damageReductionMax: number;
  /** Défendre : Défense ×1,3 (doc 02 §5.2). */
  defendDefenseMultiplier: number;
  /** Tireur au contact : mêlée à ½ dégâts (doc 02 §5.2). */
  rangedMeleePenalty: number;
  /**
   * Pénalité de portée du tir (B1, doc 02 §5.3, fidélité HoMM3) : un tir au-delà
   * de `hexes` cases inflige `×factor` (ex. `{ hexes: 10, factor: 0.5 }` = ½
   * dégâts à longue portée). **Optionnel & opt-in par données** : absent ⇒ portée
   * illimitée sans falloff (comportement historique ⇒ golden inchangé).
   */
  rangePenalty?: { hexes: number; factor: number } | undefined;
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
  /**
   * Attaque du héros (C1) : dégâts directs sur une pile, 1×/combat =
   * `base + perPower×Pouvoir + perAttack×Attaque`. Optionnel : absent ⇒ la
   * commande `HeroAttack` est refusée (feature désactivée, fixtures/golden épargnés).
   */
  heroAttack?: { base: number; perPower: number; perAttack: number } | undefined;
}

/**
 * Événement de calendrier hebdomadaire (M-CALENDAR, doc 02 §2.3) — tiré au
 * RNG seedé à chaque bascule de semaine. `growthFactor` module la croissance
 * hebdomadaire (`1` = normal, `0.5` = « semaine de la peste », `2` = abondance).
 * `id` opaque ⇒ nom/desc localisés (`calendar.event.<id>.*`).
 */
export interface CalendarEventDef {
  id: string;
  /** Poids relatif du tirage pondéré. */
  weight: number;
  /** Multiplicateur de la croissance hebdomadaire des créatures. */
  growthFactor: number;
  /**
   * « Semaine de X » (M-CALENDAR, doc 02 §2.3) : croissance × `factor` pour les
   * seules unités du palier `tier` (`CombatUnitDef.tier`), EN PLUS de
   * `growthFactor` global. Absent ⇒ semaine sans ciblage. `tier` = nombre opaque.
   */
  growthTier?: { tier: number; factor: number } | undefined;
  /**
   * « Semaine de ruée » (M-CALENDAR, doc 02 §2.3) : crédite `amount` de `resource`
   * (ressource commune) à TOUS les joueurs au passage de semaine. Absent ⇒ aucun
   * crédit. `resource` = id opaque (ressource commune, jamais de faction).
   */
  resourceGrant?: { resource: string; amount: number } | undefined;
  /**
   * « Semaine du savoir » (M-CALENDAR, doc 02 §2.3) : accorde `amount` XP à
   * CHAQUE héros (tous joueurs) au passage de semaine — miroir de `resourceGrant`
   * côté progression. Absent ⇒ aucun gain. Réutilise `grantXp` (montées en chaîne).
   */
  heroXpGrant?: { amount: number } | undefined;
  /**
   * « Semaine de X » ciblant une UNITÉ précise (doc 18 A4, lot 2.5) : croissance
   * × `factor` pour la seule unité TIRÉE au RNG seedé parmi les recrutables du
   * catalogue (`growthPerWeek` > 0, clés triées) — l'unité n'est JAMAIS nommée
   * dans la config core (zéro couplage core → paquet). Stockée dans
   * `Calendar.weekEventUnitId` le temps de la semaine.
   */
  growthUnit?: { factor: number } | undefined;
}

/**
 * Événement de calendrier MENSUEL (doc 18 A4, lot 2.5) — tiré au RNG seedé à
 * chaque bascule de mois (jour 29, 57, …), son `growthFactor` module la
 * croissance de TOUTES les semaines du mois (cumulé aux facteurs de semaine).
 * `id` opaque ⇒ nom localisé (`calendar.month.<id>.name`).
 */
export interface CalendarMonthEventDef {
  id: string;
  /** Poids relatif du tirage pondéré. */
  weight: number;
  /** Multiplicateur mensuel de la croissance (« peste » 0,5, « abondance » 1,5). */
  growthFactor: number;
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
  /**
   * Portée de vision d'une structure possédée (ville/mine) en tuiles (F1, doc 02
   * §2.1). Optionnel : absent ⇒ 0 (aucune révélation depuis les bâtiments — état
   * legacy/fixtures/golden inchangés).
   */
  buildingVisionRadius?: number | undefined;
  terrains: Record<string, TerrainRule>;
  combat: CombatRulesConfig;
  hero: HeroProgressionConfig;
  /**
   * Marché (doc 02 §4.1, lot UX U6a) : taux d'échange ressource ↔ or. Le schéma
   * de contenu le rend REQUIS (la prod l'a toujours) ; optionnel ici pour les
   * fixtures de test minimales et la stabilité du golden (config inchangée).
   */
  market?: MarketConfig;
  /**
   * Calendrier (M-CALENDAR, doc 02 §2.3) : événements hebdomadaires tirés au RNG
   * seedé. Optionnel : absent ⇒ aucune semaine spéciale (facteur 1 partout ;
   * fixtures/golden inchangés).
   */
  calendar?: { events: CalendarEventDef[]; monthEvents?: CalendarMonthEventDef[] | undefined } | undefined;
  /**
   * Butin de gardien (doc 02 §2.2) : vaincre un gardien neutre crédite un butin
   * gradué par sa **force** (PV totaux = `hp × count`). Optionnel — absent ⇒
   * aucun butin (fixtures/golden épargnés). GÉNÉRIQUE : le moteur ne lit que des
   * ids de ressource/artefact opaques, jamais un nom de faction.
   */
  guardianReward?: GuardianRewardConfig | undefined;
  /**
   * Croissance hebdomadaire des gardiens neutres (A2, doc 02 §2.2, fidélité
   * HoMM — pression temporelle du core loop) : au passage de semaine, chaque
   * pile neutre de la carte grossit de `×weeklyFactor` (plancher +1 si l'arrondi
   * n'augmente pas), plafonnée à `maxCount` absolu. **Optionnel & opt-in par
   * données** : absent ⇒ gardiens figés (comportement historique ⇒ golden
   * inchangé). Le `count` du gardien est déjà sérialisé ⇒ pas de bump save.
   */
  guardianGrowth?: { weeklyFactor: number; maxCount: number } | undefined;
}

/**
 * Butin de gardien (doc 02 §2.2) — tiré au **RNG seedé** à la victoire d'un
 * combat de gardien, gradué par les PV totaux du gardien vaincu.
 */
export interface GuardianRewardConfig {
  /** Or de base par PV total du gardien (avant variance). */
  goldPerHp: number;
  /** Variance aléatoire de l'or, en % (±) autour de la base. */
  variancePercent: number;
  /** Ressources non-or éligibles (ids opaques) — vide ⇒ jamais de ressource. */
  resources: string[];
  /** Seuil de PV totaux au-delà duquel une ressource est aussi accordée. */
  resourceThresholdHp: number;
  /** Fourchette (incluse) du montant de ressource accordé. */
  resourceAmount: { min: number; max: number };
  /** Seuil de PV totaux au-delà duquel un artefact peut tomber. */
  artifactThresholdHp: number;
  /** Chance (%) de tomber un artefact au-delà du seuil. */
  artifactChancePercent: number;
}

/** Taux du marché (doc 02 §4.1) : or par unité de ressource non-or échangée. */
export interface MarketConfig {
  /** Or reçu par unité de ressource non-or vendue. */
  sellRate: number;
  /** Or payé par unité de ressource non-or achetée (spread : ≥ sellRate). */
  buyRate: number;
  /**
   * Bonus de taux par marché possédé au-delà du premier (T-MARKETRATE, doc 02
   * §3) : `factor = 1 + perMarketBonus × (nbMarchés − 1)`, plafonné à
   * `maxMarketFactor`. Optionnel : absent ⇒ 0 (taux plat, comportement legacy).
   */
  perMarketBonus?: number | undefined;
  /** Plafond du facteur de taux dégressif (≥ 1). Optionnel : absent ⇒ 1 (plat). */
  maxMarketFactor?: number | undefined;
}

/** Progression du héros (doc 02 §1.2 + décisions plan phase-2.5). */
export interface HeroProgressionConfig {
  /** XP par PV d'unité ennemie tuée en combat (coefficient du doc 02 §1.2). */
  xpPerHpKilled: number;
  /** Courbe : xp(niveau) = base × niveau^exponent (268 × n^1.9 ⇒ niveau 2 ≈ 1000 XP). */
  levelCurve: { base: number; exponent: number };
  maxLevel: number;
  /** Pondérations du +1 attribut/niveau — profil GLOBAL (repli). */
  attributeWeights: { attack: number; defense: number; power: number; knowledge: number };
  /**
   * Profils de gain d'attribut PAR ARCHÉTYPE de héros (H-NAMED.3, doc 02 §1.2) :
   * un héros dont le roster déclare un archétype connu ici utilise ce profil au
   * lieu du global (`might` favorise Att/Déf, `magic` favorise Pou/Sav). Optionnel
   * ⇒ repli sur `attributeWeights` (comportement historique). Data-driven, aucune
   * faction : l'archétype est une clé opaque `'might' | 'magic'`.
   */
  attributeWeightsByArchetype?:
    | {
        might?: { attack: number; defense: number; power: number; knowledge: number } | undefined;
        magic?: { attack: number; defense: number; power: number; knowledge: number } | undefined;
      }
    | undefined;
  /**
   * Perks structurels par archétype (doc 18 C1, lot 3.1 — signature MMHO) :
   * effets déclaratifs du pot commun `SkillRankEffect`, posés sur
   * `HeroState.archetypeEffects` à la création d'un héros nommé dont le roster
   * porte cet archétype. Clés OPAQUES pour le moteur (aucun `if (archetype)`
   * en dur) ; optionnel ⇒ aucun perk (fixtures/golden inchangés).
   */
  archetypeEffects?: Record<string, SkillRankEffectInput[]> | undefined;
  /** Coût en or d'un recrutement de héros à la Taverne (M-TAVERN.1). Défaut 2500. */
  recruitCost?: number;
  /** Nombre maximum de héros par joueur (doc 02 §1.5). Défaut 8. */
  maxPerPlayer?: number;
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
