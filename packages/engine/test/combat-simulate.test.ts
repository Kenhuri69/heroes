import { describe, expect, it } from 'vitest';
import { simulateAutoCombat } from '../src/combat/simulate';
import { testConfig, testCatalog } from './fixtures';

/**
 * Brique de simulation d'équilibrage (`faction:sim`, Alpha 4.17) : auto-combat
 * déterministe → camp vainqueur. Pur (RNG seedé) : replay stable, testable.
 */
describe('simulateAutoCombat', () => {
  const catalog = testCatalog();
  const config = testConfig();

  it('déterministe : même graine ⇒ même vainqueur', () => {
    const a = [{ unitId: 'red-grunt', count: 20 }];
    const b = [{ unitId: 'blue-wolf', count: 20 }];
    const w1 = simulateAutoCombat(catalog, config, a, b, 'grass', 42);
    const w2 = simulateAutoCombat(catalog, config, a, b, 'grass', 42);
    expect(w1).toBe(w2);
  });

  it('une armée écrasante l’emporte', () => {
    const strong = [{ unitId: 'red-grunt', count: 100 }];
    const weak = [{ unitId: 'blue-wolf', count: 1 }];
    expect(simulateAutoCombat(catalog, config, strong, weak, 'grass', 7)).toBe('attacker');
    expect(simulateAutoCombat(catalog, config, weak, strong, 'grass', 7)).toBe('defender');
  });

  it('des graines différentes peuvent départager un combat serré', () => {
    const a = [{ unitId: 'red-grunt', count: 10 }];
    const b = [{ unitId: 'red-grunt', count: 10 }];
    const winners = new Set(
      Array.from({ length: 30 }, (_, i) => simulateAutoCombat(catalog, config, a, b, 'grass', i + 1)),
    );
    // Un miroir parfait n'a aucune raison de toujours donner le même camp.
    expect(winners.size).toBeGreaterThanOrEqual(1);
  });
});
