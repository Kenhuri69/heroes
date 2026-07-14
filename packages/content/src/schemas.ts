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
  /** Texte d'ambiance optionnel (doc 13 §3.5, lot N1) — `@loc:` pur affichage. */
  loreKey: locRef.optional(),
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
 * Machine de guerre (doc 02 §5, Alpha 4.12) — comme une unité de combat mais
 * SANS tier ni croissance : possédée par le héros (achetée à la Forge), elle
 * combat comme une pile. `cost` = prix d'achat. Générique, faction-agnostique.
 */
export const warMachineSchema = z.object({
  id: idSchema,
  name: locRef,
  stats: unitSchema.shape.stats,
  abilities: unitSchema.shape.abilities,
  cost: z.record(z.enum(COMMON_RESOURCE_IDS), z.number().int().positive()),
});

export const warMachineCatalogSchema = z.object({
  warMachines: z.array(warMachineSchema).min(1),
});

/**
 * Effets de faction déclaratifs interprétés par le moteur (plan phase-3.4,
 * doc 06 §4 : « la Nécromancie est en fait déclarative »). Union discriminée
 * — un seul type ouvert au MVP. Forme figée, partagée avec le moteur
 * (`FactionBonus`) : ne pas modifier sans coordonner les deux côtés.
 */
export const factionBonusSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('raiseUndeadOnVictory'),
    unitId: idSchema,
    percentHpRaised: z.number().int().positive(),
    capBase: z.number().int().nonnegative(),
    capPerExisting: z.number().int().nonnegative(),
    // Nécromancie graduée (F-SKILLS) : rang de `scaleSkillId` → `percentByRank`.
    // `.default` (comme combatBonus F-BONUS) : sort optionnel côté données, type
    // requis assignable au champ moteur optionnel (exactOptionalPropertyTypes).
    scaleSkillId: idSchema.default(''),
    percentByRank: z.array(z.number().int().positive()).default([]),
  }),
  z.object({
    type: z.literal('gainFactionResourceOnVictory'),
    resource: idSchema,
    amount: z.number().int().positive(),
  }),
  // F-BONUS : bonus de combat passifs (Ferveur `morale`, Formation `defense`,
  // variante offensive `attack`) — points plats, ≥ 0. Générique, doc 06 §4.
  z.object({
    type: z.literal('combatBonus'),
    attack: z.number().int().nonnegative().default(0),
    defense: z.number().int().nonnegative().default(0),
    morale: z.number().int().nonnegative().default(0),
  }),
  // F-BONUS : Fléau persistant (doc 04 §2) — les sorts de malédiction (`debuff`)
  // du héros de la faction durent +`rounds`. Générique, doc 06 §4.
  z.object({
    type: z.literal('curseDurationBonus'),
    rounds: z.number().int().positive(),
  }),
  // Magie Irrésistible (signature du Donjon, doc 17 §2) : les sorts de DÉGÂTS du
  // héros de la faction gagnent `spellBonusPercent` % de dégâts et ignorent une
  // fraction `resistancePierce` (0..1) de la résistance magique GRADUÉE de la
  // cible (l'immunité totale `spellImmune` reste un bloc entier). Générique.
  z.object({
    type: z.literal('irresistibleMagic'),
    spellBonusPercent: z.number().int().nonnegative(),
    resistancePierce: z.number().min(0).max(1),
  }),
]);

/**
 * Effet déclaratif d'une **Maison** (doc 16 §3.1, signature `houseAllegiance`).
 * Sous-ensemble de `SkillRankEffect` réellement AGRÉGÉ par le moteur
 * (`hero/skills.ts`) : on exclut `spellCircleUnlock`/`learnCircle` (non branchés
 * pour les Maisons) — un champ ignoré serait un mensonge de contenu (doc 06).
 * Au moins un effet par Maison.
 */
/** Vocabulaire d'effets déclaratifs de héros (partagé Maison + spécialité). */
const heroEffectFields = {
  movementBonusPct: z.number().optional(),
  visionBonus: z.number().optional(),
  goldPerDay: z.number().optional(),
  meleeDamagePct: z.number().optional(),
  rangedDamagePct: z.number().optional(),
  armorReductionPct: z.number().optional(),
  luckBonus: z.number().optional(),
  moraleBonus: z.number().optional(),
  manaCostReductionPct: z.number().optional(),
  // Effets TOWN-SCOPED (F-HOUSES, doc 16 §3.1 — Le Blaireau) : interprétés par le
  // code de ville (croissance hebdo / défense de siège) via `townHouseField`,
  // pas par les accesseurs par-héros. Branchés ⇒ pas un mensonge de contenu.
  garrisonGrowthPct: z.number().optional(),
  garrisonDefense: z.number().optional(),
  // Spécialité CONDITIONNELLE (H-COND, doc 04 §5 / 05 §7 / 14 §5) : bonus de combat
  // ciblé sur une UNITÉ (`unitId`) et/ou mis à l'échelle par niveau (`perLevels`).
  // Interprété au niveau unité en combat (`conditionalUnitBonus`), jamais agrégé
  // à plat. Générique — `unitId` est un id opaque.
  conditional: z
    .object({
      unitId: idSchema.optional(),
      perLevels: z.number().int().positive().optional(),
      attack: z.number().optional(),
      defense: z.number().optional(),
      speed: z.number().optional(),
    })
    .refine(
      (c) => c.attack !== undefined || c.defense !== undefined || c.speed !== undefined,
      'au moins un effet conditionnel (attack/defense/speed)',
    )
    .optional(),
  // Signatures EXACTES de spécialités (H-COND-EXACT) — chacune interprétée par un
  // point d'extension moteur générique dédié, jamais agrégée à plat :
  // Mère Corbeau (doc 04 §5) : +N % de Nécromancie (`raiseUndeadOnVictory`) par niveau.
  raiseUndeadPctPerLevel: z.number().optional(),
  // Faelar (doc 14 §5) : paliers de Symbiose au début du combat.
  startingSymbiosisStacks: z.number().int().positive().optional(),
  // Alwin (doc 05 §7) : familier gratuit dans l'armée de départ (unitId opaque).
  startingArmyBonus: z
    .object({ unitId: idSchema, count: z.number().int().positive() })
    .optional(),
} as const;

const houseEffectSchema = z
  .object(heroEffectFields)
  .refine((e) => Object.values(e).some((v) => v !== undefined), 'au moins un effet par Maison');

/**
 * Une Maison de faction (doc 16 §3.1) : id opaque, nom localisé (`house.<id>`
 * attendu dans les locales du paquet), et un profil d'effets déclaratifs. Le
 * héros/la ville choisit UNE Maison ; le moteur les agrège comme des compétences.
 */
