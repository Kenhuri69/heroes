import type { LoadReport } from '@heroes/content';
import { humanPlayerId } from '@heroes/engine';
import { appStore } from './store';
import { PLAYER_ID } from './game';
import { dispatch } from './dispatch';
import { buildDailyQuests } from './daily';
import { appendFreeModeQuests } from './narrative';

/**
 * Rafraîchissement quotidien des contrats journaliers (N-DAILYREFRESH, doc 13
 * §4.2/§5.3). Le mode libre embarque des contrats au `StartGame` (jour 1) ; ce
 * module en génère de **nouveaux à chaque jour** via la commande générique
 * `AddQuests`.
 *
 * « Armé » au démarrage d'une escarmouche (contexte report/faction/seed) ;
 * **désarmé** hors mode libre (scénario/campagne, retour menu) ⇒ no-op. La
 * génération est **déterministe** (`seed + jour`) : même partie ⇒ mêmes contrats.
 * Revue 2026-09 (C3) : le contexte (faction, graine) voyage avec la sauvegarde
 * locale (`SaveContext`) et est **restauré au chargement** — recharger une
 * escarmouche garde ses contrats ; charger une campagne DÉSARME (plus de
 * contrats journaliers injectés dans un scénario). Le `report` est fourni une
 * fois au boot (`initDailyRefresh`), pas par partie.
 */
export interface DailyRefreshContext {
  humanFactionId: string;
  baseSeed: number;
}

let report: LoadReport | null = null;
let ctx: DailyRefreshContext | null = null;

/** Au boot : le contenu chargé, commun à toutes les parties de la session. */
export function initDailyRefresh(loaded: LoadReport): void {
  report = loaded;
}

export function armDailyRefresh(humanFactionId: string, baseSeed: number): void {
  ctx = { humanFactionId, baseSeed };
}

export function disarmDailyRefresh(): void {
  ctx = null;
}

/** Contexte courant (à embarquer dans une sauvegarde), `null` hors mode libre. */
export function dailyRefreshContext(): DailyRefreshContext | null {
  return ctx ? { ...ctx } : null;
}

/** Au chargement d'une partie : ré-arme depuis le contexte sauvegardé, ou désarme. */
export function restoreDailyRefresh(saved: DailyRefreshContext | null): void {
  ctx = saved ? { ...saved } : null;
}

/** Graine déterministe et décorrélée par jour (PCG32 re-mélange en interne). */
function daySeed(baseSeed: number, day: number): number {
  return (baseSeed + day * 1000003) >>> 0;
}

/**
 * Génère et dispatch les contrats du jour COURANT (≥ 2 ; le jour 1 est déjà
 * embarqué au `StartGame`). Idempotent : `AddQuests` dédup par id jour-scopé, et
 * un même jour rappelé ne ré-ajoute rien. Appelé après chaque fin de tour humain.
 */
export async function refreshDailiesForCurrentDay(): Promise<void> {
  if (!ctx || !report) return;
  const game = appStore.getState().game;
  const day = game.calendar.day;
  if (day < 2) return;
  // Identité humaine RÉELLE de la partie en cours (B7 / remédiation R3) : l'état
  // existe ici (jour ≥ 2), il est la source de vérité — plus de `'player-1'` en
  // dur. Repli sur la convention du client si la partie n'a aucun humain.
  const { questState, metas } = buildDailyQuests(
    report,
    ctx.humanFactionId,
    humanPlayerId(game) ?? PLAYER_ID,
    daySeed(ctx.baseSeed, day),
    2,
    `d${day}-`,
  );
  if (questState.quests.length === 0) return;
  await dispatch({ type: 'AddQuests', quests: questState.quests.map((q) => q.def) });
  appendFreeModeQuests(metas);
}
