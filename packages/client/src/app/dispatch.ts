import { apply, validate, type Command, type EngineResult } from '@heroes/engine';
import { appStore } from './store';
import { eventBus } from './events';

/**
 * Point d'entrée unique UI/input → moteur (doc 07 §3). Synchrone en Phase 2
 * mais d'interface asynchrone : le passage en Web Worker sera un changement
 * d'implémentation, pas d'API.
 */
export async function dispatch(cmd: Command): Promise<EngineResult> {
  const err = validate(appStore.getState().game, cmd);
  if (err) throw new Error(`${err.code}: ${err.message}`);
  const result = apply(appStore.getState().game, cmd);
  appStore.setState({ game: result.state });
  eventBus.emit(result.events);
  return Promise.resolve(result);
}
