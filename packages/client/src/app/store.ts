import { createStore } from 'zustand/vanilla';
import { useSyncExternalStore } from 'preact/compat';
import type { GameState, GridPos, MapObjectDef, ResourceId } from '@heroes/engine';
import { createEmptyState } from '@heroes/engine';
import type { Campaign, DialogNode, Scenario, StoryCharacter } from '@heroes/content';
import type { Modal, Screen } from './router';

/** Catalogue narratif du scénario en cours (doc 13, N2b) — dialogues/personnages/quêtes. */
export interface NarrativeCatalog {
  dialogs: Record<string, DialogNode>;
  characters: Record<string, StoryCharacter>;
  quests: Record<
    string,
    { titleKey: string; descriptionKey?: string; kind: string; steps: { id: string; dialogBefore?: string }[] }
  >;
  /** Pool de barks de combat (doc 13 §6.3, N4b) — vide si le scénario n'en a pas. */
  combatBarks: string[];
}

/** Entrée du journal de quêtes (doc 13 §6.3, N2b). */
export interface QuestJournalEntry {
  id: string;
  titleKey: string;
  descriptionKey?: string;
  /** Nature de la quête (doc 13 §6.3) — `personal` reçoit un badge dédié. */
  kind: string;
  stepIndex: number;
  stepCount: number;
  status: 'active' | 'completed';
}

/** Une entrée du journal d'événements (doc 08 §3), datée du jour de jeu. */
export interface JournalEntry {
  id: number;
  day: number;
  message: string;
}

/** Une ligne du journal de combat (UX-COMBATLOG, doc 08 §2.4). */
export interface CombatLogLine {
  id: number;
  text: string;
}

/** Effectif d'une unité au bilan de fin de combat (retour de jeu 2026-07). */
export interface CombatResultUnit {
  unitId: string;
  /** Survivants (0 si l'unité a été anéantie). */
  survived: number;
  /** Pertes. */
  lost: number;
}

/**
 * Bilan de fin de combat (retour de jeu 2026-07) : morts/survivants par armée +
 * gains XP et ressources. Construit à partir des événements du dispatch qui
 * termine le combat (`CombatEnded` + `XpGained`/`GuardianVanquished`/…), affiché
 * par `CombatResultScreen`. Purement présentation client (non persisté).
 */
export interface CombatResult {
  /** Le joueur a-t-il gagné ? */
  victory: boolean;
  /** Détail de l'armée du joueur (camp `playerSide`). */
  player: CombatResultUnit[];
  /** Détail de l'armée ennemie. */
  enemy: CombatResultUnit[];
  /** XP gagnée par le héros (0 en défaite). */
  xp: number;
  /** Nombre de niveaux gagnés. */
  levelUps: number;
  /** Or gagné (butin de gardien). */
  gold: number;
  /** Ressources gagnées (butin de gardien + ressource de faction). */
  resources: { resource: string; amount: number }[];
  /** Artefact trouvé (butin de gardien), ou null. */
  artifactId: string | null;
  /** Mort-vivants relevés (Nécromancie), ou null. */
  undead: { unitId: string; count: number } | null;
}

/**
 * Type d'un toast (doc 08 §3, lot UXD-6b) : porte l'accent visuel (filet
 * coloré) et le SFX (`success → ui-confirm`, `error → ui-error`, `info` muet).
 * L'information reste portée par le texte du toast (A5 : jamais la couleur/le
 * son seuls).
 */
export type ToastKind = 'info' | 'success' | 'error';

/**
 * Store applicatif (doc 07 §3) : l'état moteur + un état d'UI léger.
 * `zustand/vanilla` + `useSyncExternalStore` : pas de dépendance React,
 * Pixi lit le store hors React via `appStore.getState()`/`subscribe`.
 */
