import { appStore } from './store';

/**
 * Réglages d'interface persistés en localStorage (revue 2026-07, B37) : taille
 * de police (3 crans a11y, doc 08 §4) et confirmation de fin de tour (lot M8
 * C12). Même patron que `motion.ts` : miroir du store, lecture au boot
 * (`initSettings`), écriture au changement. La langue et les volumes ont leur
 * propre module (`i18n.ts`/`audio.ts`).
 */

const K_FONT_SCALE = 'heroes.fontScale';
const K_CONFIRM_END_TURN = 'heroes.confirmEndTurn';

/** Taille de police CSS de chaque cran (doc 08 §4) — appliquée à `<html>` (rem). */
export const FONT_SCALE_PERCENT: Record<1 | 2 | 3, string> = { 1: '100%', 2: '112.5%', 3: '125%' };

function syncFontSize(scale: 1 | 2 | 3): void {
  document.documentElement.style.fontSize = FONT_SCALE_PERCENT[scale];
}

/** Applique et persiste le cran de police. */
export function applyFontScale(scale: 1 | 2 | 3): void {
  appStore.setState({ fontScale: scale });
  syncFontSize(scale);
  try {
    localStorage.setItem(K_FONT_SCALE, String(scale));
  } catch {
    /* stockage indisponible (navigation privée) — le réglage reste en mémoire */
  }
}

/** Applique et persiste l'option « confirmer la fin de tour ». */
export function setConfirmEndTurn(on: boolean): void {
  appStore.setState({ confirmEndTurn: on });
  try {
    localStorage.setItem(K_CONFIRM_END_TURN, on ? '1' : '0');
  } catch {
    /* stockage indisponible (navigation privée) — le réglage reste en mémoire */
  }
}

/** Restaure les réglages depuis le localStorage au démarrage (miroir du store). */
export function initSettings(): void {
  let fontScale: 1 | 2 | 3 = 1;
  let confirmEndTurn = true;
  try {
    const f = localStorage.getItem(K_FONT_SCALE);
    if (f === '2' || f === '3') fontScale = f === '2' ? 2 : 3;
    const c = localStorage.getItem(K_CONFIRM_END_TURN);
    if (c !== null) confirmEndTurn = c === '1';
  } catch {
    /* ignore */
  }
  appStore.setState({ fontScale, confirmEndTurn });
  syncFontSize(fontScale);
}
