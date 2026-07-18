/**
 * Bornage du pan de la caméra (E10, plan `ux-lot1b-combat-camera`). Pur, sans
 * dépendance Pixi/DOM ⇒ testable en unitaire. Empêche de faire glisser le
 * contenu (plateau de combat) entièrement hors de l'aire de jeu :
 *
 * - contenu PLUS GRAND que l'aire : il doit toujours la COUVRIR (aucune bande de
 *   fond ne peut apparaître au bord — on ne peut pas « perdre » le plateau) ;
 * - contenu PLUS PETIT : il reste ENTIÈREMENT dans l'aire (il peut coulisser mais
 *   pas déborder).
 *
 * Coordonnées écran : un point de contenu `c` (repère local du `world`) est rendu
 * en `worldPos + c * scale`. On borne donc `worldPos` par axe.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Bornes du contenu dans le repère local du `world` (avant mise à l'échelle). */
export interface ContentBounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

function clampAxis(
  coord: number,
  scale: number,
  contentMin: number,
  contentSize: number,
  viewMin: number,
  viewSize: number,
): number {
  const size = contentSize * scale;
  const edge = coord + contentMin * scale; // bord (haut/gauche) du contenu à l'écran
  let lo: number;
  let hi: number;
  if (size >= viewSize) {
    // Contenu plus grand : il couvre l'aire ⇒ bord ∈ [viewMin+viewSize−size, viewMin].
    lo = viewMin + viewSize - size;
    hi = viewMin;
  } else {
    // Contenu plus petit : il reste dans l'aire ⇒ bord ∈ [viewMin, viewMin+viewSize−size].
    lo = viewMin;
    hi = viewMin + viewSize - size;
  }
  const clampedEdge = Math.min(hi, Math.max(lo, edge));
  return coord + (clampedEdge - edge);
}

/**
 * Position `world` bornée pour que `content` (à `scale`) reste dans/sur `view`.
 * Renvoie la position corrigée (identité si déjà dans les bornes).
 */
export function clampWorldPosition(
  pos: { x: number; y: number },
  scale: number,
  content: ContentBounds,
  view: Rect,
): { x: number; y: number } {
  return {
    x: clampAxis(pos.x, scale, content.minX, content.width, view.x, view.width),
    y: clampAxis(pos.y, scale, content.minY, content.height, view.y, view.height),
  };
}

/**
 * Le point de contenu `c` est-il visible dans `view` à (`pos`, `scale`) ?
 * Sert au re-fit conservateur (E10) : ne recentrer sur la pile active au resize
 * QUE si elle est devenue invisible — sinon on préserve le pan de l'utilisateur.
 */
export function isContentPointVisible(
  c: { x: number; y: number },
  pos: { x: number; y: number },
  scale: number,
  view: Rect,
): boolean {
  const sx = pos.x + c.x * scale;
  const sy = pos.y + c.y * scale;
  return sx >= view.x && sx <= view.x + view.width && sy >= view.y && sy <= view.y + view.height;
}
