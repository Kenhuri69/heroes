import { apply, validate, EngineError, type Command, type EngineResult, type GameEvent, type GameState } from '@heroes/engine';
import { appStore, type CombatResult, type CombatResultUnit } from './store';
import { eventBus } from './events';
import { reduceMotion } from './motion';

/**
 * Bilan de fin de combat (retour de jeu 2026-07) : agrège les événements du
 * dispatch qui a terminé le combat (`CombatEnded` porte pertes + survivants par
 * camp ; `XpGained`/`HeroLevelUp`/`GuardianVanquished`/`FactionResourceGained`/
 * `UndeadRaised` portent les gains). Retourne `null` s'il n'y a pas de combat
 * fouillé terminé, ou si le joueur a QUITTÉ (fuite/reddition/abandon délibéré :
 * pas d'écran de bilan). Pur (données ⇒ vue) — aucune lecture d'état.
 */
export function buildCombatResult(events: readonly GameEvent[]): CombatResult | null {
  const ended = events.find((e) => e.type === 'CombatEnded');
  if (!ended || ended.type !== 'CombatEnded') return null;
  // Départ délibéré (fuite/reddition/abandon) : pas de bilan (l'action est déjà
  // explicite côté joueur).
  if (events.some((e) => e.type === 'CombatLeft')) return null;

  const enemySide = ended.playerSide === 'attacker' ? 'defender' : 'attacker';
  const breakdown = (side: 'attacker' | 'defender'): CombatResultUnit[] => {
    const byUnit = new Map<string, CombatResultUnit>();
    const get = (unitId: string): CombatResultUnit => {
      let u = byUnit.get(unitId);
      if (!u) {
        u = { unitId, survived: 0, lost: 0 };
        byUnit.set(unitId, u);
      }
      return u;
    };
    for (const s of ended.survivors) if (s.side === side) get(s.unitId).survived += s.count;
    for (const c of ended.casualties) if (c.side === side) get(c.unitId).lost += c.lost;
    return [...byUnit.values()];
  };

  let xp = 0;
  let levelUps = 0;
  let gold = 0;
  const resources: { resource: string; amount: number }[] = [];
  let artifactId: string | null = null;
  let undead: { unitId: string; count: number } | null = null;
  for (const e of events) {
    if (e.type === 'XpGained') xp += e.amount;
    else if (e.type === 'HeroLevelUp') levelUps += 1;
    else if (e.type === 'GuardianVanquished') {
      gold += e.gold;
      if (e.resource && e.resourceAmount > 0) resources.push({ resource: e.resource, amount: e.resourceAmount });
      if (e.artifactId) artifactId = e.artifactId;
    } else if (e.type === 'FactionResourceGained') {
      resources.push({ resource: e.resource, amount: e.amount });
    } else if (e.type === 'UndeadRaised' && e.count > 0) {
      undead = { unitId: e.unitId, count: e.count };
    }
  }

  return {
    victory: ended.winner === ended.playerSide,
    player: breakdown(ended.playerSide),
    enemy: breakdown(enemySide),
    xp,
    levelUps,
    gold,
    resources,
    artifactId,
    undead,
  };
}

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
  if (!before && result.state.combat) appStore.setState({ preBattlePending: true, combatAutoActive: false, combatSpellTarget: null, combatInspectId: null, combatResult: null });
  else if (before && !result.state.combat) {
    // Fin de combat : bilan (retour de jeu 2026-07) pour un combat FOUILLÉ, sinon
    // `null` (départ délibéré / pas de combat).
    appStore.setState({
      preBattlePending: false,
      combatAutoActive: false,
      combatSpellTarget: null,
      combatInspectId: null,
      combatResult: buildCombatResult(result.events),
    });
  }
  eventBus.emit(result.events);
  await runAiLoop();
  return result;
}

/**
 * Reprise des tours IA après chargement (revue 2026-07, B3) : une sauvegarde
 * peut capturer un état où `currentPlayer` est une IA (save manuel pendant le
 * relais, autosave d'une version antérieure, import `.heroes`). `dispatch`
 * étant le seul point qui relance la boucle, un tel chargement figeait la
 * partie : toutes les entrées humaines étaient ignorées, sans recours. On
 * relance donc la boucle sur `GameLoaded` (restore/import/cloud) — no-op si
 * c'est déjà à un humain de jouer.
 */
export function installAiResume(): void {
  eventBus.on((event) => {
    if (event.type !== 'GameLoaded') return;
    runAiLoop().catch((err: unknown) => {
      console.error('reprise des tours IA après chargement :', err);
    });
  });
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
