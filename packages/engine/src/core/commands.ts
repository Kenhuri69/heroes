import type { AdventureConfig } from '../adventure/config';
import type { AdventureMapDef, GridPos } from '../adventure/map';
import type { ArmyStack, CombatActionInput, CombatUnitDef } from '../combat/types';
import type { BuildingDef, TownState } from '../town/types';
import type { ArtifactDef, HeroSkillDef, SpellDef } from '../hero/types';
import type { FactionBonus } from '../faction/types';
import type { ScenarioState } from '../scenario/types';
import type { QuestState } from '../quest/types';
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
  /** Contrôleur (doc 02 §6, plan phase-3.5) — `'ai'` pour un adversaire ; défaut `'human'`. */
  controller?: 'human' | 'ai';
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
    }
  // ——— Villes (doc 02 §4) — surface figée en cadrage 3.1 ———
  | { type: 'BuildStructure'; townId: string; buildingId: string }
  | { type: 'RecruitUnits'; townId: string; unitId: string; count: number }
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
  | { type: 'CaptureTown'; townId: string; playerId: string }
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
  | { type: 'CastSpell'; spellId: string; targetStackId: string }
  // ——— Sort d'aventure (doc 02 §1.4, Alpha 4.16) : lancé sur la carte, hors combat ———
  | { type: 'CastAdventureSpell'; heroId: string; spellId: string; playerId: string; townId?: string }
  | { type: 'ChooseSkill'; heroId: string; skillId: string }
  // ——— Trésor de carte (doc 02 §2.2) : choix or/XP après avoir foulé un coffre ———
  | { type: 'ResolveTreasure'; heroId: string; choice: 'gold' | 'xp' }
  // ——— IA d'aventure (doc 11 §3.5) : joue le tour complet du joueur IA actif + fin de tour ———
  | { type: 'AiTurn'; playerId: string };

export interface CommandError {
  code:
    | 'gameAlreadyStarted'
    | 'gameNotStarted'
    | 'noPlayers'
    | 'duplicatePlayerId'
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
    | 'cannotAfford'
    | 'notRecruitable'
    | 'notUpgradable'
    | 'warMachineUnavailable'
    | 'insufficientStock'
    | 'invalidTransfer'
    | 'invalidTrade'
    | 'unknownSpell'
    | 'spellNotKnown'
    | 'notEnoughMana'
    | 'heroAlreadyCast'
    | 'invalidTarget'
    | 'unknownSkill'
    | 'noPendingChoice'
    | 'treasurePending'
    | 'gameOver';
  message: string;
}

export class EngineError extends Error {
  constructor(readonly detail: CommandError) {
    super(`${detail.code}: ${detail.message}`);
    this.name = 'EngineError';
  }
}
