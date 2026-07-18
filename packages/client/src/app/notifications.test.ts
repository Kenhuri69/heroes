import { describe, expect, it } from 'vitest';
import type { AppEvent } from './events';
import { sumDailyIncome } from './notifications';

/**
 * Agrégation des revenus du jour (E9) — logique pure (somme par ressource, or en
 * tête, joueur humain seul). Le rendu localisé est trivial par-dessus.
 */
const mine = (playerId: string, resource: string, amount: number): AppEvent =>
  ({ type: 'MineIncome', playerId, resource, amount }) as unknown as AppEvent;
const town = (playerId: string, resource: string, amount: number): AppEvent =>
  ({ type: 'TownIncome', playerId, resource, amount }) as unknown as AppEvent;

describe('sumDailyIncome', () => {
  it('somme mines + villes par ressource, or en tête', () => {
    const events = [
      mine('p1', 'gold', 100),
      town('p1', 'gold', 200),
      mine('p1', 'wood', 2),
      town('p1', 'ore', 1),
    ];
    expect(sumDailyIncome(events, 'p1')).toEqual([
      { resource: 'gold', amount: 300 },
      { resource: 'wood', amount: 2 },
      { resource: 'ore', amount: 1 },
    ]);
  });

  it('ignore les revenus des autres joueurs (IA)', () => {
    const events = [mine('p1', 'gold', 100), mine('ai', 'gold', 999), town('ai', 'wood', 50)];
    expect(sumDailyIncome(events, 'p1')).toEqual([{ resource: 'gold', amount: 100 }]);
  });

  it('lot sans revenu ⇒ liste vide (aucun toast agrégé)', () => {
    const events = [{ type: 'WeekStarted', week: 2 } as unknown as AppEvent];
    expect(sumDailyIncome(events, 'p1')).toEqual([]);
  });

  it('une seule source ⇒ une seule entrée (toujours agrégé)', () => {
    expect(sumDailyIncome([mine('p1', 'gold', 250)], 'p1')).toEqual([{ resource: 'gold', amount: 250 }]);
  });
});
