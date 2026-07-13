import type { ResourceId } from '../core/state';

/**
 * Types compétences / sorts / artefacts — SURFACE FIGÉE en cadrage
 * (plan phase-3.2). Lots K (règles), L (contenu), M (UI) programment contre
 * ces formes. Le moteur ne connaît aucune faction : tout est id + données.
 */

/**
 * École de magie d'un sort (doc 02 §1.4). **Chaîne opaque pour le moteur** (D11) :
 * le moteur ne compare que l'égalité d'école (réduction de mana par école, A6) et
 * n'énumère aucune école — l'ensemble valide est défini par les **données** et
 * validé par `@heroes/content` (écoles génériques fire/water/earth/air/neutral +
 * écoles de faction, ex. `traque`). Ajouter une école de faction = donnée +
 * registre de contenu, jamais un diff moteur.
 */
export type SpellSchool = string;
export type SpellKind =
  | 'damage'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'applyMarks'
  | 'silence'
  | 'banish'
  | 'rally'
  | 'stealth'
  | 'teleport'
  | 'adventure';

/**
 * Effet déclaratif d'un sort d'**aventure** (doc 02 §1.4, Alpha 4.16) — lancé sur
 * la carte, hors combat. Union extensible : `townPortal` (téléportation vers une
 * ville possédée) ; `vision` (H-SPELLS.3 — révèle le brouillard dans un rayon
 * autour du héros). Ajouter un effet = un cas + données, jamais de faction.
 */
export type AdventureEffect = { type: 'townPortal' } | { type: 'vision'; radius: number };

/** Définition résolue d'un sort (doc 02 §1.4), embarquée dans le catalogue. */
export interface SpellDef {
  id: string;
  school: SpellSchool;
  circle: number; // 1..5
  manaCost: number;
  kind: SpellKind;
  /** Dégâts/soin = base + perPower × Pouvoir (doc 02 §1.1). */
  base: number;
  perPower: number;
  /** Modificateurs temporaires pour buff/debuff (durée = Pouvoir rounds, min 1). */
  attackMod?: number;
  defenseMod?: number;
  speedMod?: number;
  /**
   * Modificateur de MORAL pendant le statut (F-SCHOOLS, École de la Scène doc 16
   * §3.3 : Chant de Courage +1, Dissonance −1). Générique — s'ajoute au moral de
   * la pile porteuse, borné [−3, +3] comme le reste. Absent = neutre.
   */
  moraleMod?: number;
  /** Charges de Marque appliquées (sort `applyMarks`, doc 05 §6 — école Traque). */
  marks?: number;
  /**
   * Sort mange-Marques (F-SCHOOLS.3, doc 05 §6 « Volée de Dagues Spectrales ») :
   * un sort `damage` gagne `marksDamagePct` % de dégâts PAR charge de Marque de la
   * cible (s'ajoute au bonus passif de Marque), puis les Marques sont consommées
   * (remises à 0). Absent = sort de dégâts normal. Générique : nombre opaque.
   */
  marksDamagePct?: number;
  /**
   * Zone d'effet : `splash` (C7) = la pile ciblée + les piles du même camp qui lui
   * sont adjacentes sur la grille hex (Boule de feu…) ; `all` (H-SPELLS.1, doc 02
   * §1.4) = **toutes** les piles vivantes du camp de la cible (sorts de masse —
   * le camp visé est celui de la pile choisie). Absent = mono-cible.
   */
  area?: 'splash' | 'all';
  /** Effet hors combat d'un sort `adventure` (doc 02 §1.4, Alpha 4.16). */
  adventure?: AdventureEffect;
}