export const houseSchema = z.object({
  id: idSchema,
  name: locRef,
  effects: z.array(houseEffectSchema).min(1),
});

/**
 * Origine d'un héros nommé (doc 16, séparation demandée) :
 * - `canon` : personnage issu d'un univers existant (fiction tierce) — exige
 *   `source` (le nom de l'œuvre) ; utile pour filtrer/gater les emprunts (IP).
 * - `original` : création propre au jeu, éventuellement inspirée d'un vrai
 *   joueur — pas de `source`.
 */
export const HERO_ORIGINS = ['canon', 'original'] as const;

/**
 * heroes/<id>.json — **identité** d'un héros nommé (couche contenu, doc 16
 * État 16.9). Format data-driven, **non consommé par le moteur** au staging :
 * le système de héros nommés (spécialité/Maison jouées en jeu) reste différé
 * pour toutes les factions. `specialty`/`startingHouseId` sont indicatifs.
 * `avatar` = clé du registre d'assets client (`heroes/<clé>`), `avatarStyle`
 * documente la divergence painterly/photoréaliste (doc 12 §7).
 */
export const heroIdentitySchema = z
  .object({
    id: idSchema,
    name: locRef,
    bio: locRef,
    archetype: z.enum(['might', 'magic']),
    origin: z.enum(HERO_ORIGINS),
    /** Univers/œuvre source — nom propre non localisé ; requis ssi `canon`. */
    source: z.string().min(1).optional(),
    avatar: z.string().min(1),
    avatarStyle: z.enum(['painterly', 'photoreal']).default('painterly'),
    /** Description de spécialité (indicative, `@loc:`) — affichage. */
    specialty: locRef.optional(),
    startingHouseId: idSchema.optional(),
    /**
     * Gameplay résoluble par le moteur (H-NAMED.1, doc 02 §1.2) — **optionnels**.
     * Un héros PORTANT `attributes` devient **résolu en jeu** (identité appliquée
     * au StartGame : attributs/spécialité/compétences/sorts de départ) ; sans, il
     * reste identity-only (avatar/bio, staging 16.9). `specialtyEffect` = profil
     * d'effets structuré (mêmes effets génériques que Maisons/compétences), distinct
     * de `specialty` (texte descriptif). `startingHouseId` ci-dessus reste indicatif.
     */
    attributes: z
      .object({
        attack: z.number().int().nonnegative(),
        defense: z.number().int().nonnegative(),
        power: z.number().int().nonnegative(),
        knowledge: z.number().int().nonnegative(),
      })
      .optional(),
    specialtyEffect: z
      .object({ id: idSchema, ...heroEffectFields })
      .refine((e) => Object.entries(e).some(([k, v]) => k !== 'id' && v !== undefined), 'au moins un effet de spécialité')
      .optional(),
    startingSkills: z.record(idSchema, z.number().int().min(1).max(3)).default({}),
    startingSpells: z.array(idSchema).default([]),
  })
  .refine((h) => (h.origin === 'canon') === (h.source !== undefined), {
    message: "origin 'canon' exige 'source' (univers) ; 'original' l'interdit",
    path: ['source'],
  });

/**
 * manifest.json (doc 06 §3, doc 10 §5.4). `schemaVersion: 1` — les migrations
 * arrivent avec la première évolution de schéma (doc 06 §7).
 * `abilityModules`/`hooks` restent refusés non vides tant que le moteur ne
 * les interprète pas : du contenu silencieusement ignoré serait un mensonge
 * de validation. `factionBonuses` est validé (plan phase-3.4) — règles
 * croisées (unitId existe, capacité `undead`) dans le loader.
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
  factionBonuses: z.array(factionBonusSchema).default([]),
  /** Maisons de la faction (doc 16 §3.1, signature `houseAllegiance`) — défaut []. */
  houses: z.array(houseSchema).default([]),
  /**
   * Héros nommés de la faction (doc 16 État 16.9) — convention
   * `heroes/<id>.json`. Défaut `[]` : le moteur ne les consomme pas (identité
   * stagée en avance du système de héros nommés, différé).
   */
  heroes: z.array(idSchema).default([]),
  spellSchool: idSchema.nullable(),
  heroSkills: z.array(idSchema).default([]),
  tiers: z.number().int().min(7).max(8),
  sharedGrowthGroups: z.record(z.string(), z.array(idSchema).min(2)).default({}),
  /** Unités du paquet — le navigateur ne liste pas les dossiers ; convention units/<id>.json. */
  units: z.array(idSchema).min(1),
  /** Campagne de la faction (doc 13 §6.1, N3a) — chemin relatif au paquet, optionnel. */
  story: z.string().optional(),
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
  // F-BUILDEFF.6 (doc 16 §5, La Scène) : revenu quotidien d'une ressource de
  // faction (id opaque, cross-validé loader). Parallèle de `income` (communes).
  z.object({ type: z.literal('factionResourceIncome'), resource: idSchema, amount: z.number().int().positive() }),
  z.object({ type: z.literal('growthBonus'), percent: z.number().int().nonnegative() }),
  z.object({ type: z.literal('dwelling'), tier: z.number().int().min(1).max(8), unitId: idSchema }),
  /**
   * Guilde des mages (doc 02 §4.1) : `level` = cercle enseigné ; `spellCount` =
   * nombre de sorts de ce cercle tirés au RNG seedé dans le pool de la ville à
   * la construction (G2). Absent ⇒ 0 (le bâtiment n'enseigne rien).
   */
  z.object({
    type: z.literal('mageGuild'),
    level: z.number().int().positive(),
    spellCount: z.number().int().nonnegative().optional(),
  }),
  /** Active l'échange ressource ↔ or (doc 02 §4.1, lot UX U6a). */
  z.object({ type: z.literal('market') }),
  /** Vend les machines de guerre listées au héros présent (doc 02 §5, Alpha 4.12 — la Forge). */
  z.object({ type: z.literal('warMachineVendor'), units: z.array(idSchema).min(1) }),
  /**
   * Contrat de chasse (doc 05 §3.3) : au passage de semaine, le propriétaire se
   * voit assigner une cible neutre ; la vaincre crédite `gold` + `amount` de la
   * ressource de faction `resource`. Générique — `resource` est un id opaque.
   */
  z.object({
    type: z.literal('huntContract'),
    gold: z.number().int().nonnegative(),
    resource: idSchema,
    amount: z.number().int().positive(),
  }),
  /** Choix de Maison (doc 16 §3.1/§5, « Le Choixpeau ») — `houseId` opaque résolu
   *  par le moteur dans le catalogue des Maisons ; combiné à `exclusiveGroup`. */
  z.object({ type: z.literal('houseChoice'), houseId: idSchema }),
  /**
   * Aura de bâtiment (F-BUILDEFF, doc 03 §4). `movementBonusFlat` (.1, Écuries) =
   * PM/jour au héros du propriétaire présent sur la ville. `combatMoraleBonus`
   * (.2, Statue du Jugement) = +moral en combat de siège au camp défenseur.
   * `.default(0)` (comme combatBonus F-BONUS) : champ optionnel côté données, type
   * requis assignable au champ moteur optionnel (exactOptionalPropertyTypes) — un
   * champ à 0 est un no-op côté moteur (lu `?? 0`). D'autres champs suivront.
   */
  z.object({
    type: z.literal('heroAura'),
    movementBonusFlat: z.number().int().nonnegative().default(0),
    combatMoraleBonus: z.number().int().nonnegative().default(0),
    garrisonDefense: z.number().int().nonnegative().default(0),
    // F-BUILDEFF.5 (Cercle Abîme) : +% dégâts en siège aux piles défenseure de tier
    // ≥ `eliteMinTier`. `eliteDamagePct` 0 = no-op ; `eliteMinTier` défaut 7 (T7/T8).
    eliteDamagePct: z.number().int().nonnegative().default(0),
    eliteMinTier: z.number().int().positive().default(7),
  }),
  /**
   * Bâtiment enseignant (F-BUILDEFF.3, doc 03 §4 — Cloître) : `spellId` (opaque)
   * ajouté au pool de la ville à la construction. Cross-validé dans le loader
   * (le sort doit exister dans `core/spells.json`).
   */
  z.object({ type: z.literal('grantSpell'), spellId: idSchema }),
  /** Taverne (M-TAVERN.1, doc 02 §4.1) : active le recrutement de héros nommés. */
  z.object({ type: z.literal('tavern') }),
  /** Bâtiment sans effet mécanique (forge/spécial) — prérequis d'arbre seul. */
  z.object({ type: z.literal('none') }),
]);

