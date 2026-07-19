import { describe, expect, it } from 'vitest';
import { fullscreenSupported, isFullscreen, toggleFullscreen } from './fullscreen';

/**
 * E15 (reliquat) : les helpers de plein écran sont de fins wrappers GARDÉS de la
 * Fullscreen API. En environnement node (vitest, aucun `document`), tout doit
 * dégrader silencieusement — pas de crash, pas de faux « supporté ».
 */
describe('fullscreen helpers (env node, aucun document)', () => {
  it('signale l\'absence de support', () => {
    expect(fullscreenSupported()).toBe(false);
  });

  it('n\'est jamais en plein écran', () => {
    expect(isFullscreen()).toBe(false);
  });

  it('toggle est un no-op sûr', () => {
    expect(() => toggleFullscreen()).not.toThrow();
  });
});
