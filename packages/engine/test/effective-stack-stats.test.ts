import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources } from '../src/core/state';
import { effectiveStackStats } from '../src/combat';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * LE-UX : la fiche de pile lit les stats EFFECTIVES (mêmes briques que les frappes).
 * Héros d'Attaque 3 / Défense 2 : l'attaque de la pile en tient compte, la Défense
 * du héros reste à part (pente propre, A3).
 */
describe('effectiveStackStats', () => {
  it('ajoute l’Attaque du héros et rend sa Défense à part', () => {
    const base = testMap();
    let s = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 3,
      players: [{ id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 10 }] }],
      map: { ...base, objects: [...base.objects, { id: 'g', type: 'guardian', pos: { x: 1, y: 0 }, unitId: 'blue-wolf', count: 3 }] },
      config: testConfig(),
      unitCatalog: testCatalog(),
      buildingCatalog: {},
      towns: [],
    }).state;
    s = { ...s, heroes: s.heroes.map((h) => ({ ...h, attributes: { ...h.attributes, attack: 3, defense: 2 } })) };
    s = apply(s, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] }).state;
    const combat = s.combat!;
    const mine = combat.stacks.find((st) => st.side === 'attacker')!;
    const eff = effectiveStackStats(s, combat, mine)!;
    const def = s.unitCatalog[mine.unitId]!;
    expect(eff.attack).toBe(def.stats.attack + 3);
    expect(eff.defense).toBe(def.stats.defense);
    expect(eff.heroDefense).toBe(2);
    expect(eff.luck).toBe(0);
  });
});