const buildingLevelSchema = z.object({
  cost: z.record(z.enum(COMMON_RESOURCE_IDS), z.number().int().positive()),
  requires: z.array(buildingRequirementSchema).default([]),
  effect: buildingEffectSchema,
  /** D4 : ce niveau ne peut être bâti que dans une ville par joueur (« 1 Capitole »). */
  uniquePerPlayer: z.boolean().optional(),
});

export const buildingSchema = z
  .object({
    id: buildingIdSchema,
    name: locRef.optional(),
    /** Texte d'ambiance optionnel (doc 13 §3.5, lot N1). */
    loreKey: locRef.optional(),
    maxLevel: z.number().int().positive(),
    levels: z.array(buildingLevelSchema).min(1),
    /** Groupe de choix exclusif (doc 05 §3.2) — un seul bâtiment du groupe par ville. */
    exclusiveGroup: z.string().optional(),
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
 * data/core/spells.json (doc 02 §1.4, plan phase-3.2 décision 8) — forme
 * résolue = `SpellDef` de `engine/src/hero/types.ts` (surface figée, lot K).
 * Règles croisées : `damage`/`heal` doivent avoir un effet réel (`base` > 0) ;
 * `buff`/`debuff` doivent porter au moins un modificateur temporaire.
 */
/**
 * Registre des écoles de magie valides (D11) : le moteur traite l'école comme
 * une chaîne opaque ; c'est le **contenu** qui énumère l'ensemble autorisé —
 * écoles génériques (doc 02 §1.4) + écoles de faction. Ajouter une école de
 * faction = l'inscrire ici (registre data-aware), jamais un diff moteur.
 */
export const SPELL_SCHOOLS = ['fire', 'water', 'earth', 'air', 'neutral', 'traque', 'scene', 'lumiere', 'prime'] as const;

export const spellSchema = z
  .object({
    id: idSchema,
    name: locRef.optional(),
    /** Texte d'ambiance optionnel (doc 13 §3.5, lot N1). */
    loreKey: locRef.optional(),
    school: z.enum(SPELL_SCHOOLS),
    circle: z.number().int().min(1).max(5),
    manaCost: z.number().int().positive(),
    kind: z.enum(['damage', 'heal', 'buff', 'debuff', 'applyMarks', 'silence', 'banish', 'rally', 'stealth', 'teleport', 'dispel', 'adventure']),
    base: z.number().nonnegative(),
    perPower: z.number().nonnegative(),
    attackMod: z.number().optional(),
    defenseMod: z.number().optional(),
    speedMod: z.number().optional(),
    /** Modificateur de moral pendant le statut (F-SCHOOLS, École de la Scène doc 16 §3.3). */
    moraleMod: z.number().optional(),
    /** Charges posées par un sort `applyMarks` (doc 05 §6). */
    marks: z.number().int().positive().optional(),
    /** Sort mange-Marques (F-SCHOOLS.3, doc 05 §6) : %/charge de dégâts, puis consomme. */
    marksDamagePct: z.number().nonnegative().optional(),
    /**
     * Chaîne (H-SPELLS.4, doc 02 §1.4) : un sort `damage` rebondit vers `jumps`
     * ennemis proches, dégâts × `(1 − falloffPct/100)` par saut. Générique.
     */
    chain: z.object({ jumps: z.number().int().positive(), falloffPct: z.number().min(0).max(100) }).optional(),
    /**
     * Zone d'effet : `splash` (C7) = cible + piles adjacentes du même camp ;
     * `all` (H-SPELLS.1) = toutes les piles vivantes du camp de la cible (masse).
     */
    area: z.enum(['splash', 'all']).optional(),
    /**
     * Effet hors combat d'un sort `adventure` (doc 02 §1.4, Alpha 4.16) :
     * `townPortal` (téléportation vers une ville) ou `vision` (H-SPELLS.3 —
     * révèle le brouillard dans `radius` tuiles autour du héros).
     */
    adventure: z
      .discriminatedUnion('type', [
        z.object({ type: z.literal('townPortal') }),
        z.object({ type: z.literal('vision'), radius: z.number().int().positive() }),
        /** Marche forcée (H-SPELLS) : +`amount` PM immédiats au héros. */
        z.object({ type: z.literal('movementBonus'), amount: z.number().int().positive() }),
        /** Cartographie (H-SPELLS) : révèle tout le brouillard de la carte. */
        z.object({ type: z.literal('revealMap') }),
      ])
      .optional(),
  })
  .refine((s) => (s.kind === 'damage' || s.kind === 'heal' || s.kind === 'teleport' ? s.base > 0 : true), {
    // teleport (F-SCHOOLS.8) : `base` = portée en hexes (≥ 1).
    message: 'damage/heal/teleport: base doit être > 0',
    path: ['base'],
  })
  .refine((s) => (s.kind === 'adventure') === (s.adventure !== undefined), {
    message: 'adventure: le champ `adventure` est requis (et réservé) pour ce kind',
    path: ['adventure'],
  })
  .refine(
    (s) =>
      s.kind === 'buff' || s.kind === 'debuff'
        ? s.attackMod !== undefined ||
          s.defenseMod !== undefined ||
          s.speedMod !== undefined ||
          s.moraleMod !== undefined
        : true,
    {
      message: 'buff/debuff: au moins un modificateur (attackMod/defenseMod/speedMod/moraleMod)',
      path: ['kind'],
    },
  )
  .refine((s) => (s.kind === 'applyMarks' ? s.marks !== undefined : true), {
    message: 'applyMarks: le champ `marks` (> 0) est requis',
    path: ['marks'],
  })
  .refine((s) => (s.chain ? s.kind === 'damage' : true), {
    message: 'chain: réservé aux sorts de dégâts',
    path: ['chain'],
  });

/** data/core/spells.json — un fichier = une liste (comme buildingCatalogSchema). */
export const spellCatalogSchema = z.object({
  spells: z.array(spellSchema).min(1),
});

/**
 * Rang d'effet d'une compétence (doc 02 §1.3) — sous-ensemble de
 * `SkillRankEffect` (engine/src/hero/types.ts) ; au moins un champ par rang,
 * sinon un rang « no-op » serait un mensonge de contenu.
 */
const skillRankEffectSchema = z.object({
  movementBonusPct: z.number().optional(),
  visionBonus: z.number().optional(),
  goldPerDay: z.number().optional(),
  meleeDamagePct: z.number().optional(),
  rangedDamagePct: z.number().optional(),
  armorReductionPct: z.number().optional(),
  luckBonus: z.number().optional(),
  moraleBonus: z.number().optional(),
  manaCostReductionPct: z.number().optional(),
  spellCircleUnlock: z.number().int().min(1).max(5).optional(),
  learnCircle: z.number().int().min(1).max(5).optional(),
  /** Compétence Tactique (C-TACTICS, doc 02 §5.1) : profondeur de la bande de placement pré-combat. */
  tacticsColumns: z.number().int().min(1).max(6).optional(),
  /** Prière de bataille (F-SKILLS.2, doc 03 §2/§5) : PV soignés/ressuscités 1×/combat. */
  battleResurrectHp: z.number().int().positive().optional(),
});

/** data/core/skills.json (doc 02 §1.3) — exactement 3 rangs (Novice/Expert/Maître). */
export const skillSchema = z
  .object({
    id: idSchema,
    name: locRef.optional(),
    ranks: z.tuple([skillRankEffectSchema, skillRankEffectSchema, skillRankEffectSchema]),
    /** École visée par une compétence de magie (A6) — réduction de mana filtrée par école. */
    school: z.enum(SPELL_SCHOOLS).optional(),
    /**
     * F-SKILLS : compétence « marqueur » à effet EXTERNE (ex. Nécromancie graduée,
     * dont le payoff est le % de `raiseUndeadOnVictory`). Ses rangs peuvent être
     * vides (aucun `SkillRankEffect` direct). Absent/false ⇒ chaque rang doit
     * porter au moins un effet (règle commune, doc 02 §1.3).
     */
    external: z.boolean().optional(),
  })
  .superRefine((s, ctx) => {
    if (s.external) return;
    s.ranks.forEach((rank, i) => {
      if (!Object.values(rank).some((v) => v !== undefined))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'au moins un effet par rang', path: ['ranks', i] });
    });
  });

