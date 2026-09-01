import { describe, expect, it } from 'vitest';
import type { MapObjectDef } from '@heroes/engine';
import { stairDirection } from './MapObjectCard';

/**
 * Audit ergonomie U-3 : un escalier (paire de monolithes INTER-couches) doit se
 * distinguer d'un téléport local sur la fiche d'objet — sinon rien n'indique au
 * joueur que la case mène au souterrain.
 */
const mono = (id: string, pairId: string, level?: number): MapObjectDef =>
  ({ id, type: 'monolith', pos: level === undefined ? { x: 1, y: 1 } : { x: 1, y: 1, level }, pairId }) as MapObjectDef;

describe('stairDirection', () => {
  it('reconnaît la descente et la remontée', () => {
    const down = mono('a', 'p');
    const up = mono('b', 'p', 1);
    expect(stairDirection(down, [down, up])).toBe('down');
    expect(stairDirection(up, [down, up])).toBe('up');
  });

  it('rend `null` pour un téléport de MÊME couche (le cas historique)', () => {
    const a = mono('a', 'p');
    const b = mono('b', 'p');
    expect(stairDirection(a, [a, b])).toBeNull();
  });

  it('rend `null` sans jumeau, sans carte, ou pour un autre type d’objet', () => {
    const lone = mono('a', 'p');
    expect(stairDirection(lone, [lone])).toBeNull();
    expect(stairDirection(lone, undefined)).toBeNull();
    const gold = { id: 'g', type: 'resource', pos: { x: 0, y: 0 }, resource: 'gold', amount: 1 } as MapObjectDef;
    expect(stairDirection(gold, [gold])).toBeNull();
  });
});
