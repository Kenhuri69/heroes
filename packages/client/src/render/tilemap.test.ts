import { describe, expect, it } from 'vitest';
import { fitsFlatTexture, MAX_FLAT_TEXTURE_PX } from './tilemap';

/**
 * Revue 2026-09 (R4) : le seuil d'aplatissement de la carte en UNE texture est
 * compté en pixels PHYSIQUES (résolution de rendu) et arrondi à la puissance de
 * 2 comme le fait Pixi — une carte Moyenne 36² sur mobile DPR 2 ne doit plus
 * demander une texture 8192×4096.
 */
describe('fitsFlatTexture', () => {
  it('petite/moyenne carte à DPR 1 : aplatie (comme avant)', () => {
    expect(fitsFlatTexture(24, 24, 1)).toBe(true);
    expect(fitsFlatTexture(36, 36, 1)).toBe(true);
    expect(fitsFlatTexture(48, 48, 1)).toBe(true); // 3072 px ⇒ pow2 4096 ≤ cap
  });

  it('carte Moyenne 36² à DPR 2 : 2304 px CSS ⇒ 4608 px physiques ⇒ pow2 8192 > cap ⇒ culée', () => {
    expect(fitsFlatTexture(36, 36, 2)).toBe(false);
    expect(fitsFlatTexture(24, 24, 2)).toBe(true); // 1536 × 2 = 3072 ⇒ 4096 : OK
  });

  it('grande carte : toujours culée', () => {
    expect(fitsFlatTexture(128, 128, 1)).toBe(false);
    expect(fitsFlatTexture(512, 512, 1)).toBe(false);
  });

  it('le plafond est 4096 px physiques', () => {
    expect(MAX_FLAT_TEXTURE_PX).toBe(4096);
  });
});
