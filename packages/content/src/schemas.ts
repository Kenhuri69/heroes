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

export type AbilityCatalog = z.infer<typeof abilityCatalogSchema>;
export type FactionIndex = z.infer<typeof factionIndexSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Locale = z.infer<typeof localeSchema>;
