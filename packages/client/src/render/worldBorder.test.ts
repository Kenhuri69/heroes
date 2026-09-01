import { describe, expect, it } from 'vitest';
import { applyWorldBackdrop, WORLD_BEDROCK_CSS, WORLD_OCEAN_CSS } from './worldBorder';

/**
 * Fond du vide au-delà de la carte (UXD-3A) : océan en surface, **roche mère**
 * au souterrain. Sans la seconde valeur, une caverne apparaissait posée sur la
 * mer. Fonction pure sur un porteur de `style` — testable sans DOM.
 */
function fakeRoot(): { style: { backgroundColor: string } } {
  return { style: { backgroundColor: '' } };
}

describe('applyWorldBackdrop', () => {
  it('peint l’océan en surface et la roche mère au souterrain', () => {
    const root = fakeRoot();
    applyWorldBackdrop(root as unknown as HTMLElement, 0);
    expect(root.style.backgroundColor).toBe(WORLD_OCEAN_CSS);
    applyWorldBackdrop(root as unknown as HTMLElement, 1);
    expect(root.style.backgroundColor).toBe(WORLD_BEDROCK_CSS);
    expect(WORLD_BEDROCK_CSS).not.toBe(WORLD_OCEAN_CSS);
  });

  it('ne casse pas quand le conteneur n’existe pas encore', () => {
    expect(() => applyWorldBackdrop(null, 1)).not.toThrow();
  });
});
