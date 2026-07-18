import { describe, expect, it } from 'vitest';
import { waterSheenAlpha } from './waterSheen';

/**
 * Miroitement d'eau (Lot 8b) : l'alpha est un sinus lent borné [0, 0.1], nul en
 * reduce-motion. Fonction pure ⇒ testée sans rendu.
 */
describe('waterSheenAlpha', () => {
  it('reste dans [0, 0.1] au fil du temps', () => {
    for (let t = 0; t < 12; t += 0.25) {
      const a = waterSheenAlpha(t, false);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('varie dans le temps (respiration, pas constant)', () => {
    const samples = [0, 1.5, 3, 4.5].map((t) => waterSheenAlpha(t, false));
    const distinct = new Set(samples.map((a) => a.toFixed(4)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('coupé (0) en reduce-motion, quel que soit le temps', () => {
    expect(waterSheenAlpha(0, true)).toBe(0);
    expect(waterSheenAlpha(1.5, true)).toBe(0);
    expect(waterSheenAlpha(3, true)).toBe(0);
  });
});
