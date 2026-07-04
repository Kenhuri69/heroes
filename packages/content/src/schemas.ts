import { z } from 'zod';

/** Les 7 ressources communes (doc 02 §3) — dupliquées du moteur à dessein :
 *  `content` valide des données, il n'importe pas les internals du moteur. */
export const COMMON_RESOURCE_IDS = [
  'gold',
  'wood',
  'ore',
  'crystal',
  'gems',
  'sulfur',
  'mercury',
] as const;

const idSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, 'id en kebab-case');
/** Les capacités du catalogue sont en camelCase (doc 02 §5.4 : `noRetaliation`…). */
const abilityIdSchema = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'id de capacité en camelCase');
/**
 * Les bâtiments communs sont en camelCase (`townHall`, `mageGuild` — doc 02
 * §4.1, alignés sur les clés locales `building.<id>`) ; les dwellings/spéciaux
 * de faction restent en kebab-case comme le reste du paquet. On accepte les
 * deux plutôt que d'arbitrer une seule casse pour tout `building.id`.
 */
const buildingIdSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9-]*$/, 'id de bâtiment en camelCase ou kebab-case');
const locRef = z.string().startsWith('@loc:', 'toute string visible passe par locales/');

/** data/core/abilities.json — catalogue générique de capacités (doc 02 §5.4). */
export const abilityCatalogSchema = z.object({
  abilities: z.array(abilityIdSchema).min(1),
});

/** data/factions/index.json — registre des paquets à charger (doc 06 §1). */
export const factionIndexSchema = z.object({
  factions: z.array(idSchema).min(1),
});

/** units/<id>.json (doc 10 §5.4). */
export const unitSchema = z.object({
  id: idSchema,
  tier: z.number().int().min(1).max(8),
  name: locRef,
  stats: z.object({
    hp: z.number().int().positive(),
    attack: z.number().int().nonnegative(),
    defense: z.number().int().nonnegative(),
    damage: z
      .tuple([z.number().int().positive(), z.number().int().positive()])
      .refine(([min, max]) => min <= max, 'damage: min ≤ max'),
    speed: z.number().int().positive(),
  }),
  growthPerWeek: z.number().int().positive(),
  cost: z.record(z.string(), z.number().int().positive()),
  abilities: z.array(
    z.object({ id: abilityIdSchema, params: z.record(z.string(), z.unknown()).optional() }),
  ),
});

/**
 * manifest.json (doc 06 §3, doc 10 §5.4). `schemaVersion: 1` — les migrations
 * arrivent avec la première évolution de schéma (doc 06 §7).
 * `factionBonuses`/`abilityModules`/`hooks` sont refusés non vides tant que le
 * moteur ne les interprète pas : du contenu silencieusement ignoré serait un
 * mensonge de validation.
 */
export const manifestSchema = z.object({
  id: idSchema,
  schemaVersion: z.literal(1),
  name: locRef,
  nativeTerrain: idSchema,
  keyResources: z.array(z.enum(COMMON_RESOURCE_IDS)).length(2),
  factionResources: z
    .array(z.object({ id: idSchema, icon: z.string(), cap: z.number().int().positive() }))
    .default([]),
  factionBonuses: z.array(z.unknown()).max(0).default([]),
  spellSchool: idSchema.nullable(),
  heroSkills: z.array(idSchema).default([]),
  tiers: z.number().int().min(7).max(8),
  sharedGrowthGroups: z.record(z.string(), z.array(idSchema).min(2)).default({}),
  /** Unités du paquet — le navigateur ne liste pas les dossiers ; convention units/<id>.json. */
  units: z.array(idSchema).min(1),
  abilityModules: z.array(z.string()).max(0).default([]),
  hooks: z.array(z.string()).max(0).default([]),
  aiProfile: z.object({
    aggression: z.number().min(0).max(1),
    focusFire: z.number().min(0).max(1),
    preferredTargets: z.string(),
  }),
  /**
   * Ville de faction (doc 02 §4, plan phase-3.1) — optionnelle tant que toutes
   * les factions n'ont pas de ville. `buildings` référence des bâtiments
   * communs (`data/core/buildings.json`) ou propres (`<paquet>/buildings.json`,
   * requis si présent) ; `dwellings` mappe chaque tier à l'unité et au
   * bâtiment qui la débloque (règles croisées dans le loader).
   */
  town: z
    .object({
      buildings: z.array(buildingIdSchema).min(1),
      dwellings: z
        .array(
          z.object({
            tier: z.number().int().min(1).max(8),
            unitId: idSchema,
            buildingId: buildingIdSchema,
          }),
        )
        .min(1),
    })
    .optional(),
});

