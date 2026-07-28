import { apply, validate, EngineError, type Command, type EngineResult, type GameEvent, type GameState } from '@heroes/engine';
import { appStore, type CombatResult, type CombatResultUnit } from './store';
import { eventBus } from './events';
import { reduceMotion } from './motion';
import { recordOnlineTurn } from './online-match';
import { t } from './i18n';
import { pushToastOnce } from '../ui/toasts';

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
  const gameBefore = appStore.getState().game;
  const err = validate(gameBefore, cmd);
  if (err) throw new EngineError(err);
  const before = gameBefore.combat;
  const result = apply(gameBefore, cmd);
  // Écran pré-combat (Lot 1) : armé quand un combat DÉMARRE (null → non-null),
  // désarmé quand il se termine (avec bilan pour un combat FOUILLÉ, sinon null —
  // départ délibéré). La conduite manuelle / l'Auto-Battle le désarment aussi
  // côté UI (PreBattleScreen). UN SEUL setState par commande (F1, revue
  // 2026-07) : le second doublait chaque resync de scène abonnée au store.
  if (!before && result.state.combat) {
    appStore.setState({ game: result.state, preBattlePending: true, combatAutoActive: false, combatSpellTarget: null, combatSpellZone: null, combatInspectId: null, combatResult: null, combatActingHeroId: null });
  } else if (before && !result.state.combat) {
    appStore.setState({
      game: result.state,
      preBattlePending: false,
      combatAutoActive: false,
      combatSpellTarget: null,
      combatSpellZone: null,
      combatInspectId: null,
      combatResult: buildCombatResult(result.events),
      combatActingHeroId: null,
    });
  } else {
    appStore.setState({ game: result.state });
  }
  // E9 : un combat du JOUEUR vient de se terminer dans ce dispatch (l'écran de
  // combat était posé) ⇒ contexte pour ne toaster QUE ses combats (pas ceux de
  // l'IA, résolus dans `AiTurn` sans jamais poser `game.combat` côté client).
  const humanCombat = Boolean(before) && !result.state.combat;
  eventBus.emit(result.events, { humanCombat });
  // NET-PVPUI (slice B) : capture/poste le tour en ligne (no-op hors match). Avant
  // `runAiLoop` (de toute façon no-op en PvP 2 humains).
  await recordOnlineTurn(cmd, gameBefore);
  // `gameBefore` = état de REPLI si un tour IA échoue (lot R0/B1) : c'est un état
  // produit par le moteur où la main est encore au joueur humain.
  await runAiLoop(gameBefore);
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
    // Un rejet ici est un échec de relais IA comme un autre (écart de
    // vérification R0 #1) : sans état de repli humain, il est SIGNALÉ avec sa
    // porte de sortie — plus de `console.error` seul, invisible du joueur.
    runAiLoop().catch((err: unknown) => handleAiTurnFailure(err, undefined));
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
  // Onglet masqué (revue 2026-07, B41) : `requestAnimationFrame` ne tire plus —
  // repli `setTimeout` seul pour que les tours IA avancent en arrière-plan.
  if (typeof document !== 'undefined' && document.hidden) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => (ms > 0 ? setTimeout(resolve, ms) : resolve()));
  });
}

/**
 * Échec d'un tour IA (lot R0/B1) : la boucle s'arrête, le joueur est PRÉVENU et
 * récupère la main quand c'est possible — au lieu du gel silencieux (l'exception
 * traversait `dispatch` jusqu'à un `catch` vide, laissant `currentPlayer` sur
 * l'IA et toutes les entrées humaines gardées).
 *
 * `currentPlayer` est un champ MOTEUR : il n'est jamais bricolé côté client
 * (guidelines §8 — ce serait un état que le moteur n'a pas produit, qu'un autosave
 * pourrait figer). Deux issues, toutes deux côté client :
 * 1. **rollback** sur `fallback` — l'état d'avant le dispatch, où c'est encore au
 *    joueur humain de jouer : la main revient, son tour n'est pas consommé ;
 * 2. sans repli humain (reprise `installAiResume` d'une sauvegarde « prise en
 *    plein relais IA ») : état **explicitement signalé** (`aiFailure`) avec
 *    action de récupération — recharger la dernière sauvegarde.
 */
function handleAiTurnFailure(err: unknown, fallback: GameState | undefined): void {
  console.error('runAiLoop : tour IA en échec —', err);
  if (fallback && fallback.players[fallback.currentPlayer]?.controller === 'human') {
    appStore.setState({ game: fallback, aiFailure: false });
    pushToastOnce(t('toast.aiTurnFailed'), 'error');
    return;
  }
  appStore.setState({ aiFailure: true });
  pushToastOnce(t('toast.aiTurnBlocked'), 'error');
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
async function runAiLoop(fallback?: GameState): Promise<void> {
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
        // Traité comme un échec de tour IA (R0/B1) : le `throw` d'avant traversait
        // `dispatch` et finissait dans un `catch` vide ⇒ partie figée sans message.
        handleAiTurnFailure(new Error('trop de tours IA d’affilée, boucle infinie suspectée'), fallback);
        return;
      }
      // Annonce le tour de CETTE IA puis laisse l'UI se peindre avant de calculer
      // (le calcul du tour IA est synchrone côté moteur — le yield doit précéder).
      appStore.setState({ aiTurn: { seat: game.currentPlayer + 1, done, total: Math.max(total, done + 1) } });
      await yieldToPaint(pacing);
      try {
        const result = apply(appStore.getState().game, { type: 'AiTurn', playerId: current.id });
        appStore.setState({ game: result.state });
        // `emit` DANS le `try` : le bus n'isole pas ses abonnés (audio, campagne,
        // journal, autosave…) — un abonné qui lève est un échec de tour IA comme
        // un autre, pas un gel silencieux (écart de vérification R0 #1).
        eventBus.emit(result.events);
      } catch (err) {
        // Échec ISOLÉ dans la boucle (R0/B1) : on arrête là, on prévient, on rend la main.
        handleAiTurnFailure(err, fallback);
        return;
      }
      done += 1;
    }
  } finally {
    aiLoopRunning = false;
    appStore.setState({ aiTurn: null });
  }
}