export const skillCatalogSchema = z.object({
  skills: z.array(skillSchema).min(1),
});

/** Bonus déclaratifs d'un artefact (doc 02 §1.1, doc 08 §2.3) — au moins un champ. */
const artifactBonusSchema = z
  .object({
    attack: z.number().optional(),
    defense: z.number().optional(),
    power: z.number().optional(),
    knowledge: z.number().optional(),
    luck: z.number().optional(),
    morale: z.number().optional(),
    manaMax: z.number().optional(),
    /** PM quotidiens plats (H-ARTEQUIP, doc 02 §1.5 — bottes de vitesse). */
    movementFlat: z.number().optional(),
    /** Rayon de vision plat (H-ARTEQUIP, doc 02 §1.5 — longue-vue). */
    vision: z.number().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'bonus vide');

/**
 * Emplacement de la poupée d'équipement (doc 08 §2.3, lot UXD-5b) : donnée de
 * PRÉSENTATION seule — le moteur ne la lit jamais (les bonus se somment quel
 * que soit le slot). Sert au regroupement typé de l'écran héros côté client.
 */
export const artifactSlotSchema = z.enum([
  'head',
  'neck',
  'torso',
  'weapon',
  'shield',
  'cloak',
  'hands',
  'feet',
  'ring',
  'misc',
]);

/** data/core/artifacts.json — forme résolue = `ArtifactDef` (engine/src/hero/types.ts). */
export const artifactSchema = z.object({
  id: idSchema,
  name: locRef.optional(),
  /** Texte d'ambiance optionnel (doc 13 §3.5, lot N1). */
  loreKey: locRef.optional(),
  bonus: artifactBonusSchema,
  /** Emplacement typé de la poupée (présentation client, UXD-5b) — absent ⇒ sac. */
  slot: artifactSlotSchema.optional(),
  /** Sort enseigné tant qu'équipé (H-ARTEQUIP.2) — id cross-validé au chargement. */
  grantsSpell: idSchema.optional(),
});

export const artifactCatalogSchema = z.object({
  artifacts: z.array(artifactSchema).min(1),
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
    /** Vision d'une structure possédée (ville/mine), F1 — optionnel (0 si absent). */
    buildingVisionRadius: z.number().int().nonnegative().optional(),
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
      /** Profils de gain d'attribut PAR ARCHÉTYPE (H-NAMED.3, doc 02 §1.2). Optionnel ⇒ repli global. */
      attributeWeightsByArchetype: z
        .object({
          might: z
            .object({
              attack: z.number().nonnegative(),
              defense: z.number().nonnegative(),
              power: z.number().nonnegative(),
              knowledge: z.number().nonnegative(),
            })
            .optional(),
          magic: z
            .object({
              attack: z.number().nonnegative(),
              defense: z.number().nonnegative(),
              power: z.number().nonnegative(),
              knowledge: z.number().nonnegative(),
            })
            .optional(),
        })
        .optional(),
      /** Recrutement de héros à la Taverne (M-TAVERN.1, doc 02 §1.5/§4.1). `.default` (bridge exactOptional → engine `?:`). */
      recruitCost: z.number().int().nonnegative().default(2500),
      maxPerPlayer: z.number().int().positive().default(8),
    }),
    /** Règles de combat (doc 02 §5 + plan phase-2.4) — même forme que le moteur. */
    combat: z.object({
      attackDefenseStep: z.number().positive().max(1),
      heroDefenseStep: z.number().nonnegative().max(1),
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
      /** Attaque du héros (C1) — optionnel : absent ⇒ feature désactivée. */
      heroAttack: z
        .object({
          base: z.number().nonnegative(),
          perPower: z.number().nonnegative(),
          perAttack: z.number().nonnegative(),
        })
        .optional(),
    }).refine((c) => c.obstaclesMin <= c.obstaclesMax, 'obstaclesMin ≤ obstaclesMax'),
    /** Marché (doc 02 §4.1, lot UX U6a) : taux d'échange ressource ↔ or au bâtiment marché. */
    market: z
      .object({
        /** Or reçu par unité de ressource non-or VENDUE. */
        sellRate: z.number().int().positive(),
        /** Or payé par unité de ressource non-or ACHETÉE (spread : ≥ sellRate). */
        buyRate: z.number().int().positive(),
        /** Bonus de taux par marché possédé au-delà du 1er (T-MARKETRATE) — optionnel. */
        perMarketBonus: z.number().nonnegative().optional(),
        /** Plafond du facteur dégressif (≥ 1) — optionnel. */
        maxMarketFactor: z.number().min(1).optional(),
      })
      .refine((m) => m.buyRate >= m.sellRate, 'market.buyRate ≥ market.sellRate')
      // Aller-retour non rentable À TOUT NOMBRE DE MARCHÉS : le troc (et
      // vente→rachat) vaut `sellRate × factor² / buyRate` — si ce ratio
      // dépasse 1 au facteur plafond, l'échange duplique les ressources.
      .refine(
        (m) => m.sellRate * (m.maxMarketFactor ?? 1) ** 2 <= m.buyRate,
        'market : sellRate × maxMarketFactor² ≤ buyRate (aller-retour non rentable)',
      ),
    /**
     * Calendrier (M-CALENDAR, doc 02 §2.3) : événements hebdomadaires tirés au
     * RNG seedé. Optionnel — absent ⇒ aucune semaine spéciale (facteur 1).
     */
    calendar: z
      .object({
        events: z
          .array(
            z.object({
              id: idSchema,
              weight: z.number().int().positive(),
              /** Multiplicateur de la croissance hebdomadaire (peste < 1, abondance > 1). */
              growthFactor: z.number().positive(),
              /** « Semaine de X » (M-CALENDAR) : croissance ciblée × factor pour un palier. */
              growthTier: z
                .object({ tier: z.number().int().positive(), factor: z.number().positive() })
                .optional(),
              /**
               * « Semaine de ruée » (M-CALENDAR) : crédite `amount` de `resource`
               * (ressource commune) à TOUS les joueurs au passage de semaine.
               */
              resourceGrant: z
                .object({
                  resource: z.enum(COMMON_RESOURCE_IDS),
                  amount: z.number().int().positive(),
                })
                .optional(),
              /**
               * « Semaine du savoir » (M-CALENDAR) : accorde `amount` XP à chaque
               * héros (tous joueurs) au passage de semaine.
               */
              heroXpGrant: z.object({ amount: z.number().int().positive() }).optional(),
            }),
          )
          .min(1),
      })
      .optional(),
    /**
     * Butin de gardien (doc 02 §2.2) : or/ressource/artefact gradué par la force
     * du gardien vaincu, tiré au RNG seedé. Optionnel — absent ⇒ aucun butin.
     */
    guardianReward: z
      .object({
        goldPerHp: z.number().nonnegative(),
        variancePercent: z.number().int().min(0).max(100),
        /** Ressources non-or éligibles (ids opaques, validées contre les paquets ailleurs). */
        resources: z.array(idSchema),
        resourceThresholdHp: z.number().int().nonnegative(),
        resourceAmount: z.object({
          min: z.number().int().nonnegative(),
          max: z.number().int().nonnegative(),
        }),
        artifactThresholdHp: z.number().int().nonnegative(),
        artifactChancePercent: z.number().int().min(0).max(100),
      })
      .refine((r) => r.resourceAmount.min <= r.resourceAmount.max, 'resourceAmount.min ≤ max')
      .optional(),
  }),
  newGame: z.object({
    map: idSchema,
    startingResources: z.record(z.enum(COMMON_RESOURCE_IDS), z.number().int().nonnegative()),
    /** Armée de départ du héros (≤ 7 piles) — IDs vérifiés contre les paquets chargés. */
    startingArmy: z
      .array(z.object({ unitId: idSchema, count: z.number().int().positive() }))
      .max(7)
      .default([]),
    /** Artefacts de départ du héros (plan phase-3.2 décision 9) — IDs vérifiés contre `data/core/artifacts.json`. */
    startingArtifacts: z.array(idSchema).optional(),
    /** Attributs de base du héros (doc 02 §1.1) — le Savoir fixe la mana (× 10). Défaut 0. */
    startingHero: z
      .object({
        attack: z.number().int().nonnegative(),
        defense: z.number().int().nonnegative(),
        power: z.number().int().nonnegative(),
        knowledge: z.number().int().nonnegative(),
      })
      .optional(),
    /** Nom du héros de départ (H-NAMED, doc 02 §1.1) — clé de locale UI (core) résolue au client. */
    startingHeroName: z.string().optional(),
    /**
     * Spécialité du héros de départ (H-NAMED, doc 02 §1.2) : id opaque +
     * profil d'effets déclaratifs (même vocabulaire que les Maisons). Le nom/la
     * description localisés vivent dans les locales (`hero.specialty.<id>.*`).
     */
    startingHeroSpecialty: z
      .object({ id: idSchema, ...heroEffectFields })
      .refine((e) => Object.entries(e).some(([k, v]) => k !== 'id' && v !== undefined), 'au moins un effet de spécialité')
      .optional(),
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
        /** Gardien lié (M-GUARDLINK, doc 02 §2.2) — id d'un objet `guardian` ; ramassage bloqué tant qu'il vit. */
        guardedBy: idSchema.optional(),
      }),
      /**
       * Gardien neutre : pile unique, combat à l'interception (doc 02 §2.2).
       * `roamRadius` (optionnel) = gardien **errant** : 1 pas/jour vers le héros
       * le plus proche dans ce rayon.
       */
      z.object({
        id: idSchema,
        type: z.literal('guardian'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        unitId: idSchema,
        count: z.number().int().positive(),
        roamRadius: z.number().int().positive().optional(),
      }),
      /**
       * Lieu de bonus visitable (doc 02 §2.2) — effet déclaratif générique
       * (fontaine/écurie/arbre du savoir/moulin) + politique de re-visite.
       */
      z.object({
        id: idSchema,
        type: z.literal('visitable'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        effect: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('luck'), amount: z.number().int().positive() }),
          /** Temple / point d'eau (M-VISIT, doc 02 §2.2) : +moral jusqu'au prochain combat. */
          z.object({ kind: z.literal('morale'), amount: z.number().int().positive() }),
          z.object({ kind: z.literal('movement'), amount: z.number().int().positive() }),
          z.object({ kind: z.literal('levelXp') }),
          /** Pierre du Savoir (M-VISIT, doc 02 §2.2) : montant FIXE d'XP au héros. */
          z.object({ kind: z.literal('experience'), amount: z.number().int().positive() }),
          z.object({
            kind: z.literal('resource'),
            resource: z.enum(COMMON_RESOURCE_IDS),
            amount: z.number().int().positive(),
          }),
          /** Tour de guet (F2) : révèle `amount` tuiles de brouillard autour du lieu. */
          z.object({ kind: z.literal('vision'), amount: z.number().int().positive() }),
          /** Bonus d'attribut PERMANENT (M-VISIT, doc 02 §2.2 — arène/statue). */
          z.object({
            kind: z.literal('permanentStat'),
            attribute: z.enum(['attack', 'defense', 'power', 'knowledge']),
            amount: z.number().int().positive(),
          }),
          /** Sanctuaire de sort (M-VISIT, doc 02 §2.2) : enseigne `spellId` au héros. */
          z.object({ kind: z.literal('learnSpell'), spellId: idSchema }),
          /** Cabane de la sorcière (M-VISIT, doc 02 §2.2) : enseigne `skillId` au héros. */
          z.object({ kind: z.literal('grantSkill'), skillId: idSchema }),
          /** Fabrique de machines de guerre (M-VISIT, doc 02 §2.2) : donne `machineId` au héros. */
          z.object({ kind: z.literal('grantWarMachine'), machineId: idSchema }),
          /** Puits de magie (M-VISIT, doc 02 §2.2) : restaure la mana du héros à son max. */
          z.object({ kind: z.literal('restoreMana') }),
          /** Chariot / dépouille (M-VISIT, doc 02 §2.2) : donne `artifactId` au héros. */
          z.object({ kind: z.literal('grantArtifact'), artifactId: idSchema }),
        ]),
        frequency: z.enum(['oncePerHero', 'oncePerHeroPerWeek']),
      }),
      /** Habitation hors ville (doc 02 §2.2) : stock initial optionnel (défaut 0). */
      z.object({
        id: idSchema,
        type: z.literal('dwelling'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        unitId: idSchema,
        stock: z.number().int().nonnegative().optional(),
      }),
      /** Mine capturable (doc 02 §2.2) : `amount` de `resource` par jour à son propriétaire. */
      z.object({
        id: idSchema,
        type: z.literal('mine'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        resource: z.enum(COMMON_RESOURCE_IDS),
        amount: z.number().int().positive(),
      }),
      /**
       * Trésor (doc 02 §2.2) : le héros choisit `gold` OU `xp` à la visite.
       * Au moins un gain > 0 — règle croisée dans `loadMap` (une union
       * discriminée Zod n'accepte pas de `.refine` par variante).
       */
      z.object({
        id: idSchema,
        type: z.literal('treasure'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        gold: z.number().int().nonnegative(),
        xp: z.number().int().nonnegative(),
        /** Gardien lié (M-GUARDLINK, doc 02 §2.2) — cf. objet `resource`. */
        guardedBy: idSchema.optional(),
      }),
      /** Artefact posé au sol (doc 02 §2.2) — `artifactId` connu, règle croisée dans `loadMap`. */
      z.object({
        id: idSchema,
        type: z.literal('artifact'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        artifactId: idSchema,
        /** Gardien lié (M-GUARDLINK, doc 02 §2.2) — cf. objet `resource`. */
        guardedBy: idSchema.optional(),
      }),
      /**
       * Monolithe / téléporteur apparié (M-NAV a, doc 02 §2.1) : exactement 2
       * monolithes partagent un `pairId` — règle croisée dans `loadMap`.
       */
      z.object({
        id: idSchema,
        type: z.literal('monolith'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        pairId: idSchema,
      }),
      /**
       * Ville (doc 02 §4, plan phase-3.1) — la ville de départ y référence son id.
       * `factionId`/`garrison` optionnels : une ville **neutre** (Alpha 4.13) posée
       * sur la carte, assiégeable par un héros (combat contre sa garnison). Une
       * ville de départ de joueur ignore ces champs (garnison initiale vide).
       */
      z.object({
        id: idSchema,
        type: z.literal('town'),
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        factionId: idSchema.optional(),
        garrison: z
          .array(z.object({ unitId: idSchema, count: z.number().int().positive() }))
          .optional(),
      }),
    ]),
  ),
  startPositions: z
    .array(z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() }))
    .min(1),
  /**
   * Triggers déclaratifs (doc 02 §2.1) — optionnels. `on` = visite d'une tuile
   * (`x`,`y`) ou jour donné ; `effect` = octroi de ressource commune ou message
   * localisé. Forme figée identique à `MapTriggerDef` du moteur (générique, sans
   * faction). `fired` est un champ d'état, absent des données.
   */
  triggers: z
    .array(
      z.object({
        id: idSchema,
        on: z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('visit'),
            x: z.number().int().nonnegative(),
            y: z.number().int().nonnegative(),
          }),
          z.object({ kind: z.literal('day'), day: z.number().int().positive() }),
        ]),
        effect: z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('grantResource'),
            resource: z.enum(COMMON_RESOURCE_IDS),
            amount: z.number().int().positive(),
          }),
          z.object({ kind: z.literal('message'), textKey: z.string().min(1) }),
        ]),
      }),
    )
    .optional(),
});

