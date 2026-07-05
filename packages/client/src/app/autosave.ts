import { appStore } from './store';
import { eventBus } from './events';
import { saveGame } from './save';

/**
 * Autosave (doc 07 §4) : sauvegarde silencieuse dans le slot `auto` après
 * chaque fin de tour (`TurnEnded`). Fire-and-forget — un échec de stockage
 * (quota, navigateur privé…) ne doit jamais interrompre la partie.
 */
export function installAutosave(): void {
  eventBus.on((event) => {
    if (event.type !== 'TurnEnded') return;
    saveGame(appStore.getState().game, 'auto').catch((err: unknown) => {
      console.warn('autosave: échec de la sauvegarde automatique', err);
      eventBus.emit([{ type: 'SaveFailed' }]);
    });
  });
}
