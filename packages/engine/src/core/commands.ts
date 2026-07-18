import type { AdventureConfig } from '../adventure/config';
import type { AdventureMapDef, GridPos } from '../adventure/map';
import type { ArmyStack, CombatActionInput, CombatUnitDef } from '../combat/types';
import type { OffsetPos } from '../combat/hex';
import type { BuildingDef, TownState } from '../town/types';
import type { ArtifactDef, HeroSkillDef, ResolvedHeroDef, SkillRankEffect, SpellDef } from '../hero/types';
import type { FactionBonus } from '../faction/types';
import type { ScenarioState } from '../scenario/types';
import type { QuestDef, QuestState } from '../quest/types';
import type { HeroAttributes, ResourceId, Resources } from './state';

export interface PlayerSetup {
  id: string;
  /** Ressources de départ — fournies par le scénario/les données, jamais en dur. */
  startingResources: Resources;
  /** Armée de départ du héros (≤ 7 piles) — données de scénario. */
  startingArmy?: ArmyStack[];
  /** Attributs de base du héros (doc 02 §1.1) — données de scénario ; défaut 0. */
  startingAttributes?: HeroAttributes;
  /** Sorts connus d'emblée (ids) — résolus par le contenu (cercle ≤ Guilde MVP, décision 3.2 #7). */
  startingSpells?: string[];
  /** Maison du héros (doc 06 §4) — id opaque pour le moteur ; défaut ''. */
  startingFactionId?: string;
  /** Allégeance de Maison du héros (doc 16 §3.1) — id opaque ; défaut ''. */
  startingHouseId?: string;
  /** Nom du héros (doc 02 §1.1, H-NAMED) — chaîne opaque (souvent `@loc:`) ; défaut ''. */
  startingName?: string;
  /** Spécialité du héros (doc 02 §1.2, H-NAMED) — id opaque résolu via `specialtyCatalog` ; défaut ''. */
  startingSpecialtyId?: string;
  /**
   * Héros nommé du roster (H-NAMED.1, doc 02 §1.2) — id opaque résolu via
   * `StartGame.heroRoster` : fournit nom/attributs/spécialité/compétences/sorts de
   * départ. Les champs explicites ci-dessus (report de campagne) le priment. Défaut :
   * aucun (héros générique).
   */
  startingHeroId?: string;
  /** Contrôleur (doc 02 §6, plan phase-3.5) — `'ai'` pour un adversaire ; défaut `'human'`. */
  controller?: 'human' | 'ai';
  /** Équipe / alliance (doc 02 §6) — entier opaque ; défaut `0` (sans alliance). */
  team?: number;
  /**
   * Report de héros entre chapitres de campagne (doc 13 §4.1, N3a) — le héros
   * nommé conserve niveau/XP/compétences/artefacts d'un chapitre à l'autre.
   * Optionnels : absents ⇒ héros neuf (niveau 1). `startingArtifacts` (par
   * joueur) prime sur le champ global `StartGame.startingArtifacts`.
   */
  startingLevel?: number;
  startingXp?: number;
  startingSkills?: Record<string, number>;
  startingArtifacts?: (string | null)[];
}

/**
 * Union des commandes — petites et sérialisables : c'est le format de replay
 * et le futur protocole réseau (doc 07 §3). `StartGame` embarque carte,
 * constantes et catalogue d'unités résolus (validés par le pipeline de
 * contenu) : le moteur ne fetch jamais rien. En combat, seul le camp du
 * joueur est commandé — le camp IA est joué par le moteur (le journal ne
 * contient que les décisions du joueur).
 */