/** data/scenarios/index.json — registre des scénarios à charger (comme `factionIndexSchema`). */
export const scenarioIndexSchema = z.object({
  scenarios: z.array(idSchema).min(1),
});

/**
 * Condition de victoire/défaite déclarative — forme figée, identique à
 * `VictoryCondition` de `engine/src/scenario/types.ts` (plan phase-3.5). Le
 * contenu ne fait qu'y référencer des ids opaques (ville, héros) ; leur
 * résolution en jeu appartient au moteur.
 */
export const victoryConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('eliminateAllEnemies') }),
  z.object({ type: z.literal('captureTown'), townId: idSchema }),
  z.object({ type: z.literal('defeatHero'), heroId: idSchema }),
  z.object({ type: z.literal('surviveDays'), days: z.number().int().positive() }),
]);

/** Objectifs d'un joueur — identique à `ScenarioObjectives` du moteur. */
export const scenarioObjectivesSchema = z.object({
  victory: victoryConditionSchema,
  defeat: victoryConditionSchema,
});

/**
 * Narration (doc 13, lot N2b) — contenu déclaratif interprété par le système
 * de quêtes générique (moteur, N2a) et la couche de présentation (client). Le
 * moteur ne connaît ni texte ni dialogue : `titleKey`/`descriptionKey`/
 * `dialogBefore` sont des champs CÔTÉ CLIENT (dépouillés avant embarquement).
 */
