import type { GridPos } from '../adventure/map';
import type { ArmyStack } from '../combat/types';
import type { Resources } from '../core/state';

/**
 * Types du town building — SURFACE FIGÉE en cadrage (plan phase-3.1). Les lots
 * H (règles), I (contenu) et J (écran) programment contre ces formes. Toute
 * évolution passe par la session principale. Le moteur ne connaît aucune
 * faction : `factionId` et `buildingId` sont des IDs opaques venus des données.
 */

/** Effet déclaratif d'un niveau de bâtiment (doc 02 §4.1). */
export type BuildingEffect =
  | { type: 'income'; resource: keyof Resources; amount: number }
  | { type: 'growthBonus'; percent: number }
  | { type: 'dwelling'; tier: number; unitId: string }
  | { type: 'mageGuild'; level: number }
  /** Active l'échange ressource ↔ or dans la ville (doc 02 §4.1, lot UX U6a). */
  | { type: 'market' }
  /** Vend les machines de guerre listées (`units`) au héros présent (doc 02 §5, Alpha 4.12). */
  | { type: 'warMachineVendor'; units: string[] }
  /**
   * Contrat de chasse (doc 05 §3.3) : cible neutre hebdomadaire assignée au
   * propriétaire ; la vaincre crédite `gold` + `amount` de la ressource de
   * faction `resource` (id opaque — le moteur ne connaît aucune faction).
   */
  | { type: 'huntContract'; gold: number; resource: string; amount: number }
  /** Bâtiment sans effet mécanique en 3.1 (tavern/forge/spécial) — arbre seul. */
  | { type: 'none' };

export interface BuildingLevel {
  cost: Partial<Resources>;
  /** Prérequis : autres bâtiments à un niveau minimum (gradation, doc 02 §4.1). */
  requires: { building: string; level: number }[];
  effect: BuildingEffect;
}

/** Définition résolue d'un bâtiment, embarquée dans `StartGame.buildingCatalog`. */
export interface BuildingDef {
  id: string;
  maxLevel: number;
  /** Un entrée par niveau (index 0 = niveau 1). */
  levels: BuildingLevel[];
  /**
   * Choix exclusif (doc 05 §3.2, les Cercles) : au plus un bâtiment par groupe
   * peut être construit dans une ville (irréversible). Générique — le moteur ne
   * connaît pas les noms de groupes, seulement l'égalité de chaîne.
   */
  exclusiveGroup?: string | undefined;
}

export interface TownState {
  id: string;
  /** null = ville neutre non capturée. */
  ownerPlayerId: string | null;
  pos: GridPos;
  /** ID du paquet de faction de la ville (opaque pour le moteur). */
  factionId: string;
  /** Niveau construit par bâtiment (absent = non construit). */
  buildings: Record<string, number>;
  /** Une construction par ville et par jour (doc 02 §4.1) — remis à false au DayStarted. */
  builtToday: boolean;
  /** Armée de défense de la ville, ≤ 7 piles (doc 02 §4.1). */
  garrison: ArmyStack[];
  /** Stock de créatures recrutables accumulé (unitId → effectif), plafonné 2 semaines. */
  stock: Record<string, number>;
}