export interface AppState {
  game: GameState;
  /** Vitesse d'animation du combat ×1/×2/×4 (doc 08 §2.4). */
  combatSpeed: 1 | 2 | 4;
  /** Fourchettes d'affichage de force des gardiens (doc 02 §2.2) — config display. */
  strengthBands: { max: number | null; key: string }[];
  /** Gardien visé par la prévisualisation de chemin (fourchette affichée par l'UI). */
  guardianHint: { count: number } | null;
  /** Préviz de chemin affichée (lot M2) — le HUD montre « Annuler le déplacement ». */
  pathPreviewActive: boolean;
  /** Objet de carte inspecté à l'appui long (doc 08 §2.1, lot M2) — fiche DOM. */
  mapCard: MapObjectDef | null;
  /** Ressource inspectée au tap (doc 08 §2.1, lot M6 C8) — fiche stock + revenu/jour. */
  resourceDetail: ResourceId | null;
  /** Langue de l'UI (doc 08 §2.5) — persistée en localStorage par app/i18n. */
  locale: 'fr' | 'en';
  /** Taille de police, 3 crans (doc 08 §4) : 1 = normal. */
  fontScale: 1 | 2 | 3;
  /** File de toasts éphémères (doc 08 §3) — disparaissent ~4 s. */
  toasts: { id: number; message: string; kind: ToastKind }[];
  /** Journal consultable des notifications de jeu (doc 08 §3), le plus récent en dernier. */
  journal: JournalEntry[];
  /** Journal du combat courant (UX-COMBATLOG, doc 08 §2.4) — remis à zéro à chaque `CombatStarted`. */
  combatLog: CombatLogLine[];
  /** Nombre d'entrées de journal non lues (badge cloche) — remis à 0 à l'ouverture. */
  journalUnread: number;
  /**
   * Route de base (doc 08 §3, lot UX U2) — `menu` ou `adventure` ; le combat
   * est dérivé de `game.combat`, pas une route. Piloté par `app/router.ts`.
   */
  screen: Screen;
  /** Pile de modales typée (doc 08 §3, plafond `MAX_MODAL_DEPTH`). */
  modals: Modal[];
  /** Scénarios chargés (doc 02 §6, plan phase-3.5) — liste affichée au menu. */
  scenarios: Scenario[];
  /** Ids des factions chargées (doc 09) — proposées dans l'écran d'escarmouche. */
  factions: string[];
  /**
   * Héros nommés jouables du roster (H-NAMED.2) — id + faction + réf de nom `@loc:`.
   * Peuplé au chargement ; consommé par les écrans de configuration (choix du héros
   * de départ par siège humain). Vide si aucun héros de roster.
   */
  rosterHeroes: { id: string; factionId: string; name: string }[];
  /** Télémétrie locale opt-in activée (doc 09, Alpha 4.19) — miroir du localStorage. */
  telemetryEnabled: boolean;
  /** Compteur de rafraîchissement des stats de télémétrie (re-render Options après reset). */
  telemetryTick: number;
  /** Héros humain sélectionné (doc 08 §2.1, lot UX U4) — null = 1er héros par défaut. */
  selectedHeroId: string | null;
  /**
   * Hot-seat (Alpha 4.15) : id du joueur actif ayant déjà accusé réception de son
   * tour (« passez l'appareil » validé). L'overlay de passage s'affiche tant que
   * le joueur courant diffère. `null` = personne n'a encore validé (nouveau tour).
   */
  turnAck: string | null;
  /** Catalogue narratif du scénario en cours (doc 13, N2b) — null hors campagne. */
  narrative: NarrativeCatalog | null;
  /** Dialogue affiché (doc 13 §6.3) : nœud courant + ligne visible ; null = aucun. */
  dialogue: { node: DialogNode; line: number } | null;
  /** File d'attente de dialogues (ouverture, `dialogBefore`) jouée à la suite. */
  dialogueQueue: string[];
  /** Journal de quêtes de campagne (doc 13 §6.3) — vide hors campagne. */
  questJournal: QuestJournalEntry[];
  /** Campagnes chargées (doc 13 §4.1, N3a) — proposées à l'écran de sélection. */
  campaigns: Campaign[];
  /** Chapitres complétés par campagne (miroir du localStorage) — pour l'UI. */
  campaignProgress: Record<string, number>;
  /** Chapitre de campagne en cours (pour l'avancement à la victoire) — null hors campagne. */
  activeChapter: { campaignId: string; chapterIndex: number } | null;
  /** Cinématique caméra en cours (doc 13 §6.3, N3c.1) — letterbox + bouton Passer. */
  cutsceneActive: boolean;
  /**
   * Drapeaux de campagne (doc 13 §6.3, N3c.2) — posés par les choix de dialogue,
   * persistés en localStorage et **relus entre campagnes** (méta-jeu global).
   */
  campaignFlags: Record<string, boolean>;
  /** Bark de combat affiché (doc 13 §6.3, N4b) — clé de locale ; null hors combat. */
  combatBark: string | null;
  /**
   * Écran pré-combat (Lot 1, fidélité HoMM Online) : `true` dès qu'un combat
   * démarre, jusqu'à ce que le joueur choisisse « Combattre » (→ conduite
   * manuelle) ou « Auto-Battle » (→ `AutoCombat`). Armé/désarmé par `dispatch`
   * aux transitions de `game.combat`.
   */
  preBattlePending: boolean;
  /**
   * Auto-combat round par round actif (lot M4, doc 08 §2.4) : une boucle
   * d'effet de `CombatUi` dispatch `AutoCombat{rounds:1}` tant que le flag est
   * levé ; « Reprendre la main » le coupe. Réinitialisé aux transitions de
   * combat par `dispatch` (comme `preBattlePending`).
   */
  combatAutoActive: boolean;
  /** Volume musique 0-1 (UXD-6B) — miroir du localStorage, réglé aux Options. */
  musicVolume: number;
  /** Volume effets 0-1 (UXD-6B) — miroir du localStorage. */
  sfxVolume: number;
  /** Mute rapide (I8) — override coupant musique + SFX, miroir du localStorage. */
  audioMuted: boolean;
  /** Retour haptique mobile (I15) — opt-in (défaut OFF), miroir du localStorage. */
  hapticsEnabled: boolean;
  /** Option « réduire les animations » (lot M8 C3) — union avec le réglage OS. */
  reduceMotionOption: boolean;
  /** Confirmer la fin de tour si un héros n'a pas bougé (lot M8 C12) — défaut on. */
  confirmEndTurn: boolean;
  /** Confirmation de fin de tour en attente (lot M8 C12) — overlay tap-tap ; null = aucune. */
  pendingEndTurn: { playerId: string } | null;
  /**
   * Invite coop en attente (E4.5, doc 18 E4) : un déplacement va engager un
   * gardien et un héros allié est adjacent ⇒ overlay Oui (rejoint)/Non (solo).
   * `path` est le chemin à dispatcher ; null = aucune invite en cours.
   */
  pendingCoopInvite: { heroId: string; allyHeroId: string; allyName: string; path: GridPos[] } | null;
  /**
   * Chargement en cours (« Nouvelle partie » : génération de carte). `label` =
   * clé i18n de l'étape ; `progress` ∈ [0,1]. `null` = aucun chargement. Rendu
   * par `LoadingOverlay` (overlay bloquant à barre de progression).
   */
  loading: { label: string; progress: number } | null;
  /**
   * Couleurs de joueur choisies à « Nouvelle partie » (id de joueur → couleur
   * 0xRRGGBB). Purement présentation client (le moteur n'a pas de couleur) :
   * `playerColor` la consulte en priorité, sinon la palette d'index. `{}` = repli
   * palette (remis à zéro au retour menu ; les autres modes ne la posent pas).
   */
  playerColors: Record<string, number>;
  /**
   * Progression des tours IA (UX multi-joueurs) : posée par `runAiLoop` pendant
   * qu'un ou plusieurs joueurs IA jouent, `null` sinon. `seat` = n° (1-based) du
   * joueur IA en train d'agir ; `done`/`total` = tours IA joués / à jouer sur ce
   * relais. Purement présentation (non persistée) : alimente l'indicateur de tour
   * et évite l'impression de gel pendant que l'IA calcule.
   */
  aiTurn: { seat: number; done: number; total: number } | null;
  /**
   * Partie PvP asynchrone en cours (NET-PVPUI slice B) — `null` en partie locale.
   * `id` = match serveur ; `nextSeq` = prochain n° de lot à poster ; `myPlayerId`
   * = id moteur de MON siège (pour savoir quand c'est mon tour). Présentation/
   * pilotage client (non persisté dans le snapshot moteur).
   */
  onlineMatch: { id: string; nextSeq: number; myPlayerId: string | null; status: string } | null;
  /**
   * F-SCHOOLS.8 (Pas de Brume) : ciblage d'hex de combat en attente. Posé par le
   * grimoire quand le joueur a choisi un sort de téléportation et sa pile alliée ;
   * `CombatScene` surligne alors les destinations et le tap dispatche
   * `CastSpell{…, targetHex}`. `null` = aucun ciblage en cours. Purement
   * présentation client (non persisté) ; remis à zéro aux transitions de combat.
   */
  combatSpellTarget: { spellId: string; targetStackId: string } | null;
  /**
   * C-SPELLUI.3 : sort + cible dont la ZONE d'effet est prévisualisée sur la
   * grille pendant le choix de cible dans le grimoire. `CombatScene` surligne
   * les hexes touchés (cible + splash/all/chaîne, via `spellAffectedStacks`).
   * `null` = aucun ciblage en cours. Purement présentation client (non
   * persisté) ; remis à zéro aux transitions de combat et au démontage du livre.
   */
  combatSpellZone: { spellId: string; targetStackId: string } | null;
  /**
   * Pile de combat inspectée (amélioration UX champ de bataille) — id de pile
   * dont la fiche de stats est ouverte. Posé par un appui long / clic maintenu
   * sur le plateau (`CombatScene`) ou un tap sur une vignette du bandeau
   * (`StackChip`) ; rendu par `StackSheet`. `null` = aucune fiche. Purement
   * présentation client (non persisté) ; remis à zéro aux transitions de combat.
   */
  combatInspectId: string | null;
  /**
   * Bilan de fin de combat (retour de jeu 2026-07) : posé par `dispatch` quand un
   * combat FOUILLÉ se termine (annihilation), affiché par `CombatResultScreen`
   * par-dessus la carte jusqu'à ce que le joueur le ferme. `null` = aucun bilan.
   * Non posé pour un abandon/fuite/reddition (départ délibéré). Non persisté.
   */
  combatResult: CombatResult | null;
}