/** Rangs Novice/Expert/Maître d'une compétence (doc 02 §1.3) — effets par rang. */
export interface SkillRankEffect {
  movementBonusPct?: number;
  visionBonus?: number;
  goldPerDay?: number;
  meleeDamagePct?: number;
  rangedDamagePct?: number;
  armorReductionPct?: number;
  luckBonus?: number;
  moraleBonus?: number;
  manaCostReductionPct?: number;
  spellCircleUnlock?: number;
  learnCircle?: number;
  /** Compétence Tactique (C-TACTICS, doc 02 §5.1) : profondeur de la bande de placement pré-combat. */
  tacticsColumns?: number;
  /**
   * Prière de bataille (F-SKILLS.2, doc 03 §2/§5) : PV soignés/ressuscités par le
   * héros sur une pile alliée, **1×/combat**. Un héros dont une compétence porte
   * ce champ (> 0) débloque l'action `HeroRally`. Agrégé par `heroBattlePrayerHp`.
   */
  battleResurrectHp?: number;
  /**
   * Effets **town-scoped** d'une Maison (F-HOUSES, doc 16 §3.1 — Le Blaireau).
   * Contrairement aux champs ci-dessus (agrégés PAR HÉROS dans `hero/skills.ts`),
   * ceux-ci s'appliquent à une VILLE : ils ne sont interprétés que par le code de
   * ville, via `townHouseField` (option B — la Maison du héros présent sur la
   * tuile de la ville). `garrisonGrowthPct` = bonus % de croissance hebdo ;
   * `garrisonDefense` = bonus plat de défense « murs » au siège.
   */
  garrisonGrowthPct?: number;
  garrisonDefense?: number;
  /**
   * Spécialité CONDITIONNELLE (H-COND, doc 04 §5 / 05 §7 / 14 §5) — bonus de
   * combat ciblé sur une UNITÉ précise (`unitId`) et/ou mis à l'échelle par
   * NIVEAU du héros (`perLevels` ⇒ magnitude × `ceil(level/perLevels)`, sinon ×1).
   * Interprété au niveau unité en combat (`conditionalUnitBonus`) ; **jamais**
   * agrégé par `sumHouseField` (les entrées `conditional` n'ont pas de champ
   * scalaire). Générique : le moteur ne lit que des ids opaques (aucune faction).
   */
  conditional?: {
    /** Unité ciblée (id opaque) — absent = toutes les piles du camp. */
    unitId?: string;
    /** Palier de niveau : magnitude × `ceil(heroLevel / perLevels)`. Absent/0 = ×1 (plat). */
    perLevels?: number;
    attack?: number;
    defense?: number;
    speed?: number;
  };
  /**
   * Spécialité EXACTE Mère Corbeau (H-COND-EXACT, doc 04 §5) — met à l'échelle
   * l'effet de faction générique `raiseUndeadOnVictory` : `+N %` de PV relevés
   * PAR NIVEAU du héros vainqueur, additionné au pourcentage de base. Lu dans
   * `applyRaiseUndeadOnVictory` uniquement. Générique : `raiseUndead` est le nom
   * du mécanisme déclaratif au moteur, pas un id de faction.
   */
  raiseUndeadPctPerLevel?: number;
  /**
   * Spécialité EXACTE Faelar (H-COND-EXACT, doc 14 §5) — au DÉBUT du combat, les
   * piles du camp du héros dotées de la capacité `symbiosis` démarrent à ce
   * nombre de paliers (borné par `maxStacks`) au lieu de 0. Lu dans
   * `openPlacementOrBattle`. Générique : `symbiosis` est un module de capacité.
   */
  startingSymbiosisStacks?: number;
  /**
   * Spécialité EXACTE Alwin (H-COND-EXACT, doc 05 §7) — armée de départ bonus :
   * à la création du héros (`StartGame`), `count` créatures `unitId` rejoignent
   * `hero.army` (empilées si déjà présentes, sinon nouvelle pile si < 7). Objet
   * EXCLU de `NumericEffectField` (comme `conditional`). `unitId` = id opaque.
   */
  startingArmyBonus?: { unitId: string; count: number };
}

/**
 * Identité résolue d'un héros nommé (H-NAMED.1, doc 02 §1.2) — embarquée dans
 * `StartGame.heroRoster`, indexée par id. Le moteur applique nom/attributs/
 * spécialité/départ à la création si `PlayerSetup.startingHeroId` la désigne.
 * Effets déclaratifs génériques (mêmes que Maisons/compétences) — zéro nom en dur.
 */
