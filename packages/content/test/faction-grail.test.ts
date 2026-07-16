import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, type ReadJson } from '../src/loader';

/**
 * Graal signature par faction (doc 02 §2.2) — invariant de modularité : chaque
 * paquet de faction ship **exactement un** bâtiment `requiresGrail` (son Graal),
 * listé dans `town.buildings`, avec une clé de nom résolue en fr ET en. Le Graal
 * réutilise un effet de bâtiment générique existant (zéro diff moteur) : ce test
 * ancre la migration « Graal core universel → Graal par faction » et casse si un
 * paquet perd son Graal ou l'oublie dans le manifeste.
 *
 * Faction-agnostique : on itère les paquets réellement chargés, aucun id littéral
 * de faction (garde-fou de modularité, ci.yml).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('Graal signature par faction (doc 02 §2.2)', () => {
  it('chaque paquet ship un Graal (requiresGrail) listé et localisé', async () => {
    const { content } = await loadContent(readJsonFromDisk);
    expect(content.packs.length).toBeGreaterThan(0);
    for (const pack of content.packs) {
      const grails = pack.buildings.filter((b) => b.requiresGrail === true);
      expect(grails.length, `${pack.manifest.id} devrait ship exactement un Graal`).toBe(1);
      const grail = grails[0]!;
      expect(
        pack.manifest.town?.buildings.includes(grail.id),
        `${grail.id} devrait être dans town.buildings de ${pack.manifest.id}`,
      ).toBe(true);
      const nameKey = `building.${grail.id}`;
      expect(nameKey in pack.locales.fr, `${nameKey} manquant en fr`).toBe(true);
      expect(nameKey in pack.locales.en, `${nameKey} manquant en en`).toBe(true);
    }
  });

  it('aucun Graal universel (core) ne subsiste', async () => {
    const core = (await readJsonFromDisk('core/buildings.json')) as { buildings: { requiresGrail?: boolean }[] };
    expect(core.buildings.some((b) => b.requiresGrail === true)).toBe(false);
  });
});