export const appStore = createStore<AppState>(() => ({
  game: createEmptyState(),
  combatSpeed: 1,
  strengthBands: [],
  guardianHint: null,
  pathPreviewActive: false,
  mapCard: null,
  resourceDetail: null,
  locale: 'fr',
  fontScale: 1,
  toasts: [],
  journal: [],
  combatLog: [],
  journalUnread: 0,
  screen: 'menu',
  modals: [],
  scenarios: [],
  factions: [],
  rosterHeroes: [],
  telemetryEnabled: false,
  telemetryTick: 0,
  selectedHeroId: null,
  turnAck: null,
  narrative: null,
  dialogue: null,
  dialogueQueue: [],
  questJournal: [],
  campaigns: [],
  campaignProgress: {},
  activeChapter: null,
  cutsceneActive: false,
  campaignFlags: {},
  combatBark: null,
  preBattlePending: false,
  combatAutoActive: false,
  musicVolume: 0.35,
  sfxVolume: 0.6,
  audioMuted: false,
  hapticsEnabled: false,
  reduceMotionOption: false,
  confirmEndTurn: true,
  pendingEndTurn: null,
  pendingCoopInvite: null,
  loading: null,
  playerColors: {},
  aiTurn: null,
  onlineMatch: null,
  combatSpellTarget: null,
  combatSpellZone: null,
  combatInspectId: null,
  combatResult: null,
}));

/** Hook Preact : re-rend quand la valeur sélectionnée change (égalité stricte). */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(appStore.subscribe, () => selector(appStore.getState()));
}
