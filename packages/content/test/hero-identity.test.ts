import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, type ReadJson } from '../src/loader';
import { HERO_ORIGINS } from '../src/schemas';

/**
 * Héros nommés — format d'identité (doc 16 État 16.9). Séparation demandée :
 * héros `canon` (issus d'un univers tiers) vs `original` (créations propres au
 * jeu). Format **data-driven**, validé par le pipeline, **non consommé par le
 * moteur** (staging). Le paquet est repéré par sa PROPRIÉTÉ signature (déclare
 * des héros nommés), jamais par son id littéral — garde-fou de modularité (ci.yml).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('Héros nommés — identité et séparation par origine', () => {
  it('charge les fiches, chaque héros est nommé/typé et classé par origine', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);

    // Signature : une faction qui déclare des héros nommés.
    const pack = report.content.packs.find((p) => p.heroes.length > 0);
    if (!pack) throw new Error('aucune faction ne déclare de héros nommés');

    for (const hero of pack.heroes) {
      expect(HERO_ORIGINS).toContain(hero.origin);
      expect(['might', 'magic']).toContain(hero.archetype);
      expect(hero.avatar).toBeTruthy();
      // Nom + bio localisés fr/en (parité garantie par le loader).
      expect(pack.locales.fr[hero.name.slice('@loc:'.length)]).toBeTruthy();
      expect(pack.locales.en[hero.bio.slice('@loc:'.length)]).toBeTruthy();
    }
  });

  it("sépare canon (avec source d'univers) et original (sans source)", async () => {
    const report = await loadContent(readJsonFromDisk);
    const pack = report.content.packs.find((p) => p.heroes.length > 0)!;

    const canon = pack.heroes.filter((h) => h.origin === 'canon');
    const original = pack.heroes.filter((h) => h.origin === 'original');

    // La séparation est effective : les deux catégories existent et se filtrent.
    expect(canon.length).toBeGreaterThan(0);
    expect(original.length).toBeGreaterThan(0);

    // Invariant du format : `canon` ⇒ source d'univers ; `original` ⇒ pas de source.
    for (const h of canon) expect(h.source).toBeTruthy();
    for (const h of original) expect(h.source).toBeUndefined();
  });
});
