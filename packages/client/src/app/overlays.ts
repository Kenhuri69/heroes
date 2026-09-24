import type { AppState } from './store';

/**
 * Un overlay FORCÉ (hors pile de modales) masque-t-il la carte d'aventure ?
 * (revue 2026-09b E1). Les raccourcis clavier de la carte (E/T/H/N) doivent
 * alors se taire : sans cette garde, `E` pressé sur l'écran « passez l'appareil »
 * du hot-seat terminait le tour du joueur SUIVANT, et `E` sous un dialogue ou le
 * bilan de combat terminait le tour à l'aveugle. Pur (lit l'état seulement).
 */
export function forcedOverlayOpen(s: AppState): boolean {
  const game = s.game;
  if (game.combat || game.outcome) return true;
  if (s.modals.length > 0 || s.pendingEndTurn) return true;
  // Tour d'un adversaire (IA) en cours, relais IA ou partie bloquée.
  const active = game.players[game.currentPlayer];
  if (!active || active.controller !== 'human' || s.aiTurn || s.aiFailure) return true;
  // Passage d'appareil hot-seat (même condition que `HandoffOverlay`), et
  // attente du tour adverse en PvP asynchrone (`OnlineWaitOverlay`).
  if (s.onlineMatch) {
    if (active.id !== s.onlineMatch.myPlayerId) return true;
  } else if (game.players.filter((p) => p.controller === 'human').length >= 2 && active.id !== s.turnAck) {
    return true;
  }
  // Choix forcés du joueur actif (compétence/attribut, trésor, trigger).
  if (game.pendingTreasure?.playerId === active.id || game.pendingTriggerChoice?.playerId === active.id) return true;
  if (
    game.heroes.some(
      (h) => h.playerId === active.id && (h.pendingSkillChoices.length > 0 || h.pendingAttributeChoices.length > 0),
    )
  )
    return true;
  // Narration, bilan, invitation coop, fiches, chargement, pré-combat.
  return (
    s.cutsceneActive ||
    s.dialogue !== null ||
    s.combatResult !== null ||
    s.pendingCoopInvite !== null ||
    s.mapCard !== null ||
    s.resourceDetail !== null ||
    s.loading !== null ||
    s.preBattlePending
  );
}
