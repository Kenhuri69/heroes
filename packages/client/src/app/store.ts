import { createStore } from 'zustand/vanilla';
import { useSyncExternalStore } from 'preact/compat';
import type { GameState } from '@heroes/engine';
import { createEmptyState } from '@heroes/engine';
import type { Scenario } from '@heroes/content';

/**
 * Store applicatif (doc 07 §3) : l'état moteur + un état d'UI léger.
 * `zustand/vanilla` + `useSyncExternalStore` : pas de dépendance React,
 * Pixi lit le store hors React via `appStore.getState()`/`subscribe`.
 */
export interface AppState {
  game: GameState;
  selectedHeroId: string | null;
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
  /** File de toasts d'événements (doc 08 §3) — journal consultable : MVP. */
  toasts: { id: number; message: string }[];
  /** L'écran de menu est affiché (aucune partie en cours à l'écran). */
  screen: 'menu' | 'game';
  /** Écran de ville ouvert sur cet id (doc 02 §4.2) — null = fermé. */
  townScreenOpen: string | null;
  /** Scénarios chargés (doc 02 §6, plan phase-3.5) — liste affichée au menu. */
  scenarios: Scenario[];
}

export const appStore = createStore<AppState>(() => ({
  game: createEmptyState(),
  selectedHeroId: null,
  combatSpeed: 1,
  strengthBands: [],
  guardianHint: null,
  locale: 'fr',
  fontScale: 1,
  toasts: [],
  screen: 'menu',
  townScreenOpen: null,
  scenarios: [],
}));

/** Hook Preact : re-rend quand la valeur sélectionnée change (égalité stricte). */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(appStore.subscribe, () => selector(appStore.getState()));
}
