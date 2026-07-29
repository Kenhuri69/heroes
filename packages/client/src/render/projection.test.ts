import { describe, expect, it } from 'vitest';
import { ISO_TILE_H, ISO_TILE_W, isoTokenScale } from './projection';

/**
 * Lot R5 (constat U3) : les jetons de carte étaient mis à l'échelle sur une boîte
 * CARRÉE de `TILE_SIZE` (64 px) alors qu'un losange mesure 64 × 32 — un sprite
 * carré occupait donc **deux rangées** de tuiles (le héros recouvrait la ville
 * sous ses pieds, un groupe de gardiens masquait trois cases). `isoTokenScale`
 * borne les deux dimensions dans le repère du losange.
 */
describe('isoTokenScale (R5, U3)', () => {
  const square = { width: 512, height: 512 };

  it('borne la hauteur à l’allocation en rangées de losange', () => {
    const s = isoTokenScale(square, 1.5);
    expect(square.height * s).toBeCloseTo(1.5 * ISO_TILE_H); // 48 px, pas 64
    expect(square.width * s).toBeLessThanOrEqual(ISO_TILE_W);
  });

  it('borne aussi la largeur (sprite très large)', () => {
    const wide = { width: 1024, height: 256 };
    const s = isoTokenScale(wide, 1.5);
    expect(wide.width * s).toBeCloseTo(ISO_TILE_W);
    expect(wide.height * s).toBeLessThanOrEqual(1.5 * ISO_TILE_H);
  });

  it('préserve le ratio d’aspect', () => {
    const tall = { width: 256, height: 512 };
    const s = isoTokenScale(tall, 2);
    expect((tall.width * s) / (tall.height * s)).toBeCloseTo(tall.width / tall.height);
  });

  it('l’allocation en rangées pilote la hauteur (ville > objet)', () => {
    expect(square.height * isoTokenScale(square, 2)).toBeGreaterThan(
      square.height * isoTokenScale(square, 1.5),
    );
  });

  it('reste sous les deux tuiles de haut de l’ancienne formule', () => {
    const before = 64 / Math.max(square.width, square.height); // ancienne boîte carrée
    expect(isoTokenScale(square, 1.5)).toBeLessThan(before);
  });
});
