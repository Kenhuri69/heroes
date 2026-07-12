import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * H-SPELLS.2 — Cohérence Guilde des mages ↔ catalogue de sorts (doc 02 §1.4).
 * Le moteur enseigne, à chaque niveau `mageGuild`, `spellCount` sorts du cercle
 * `level` (`rollGuildSpells` filtre `circle === level`). Invariant de données :
 * chaque niveau doit disposer d'AU MOINS `spellCount` sorts de son cercle, sinon
 * le pool sort incomplet (guilde « stérile »). On vérifie aussi que les cercles
 * 4-5 existent (sans quoi la compétence Sagesse resterait inerte).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

async function readJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(join(DATA_DIR, rel), 'utf8')) as T;
}

interface SpellRow {
  id: string;
  circle: number;
}
interface BuildingRow {
  id: string;
  maxLevel: number;
  levels: { effect: { type: string; level?: number; spellCount?: number } }[];
}

describe('H-SPELLS.2 — cohérence Guilde des mages / cercles de sorts', () => {
  it('chaque niveau de guilde a assez de sorts de son cercle pour son spellCount', async () => {
    const { spells } = await readJson<{ spells: SpellRow[] }>('core/spells.json');
    const { buildings } = await readJson<{ buildings: BuildingRow[] }>('core/buildings.json');
    const byCircle = new Map<number, number>();
    for (const s of spells) byCircle.set(s.circle, (byCircle.get(s.circle) ?? 0) + 1);

    const guild = buildings.find((b) => b.levels.some((l) => l.effect.type === 'mageGuild'));
    expect(guild).toBeDefined();
    for (const lvl of guild!.levels) {
      const eff = lvl.effect;
      if (eff.type !== 'mageGuild') continue;
      const circle = eff.level ?? 0;
      const need = eff.spellCount ?? 0;
      const have = byCircle.get(circle) ?? 0;
      expect(have, `cercle ${circle} : ${have} sort(s) pour spellCount ${need}`).toBeGreaterThanOrEqual(need);
    }
  });

  it('des sorts de cercle 4 et 5 existent (Sagesse enfin utile)', async () => {
    const { spells } = await readJson<{ spells: SpellRow[] }>('core/spells.json');
    expect(spells.some((s) => s.circle === 4)).toBe(true);
    expect(spells.some((s) => s.circle === 5)).toBe(true);
  });

  it('la guilde monte jusqu’au cercle 5', async () => {
    const { buildings } = await readJson<{ buildings: BuildingRow[] }>('core/buildings.json');
    const guild = buildings.find((b) => b.levels.some((l) => l.effect.type === 'mageGuild'));
    const maxCircle = Math.max(
      ...guild!.levels.flatMap((l) => (l.effect.type === 'mageGuild' ? [l.effect.level ?? 0] : [])),
    );
    expect(maxCircle).toBe(5);
  });
});
