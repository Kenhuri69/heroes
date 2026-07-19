/**
 * Bascule plein écran (E15, plan `game-ergonomics-immersion-review`) : fins
 * gardes autour de la Fullscreen API du navigateur. Purement présentation —
 * aucun état de jeu, aucune persistance (le plein écran appartient au
 * navigateur). No-op si l'API est absente (certains mobiles) ou hors DOM (tests).
 */
export function fullscreenSupported(): boolean {
  return typeof document !== 'undefined' && typeof document.documentElement?.requestFullscreen === 'function';
}

export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenElement != null;
}

export function toggleFullscreen(): void {
  if (!fullscreenSupported()) return;
  if (isFullscreen()) {
    void document.exitFullscreen?.().catch(() => {});
  } else {
    void document.documentElement.requestFullscreen().catch(() => {});
  }
}
