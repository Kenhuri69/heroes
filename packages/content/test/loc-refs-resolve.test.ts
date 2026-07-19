import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Audit i18n de contenu (plan `i18n-audit-spell-schools`, suite) : TOUTE
 * référence `@loc:<clé>` d'un paquet de faction (nom/bio d'unité, de héros, lore
 * de bâtiment, titres de campagne…) doit se résoudre dans les locales de CE
 * paquet — ou, à défaut, dans les locales core — en FR **et** en EN. Sinon l'UI
 * affiche la clé brute (« @loc:building.x.lore »).
 *
 * Le loader (`content:check`) n'impose la résolution que d'un SOUS-ENSEMBLE des
 * refs (noms d'unités/héros/faction/maison, loreKey d'unité). Ce test généralise
 * à **toutes** les refs — notamment lore de bâtiment et campagnes, non couvertes
 * — pour empêcher une ref pendante d'une future faction.
 *
 * Faction-agnostique : itère sur les dossiers réellement présents, aucun id
 * littéral (garde-fou de modularité, ci.yml).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');
const LOC_REF = /@loc:([A-Za-z0-9_.@-]+)/g;

async function walkJson(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkJson(full)));
    else if (e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

async function keySet(rel: string): Promise<Set<string>> {
  try {
    const obj = JSON.parse(await readFile(join(DATA_DIR, rel), 'utf8')) as Record<string, unknown>;
    return new Set(Object.keys(obj));
  } catch {
    return new Set();
  }
}

describe('i18n — résolution de toutes les références @loc: de contenu', () => {
  it('chaque @loc: résout dans les locales du paquet (ou core) en FR et EN', async () => {
    const factionsDir = join(DATA_DIR, 'factions');
    const dirs = (await readdir(factionsDir, { withFileTypes: true })).filter((e) => e.isDirectory());

    const missing: string[] = [];
    for (const lang of ['fr', 'en'] as const) {
      const core = await keySet(`core/locales/${lang}.json`);
      for (const d of dirs) {
        const own = await keySet(`factions/${d.name}/locales/${lang}.json`);
        // Collecte les refs dans TOUS les JSON du paquet (données + story), pas
        // les locales elles-mêmes (qui définissent, ne référencent pas).
        const files = (await walkJson(join(factionsDir, d.name))).filter(
          (f) => !f.includes(`/locales/`),
        );
        const refs = new Set<string>();
        for (const f of files) {
          const text = await readFile(f, 'utf8');
          for (const m of text.matchAll(LOC_REF)) if (m[1]) refs.add(m[1]);
        }
        for (const key of refs) {
          if (!own.has(key) && !core.has(key)) missing.push(`${d.name}/${lang}: @loc:${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
