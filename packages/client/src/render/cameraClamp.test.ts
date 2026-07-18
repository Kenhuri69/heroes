import { describe, expect, it } from 'vitest';
import { clampWorldPosition, isContentPointVisible, type ContentBounds, type Rect } from './cameraClamp';

/**
 * Bornage du pan (E10) — pur, testable sans Pixi. Aire de jeu = [0,0,400×600]
 * (viewport portrait typique moins les marges d'en-tête/barre d'actions).
 */
const view: Rect = { x: 0, y: 0, width: 400, height: 600 };

describe('clampWorldPosition — le contenu ne peut pas quitter l’aire', () => {
  // Contenu plus GRAND que l'aire (plateau qui déborde en portrait, scale plancher).
  const big: ContentBounds = { minX: 0, minY: 0, width: 600, height: 900 };

  it('contenu plus grand : une position centrée reste inchangée', () => {
    // Centré : bord haut/gauche à ((view−size)/2) = (-100, -150).
    const pos = { x: -100, y: -150 };
    expect(clampWorldPosition(pos, 1, big, view)).toEqual(pos);
  });

  it('contenu plus grand : un pan excessif est ramené pour couvrir l’aire', () => {
    // Tiré loin en bas à droite (bord gauche à +500) ⇒ on perdrait le plateau.
    const clamped = clampWorldPosition({ x: 500, y: 400 }, 1, big, view);
    // Bord gauche borné à 0 (max), bord haut à 0.
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
    // Et le bord droit couvre toujours l’aire : x + width ≥ view.width.
    expect(clamped.x + big.width * 1).toBeGreaterThanOrEqual(view.width);
  });

  it('contenu plus grand : borne basse = le bord droit/bas touche l’aire', () => {
    const clamped = clampWorldPosition({ x: -9999, y: -9999 }, 1, big, view);
    expect(clamped.x).toBe(view.width - big.width); // -200
    expect(clamped.y).toBe(view.height - big.height); // -300
  });

  // Contenu plus PETIT que l'aire (plateau qui tient : centré, pas de pan utile).
  const small: ContentBounds = { minX: 0, minY: 0, width: 200, height: 300 };

  it('contenu plus petit : reste entièrement dans l’aire (pas de débordement)', () => {
    const clamped = clampWorldPosition({ x: 350, y: 550 }, 1, small, view);
    // Bord gauche borné à [0, view.width−size] = [0, 200].
    expect(clamped.x).toBe(200);
    expect(clamped.y).toBe(300);
  });

  it('respecte minX/minY du contenu (offset de repère non nul)', () => {
    const offset: ContentBounds = { minX: 50, minY: 20, width: 600, height: 900 };
    const clamped = clampWorldPosition({ x: 999, y: 999 }, 1, offset, view);
    // Bord gauche du contenu = x + minX*scale ; borné à ≤ view.x (0).
    expect(clamped.x + offset.minX).toBeLessThanOrEqual(0.0001);
  });

  it('tient compte de l’échelle (scale ≠ 1)', () => {
    // width 300 × scale 2 = 600 > 400 ⇒ règle « couvre l’aire ».
    const c: ContentBounds = { minX: 0, minY: 0, width: 300, height: 100 };
    const clamped = clampWorldPosition({ x: 500, y: 0 }, 2, c, view);
    expect(clamped.x).toBe(0);
    expect(clamped.x + c.width * 2).toBeGreaterThanOrEqual(view.width);
  });
});

describe('isContentPointVisible — re-fit conservateur', () => {
  const view2: Rect = { x: 0, y: 100, width: 400, height: 400 };
  it('point à l’intérieur ⇒ visible', () => {
    expect(isContentPointVisible({ x: 100, y: 100 }, { x: 0, y: 0 }, 1, view2)).toBe(true);
  });
  it('point au-dessus de l’aire ⇒ invisible', () => {
    expect(isContentPointVisible({ x: 100, y: 0 }, { x: 0, y: 0 }, 1, view2)).toBe(false);
  });
  it('point poussé hors de l’aire par le pan ⇒ invisible', () => {
    // point (100,200) rendu à (100 + (−350), 200) = (−250, 200) ⇒ x hors [0,400].
    expect(isContentPointVisible({ x: 100, y: 200 }, { x: -350, y: 0 }, 1, view2)).toBe(false);
  });
});
