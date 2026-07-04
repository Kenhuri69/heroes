import { createStore } from 'zustand/vanilla';
import { useSyncExternalStore } from 'preact/compat';
import type { GameState } from '@heroes/engine';
import { createEmptyState } from '@heroes/engine';

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
}

export const appStore = createStore<AppState>(() => ({
  game: createEmptyState(),
  selectedHeroId: null,
  combatSpeed: 1,
  strengthBands: [],
  guardianHint: null,
}));

/** Hook Preact : re-rend quand la valeur sélectionnée change (égalité stricte). */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(appStore.subscribe, () => selector(appStore.getState()));
}