/** locales/<lang>.json — clé de contenu → texte. */
export const localeSchema = z.record(z.string(), z.string());

/**
 * building.json (doc 02 §4.1, doc 06 §2-3) — forme résolue = `BuildingDef` de
 * `engine/src/town/types.ts` (surface figée, plan phase-3.1). `cost` et
 * `income.resource` sont restreints aux 7 ressources communes : le type moteur
 * `BuildingLevel.cost: Partial<Resources>` n'admet QUE `ResourceId` (contrairement
 * à `unit.cost` qui admet aussi les ressources de faction) — pas de ressource de
 * faction pour bâtir/produire en 3.1.
 */
const buildingRequirementSchema = z.object({
  building: buildingIdSchema,
  level: z.number().int().positive(),
});

const buildingEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('income'), resource: z.enum(COMMON_RESOURCE_IDS), amount: z.number().int().positive() }),
  z.object({ type: z.literal('growthBonus'), percent: z.number().int().nonnegative() }),
  z.object({ type: z.literal('dwelling'), tier: z.number().int().min(1).max(8), unitId: idSchema }),
  z.object({ type: z.literal('mageGuild'), level: z.number().int().positive() }),
  /** Bâtiment sans effet mécanique en 3.1 (market/tavern/forge/spécial) — arbre seul. */
  z.object({ type: z.literal('none') }),
]);

const buildingLevelSchema = z.object({
  cost: z.record(z.enum(COMMON_RESOURCE_IDS), z.number().int().positive()),
  requires: z.array(buildingRequirementSchema).default([]),
  effect: buildingEffectSchema,
});

export const buildingSchema = z
  .object({
    id: buildingIdSchema,
    name: locRef.optional(),
    maxLevel: z.number().int().positive(),
    levels: z.array(buildingLevelSchema).min(1),
  })
  .refine((b) => b.levels.length === b.maxLevel, {
    message: 'levels.length doit être égal à maxLevel',
    path: ['levels'],
  });

/** data/core/buildings.json et data/factions/<id>/buildings.json — un fichier = une liste. */
export const buildingCatalogSchema = z.object({
  buildings: z.array(buildingSchema).min(1),
});

/**
 * data/core/config.json — constantes d'équilibrage (doc 02 : jamais en dur).
 * `adventure` a la même forme que l'`AdventureConfig` du moteur (duplication
 * structurelle à dessein, comme les ressources : `content` valide des données,
 * il n'importe pas les internals du moteur).
 */
