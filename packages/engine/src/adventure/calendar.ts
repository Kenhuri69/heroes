/**
 * Calendrier — événements hebdomadaires (M-CALENDAR, doc 02 §2.3). Tirage
 * pondéré déterministe (RNG seedé) à chaque bascule de semaine ; le
 * `growthFactor` de l'événement tiré module la croissance hebdomadaire
 * (`town/economy.ts`). Purement data-driven : les événements vivent dans
 * `config.calendar.events`, le moteur ne connaît que des ids opaques.
 */
import type { CalendarEventDef } from './config';
import type { GameState } from '../core/state';
import { rollRange } from '../core/rng';

/**
 * Tire l'événement de la semaine courante (pondéré par `weight`), le stocke dans
 * `calendar.weekEventId` et le renvoie. Consomme le RNG seedé. Renvoie `null`
 * (et laisse `weekEventId` à `null`) si aucun événement n'est configuré.
 */
export function rollWeekEvent(draft: GameState): CalendarEventDef | null {
  const events = draft.config?.calendar?.events ?? [];
  const total = events.reduce((sum, e) => sum + e.weight, 0);
  if (events.length === 0 || total <= 0) {
    draft.calendar.weekEventId = null;
    return null;
  }
  const roll = rollRange(draft.rng, 0, total - 1);
  draft.rng = roll.state;
  let acc = 0;
  for (const e of events) {
    acc += e.weight;
    if (roll.value < acc) {
      draft.calendar.weekEventId = e.id;
      return e;
    }
  }
  // Filet (arrondi/poids) : le dernier événement.
  const last = events[events.length - 1] as CalendarEventDef;
  draft.calendar.weekEventId = last.id;
  return last;
}

/**
 * Facteur multiplicatif de croissance hebdomadaire de la semaine courante
 * (1 si aucun événement / événement inconnu).
 */
export function weekGrowthFactor(state: GameState): number {
  const id = state.calendar.weekEventId;
  if (id === null) return 1;
  return state.config?.calendar?.events.find((e) => e.id === id)?.growthFactor ?? 1;
}
