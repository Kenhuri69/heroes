import type { GameState } from '@heroes/engine';
import { appStore, type AppState } from './store';
import { eventBus } from './events';
import { resetNarrativeState } from './narrative';
import { skipCutscene } from './cutscene';
import { dailyRefreshContext, restoreDailyRefresh, type DailyRefreshContext } from './daily-refresh';

/**
 * Point d'entrée UNIQUE d'une partie chargée (revue 2026-09, C2/C3/C5) —
 * Continuer, Charger, import `.heroes`, cloud pull, match en ligne. Avant, chaque
 * chemin posait `game` + `screen` à sa façon et **aucun** ne purgeait l'état
 * client PAR PARTIE : chapitre de campagne actif (une escarmouche chargée
 * faisait avancer la campagne — B13 rejoué), contrats journaliers armés (injectés
 * dans une campagne chargée), accusé de tour hot-seat, cinématique en cours.
 *
 * Le contexte client d'une partie (`SaveContext`) voyage AVEC la sauvegarde
 * locale (métadonnées IndexedDB / `.heroes`, hors `GameState` ⇒ pas de bump de
 * save) : recharger sa propre campagne garde le chapitre actif, recharger une
 * escarmouche garde ses contrats journaliers ; une sauvegarde sans contexte
 * (cloud, ancien format) repart propre.
 */
export interface SaveContext {
  activeChapter: AppState['activeChapter'];
  dailyRefresh: DailyRefreshContext | null;
}

/** Contexte client de la partie EN COURS, à embarquer dans une sauvegarde. */
export function currentSaveContext(): SaveContext {
  return { activeChapter: appStore.getState().activeChapter, dailyRefresh: dailyRefreshContext() };
}

export function enterLoadedGame(
  state: GameState,
  opts: { context?: SaveContext | null; onlineMatch?: AppState['onlineMatch'] } = {},
): void {
  // La narration/les journaux de la partie en cours ne concernent pas la partie
  // chargée (le catalogue narratif n'est pas persisté) — purge (B35).
  resetNarrativeState();
  // Une cinématique de la partie précédente ne doit pas survivre (ni couper
  // ensuite, par son `setState` final, le dialogue d'ouverture de la nouvelle).
  skipCutscene();
  restoreDailyRefresh(opts.context?.dailyRefresh ?? null);
  appStore.setState({
    game: state,
    // Route aventure + pile de modales vidée (U2) ; signalement d'échec de tour
    // IA levé (R0/B1 : le rechargement EST la sortie) ; cycle hot-seat redémarré.
    screen: 'adventure',
    modals: [],
    aiFailure: false,
    turnAck: null,
    activeChapter: opts.context?.activeChapter ?? null,
    onlineMatch: opts.onlineMatch ?? null,
  });
  eventBus.emit([{ type: 'GameLoaded' }]);
}
