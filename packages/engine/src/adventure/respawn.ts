import type { GameState } from '../core/state';
import { samePos, type GuardianObjectDef } from './map';

/**
 * Respawn de gardiens (doc 18 A2b, fidélité MMHO) — OPT-IN par données :
 * seul un gardien doté de `respawnDays` est mis en file au retrait, et la
 * file `map.respawns` n'est créée qu'à ce moment-là ⇒ sans la mécanique,
 * la forme d'état reste bit-identique (golden intact, pas de bump save).
 */

/**
 * Met en file la réapparition d'un gardien au moment de son RETRAIT de la
 * carte. `count` = effectif à restaurer (pré-combat — au chemin « remnants »,
 * `object.count` a déjà été écrasé à 0, l'appelant passe la valeur capturée).
 * No-op sans `respawnDays`.
 */
export function queueGuardianRespawn(
  draft: GameState,
  guardian: GuardianObjectDef,
  count: number,
): void {
  if (!draft.map || guardian.respawnDays === undefined || count <= 0) return;
  (draft.map.respawns ??= []).push({
    day: draft.calendar.day + guardian.respawnDays,
    object: { ...guardian, pos: { ...guardian.pos }, count },
  });
}

/**
 * Fait réapparaître les gardiens dus — appelé au changement de jour. Une tuile
 * occupée (héros, ville, autre objet — un errant a pu dériver dessus) reporte
 * l'entrée au jour suivant. Déterministe : ordre FIFO de la file, aucun RNG.
 */
export function respawnDueGuardians(draft: GameState): void {
  const map = draft.map;
  if (!map?.respawns?.length) return;
  const still: typeof map.respawns = [];
  for (const entry of map.respawns) {
    const free =
      entry.day <= draft.calendar.day &&
      !draft.heroes.some((h) => samePos(h.pos, entry.object.pos)) &&
      !draft.towns.some((t) => samePos(t.pos, entry.object.pos)) &&
      !map.objects.some((o) => samePos(o.pos, entry.object.pos));
    if (free) map.objects.push(entry.object);
    else still.push(entry);
  }
  map.respawns = still;
}