export const gameConfigSchema = z.object({
  adventure: z.object({
    movement: z.object({
      base: z.number().int().positive(),
      perSpeed: z.number().int().nonnegative(),
      roadMultiplier: z.number().positive().max(1),
      diagonalMultiplier: z.number().min(1),
    }),
    visionRadius: z.number().int().positive(),
    terrains: z
      .record(idSchema, z.object({ moveCost: z.number().int().positive().nullable() }))
      .refine(
        (t) => Object.values(t).some((r) => r.moveCost !== null),
        'au moins un terrain franchissable',
      ),
    /** Progression du héros (doc 02 §1.2 + plan phase-2.5) — même forme que le moteur. */
    hero: z.object({
      xpPerHpKilled: z.number().nonnegative(),
      levelCurve: z.object({ base: z.number().positive(), exponent: z.number().positive() }),
      maxLevel: z.number().int().positive(),
      attributeWeights: z.object({
        attack: z.number().nonnegative(),
        defense: z.number().nonnegative(),
        power: z.number().nonnegative(),
        knowledge: z.number().nonnegative(),
      }),
    }),
    /** Règles de combat (doc 02 §5 + plan phase-2.4) — même forme que le moteur. */
    combat: z.object({
      attackDefenseStep: z.number().positive().max(1),
      damageBonusMax: z.number().positive().max(5),
      damageReductionMax: z.number().positive().max(1),
      defendDefenseMultiplier: z.number().min(1),
      rangedMeleePenalty: z.number().positive().max(1),
      moraleChancePerPoint: z.number().nonnegative().max(1),
      luckChancePerPoint: z.number().nonnegative().max(1),
      markBonusPerStack: z.number().nonnegative().max(1),
      marksMax: z.number().int().positive(),
      obstaclesMin: z.number().int().nonnegative(),
      obstaclesMax: z.number().int().nonnegative(),
    }).refine((c) => c.obstaclesMin <= c.obstaclesMax, 'obstaclesMin ≤ obstaclesMax'),
  }),
  newGame: z.object({
    map: idSchema,
    startingResources: z.record(z.enum(COMMON_RESOURCE_IDS), z.number().int().nonnegative()),
    /** Armée de départ du héros (≤ 7 piles) — IDs vérifiés contre les paquets chargés. */
    startingArmy: z
      .array(z.object({ unitId: idSchema, count: z.number().int().positive() }))
      .max(7)
      .default([]),
    /** Ville de départ (doc 02 §4, plan phase-3.1) — optionnelle, mono-ville en 3.1. */
    startingTown: z
      .object({
        id: idSchema,
        factionId: idSchema,
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        prebuilt: z
          .array(z.object({ building: buildingIdSchema, level: z.number().int().positive() }))
          .min(1),
      })
      .optional(),
  }),
  /** Affichage client (fourchettes de force des gardiens — doc 02 §2.2). */
  display: z.object({
    strengthBands: z
      .array(z.object({ max: z.number().int().positive().nullable(), key: idSchema }))
      .min(1),
  }),
});

/**
 * data/maps/<id>.map.json (doc 02 §2.1) : couches en chaînes par rangée —
 * `tiles` via une légende char → terrain, `roads` en '0'/'1'. Les règles
 * croisées (dimensions, chars connus, franchissabilité) vivent dans `loadMap`.
 */
export const mapFileSchema = z.object({
  id: idSchema,
  schemaVersion: z.literal(1),
  width: z.number().int().min(1).max(256),
  height: z.number().int().min(1).max(256),
  legend: z.record(z.string().length(1), idSchema),
  tiles: z.array(z.string()).min(1),
  roads: z.array(z.string()).min(1),
  objects: z.array(
    z.discriminatedUnion('type', [
      z.object({
        id: idSchema,
        type: z.literal('resource'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        resource: z.enum(COMMON_RESOURCE_IDS),
        amount: z.number().int().positive(),
      }),
      /** Gardien neutre : pile unique, combat à l'interception (doc 02 §2.2). */
      z.object({
        id: idSchema,
        type: z.literal('guardian'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        unitId: idSchema,
        count: z.number().int().positive(),
      }),
      /** Ville (doc 02 §4, plan phase-3.1) — la ville de départ y référence son id. */
      z.object({
        id: idSchema,
        type: z.literal('town'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
      }),
    ]),
  ),
  startPositions: z
    .array(z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() }))
    .min(1),
});

export type AbilityCatalog = z.infer<typeof abilityCatalogSchema>;
export type FactionIndex = z.infer<typeof factionIndexSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Locale = z.infer<typeof localeSchema>;
export type GameConfig = z.infer<typeof gameConfigSchema>;
export type MapFile = z.infer<typeof mapFileSchema>;
export type Building = z.infer<typeof buildingSchema>;
export type BuildingCatalogFile = z.infer<typeof buildingCatalogSchema>;
/** Forme moteur — `Building` sans `name` (locale, hors `BuildingDef` figé). */
export type ResolvedBuilding = Omit<Building, 'name'>;