export type Command =
  | {
      type: 'StartGame';
      seed: number;
      players: PlayerSetup[];
      map: AdventureMapDef;
      config: AdventureConfig;
      unitCatalog: Record<string, CombatUnitDef>;
      /** Catalogue de bâtiments résolu (optionnel : parties sans ville). */
      buildingCatalog?: Record<string, BuildingDef>;
      /** Villes initiales résolues (ville de départ du joueur, villes neutres). */
      towns?: TownState[];
      /** Catalogues héros résolus (optionnels : sorts/compétences/artefacts). */
      spellCatalog?: Record<string, SpellDef>;
      skillCatalog?: Record<string, HeroSkillDef>;
      artifactCatalog?: Record<string, ArtifactDef>;
      /** Artefacts de départ du héros (ids) — données de scénario. */
      startingArtifacts?: string[];
      /** Catalogue d'effets de faction déclaratifs résolu par le contenu (doc 06 §4). */
      factionCatalog?: Record<string, { bonuses: FactionBonus[] }>;
      /**
       * Catalogue des Maisons résolu par le contenu (doc 16 §3.1), indexé par
       * `houseId` → effets déclaratifs. Sert à résoudre `hero.houseEffects` à la
       * création ; non stocké dans l'état (les effets résolus vivent sur le héros).
       */
      houseCatalog?: Record<string, { effects: SkillRankEffect[] }>;
      /**
       * Catalogue des spécialités de héros résolu par le contenu (doc 02 §1.2,
       * H-NAMED), indexé par `specialtyId` → effets déclaratifs. Sert à résoudre
       * `hero.specialtyEffects` à la création ; non stocké dans l'état (les effets
       * résolus vivent sur le héros, comme `houseCatalog`/`houseEffects`).
       */
      specialtyCatalog?: Record<string, { effects: SkillRankEffect[] }>;
      /**
       * Roster de héros nommés résolu par le contenu (H-NAMED.1, doc 02 §1.2), indexé
       * par `heroId` → identité déclarative (fiches `heroes/<id>.json` portant du
       * gameplay). Résout l'identité à la création (`PlayerSetup.startingHeroId`) ; non
       * stocké dans l'état (comme `houseCatalog`/`specialtyCatalog`).
       */
      heroRoster?: Record<string, ResolvedHeroDef>;
      /**
       * Groupes de croissance partagée résolus par le contenu (doc 05 §3.1/§8),
       * `groupId → membres`. Embarqué dans `GameState.growthGroups` ; absent = aucun.
       */
      growthGroups?: Record<string, string[]>;
      /** Objectifs de scénario par joueur (doc 02 §6, plan phase-3.5) — absent = partie libre. */
      scenario?: ScenarioState;
      /** Quêtes de campagne (doc 13 §6.2, N2a) — absent = pas de campagne. */
      quests?: QuestState;
    }
  | {
      /** Chemin calculé par A* côté client ; le moteur revalide chaque pas. */
      type: 'MoveHero';
      heroId: string;
      path: GridPos[];
    }
  | { type: 'EndTurn'; playerId: string }
  /** Fouille de la tuile du Graal (T-GRAIL lot 2) — le héros sur `grailPos` obtient le Graal. */
  | { type: 'Dig'; heroId: string }
  /** Embarque un héros à pied sur un bateau adjacent (A3.2) — il devient naval. */
  | { type: 'BoardBoat'; heroId: string; boatId: string }
  /** Débarque un héros naval sur une tuile terrestre adjacente (A3.2). */
  | { type: 'DisembarkBoat'; heroId: string; target: GridPos }
  | {
      /** Ouvre un combat hors aventure (arène `/#arena`, tests). */
      type: 'StartCombat';
      attacker: ArmyStack[];
      defender: ArmyStack[];
      terrain: string;
    }
  | { type: 'CombatAction'; action: CombatActionInput }
  | {
      /** L'IA joue le camp du joueur jusqu'à la fin du combat (doc 02 §5.5). */
      type: 'AutoCombat';
      /**
       * Lot M4 (doc 08 §2.4 « reprendre la main à tout round ») : joue `rounds`
       * round(s) auto puis rend la main sur une pile du joueur. Absent =
       * résolution complète (comportement historique, replays inchangés).
       */
      rounds?: number;
    }
  // ——— Villes (doc 02 §4) — surface figée en cadrage 3.1 ———
  | { type: 'BuildStructure'; townId: string; buildingId: string }
  | { type: 'RecruitUnits'; townId: string; unitId: string; count: number }
  | {
      /**
       * Choisit le destinataire de la croissance hebdo d'un groupe de croissance
       * partagée (doc 05 §3.1/§8, ex. « apex » T7/T8) dans une ville. Préférence
       * permanente ; prend effet au prochain passage de semaine. Générique : le
       * moteur ne connaît que des ids opaques (groupe, unité).
       */
      type: 'ChooseSharedGrowth';
      townId: string;
      groupId: string;
      unitId: string;
    }
  | {
      /**
       * Améliore toute la pile de garnison `unitId` (base) en sa variante
       * améliorée (doc 02 §4.1, Alpha 4.11) : requiert le dwelling amélioré bâti
       * (niveau 2) ; débite le différentiel de coût. Mapping base→amélioré
       * dérivé du dwelling gradué — aucun nom de faction dans le moteur.
       */
      type: 'UpgradeUnits';
      townId: string;
      unitId: string;
    }
  | {
      /**
       * Achète une machine de guerre (doc 02 §5, Alpha 4.12) à un bâtiment
       * vendeur (Forge) : requiert le héros présent, la machine listée par le
       * vendeur et non déjà possédée ; débite le coût du catalogue.
       */
      type: 'BuyWarMachine';
      townId: string;
      unitId: string;
    }
  | {
      /** Échange une pile entre garnison de ville et armée du héros présent. */
      type: 'GarrisonTransfer';
      townId: string;
      heroId: string;
      from: 'town' | 'hero';
      slot: number;
    }
  | {
      /**
       * Réordonne l'armée d'un héros (UX-REORDER, doc 08 §2.1/§2.3) : déplace la
       * pile de l'index `from` à `to` dans `hero.army`. L'ordre des slots influe
       * sur le placement de combat (`combat/setup.ts`). Générique, zéro faction.
       */
      type: 'ReorderArmy';
      heroId: string;
      from: number;
      to: number;
    }
  | {
      /**
       * Sépare une pile d'armée d'un héros (UX-SPLIT, doc 08 §2.1/§2.3) : retire
       * `count` créatures de la pile d'index `from` et crée une nouvelle pile du
       * même `unitId` ajoutée à `hero.army` (compact ≤ 7). Générique, zéro faction.
       */
      type: 'SplitStack';
      heroId: string;
      from: number;
      count: number;
    }
  | {
      /**
       * Transfert d'une pile d'armée OU d'un artefact entre deux héros du MÊME
       * joueur sur des tuiles adjacentes (UX-HEROSWAP, doc 02 §1.5, doc 08 §2.3).
       * `kind` sélectionne la ressource transférée ; `slot` est l'index source
       * (dans `army` ou `artifacts` du héros source). Une entité par commande —
       * l'UI enchaîne pour « tout donner ». Purement déterministe (aucun RNG).
       */
      type: 'TransferBetweenHeroes';
      fromHeroId: string;
      toHeroId: string;
      kind: 'army' | 'artifact';
      slot: number;
    }
  | {
      /**
       * Déséquipe un artefact (H-ARTEQUIP, doc 08 §2.3) : `artifacts[slot]` du
       * héros du joueur actif → son sac (`backpack`). Hors combat, déterministe.
       */
      type: 'UnequipArtifact';
      heroId: string;
      slot: number;
    }
  | {
      /**
       * Équipe un artefact du sac (H-ARTEQUIP) : `backpack[index]` → 1er slot
       * d'`artifacts` libre (refus si les 10 sont pleins). Hors combat.
       */
      type: 'EquipArtifact';
      heroId: string;
      index: number;
    }
  | {
      /**
       * Envoie une pile de garnison vers une autre ville possédée (T-CARAVAN,
       * doc 02 §4.1). Trajet en jours via l'A* existant ; arrivée en garnison.
       */
      type: 'SendCaravan';
      fromTownId: string;
      toTownId: string;
      slot: number;
    }
  | { type: 'CaptureTown'; townId: string; playerId: string }
  /**
   * Recruter un héros nommé à la Taverne (M-TAVERN.1, doc 02 §1.5/§4.1) : `heroId`
   * = id du roster (`GameState.heroRoster`), résolu contre or à la ville. Le héros
   * apparaît sur la tuile de la ville, armée vide.
   */
  | { type: 'RecruitHero'; townId: string; heroId: string; playerId: string }
  | {
      /**
       * Échange ressource ↔ or au bâtiment marché (doc 02 §4.1, lot UX U6a).
       * Exactement un côté est `'gold'` : vendre (give = ressource) ou acheter
       * (give = or). Taux `config.market`, déterministe (aucun RNG).
       */
      type: 'TradeResources';
      townId: string;
      give: ResourceId;
      receive: ResourceId;
      giveAmount: number;
    }
  // ——— Héros : sorts & compétences (doc 02 §1.2–§1.4) — surface figée 3.2 ———
  /**
   * F-SCHOOLS.8 : `targetHex` = destination d'un sort de téléportation
   * (`kind: 'teleport'`, Pas de Brume) ; ignoré par les autres sorts. Champ de
   * commande (pas d'état persisté) ⇒ aucun bump de sauvegarde.
   */
  | { type: 'CastSpell'; spellId: string; targetStackId: string; targetHex?: OffsetPos }
  /** Attaque du héros (C1) : dégâts directs sur une pile ennemie, 1×/combat. */
  | { type: 'HeroAttack'; targetStackId: string }
  /** Prière de bataille (F-SKILLS.2) : le héros soigne/ressuscite une pile alliée, 1×/combat. */
  | { type: 'HeroRally'; targetStackId: string }
  /** Placement d'une pile pendant la phase de placement tactique (C-TACTICS, doc 02 §5.1). */
  | { type: 'PlaceStack'; stackId: string; to: OffsetPos }
  /** Clôt la phase de placement et démarre la bataille (C-TACTICS). */
  | { type: 'FinishPlacement' }
  /** Fuite (C3) : quitter le combat en abandonnant l'armée ; le héros survit. */
  | { type: 'Retreat' }
  /** Reddition (C3) : payer de l'or (valeur d'armée) pour quitter en gardant l'armée. */
  | { type: 'Surrender' }
  /** Abandon pré-combat : renoncer avant l'engagement (round 1) en gardant l'armée survivante, sans coût. */
  | { type: 'AbandonCombat' }
  // ——— Sort d'aventure (doc 02 §1.4, Alpha 4.16) : lancé sur la carte, hors combat ———
  | { type: 'CastAdventureSpell'; heroId: string; spellId: string; playerId: string; townId?: string }
  | { type: 'ChooseSkill'; heroId: string; skillId: string }
  // ——— Choix d'attribut à la montée (doc 02 §1.2, H-LEVELCHOICE) : joueur humain ———
  | { type: 'ChooseAttribute'; heroId: string; attribute: 'attack' | 'defense' | 'power' | 'knowledge' }
  // ——— Trésor de carte (doc 02 §2.2) : choix or/XP après avoir foulé un coffre ———
  | { type: 'ResolveTreasure'; heroId: string; choice: 'gold' | 'xp' }
  // ——— Quêtes ajoutées en cours de partie (N-DAILYREFRESH, doc 13 §4.2) ———
  | {
      /**
       * Ajoute des quêtes en cours de partie (ex. rafraîchissement des contrats
       * journaliers au passage de jour). Défs **opaques** (le moteur ne connaît
       * ni texte ni dialogue) ; **idempotent** : une déf dont l'id existe déjà
       * est ignorée. Générique — aucune notion de faction/quête nommée.
       */
      type: 'AddQuests';
      quests: QuestDef[];
    }
  // ——— IA d'aventure (doc 11 §3.5) : joue le tour complet du joueur IA actif + fin de tour ———
  | { type: 'AiTurn'; playerId: string };

