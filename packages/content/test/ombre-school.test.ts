import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * École de magie `ombre` (Ténèbres) — pendant sombre de `traque`/`scene`. Données
 * pures : le gate d'apprentissage (client `game.ts`) est générique — un héros
 * connaît les sorts des écoles UNIVERSELLES + ceux de l'école de SA faction
 * (`manifest.spellSchool`). La faction porteuse est identifiée par sa PROPRIÉTÉ
 * (`spellSchool === 'ombre'`), JAMAIS par son id littéral — le garde-fou de
 * modularité (ci.yml) interdit tout nom de faction dans `packages/`.
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

async function readJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(join(DATA_DIR, rel), 'utf8')) as T;
}

interface SpellRow {
  id: string;
  school: string;
  circle: number;
}

const UNIVERSAL = new Set(['fire', 'water', 'earth', 'air', 'neutral']);

/** Réplique du gate d'apprentissage (client `game.ts`) : cercle ≤ 3, école universelle ou de faction. */
function learnable(spells: SpellRow[], factionSchool: string | null): Set<string> {
  return new Set(
    spells.filter((s) => s.circle <= 3 && (UNIVERSAL.has(s.school) || s.school === factionSchool)).map((s) => s.id),
  );
}

const OMBRE_SPELLS = ['cecite', 'fleau-des-tenebres', 'nuee-d-ombre', 'trait-d-ombre'];

describe('École de magie `ombre` (doc 17 §5)', () => {
  it('exactement une faction déclare l’école `ombre` (identifiée par propriété)', async () => {
    const { factions } = await readJson<{ factions: string[] }>('factions/index.json');
    let count = 0;
    for (const id of factions) {
      const m = await readJson<{ spellSchool: string | null }>(`factions/${id}/manifest.json`);
      if (m.spellSchool === 'ombre') count += 1;
    }
    expect(count).toBe(1);
  });

  it('les 4 sorts d’ombre existent, cercles 1–3', async () => {
    const { spells } = await readJson<{ spells: SpellRow[] }>('core/spells.json');
    const ombre = spells.filter((s) => s.school === 'ombre');
    expect(ombre.map((s) => s.id).sort()).toEqual([...OMBRE_SPELLS].sort());
    expect(ombre.every((s) => s.circle >= 1 && s.circle <= 3)).toBe(true);
  });

  it('un héros de l’école `ombre` apprend ces sorts ; un héros `scene` non (et réciproquement)', async () => {
    const { spells } = await readJson<{ spells: SpellRow[] }>('core/spells.json');
    const withOmbre = learnable(spells, 'ombre');
    const withScene = learnable(spells, 'scene');
    for (const id of OMBRE_SPELLS) {
      expect(withOmbre.has(id), `école ombre apprend ${id}`).toBe(true);
      expect(withScene.has(id), `école scene n’apprend PAS ${id}`).toBe(false);
    }
    expect(withOmbre.has('dissonance')).toBe(false); // sort de la Scène
    // Les deux partagent les écoles universelles.
    expect(withOmbre.has('trait-de-feu')).toBe(true);
    expect(withScene.has('trait-de-feu')).toBe(true);
  });

  it('parité de locale fr/en pour chaque sort d’ombre + le nom d’école', async () => {
    const fr = await readJson<Record<string, string>>('core/locales/fr.json');
    const en = await readJson<Record<string, string>>('core/locales/en.json');
    for (const id of OMBRE_SPELLS) {
      expect(fr[`spell.${id}`], `fr spell.${id}`).toBeTruthy();
      expect(en[`spell.${id}`], `en spell.${id}`).toBeTruthy();
    }
    expect(fr['school.ombre']).toBeTruthy();
    expect(en['school.ombre']).toBeTruthy();
  });
});
