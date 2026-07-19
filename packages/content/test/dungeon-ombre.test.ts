import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * École de magie `ombre` du Donjon (doc 17 §5) — pendant sombre de `traque`/`scene`.
 * Données pures : le gate d'apprentissage (client `game.ts`) est générique — un
 * héros connaît les sorts des écoles UNIVERSELLES + ceux de l'école de SA faction
 * (`manifest.spellSchool`). On vérifie ici que les DONNÉES exercent correctement ce
 * gate : le Donjon déclare `ombre`, les 4 sorts existent, et la réplique du filtre
 * donne les sorts au Donjon mais pas à une autre faction.
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

describe('École `ombre` du Donjon (doc 17 §5)', () => {
  it('le manifeste du Donjon déclare spellSchool "ombre"', async () => {
    const manifest = await readJson<{ spellSchool: string | null }>('factions/dungeon/manifest.json');
    expect(manifest.spellSchool).toBe('ombre');
  });

  it('les 4 sorts d’ombre existent, cercles 1–3', async () => {
    const { spells } = await readJson<{ spells: SpellRow[] }>('core/spells.json');
    const ombre = spells.filter((s) => s.school === 'ombre');
    expect(ombre.map((s) => s.id).sort()).toEqual(
      ['cecite', 'fleau-des-tenebres', 'nuee-d-ombre', 'trait-d-ombre'].sort(),
    );
    expect(ombre.every((s) => s.circle >= 1 && s.circle <= 3)).toBe(true);
  });

  it('un héros Donjon apprend les sorts d’ombre ; un héros Vox Arcana non', async () => {
    const { spells } = await readJson<{ spells: SpellRow[] }>('core/spells.json');
    const dungeon = learnable(spells, 'ombre');
    const vox = learnable(spells, 'scene');
    for (const id of ['trait-d-ombre', 'cecite', 'nuee-d-ombre', 'fleau-des-tenebres']) {
      expect(dungeon.has(id), `Donjon apprend ${id}`).toBe(true);
      expect(vox.has(id), `Vox n’apprend PAS ${id}`).toBe(false);
    }
    // Symétrie : le Donjon n’apprend pas les sorts de la Scène (Vox), et les deux
    // partagent bien les écoles universelles.
    expect(dungeon.has('dissonance')).toBe(false);
    expect(dungeon.has('trait-de-feu')).toBe(true);
    expect(vox.has('trait-de-feu')).toBe(true);
  });

  it('parité de locale fr/en pour chaque sort d’ombre (nom présent des deux côtés)', async () => {
    const fr = await readJson<Record<string, string>>('core/locales/fr.json');
    const en = await readJson<Record<string, string>>('core/locales/en.json');
    for (const id of ['trait-d-ombre', 'cecite', 'nuee-d-ombre', 'fleau-des-tenebres']) {
      expect(fr[`spell.${id}`], `fr spell.${id}`).toBeTruthy();
      expect(en[`spell.${id}`], `en spell.${id}`).toBeTruthy();
    }
  });
});
