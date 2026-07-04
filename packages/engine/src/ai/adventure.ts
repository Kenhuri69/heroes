import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';

/**
 * Joue le tour d'aventure d'un joueur IA (doc 11 §3.5, plan phase-3.5) :
 * déplace ses héros vers le meilleur objectif atteignable (ramassage / gardien
 * battable / capture), construit + recrute dans ses villes, puis termine son
 * tour. Déterministe (RNG de l'état). Ne joue QUE si le joueur est `'ai'`.
 *
 * STUB (cadrage) : implémentation dans le lot S (IA d'aventure). Signature
 * figée. Le driver (client + property test) boucle « tant que le joueur courant
 * est `ai` et la partie n'est pas finie, appeler runAiTurn ».
 */
export function runAiTurn(draft: GameState, playerId: string, _events: GameEvent[]): void {
  const player = draft.players.find((p) => p.id === playerId);
  if (!player || player.controller !== 'ai' || player.eliminated || draft.outcome) return;
  // Lot S : décisions IA (héros : A* vers objectif + ramassage/gardien/capture ;
  // ville : build + recruit), puis équivalent EndTurn pour ce joueur.
}
