import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Audit i18n (plan `i18n-audit-spell-schools`) : le grimoire client affiche un
 * onglet par école de sorts via `t(`school.<id>`)`, et `t()` ne lit QUE les
 * locales core (aucun repli paquet). Invariant : toute école référencée par un
 * sort core OU déclarée `spellSchool` d'une faction doit avoir un libellé
 * `school.<id>` en core FR **et** EN — sinon l'UI montre la clé brute
 * (« school.traque »). Ce test aurait attrapé lumiere/prime/traque/scene.
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

async function readJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(join(DATA_DIR, rel), 'utf8')) as T;
}

describe('i18n — libellé core de chaque école de sorts', () => {
  it('school.<id> existe en FR et EN pour toute école utilisée', async () => {
    const spells = await readJson<{ spells: { school: string }[] }>('core/spells.json');
    const schools = new Set(spells.spells.map((s) => s.school));

    // Écoles propres déclarées par les factions (manifest.spellSchool).
    const factionsDir = join(DATA_DIR, 'factions');
    const entries = await readdir(factionsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const manifest = await readJson<{ spellSchool?: string }>(`factions/${e.name}/manifest.json`);
        if (manifest.spellSchool) schools.add(manifest.spellSchool);
      } catch {
        // paquet sans manifeste lisible — ignoré (couvert par d'autres tests).
      }
    }

    const fr = await readJson<Record<string, string>>('core/locales/fr.json');
    const en = await readJson<Record<string, string>>('core/locales/en.json');

    const missing: string[] = [];
    for (const school of schools) {
      if (!fr[`school.${school}`]) missing.push(`fr:school.${school}`);
      if (!en[`school.${school}`]) missing.push(`en:school.${school}`);
    }
    expect(missing).toEqual([]);
  });
});
