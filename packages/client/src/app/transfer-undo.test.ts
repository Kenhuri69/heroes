import { describe, expect, it } from 'vitest';
import { reverseArmySlot, reverseArtifactSlot } from './transfer-undo';

describe('LE-UX — annuler le dernier transfert', () => {
  const a = { unitId: 'a', count: 3 };
  const b = { unitId: 'b', count: 5 };

  it('pile déplacée entière ⇒ renvoyable depuis son nouvel emplacement', () => {
    expect(reverseArmySlot([a, b], [a], [{ unitId: 'c', count: 1 }], [{ unitId: 'c', count: 1 }, b])).toEqual({ slot: 1, index: 1 });
    expect(reverseArmySlot([b, a], [a], [], [b])).toEqual({ slot: 0, index: 0 });
  });

  it('pile fusionnée à une pile de même unité ⇒ pas d’annulation', () => {
    expect(reverseArmySlot([a, b], [a], [{ unitId: 'b', count: 1 }], [{ unitId: 'b', count: 6 }])).toBeNull();
  });

  it('artefact ⇒ l’emplacement où il est arrivé', () => {
    expect(reverseArtifactSlot(['x', null, null], ['x', 'y', null])).toBe(1);
    expect(reverseArtifactSlot(['x'], ['x'])).toBeNull();
  });
});
