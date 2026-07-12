import { apply, validate, EngineError, type Command, type EngineResult, type GameState } from '@heroes/engine';
import { appStore } from './store';
import { eventBus } from './events';
import { reduceMotion } from './motion';

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
  if (!before && result.state.combat) appStore.setState({ preBattlePending: true, combatAutoActive: false, combatSpellTarget: null });
  else if (before && !result.state.combat) appStore.setState({ preBattlePending: false, combatAutoActive: false, combatSpellTarget: null });
  eventBus.emit(result.events);
  await runAiLoop();
  return result;
}

/**
 * Garde-fou anti-boucle infinie (plan phase-3.5 §5) : un tour = un `AiTurn`
 * par joueur IA actif, largement suffisant même pour un enchaînement de
 * plusieurs joueurs IA d'affilée.
 */
const MAX_AI_TURNS_PER_DISPATCH = 200;

/** Délai perceptible entre deux tours IA (ms) — coupé si les animations sont réduites. */
const AI_TURN_PACING_MS = 350;

/** Garde de ré-entrance : une seule boucle IA à la fois (les gardes d'entrée UI empêchent déjà tout dispatch humain concurrent, ceci est une sécurité). */
let aiLoopRunning = false;

/** Cède la main au navigateur le temps d'un repaint (anti-gel), puis attend `ms`. */
function yieldToPaint(ms: number): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => (ms > 0 ? setTimeout(resolve, ms) : resolve()));
  });
}

/** Nombre de tours IA consécutifs à venir depuis le joueur courant (même ordre que le moteur : index croissant, cyclique) jusqu'au prochain joueur humain. */
function countPendingAiTurns(game: GameState): number {
  const n = game.players.length;
  let count = 0;
  for (let k = 0; k < n; k++) {
    const p = game.players[(game.currentPlayer + k) % n];
    if (p?.controller !== 'ai') break;
    count++;
  }
  return count;
}

/**
 * Boucle de pilotage des tours IA (doc 02 §6, plan phase-3.5 lot U) : après
 * tout dispatch réussi (`EndTurn`, fin de combat, capture, `StartGame`…),
 * tant que c'est au tour d'un joueur `'ai'`, la partie n'est pas finie et
 * aucun combat n'est en cours, joue son tour (`AiTurn` fait le tour complet +
 * `EndTurn`, doc 11 §3.5) et ré-évalue — jusqu'à retomber sur un joueur
 * humain ou une fin de partie.
 *
 * **Asynchrone** (UX multi-joueurs) : un `requestAnimationFrame` + court délai
 * entre chaque tour laisse le navigateur repeindre — sans quoi la boucle
 * synchrone gelait l'UI le temps que TOUS les adversaires jouent (impression de
 * blocage, aucun feedback). `dispatch` l'`await` : le contrat reste inchangé
 * (après un `await dispatch(EndTurn)`, les tours IA se sont bien appliqués), mais
 * le thread principal est libéré entre chaque tour. `store.aiTurn` porte la
 * progression pour l'indicateur de tour.
 *
 * Placé ici plutôt qu'en abonnement `appStore.subscribe` (option laissée
 * ouverte par le plan) : `dispatch` est déjà le point d'entrée UNIQUE
 * commande → moteur (doc 07 §3), donc le seul endroit où « l'état vient de
 * changer » sans ambiguïté.
 */
async function runAiLoop(): Promise<void> {
  if (aiLoopRunning) return;
  const total = countPendingAiTurns(appStore.getState().game);
  if (total === 0) return;
  aiLoopRunning = true;
  const pacing = reduceMotion() ? 0 : AI_TURN_PACING_MS;
  let done = 0;
  try {
    for (;;) {
      const game = appStore.getState().game;
      if (game.outcome || game.combat) return;
      const current = game.players[game.currentPlayer];
      if (!current || current.controller !== 'ai') return;
      if (done >= MAX_AI_TURNS_PER_DISPATCH) {
        throw new Error('runAiLoop : trop de tours IA d’affilée, boucle infinie suspectée');
      }
      // Annonce le tour de CETTE IA puis laisse l'UI se peindre avant de calculer
      // (le calcul du tour IA est synchrone côté moteur — le yield doit précéder).
      appStore.setState({ aiTurn: { seat: game.currentPlayer + 1, done, total: Math.max(total, done + 1) } });
      await yieldToPaint(pacing);
      const result = apply(appStore.getState().game, { type: 'AiTurn', playerId: current.id });
      appStore.setState({ game: result.state });
      eventBus.emit(result.events);
      done += 1;
    }
  } finally {
    aiLoopRunning = false;
    appStore.setState({ aiTurn: null });
  }
}
