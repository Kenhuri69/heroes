import { emptyResources, type Command, type Resources } from '@heroes/engine';
import type { GameConfig, ResolvedMap } from '@heroes/content';

export const PLAYER_ID = 'player-1';

/** Construit la commande `StartGame` depuis les données validées — rien en dur. */
export function newGameCommand(seed: number, config: GameConfig, map: ResolvedMap): Command {
  const startingResources: Resources = { ...emptyResources() };
  for (const [id, amount] of Object.entries(config.newGame.startingResources)) {
    startingResources[id as keyof Resources] = amount ?? 0;
  }
  return {
    type: 'StartGame',
    seed,
    players: [{ id: PLAYER_ID, startingResources }],
    map,
    config: config.adventure,
  };
}
