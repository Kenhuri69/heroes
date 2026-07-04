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
}

export const appStore = createStore<AppState>(() => ({
  game: createEmptyState(),
  selectedHeroId: null,
}));

/** Hook Preact : re-rend quand la valeur sélectionnée change (égalité stricte). */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(appStore.subscribe, () => selector(appStore.getState()));
}
