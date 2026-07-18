import type { GameEvent } from '@heroes/engine';

/**
 * Bus moteur → présentation (doc 07 §3) : le rendu anime à partir des
 * événements, l'état « saute » à la fin. `GameLoaded`/`SaveFailed` sont des
 * signaux applicatifs (pas moteur) : chargement de sauvegarde réussi, échec
 * de stockage d'une sauvegarde (doc 07 §4).
 */
export type AppEvent = GameEvent | { type: 'GameLoaded' } | { type: 'SaveFailed' };

/** Contexte d'un lot d'événements (E9) : `humanCombat` = un combat du JOUEUR vient
 *  de se terminer dans ce dispatch (≠ combat de l'IA résolu dans `AiTurn`). */
export interface EmitMeta {
  readonly humanCombat?: boolean;
}

type Listener = (event: AppEvent) => void;
type BatchListener = (events: readonly AppEvent[], meta: EmitMeta) => void;

const listeners = new Set<Listener>();
const batchListeners = new Set<BatchListener>();

export const eventBus = {
  /** Abonnement PAR ÉVÉNEMENT (animations, rendu) — inchangé. */
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Abonnement PAR LOT (E9) : reçoit le lot entier + son `meta` — pour agréger
   *  (revenus du jour) ou filtrer selon le contexte (combats IA). */
  onBatch(listener: BatchListener): () => void {
    batchListeners.add(listener);
    return () => batchListeners.delete(listener);
  },
  emit(events: readonly AppEvent[], meta: EmitMeta = {}): void {
    for (const event of events) for (const l of listeners) l(event);
    for (const l of batchListeners) l(events, meta);
  },
};
