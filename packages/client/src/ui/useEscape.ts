import { useEffect } from 'preact/hooks';

/**
 * Ferme une modale à la touche Escape (accessibilité clavier, doc 08 §1).
 * Revue 2026-09 : les modales de combat ne se fermaient qu'au clic — le hook
 * factorise le listener `keydown` (démonté avec la modale).
 */
export function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