export const questConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('eliminateAllEnemies') }),
  z.object({ type: z.literal('captureTown'), townId: idSchema }),
  z.object({ type: z.literal('defeatHero'), heroId: idSchema }),
  z.object({ type: z.literal('surviveDays'), days: z.number().int().positive() }),
  z.object({ type: z.literal('buildStructure'), buildingId: buildingIdSchema }),
  z.object({ type: z.literal('ownUnits'), unitId: idSchema, count: z.number().int().positive() }),
  z.object({ type: z.literal('defeatGuardian'), objectId: idSchema }),
  z.object({
    type: z.literal('visitTile'),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
  }),
]);

export const questRewardSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('resources'),
    resources: z.record(z.enum(COMMON_RESOURCE_IDS), z.number().int().positive()),
  }),
  z.object({ type: z.literal('artifact'), artifactId: idSchema }),
  z.object({ type: z.literal('units'), unitId: idSchema, count: z.number().int().positive() }),
]);

export const questStepSchema = z.object({
  id: idSchema,
  condition: questConditionSchema,
  /** Dialogue joué à l'entrée de l'étape (client) — id d'un nœud du scénario. */
  dialogBefore: idSchema.optional(),
});

export const questSchema = z.object({
  id: idSchema,
  kind: z.enum(['primary', 'side', 'daily', 'personal']).default('primary'),
  /** Joueur propriétaire — défaut : le joueur humain (moteur). */
  playerId: idSchema.optional(),
  steps: z.array(questStepSchema).min(1),
  rewards: z.array(questRewardSchema).default([]),
  titleKey: locRef,
  descriptionKey: locRef.optional(),
});

