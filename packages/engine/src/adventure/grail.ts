import type { GameEvent } from '../core/events';
import type { GameState, HeroState, PlayerState } from '../core/state';
import { grailRevealedTo, samePos } from './map';

/**
 * Fouille du Graal (T-GRAIL lot 2, doc 02 §2.2) — **cœur partagé** entre la
 * commande `Dig` (joueur) et l'IA d'aventure, sur le patron de
 * `advanceHeroAlongPath` : une seule écriture de la règle, deux appelants.
 * Le module `ai/` ne peut pas importer `core/engine` (cycle : le moteur y
 * appelle `runAiTurn`), d'où ce helper dans `adventure/`.
 */

/** Le héros peut-il fouiller ici ? (tuile du Graal révélée, pas déjà trouvé, PM restants) */
export function canDigGrail(state: GameState, hero: HeroState, player: PlayerState): boolean {
  const map = state.map;
  if (!map?.grailPos || player.hasGrail) return false;
  if (!samePos(hero.pos, map.grailPos)) return false;
  if (hero.movementPoints <= 0) return false;
  return grailRevealedTo(map, player.obelisksVisited);
}

/** Applique la fouille : le joueur obtient le Graal, la journée du héros y passe. */
export function digGrail(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  events: GameEvent[],
): void {
  player.hasGrail = true;
  hero.movementPoints = 0; // la fouille consomme la journée (fidélité HoMM)
  events.push({ type: 'GrailFound', playerId: player.id, heroId: hero.id, pos: { ...hero.pos } });
}
