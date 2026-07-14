import { appStore } from './store';
import { eventBus } from './events';
import { saveGame } from './save';

/**
 * Autosave (doc 07 §4) : sauvegarde silencieuse dans le slot `auto` après
 * chaque fin de tour (`TurnEnded`). Fire-and-forget — un échec de stockage
 * (quota, navigateur privé…) ne doit jamais interrompre la partie.
 *
 * Un relais IA émet un `TurnEnded` PAR TOUR IA : on n'écrit le slot qu'au
 * retour de la main à un joueur humain (revue 2026-07, B3/F4) — une seule
 * écriture (sérialisation + gzip + IndexedDB) par relais au lieu de N
 * concurrentes en plein pacing, et jamais de snapshot « currentPlayer = IA »
 * qu'un « Continuer » ne saurait reprendre.
 */
export function installAutosave(): void {
  eventBus.on((event) => {
    if (event.type !== 'TurnEnded') return;
    const game = appStore.getState().game;
    if (game.players[game.currentPlayer]?.controller !== 'human') return;
    saveGame(game, 'auto').catch((err: unknown) => {
      console.warn('autosave: échec de la sauvegarde automatique', err);
      eventBus.emit([{ type: 'SaveFailed' }]);
    });
  });
}
