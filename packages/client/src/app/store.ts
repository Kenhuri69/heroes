import { createStore } from 'zustand/vanilla';
import { useSyncExternalStore } from 'preact/compat';
import type { GameState } from '@heroes/engine';
import { createEmptyState } from '@heroes/engine';
import type { Scenario } from '@heroes/content';
import type { Modal, Screen } from './router';

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
}

export const appStore = createStore<AppState>(() => ({
  game: createEmptyState(),
  combatSpeed: 1,
  strengthBands: [],
  guardianHint: null,
  locale: 'fr',
  fontScale: 1,
  toasts: [],
  journal: [],
  journalUnread: 0,
  screen: 'menu',
  modals: [],
  scenarios: [],
}));

/** Hook Preact : re-rend quand la valeur sélectionnée change (égalité stricte). */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(appStore.subscribe, () => selector(appStore.getState()));
}
