import { createStore } from 'zustand/vanilla';
import { useSyncExternalStore } from 'preact/compat';
import type { GameState, MapObjectDef } from '@heroes/engine';
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
  /** Langue de l'UI (doc 08 §2.5) — persistée en localStorage par app/i18n. */
  locale: 'fr' | 'en';
  /** Taille de police, 3 crans (doc 08 §4) : 1 = normal. */
  fontScale: 1 | 2 | 3;
  /** File de toasts éphémères (doc 08 §3) — disparaissent ~4 s. */
  toasts: { id: number; message: string }[];
  /** Journal consultable des notifications de jeu (doc 08 §3), le plus récent en dernier. */
  journal: JournalEntry[];
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
  /** Volume musique 0-1 (UXD-6B) — miroir du localStorage, réglé aux Options. */
  musicVolume: number;
  /** Volume effets 0-1 (UXD-6B) — miroir du localStorage. */
  sfxVolume: number;
}

export const appStore = createStore<AppState>(() => ({
  game: createEmptyState(),
  combatSpeed: 1,
  strengthBands: [],
  guardianHint: null,
  pathPreviewActive: false,
  mapCard: null,
  locale: 'fr',
  fontScale: 1,
  toasts: [],
  journal: [],
  journalUnread: 0,
  screen: 'menu',
  modals: [],
  scenarios: [],
  factions: [],
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
  musicVolume: 0.35,
  sfxVolume: 0.6,
}));

/** Hook Preact : re-rend quand la valeur sélectionnée change (égalité stricte). */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(appStore.subscribe, () => selector(appStore.getState()));
}
