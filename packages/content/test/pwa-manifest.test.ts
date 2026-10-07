import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Manifeste PWA (lot 8.1, finitions LE8) : chaque icône déclarée existe, et une
 * icône **maskable** dédiée est fournie (Android découpe l'icône en cercle ou en
 * carré arrondi : sans elle, l'icône `any` est réduite dans un cadre blanc).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

describe('manifeste PWA', () => {
  const manifest = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.webmanifest'), 'utf8')) as {
    icons: ManifestIcon[];
  };

  it('chaque icône déclarée existe', () => {
    for (const icon of manifest.icons) expect(existsSync(join(DATA_DIR, icon.src)), icon.src).toBe(true);
  });

  it('déclare une icône maskable PNG d’au moins 512 px, dans une entrée à part', () => {
    const maskable = manifest.icons.filter((i) => i.purpose === 'maskable');
    expect(maskable.some((i) => i.type === 'image/png' && i.sizes === '512x512')).toBe(true);
    // Jamais « any maskable » sur la même image : le motif `any` n'a pas la marge de la zone sûre.
    expect(manifest.icons.some((i) => /any/.test(i.purpose ?? '') && /maskable/.test(i.purpose ?? ''))).toBe(false);
  });
});
