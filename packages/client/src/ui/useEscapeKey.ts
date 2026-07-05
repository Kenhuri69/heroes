import { useEffect } from 'preact/hooks';

/**
 * Ferme une modale à la touche Échap (doc 08 §3). Hook partagé — évite de
 * dupliquer l'abonnement `keydown` window dans chaque panneau. Les modales du
 * jeu ne coexistent pas (ville OU options), donc pas de pile de handlers : un
 * simple hook réutilisable suffit.
 */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape]);
}
