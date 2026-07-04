import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, type ReadJson } from '../src/loader';

/**
 * Régression (plan phase-3.7) : le nom de faction doit rester propre à chaque
 * paquet une fois TOUTES les locales de paquets fusionnées comme le fait le
 * client (`initI18n` : `Object.assign` de `pack.locales[lang]` dans un seul
 * objet plat par langue). Un jour, les 4 manifestes pointaient vers la même
 * clé `@loc:faction.name` : après fusion, le nom résolu était celui du dernier
 * paquet chargé pour toutes les factions. La clé est désormais unique par
 * faction (`@loc:faction.<id>.name`, côté données) — ce test l'ancre.
 *
 * Faction-agnostique : on n'écrit aucun id littéral (garde-fou de modularité,
 * ci.yml) — on itère sur les paquets réellement chargés.
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

const LANGS = ['fr', 'en'] as const;

describe('résolution du nom de faction (locales fusionnées)', () => {
  it('chaque faction résout son propre nom après fusion de toutes les locales', async () => {
    const { content } = await loadContent(readJsonFromDisk);
    const packs = content.packs;
    expect(packs.length).toBeGreaterThanOrEqual(2); // le bug n'apparaît qu'à ≥ 2 paquets

    for (const lang of LANGS) {
      // Reproduit le merge du client : un seul objet plat par langue.
      const merged: Record<string, string> = {};
      for (const pack of packs) Object.assign(merged, pack.locales[lang]);

      for (const pack of packs) {
        const key = pack.manifest.name.slice('@loc:'.length);
        const own = pack.locales[lang][key];
        expect(own, `${pack.manifest.id}: clé ${key} absente de sa propre locale ${lang}`).toBeDefined();
        // Après fusion, la clé du manifeste résout TOUJOURS le nom du paquet.
        expect(
          merged[key],
          `${pack.manifest.id}: nom résolu en ${lang} pollué par un autre paquet`,
        ).toBe(own);
      }
    }
  });

  it('aucune collision de clé de nom entre paquets', async () => {
    const { content } = await loadContent(readJsonFromDisk);
    const nameKeys = content.packs.map((p) => p.manifest.name);
    expect(new Set(nameKeys).size).toBe(nameKeys.length);
  });
});