export interface CommandError {
  code:
    | 'gameAlreadyStarted'
    | 'gameNotStarted'
    | 'noPlayers'
    | 'duplicatePlayerId'
    | 'duplicateStartingHero'
    | 'notYourTurn'
    | 'invalidMap'
    | 'unknownHero'
    | 'notYourHero'
    | 'invalidPath'
    | 'noMovementPoints'
    | 'combatActive'
    | 'noCombat'
    | 'invalidArmy'
    | 'invalidAction'
    | 'unknownTown'
    | 'notYourTown'
    | 'alreadyBuiltToday'
    | 'unknownBuilding'
    | 'buildingMaxLevel'
    | 'requirementsNotMet'
    | 'exclusiveChoiceLocked'
    | 'houseAlreadyChosen'
    | 'wrongFactionBuilding'
    | 'uniquePerPlayer'
    | 'cannotAfford'
    | 'notRecruitable'
    | 'unknownGrowthGroup'
    | 'notUpgradable'
    | 'warMachineUnavailable'
    | 'insufficientStock'
    | 'invalidTransfer'
    | 'invalidReorder'
    | 'invalidSplit'
    | 'invalidEquip'
    | 'slotOccupied'
    | 'notAdjacent'
    | 'invalidCaravan'
    | 'invalidTrade'
    | 'unknownSpell'
    | 'spellNotKnown'
    | 'notEnoughMana'
    | 'heroAlreadyCast'
    | 'heroAttackUnavailable'
    | 'heroAttackUsed'
    | 'heroRallyUnavailable'
    | 'heroRallyUsed'
    | 'invalidTarget'
    | 'unknownSkill'
    | 'invalidAttribute'
    | 'noPendingChoice'
    | 'treasurePending'
    | 'invalidRounds'
    | 'notOnGrail'
    | 'alreadyHasGrail'
    | 'noMovement'
    | 'grailRequired'
    // Navigation (A3.2) : embarquement/débarquement.
    | 'alreadyNaval'
    | 'notNaval'
    | 'unknownBoat'
    | 'boatNotAdjacent'
    | 'tileOccupied'
    | 'gameOver';
  message: string;
}

export class EngineError extends Error {
  constructor(readonly detail: CommandError) {
    super(`${detail.code}: ${detail.message}`);
    this.name = 'EngineError';
  }
}
