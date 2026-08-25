import { describe, expect, it } from 'vitest';
import { isGateBroken } from './siegeWall';

/**
 * Porte brisée (dernier item du Lot 3 de `siege-visual-overhaul`) : le prédicat
 * qui décide si le gatehouse montre son art défoncé. Pur ⇒ testable sans Pixi.
 */
describe('isGateBroken', () => {
  it('porte intacte tant que l’état initial n’est pas relevé', () => {
    expect(isGateBroken(null, new Set([0, 1, 2]))).toBe(false);
  });

  it('porte intacte quand aucun segment initial n’est tombé', () => {
    const initial = new Set([0, 1, 2, 7, 8, 9]);
    expect(isGateBroken(initial, new Set([0, 1, 2, 7, 8, 9]))).toBe(false);
  });

  it('porte brisée dès qu’un segment muré au départ a été abattu', () => {
    const initial = new Set([0, 1, 2, 7, 8, 9]);
    expect(isGateBroken(initial, new Set([0, 1, 7, 8, 9]))).toBe(true);
  });

  it('les rangées ouvertes AU SETUP (brèche de catapulte) ne brisent pas la porte', () => {
    // Rangées 3 et 6 déjà ouvertes au setup ⇒ absentes de l'état initial : leur
    // absence ne doit jamais compter comme une percée.
    const initial = new Set([0, 1, 2, 7, 8, 9]);
    expect(isGateBroken(initial, new Set([0, 1, 2, 7, 8, 9]))).toBe(false);
  });
});
