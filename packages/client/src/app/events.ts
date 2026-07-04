import type { GameEvent } from '@heroes/engine';

/**
 * Bus moteur → présentation (doc 07 §3) : le rendu anime à partir des
 * événements, l'état « saute » à la fin. `GameLoaded` est un signal
 * applicatif (pas moteur) émis après un chargement de sauvegarde.
 */
export type AppEvent = GameEvent | { type: 'GameLoaded' };

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
