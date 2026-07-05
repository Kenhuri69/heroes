import type { GameEvent } from '@heroes/engine';

/**
 * Bus moteur → présentation (doc 07 §3) : le rendu anime à partir des
 * événements, l'état « saute » à la fin. `GameLoaded`/`SaveFailed` sont des
 * signaux applicatifs (pas moteur) : chargement de sauvegarde réussi, échec
 * de stockage d'une sauvegarde (doc 07 §4).
 */
export type AppEvent = GameEvent | { type: 'GameLoaded' } | { type: 'SaveFailed' };

type Listener = (event: AppEvent) => void;

const listeners = new Set<Listener>();

export const eventBus = {
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit(events: readonly AppEvent[]): void {
    for (const event of events) for (const l of listeners) l(event);
  },
};
