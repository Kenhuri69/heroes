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
});

/** locales/<lang>.json — clé de contenu → texte. */
export const localeSchema = z.record(z.string(), z.string());

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
  }),
  newGame: z.object({
    map: idSchema,
    startingResources: z.record(z.enum(COMMON_RESOURCE_IDS), z.number().int().nonnegative()),
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
    z.object({
      id: idSchema,
      type: z.literal('resource'),
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
      resource: z.enum(COMMON_RESOURCE_IDS),
      amount: z.number().int().positive(),
    }),
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