export interface ResolvedHeroDef {
  /** Faction propriétaire (id opaque) — la Taverne d'une ville n'offre que les héros de SA faction (M-TAVERN.1). */
  factionId: string;
  name: string;
  /**
   * Archétype du héros (H-NAMED.3, doc 02 §1.2) — sélectionne le profil de gain
   * d'attribut par niveau (`config.attributeWeightsByArchetype`). Optionnel ⇒
   * repli sur le profil global (vieux save / héros générique). Clé opaque.
   */
  archetype?: 'might' | 'magic';
  attributes: { attack: number; defense: number; power: number; knowledge: number };
  specialtyId: string;
  specialtyEffects: SkillRankEffect[];
  startingSkills: Record<string, number>;
  startingSpells: string[];
}

export interface HeroSkillDef {
  id: string;
  /** 3 rangs (index 0 = Novice) — doc 02 §1.3. */
  ranks: SkillRankEffect[];
  /**
   * École visée par une compétence de magie (« Magie par école ×4 », doc 02
   * §1.3) : sa réduction de coût de mana ne s'applique QU'aux sorts de cette
   * école (A6). Absente pour les compétences non magiques.
   */
  school?: SpellSchool;
  /**
   * Faction propriétaire (F-SKILLS, doc 02 §1.3) — id opaque **estampillé par le
   * loader** depuis `manifest.heroSkills`. Une compétence de faction n'est
   * proposée au tirage de niveau **qu'aux héros de cette faction** (`hero.factionId
   * === factionId`). Absente = compétence **commune**. Le moteur ne compare
   * jamais qu'un id ; optionnelle ⇒ vieilles saves gracieuses (aucun bump).
   */
  factionId?: string;
}

/**
 * Emplacement typé de la poupée d'équipement (doc 08 §2.3, lot UXD-5b).
 * Donnée de PRÉSENTATION pure : le moteur ne la lit jamais (aucun
 * `if (slot === …)`), les bonus se somment quel que soit l'emplacement. Elle
 * sert uniquement au regroupement typé de l'écran héros côté client.
 */
export type ArtifactSlot =
  | 'head'
  | 'neck'
  | 'torso'
  | 'weapon'
  | 'shield'
  | 'cloak'
  | 'hands'
  | 'feet'
  | 'ring'
  | 'misc';

/** Bonus déclaratifs cumulatifs d'un artefact (doc 02 §1.1, doc 08 §2.3). */
export interface ArtifactDef {
  id: string;
  bonus: {
    attack?: number;
    defense?: number;
    power?: number;
    knowledge?: number;
    luck?: number;
    morale?: number;
    manaMax?: number;
  };
  /** Emplacement de poupée (présentation client, jamais lu par le moteur). */
  slot?: ArtifactSlot;
}

/** Statut temporaire appliqué à une pile par un sort (buff/debuff) ou une capacité (curseOnHit). */
export interface SpellStatus {
  spellId: string;
  attackMod: number;
  defenseMod: number;
  speedMod: number;
  /**
   * Modificateur de MORAL pendant le statut (F-SCHOOLS, École de la Scène doc 16
   * §3.3). **Optionnel** — absent sur les statuts sans effet de moral (poison,
   * malédiction, buff/debuff purs de stats). Lu `?? 0` par `moraleOf` ⇒ pas de
   * bump save (les anciennes sauvegardes restent valides).
   */
  moraleMod?: number;
  /**
   * Modificateur MULTIPLICATIF des dégâts que la pile INFLIGE (A2c, `curseOnHit`
   * « Faux funeste » : −0,2 = −20 %). 0 = neutre. Distinct des mods additifs
   * d'attaque/défense (pente ±0,05).
   */
  damageDealtMod: number;
  /**
   * Dégâts de POISON infligés à la pile porteuse au début de chaque round
   * (A2f, `poisonSting` Manticore — doc 05 §4). Dégâts plats, cumulés si
   * plusieurs poisons. 0 = statut non toxique (buff/debuff/malédiction).
   */
  damagePerRound: number;
  /**
   * Silence (F-SCHOOLS.4, doc 05 §6 « Silence Scellé ») : tant qu'un statut
   * `silenced` est actif sur la pile, elle ne peut plus lancer son sort embarqué
   * (`spellcaster`, A2h). `false` pour tout statut de buff/debuff/malédiction/poison.
   */
  silenced: boolean;
  roundsLeft: number;
}

/** Coût de recrutement partiel — réexport pratique pour les données de sort. */
export type PartialResources = Partial<Record<ResourceId, number>>;
