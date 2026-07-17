import { describe, expect, it } from 'vitest';
import { simulateHeroCombat } from '../src/combat/simulate';
import type { CombatUnitDef } from '../src/combat/types';
import type { FactionBonus } from '../src/faction/types';
import { testConfig } from './fixtures';

/**
 * Brique d'attrition/gauntlet de `faction:sim` (plan `faction-sim-fidelity`) :
 * un combat héros-vs-héros auto-résolu, avec effets de faction post-victoire et
 * report de l'armée reconstruite du vainqueur. C'est ce qui permet de VALORISER
 * la nécromancie (impossible avec un duel unique sans héros).
 */
const catalog = (): Record<string, CombatUnitDef> => ({
  raider: {
    id: 'raider',
    groupId: 'raiders',
    nativeTerrain: 'grass',
    stats: { hp: 30, attack: 10, defense: 6, damage: [6, 10], speed: 7 },
    abilities: [],
  },
  militia: {
    id: 'militia',
    groupId: 'town',
    nativeTerrain: 'grass',
    stats: { hp: 12, attack: 4, defense: 3, damage: [2, 3], speed: 4 },
    abilities: [],
  },
  skeleton: {
    id: 'skeleton',
    groupId: 'raiders',
    nativeTerrain: 'grass',
    stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 },
    abilities: [{ id: 'undead', params: {} }],
  },
});

const necroCatalog: Record<string, { bonuses: FactionBonus[] }> = {
  raiders: {
    bonuses: [
      { type: 'raiseUndeadOnVictory', unitId: 'skeleton', percentHpRaised: 100, capBase: 10000, capPerExisting: 0 },
    ],
  },
};

describe('simulateHeroCombat', () => {
  const config = testConfig();

  it('déterministe : même graine ⇒ même vainqueur et même armée reportée', () => {
    const cat = catalog();
    const a = { army: [{ unitId: 'raider', count: 10 }], factionId: 'raiders' };
    const b = { army: [{ unitId: 'militia', count: 10 }], factionId: 'town' };
    const r1 = simulateHeroCombat(cat, config, {}, a, b, 42);
    const r2 = simulateHeroCombat(cat, config, {}, a, b, 42);
    expect(r1.winner).toBe(r2.winner);
    expect(r1.challengerArmy).toEqual(r2.challengerArmy);
  });

  it('un challenger écrasant gagne et reporte des survivants', () => {
    const cat = catalog();
    const strong = { army: [{ unitId: 'raider', count: 40 }], factionId: 'raiders' };
    const weak = { army: [{ unitId: 'militia', count: 2 }], factionId: 'town' };
    const r = simulateHeroCombat(cat, config, {}, strong, weak, 7);
    expect(r.winner).toBe('attacker');
    const total = r.challengerArmy.reduce((n, s) => n + s.count, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('un challenger vaincu ne reporte rien', () => {
    const cat = catalog();
    const weak = { army: [{ unitId: 'militia', count: 1 }], factionId: 'town' };
    const strong = { army: [{ unitId: 'raider', count: 40 }], factionId: 'raiders' };
    const r = simulateHeroCombat(cat, config, {}, weak, strong, 7);
    expect(r.winner).toBe('defender');
    expect(r.challengerArmy).toEqual([]);
  });

  it('nécromancie : la victoire relève des morts-vivants dans l’armée reportée', () => {
    const cat = catalog();
    const necro = { army: [{ unitId: 'raider', count: 40 }], factionId: 'raiders' };
    const living = { army: [{ unitId: 'militia', count: 10 }], factionId: 'town' };
    // Avec l'effet de faction : squelettes relevés depuis les PV vivants tués.
    const withNecro = simulateHeroCombat(cat, config, necroCatalog, necro, living, 3);
    expect(withNecro.winner).toBe('attacker');
    const raised = withNecro.challengerArmy.find((s) => s.unitId === 'skeleton');
    expect(raised?.count ?? 0).toBeGreaterThan(0);
    // Sans effet de faction (catalogue vide) : aucun squelette relevé — preuve que
    // le report vient bien de la nécromancie, pas de l'armée de départ.
    const noNecro = simulateHeroCombat(cat, config, {}, necro, living, 3);
    expect(noNecro.challengerArmy.some((s) => s.unitId === 'skeleton')).toBe(false);
  });
});
