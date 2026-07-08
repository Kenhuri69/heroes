import { appStore } from './store';

/**
 * Réduction des animations (lot M8 C3, a11y doc 08 §4) : l'option en jeu s'UNIT
 * au réglage système `prefers-reduced-motion` — activer l'un OU l'autre coupe le
 * mouvement. Le CSS lit l'attribut `data-reduce-motion` (posé par `applyReduceMotion`)
 * OU le média ; le rendu Pixi lit `reduceMotion()`.
 */
const K_REDUCE_MOTION = 'heroes.reduceMotion';

function systemReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Vrai si le mouvement doit être coupé : option en jeu OU réglage OS. */
export function reduceMotion(): boolean {
  return appStore.getState().reduceMotionOption || systemReducedMotion();
}

/** Applique et persiste l'option ; reflète l'état effectif sur `<html data-reduce-motion>`. */
export function applyReduceMotion(on: boolean): void {
  appStore.setState({ reduceMotionOption: on });
  try {
    localStorage.setItem(K_REDUCE_MOTION, on ? '1' : '0');
  } catch {
    /* stockage indisponible (navigation privée) — l'option reste en mémoire */
  }
  syncReduceMotionAttribute();
}

/** Pose `data-reduce-motion="true"` sur `<html>` si l'option OU l'OS le demande. */
export function syncReduceMotionAttribute(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.reduceMotion = reduceMotion() ? 'true' : 'false';
}

/** Restaure l'option depuis le localStorage au démarrage (miroir du store). */
export function initReduceMotion(): void {
  let stored = false;
  try {
    stored = localStorage.getItem(K_REDUCE_MOTION) === '1';
  } catch {
    /* ignore */
  }
  appStore.setState({ reduceMotionOption: stored });
  syncReduceMotionAttribute();
}
