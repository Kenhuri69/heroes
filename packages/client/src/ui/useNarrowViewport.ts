import { useEffect, useState } from 'preact/hooks';

/** Seuil « portrait étroit » — MÊME valeur que les media queries de `combat.css`/`town.css`. */
const NARROW_VIEWPORT_QUERY = '(max-width: 640px)';

/**
 * Portrait étroit — seul cas du client où la largeur doit être connue en JS (le
 * reste de la responsivité reste en CSS) :
 * - combat (lot R1 / H5) : la barre d'actions y replie les actions de héros dans
 *   le tiroir « ⋯ » au-delà du cran de police 1 ;
 * - écran de ville (lot R2 / H1) : libellés d'en-tête en forme courte, et
 *   panorama replié par défaut.
 */
export function useNarrowViewport(): boolean {
  const query = (): MediaQueryList | null =>
    typeof matchMedia === 'function' ? matchMedia(NARROW_VIEWPORT_QUERY) : null;
  const [narrow, setNarrow] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const onChange = (): void => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
