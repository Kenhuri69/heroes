/**
 * Marges d'écran réservées aux surcouches DOM du combat (lot R1 / constat B2).
 *
 * La scène réservait DEUX CONSTANTES FIGÉES (96 / 120 px) alors que le bandeau
 * d'armées et le bloc bas sont **fluides** : cran de police, avertissement de
 * riposte mortelle, tiroir « ⋯ », retour à la ligne des libellés. Mesure arène
 * 360×640 : bas réel 157 px au cran 1 et **217 px au cran 3** pour 120 réservés
 * ⇒ jusqu'à deux rangées d'hexes (et l'unique pile ennemie) cachées sous la
 * barre d'actions.
 *
 * `CombatUi` publie ici les hauteurs RÉELLEMENT mesurées (`ResizeObserver`),
 * `CombatScene` les lit dans `viewRect()` et re-`layout()` à chaque changement.
 * Même patron scène ⇄ UI que `preview.ts`.
 *
 * **Repli** : une hauteur absente (arène headless, test unitaire, rendu avant
 * montage du DOM), nulle, négative ou non finie retombe sur les constantes
 * historiques — **jamais 0** : une marge nulle recadrerait le plateau sur toute
 * la hauteur de l'écran, exactement la régression inverse.
 */

/** Repli du bandeau haut (armées + round) tant qu'aucune mesure n'est publiée. */
export const FALLBACK_INSET_TOP = 96;
/** Repli du bloc bas (préviz + avertissement + barre d'actions). */
export const FALLBACK_INSET_BOTTOM = 120;

export interface CombatInsets {
  top: number;
  bottom: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let measuredTop: number | null = null;
let measuredBottom: number | null = null;

/** Hauteur exploitable, ou `null` (⇒ repli) si absente / non positive / non finie. */
function sane(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export const combatInsets = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Publie les hauteurs mesurées ; ne notifie que si elles changent réellement. */
  set(next: { top?: number | null; bottom?: number | null }): void {
    const top = sane(next.top);
    const bottom = sane(next.bottom);
    if (top === measuredTop && bottom === measuredBottom) return;
    measuredTop = top;
    measuredBottom = bottom;
    for (const l of listeners) l();
  },
  /** Démontage de la couche DOM : retour aux marges de repli. */
  reset(): void {
    this.set({});
  },
  get(): CombatInsets {
    return {
      top: measuredTop ?? FALLBACK_INSET_TOP,
      bottom: measuredBottom ?? FALLBACK_INSET_BOTTOM,
    };
  },
};
