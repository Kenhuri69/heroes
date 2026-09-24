import { useEffect, useRef } from 'preact/hooks';

/**
 * Pile LIFO des couches fermables à Échap (revue 2026-09b E17). Avant : chaque
 * overlay posait son propre listener `keydown` ET le Shell appelait `back()` —
 * un seul Échap fermait DEUX couches (ex. l'aide des raccourcis ouverte depuis
 * Options fermait Options entier). Désormais un unique listener en phase de
 * CAPTURE ne ferme que la couche du dessus (la dernière montée) et arrête
 * l'événement : le `back()` du Shell (phase de bouillonnement) ne s'exécute que
 * si aucune couche locale n'est ouverte.
 */
const stack: { current: () => void }[] = [];
let installed = false;

function install(): void {
  if (installed) return;
  installed = true;
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      const top = stack[stack.length - 1];
      if (!top) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      top.current();
    },
    { capture: true },
  );
}

/**
 * Ferme une couche à la touche Échap (accessibilité clavier, doc 08 §1). `active`
 * permet aux overlays toujours montés (fiches, confirmations) de ne s'empiler que
 * lorsqu'ils sont visibles. Le gestionnaire courant est lu par ref : un re-rendu
 * ne fait pas remonter la couche en haut de pile.
 */
export function useEscape(onClose: () => void, active = true): void {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    install();
    stack.push(ref);
    return () => {
      const i = stack.lastIndexOf(ref);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