/**
 * Gabarits de quêtes journalières du mode libre (doc 13 §4.2/§5.3, N4c) — petites
 * missions « contrats » instanciées côté client via le RNG seedé de la partie.
 * Les conditions sont résolues en `QuestCondition` moteur : `recruitTier` devient
 * un `ownUnits` de l'unité de tier N de la faction du joueur (résolu au runtime).
 */
export const dailyTemplateConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('recruitTier'),
    tier: z.number().int().min(1).max(8),
    count: z.number().int().positive(),
  }),
  z.object({ type: z.literal('buildStructure'), buildingId: buildingIdSchema }),
  z.object({ type: z.literal('surviveDays'), days: z.number().int().positive() }),
]);

export const dailyTemplateSchema = z.object({
  id: idSchema,
  condition: dailyTemplateConditionSchema,
  reward: questRewardSchema,
  titleKey: locRef,
  descriptionKey: locRef.optional(),
});

export const dailyTemplatesFileSchema = z.object({
  templates: z.array(dailyTemplateSchema).min(1),
});

const dialogLineSchema = z.object({
  /** Id d'un personnage du catalogue `characters`. */
  speaker: idSchema,
  /** Humeur/variante de portrait (clé libre) — repli procédural côté client. */
  portrait: z.string().optional(),
  textKey: locRef,
});

export const dialogNodeSchema = z.object({
  id: idSchema,
  lines: z.array(dialogLineSchema).min(1),
  choices: z
    .array(
      z.object({
        textKey: locRef,
        next: idSchema.optional(),
        setFlag: z.string().optional(),
      }),
    )
    .optional(),
});

export const characterSchema = z.object({
  id: idSchema,
  nameKey: locRef,
  /** Portraits par humeur (id libre → chemin/clé) — optionnel, repli procédural. */
  portraits: z.record(z.string(), z.string()).default({}),
});

/**
 * Cinématique scriptée par la caméra (doc 13 §6.3, lot N3c.1) — PAS de vidéo.
 * Une séquence déclarative d'étapes interprétées par la scène d'aventure Pixi
 * (côté client, pure présentation — zéro diff moteur) : déplacer la caméra sur
 * une tuile, attendre, jouer un dialogue existant. Skippable au tap.
 */
export const cutsceneStepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('panTo'),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    /** Durée du déplacement caméra en ms (défaut : 900). */
    ms: z.number().int().positive().optional(),
  }),
  z.object({ type: z.literal('wait'), ms: z.number().int().positive() }),
  /** Joue un nœud de dialogue du scénario (id de `dialogs`). */
  z.object({ type: z.literal('dialog'), dialog: idSchema }),
]);

export const cutsceneSchema = z.object({
  id: idSchema,
  steps: z.array(cutsceneStepSchema).min(1),
});

/**
 * data/scenarios/<id>.scenario.json (plan phase-3.5) — une carte + des joueurs
 * (contrôleur, faction, dotation de départ) + des objectifs par joueur. Les
 * règles croisées (carte connue, faction chargée, index de départ valide,
 * unités d'armée connues) vivent dans `loadScenarios`.
 */
