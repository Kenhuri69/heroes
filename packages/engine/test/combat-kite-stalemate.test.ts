import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { KITE_MAX_ROUND } from '../src/combat/ai';
import type { CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Anti-impasse : un tireur menacé par une pile plus lente fuyait à chaque round
 * sans jamais tirer (règle de repli de l'IA) ⇒ auto-combat sans fin, levée
 * « boucle infinie suspectée ». Instantané réel relevé par la lecture « élites »
 * de faction:sim (Zombie élite contre Archer sylvestre élite, round 52, hors
 * terrain natif : pas de bonus de vitesse).
 */
const CATALOG: Record<string, CombatUnitDef> = {
  archer: {
    id: 'archer', groupId: 'g', nativeTerrain: 'swamp',
    stats: { hp: 12, attack: 6, defense: 4, damage: [3, 5], speed: 6 },
    abilities: [{ id: 'shooter', params: { ammo: 12 } }],
  },
  zombie: {
    id: 'zombie', groupId: 'g', nativeTerrain: 'swamp',
    stats: { hp: 18, attack: 4, defense: 5, damage: [3, 4], speed: 4 },
    abilities: [],
  },
};

describe('IA de combat — le repli d’un tireur est borné', () => {
  it('instantané d’impasse : l’auto-combat se termine', () => {
    let s = createEmptyState();
    s.started = true;
    s.config = testConfig();
    s.unitCatalog = CATALOG;
    s.rng = seedRng(19);
    s = apply(s, {
      type: 'StartCombat',
      attacker: [{ unitId: 'zombie', count: 18 }],
      defender: [{ unitId: 'archer', count: 9 }],
      terrain: 'grass',
    }).state;
    s = produce(s, (d) => {
      const c = d.combat!;
      c.round = 52;
      c.obstacles = [{ col: 9, row: 4 }, { col: 7, row: 9 }];
      const [zombie, archer] = c.stacks;
      Object.assign(zombie!, { pos: { col: 11, row: 3 }, firstHp: 16 });
      Object.assign(archer!, { pos: { col: 10, row: 9 }, firstHp: 7, ammo: 1 });
    });
    expect(KITE_MAX_ROUND).toBeLessThan(52);
    const done = apply(s, { type: 'AutoCombat' }).state;
    expect(done.combat).toBeNull();
  });
});
