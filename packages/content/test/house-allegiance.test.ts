import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { houseSchema } from '../src/schemas';
import { buildHouseCatalog, loadContent, PackError, type LoadReport, type ReadJson } from '../src/loader';

const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');
const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

/**
 * Maisons de faction (doc 16 §3.1, signature `houseAllegiance`) — schéma de
 * contenu + construction du catalogue. Garde-fou CI « zéro nom de faction » :
 * ids FICTIFS uniquement ('house-lion', 'pack-0'…).
 */

describe('houseAllegiance — schéma de Maison', () => {
  it('accepte une Maison valide', () => {
    const r = houseSchema.safeParse({
      id: 'house-lion',
      name: '@loc:house.house-lion',
      effects: [{ goldPerDay: 250, moraleBonus: 1 }],
    });
    expect(r.success).toBe(true);
  });

  it('refuse un effet vide (mensonge de contenu)', () => {
    const r = houseSchema.safeParse({
      id: 'house-x',
      name: '@loc:house.house-x',
      effects: [{}],
    });
    expect(r.success).toBe(false);
  });

  it('refuse une Maison sans aucun effet', () => {
    const r = houseSchema.safeParse({
      id: 'house-x',
      name: '@loc:house.house-x',
      effects: [],
    });
    expect(r.success).toBe(false);
  });
});

describe('houseAllegiance — buildHouseCatalog', () => {
  const report = (packsHouses: unknown[][]): LoadReport =>
    ({
      content: {
        packs: packsHouses.map((houses, i) => ({ manifest: { id: `pack-${i}`, houses } })),
      },
    }) as unknown as LoadReport;

  it('indexe les Maisons par id', () => {
    const cat = buildHouseCatalog(
      report([[{ id: 'house-lion', name: '@loc:house.house-lion', effects: [{ meleeDamagePct: 10 }] }]]),
    );
    expect(cat['house-lion']?.effects).toEqual([{ meleeDamagePct: 10 }]);
  });

  it('rejette un id de Maison en double (tous paquets confondus)', () => {
    const dup = [{ id: 'house-a', name: '@loc:house.house-a', effects: [{ goldPerDay: 1 }] }];
    expect(() => buildHouseCatalog(report([dup, dup]))).toThrow(PackError);
  });
});

describe('houseAllegiance — données réelles (faction académie)', () => {
  it('la faction qui déclare des Maisons en résout un catalogue non vide et bien formé', async () => {
    // Trouve la faction PAR SA SIGNATURE (déclare des Maisons), sans la nommer —
    // le garde-fou CI interdit un id de faction dans packages/.
    const reportContent = await loadContent(readJsonFromDisk);
    expect(reportContent.rejected).toEqual([]);
    const withHouses = reportContent.content.packs.filter((p) => p.manifest.houses.length > 0);
    expect(withHouses.length).toBeGreaterThanOrEqual(1);

    const catalog = buildHouseCatalog(reportContent);
    const ids = Object.keys(catalog);
    expect(ids.length).toBeGreaterThanOrEqual(5); // les 5 Maisons de l'académie
    for (const id of ids) {
      expect(catalog[id]?.effects.length).toBeGreaterThan(0); // pas de Maison sans effet
    }
  });
});