export const scenarioSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(1),
    name: locRef,
    /** Référence `data/maps/<id>.map.json`. */
    map: idSchema,
    players: z
      .array(
        z.object({
          id: idSchema,
          controller: z.enum(['human', 'ai']),
          /** Référence un paquet de faction chargé (`data/factions/<id>/`). */
          factionId: idSchema,
          /** Index dans `map.startPositions`. */
          startPositionIndex: z.number().int().nonnegative(),
          startingResources: z
            .record(z.enum(COMMON_RESOURCE_IDS), z.number().int().nonnegative())
            .default({}),
          /** Armée de départ du héros (≤ 7 piles). */
          startingArmy: z
            .array(z.object({ unitId: idSchema, count: z.number().int().positive() }))
            .max(7)
            .default([]),
          /** Artefacts de départ du héros (ids) — validés contre `data/core/artifacts.json`. */
          startingArtifacts: z.array(idSchema).optional(),
          /** Ville de départ du joueur (doc 02 §4) — optionnelle (scénario sans ville). */
          startingTown: z
            .object({
              id: idSchema,
              x: z.number().int().nonnegative(),
              y: z.number().int().nonnegative(),
              prebuilt: z
                .array(z.object({ building: buildingIdSchema, level: z.number().int().positive() }))
                .min(1),
            })
            .optional(),
        }),
      )
      .min(2),
    objectives: z.record(idSchema, scenarioObjectivesSchema),
    /**
     * Narration embarquée (doc 13, lot N2b) — optionnelle. `quests` sont
     * résolues en `QuestState` moteur (N2a) ; `dialogs`/`characters`/
     * `openingDialog` alimentent la couche de présentation client. La forme
     * dossier `data/story/` (multi-chapitres, doc 13 §6.1) arrive en N3.
     */
    quests: z.array(questSchema).optional(),
    dialogs: z.array(dialogNodeSchema).optional(),
    characters: z.array(characterSchema).optional(),
    /** Dialogue joué à l'ouverture de la partie (id d'un nœud de `dialogs`). */
    openingDialog: idSchema.optional(),
    /** Cinématiques caméra (doc 13 §6.3, N3c.1) — présentation client pure. */
    cutscenes: z.array(cutsceneSchema).optional(),
    /** Cinématique jouée à l'ouverture de la partie (id d'un nœud de `cutscenes`). */
    openingCutscene: idSchema.optional(),
    /**
     * Barks de combat (doc 13 §6.3, N4b) — pool de répliques localisées de
     * l'antagoniste, dont UNE est tirée au hasard côté client au début d'un
     * combat. Présentation pure : jamais embarqué dans le moteur.
     */
    combatBarks: z.array(locRef).optional(),
    /**
     * Événement temporaire (doc 13 §4.3, N4d) — fenêtre de dates ISO
     * (`YYYY-MM-DD`) vérifiée à l'ouverture du menu par l'horloge CLIENT (jamais
     * le moteur). Un scénario sans `availability` est disponible en permanence.
     */
    availability: z
      .object({ from: z.string().min(1), to: z.string().min(1) })
      .optional(),
  })
  .refine((s) => s.players.every((p) => s.objectives[p.id]), 'chaque joueur doit avoir des objectifs');

export type AbilityCatalog = z.infer<typeof abilityCatalogSchema>;
export type FactionIndex = z.infer<typeof factionIndexSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type FactionBonus = z.infer<typeof factionBonusSchema>;
export type House = z.infer<typeof houseSchema>;
export type HouseEffect = z.infer<typeof houseEffectSchema>;
export type HeroIdentity = z.infer<typeof heroIdentitySchema>;
export type HeroOrigin = (typeof HERO_ORIGINS)[number];
export type Unit = z.infer<typeof unitSchema>;
export type Locale = z.infer<typeof localeSchema>;
export type GameConfig = z.infer<typeof gameConfigSchema>;
export type MapFile = z.infer<typeof mapFileSchema>;
export type Building = z.infer<typeof buildingSchema>;
export type BuildingCatalogFile = z.infer<typeof buildingCatalogSchema>;
/**
 * Forme moteur — `Building` sans `name`/`loreKey` (affichage, hors `BuildingDef`
 * figé), plus `factionId` : origine opaque du bâtiment (id du paquet de faction,
 * absent pour un bâtiment commun/core). Sert à restreindre la construction à la
 * faction de la ville — le moteur ne compare que des chaînes, jamais un nom en dur.
 */
export type ResolvedBuilding = Omit<Building, 'name' | 'loreKey'> & { factionId?: string };
export type Spell = z.infer<typeof spellSchema>;
export type SpellCatalogFile = z.infer<typeof spellCatalogSchema>;
/** Forme moteur — `Spell` sans `name`/`loreKey` (affichage, hors `SpellDef` figé). */
export type ResolvedSpell = Omit<Spell, 'name' | 'loreKey'>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillCatalogFile = z.infer<typeof skillCatalogSchema>;
/** Forme moteur — `Skill` sans `name` (locale, hors `HeroSkillDef` figé). */
// `external` est une contrainte de VALIDATION (contenu) hors forme moteur ; le
// `factionId` (F-SKILLS) est estampillé par le loader depuis `manifest.heroSkills`.
export type ResolvedSkill = Omit<Skill, 'name' | 'external'> & { factionId?: string };
export type Artifact = z.infer<typeof artifactSchema>;
export type ArtifactSlot = z.infer<typeof artifactSlotSchema>;
export type ArtifactCatalogFile = z.infer<typeof artifactCatalogSchema>;
export type WarMachine = z.infer<typeof warMachineSchema>;
/** Forme moteur — `Artifact` sans `name`/`loreKey` (affichage, hors `ArtifactDef` figé). */
export type ResolvedArtifact = Omit<Artifact, 'name' | 'loreKey'>;
export type ScenarioIndex = z.infer<typeof scenarioIndexSchema>;
/** Forme moteur — identique à `VictoryCondition` de `engine/src/scenario/types.ts`. */
export type VictoryCondition = z.infer<typeof victoryConditionSchema>;
/** Forme moteur — identique à `ScenarioObjectives` de `engine/src/scenario/types.ts`. */
export type ScenarioObjectives = z.infer<typeof scenarioObjectivesSchema>;
/**
 * Campagne (doc 13 §4.1/§6.1, N3a) — suite ordonnée de chapitres, chacun
 * référençant un scénario chargé. Vit dans le paquet de faction
 * (`data/factions/<id>/story/campaign.json`, déclaré par `manifest.story`) :
 * ajouter une maison = ajouter sa campagne, zéro diff ailleurs (doc 13 §8).
 */
export const campaignChapterSchema = z.object({
  id: idSchema,
  /** Référence un scénario chargé (`data/scenarios/<id>.scenario.json`). */
  scenario: idSchema,
  titleKey: locRef,
  descriptionKey: locRef.optional(),
});

export const campaignSchema = z.object({
  id: idSchema,
  factionId: idSchema,
  nameKey: locRef,
  descriptionKey: locRef.optional(),
  chapters: z.array(campaignChapterSchema).min(1),
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type Cutscene = z.infer<typeof cutsceneSchema>;
export type CutsceneStep = z.infer<typeof cutsceneStepSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type CampaignChapter = z.infer<typeof campaignChapterSchema>;
export type QuestContent = z.infer<typeof questSchema>;
export type QuestStepContent = z.infer<typeof questStepSchema>;
export type QuestRewardContent = z.infer<typeof questRewardSchema>;
export type DailyTemplate = z.infer<typeof dailyTemplateSchema>;
export type DailyTemplatesFile = z.infer<typeof dailyTemplatesFileSchema>;
export type DialogNode = z.infer<typeof dialogNodeSchema>;
export type StoryCharacter = z.infer<typeof characterSchema>;
