import type { Scenario } from '@heroes/content';

/** Statut d'un événement temporaire (doc 13 §4.3, N4d). */
export type EventStatus = 'active' | 'archived' | 'upcoming';

/**
 * Statut d'un scénario d'événement selon l'horloge **client** (présentation,
 * jamais le moteur — le déterminisme de la simulation n'est jamais daté). `null`
 * si le scénario n'a pas de fenêtre `availability` (disponible en permanence).
 * Comparaison au jour (ISO `YYYY-MM-DD`), bornes incluses.
 */
export function eventStatus(scenario: Scenario, now: number): EventStatus | null {
  const a = scenario.availability;
  if (!a) return null;
  const today = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  if (today < a.from) return 'upcoming';
  if (today > a.to) return 'archived';
  return 'active';
}
