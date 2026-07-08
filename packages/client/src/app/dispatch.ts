import { apply, validate, EngineError, type Command, type EngineResult } from '@heroes/engine';
import { appStore } from './store';
import { eventBus } from './events';

/**
 * Point d'entrée unique UI/input → moteur (doc 07 §3). Synchrone en Phase 2
 * mais d'interface asynchrone : le passage en Web Worker sera un changement
 * d'implémentation, pas d'API.
 *
 * Un rejet de `validate` lève une `EngineError` (comme `apply`) — l'UI récupère
 * ainsi le `code` structuré (`err.detail.code`) pour un message localisé
 * (remédiation R2b CL6), au lieu d'une `Error` opaque « code: message ».
 */
export async function dispatch(cmd: Command): Promise<EngineResult> {
  const err = validate(appStore.getState().game, cmd);
  if (err) throw new EngineError(err);
  const before = appStore.getState().game.combat;
  const result = apply(appStore.getState().game, cmd);
  appStore.setState({ game: result.state });
  // Écran pré-combat (Lot 1) : armé quand un combat DÉMARRE (null → non-null),
  // désarmé quand il se termine. La conduite manuelle / l'Auto-Battle le
  // désarment aussi côté UI (PreBattleScreen).
  if (!before && result.state.combat) appStore.setState({ preBattlePending: true, combatAutoActive: false });
  else if (before && !result.state.combat) appStore.setState({ preBattlePending: false, combatAutoActive: false });
  eventBus.emit(result.events);
  runAiLoop();
  return Promise.resolve(result);
}

/**
 * Garde-fou anti-boucle infinie (plan phase-3.5 §5) : un tour = un `AiTurn`
 * par joueur IA actif, largement suffisant même pour un enchaînement de
 * plusieurs joueurs IA d'affilée.
 */
const MAX_AI_TURNS_PER_DISPATCH = 200;

/**
 * Boucle de pilotage des tours IA (doc 02 §6, plan phase-3.5 lot U) : après
 * tout dispatch réussi (`EndTurn`, fin de combat, capture, `StartGame`…),
 * tant que c'est au tour d'un joueur `'ai'`, la partie n'est pas finie et
 * aucun combat n'est en cours, joue son tour (`AiTurn` fait le tour complet +
 * `EndTurn`, doc 11 §3.5) et ré-évalue — jusqu'à retomber sur un joueur
 * humain ou une fin de partie.
 *
 * Placé ici plutôt qu'en abonnement `appStore.subscribe` (option laissée
 * ouverte par le plan) : `dispatch` est déjà le point d'entrée UNIQUE
 * commande → moteur (doc 07 §3), donc le seul endroit où « l'état vient de
 * changer » sans ambiguïté. Un abonnement au store se redéclencherait à
 * chaque `setState` — y compris ceux de cette boucle elle-même — et
 * demanderait une garde de réentrance équivalente pour un gain nul.
 */
function runAiLoop(): void {
  let iterations = 0;
  for (;;) {
    const game = appStore.getState().game;
    if (game.outcome || game.combat) return;
    const current = game.players[game.currentPlayer];
    if (!current || current.controller !== 'ai') return;
    if (++iterations > MAX_AI_TURNS_PER_DISPATCH) {
      throw new Error('runAiLoop : trop de tours IA d’affilée, boucle infinie suspectée');
    }
    const result = apply(game, { type: 'AiTurn', playerId: current.id });
    appStore.setState({ game: result.state });
    eventBus.emit(result.events);
  }
}
