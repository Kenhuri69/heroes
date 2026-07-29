/**
 * Projection isométrique de la carte d'aventure (Lot A1, doc 02 §2.1).
 *
 * Le **moteur** reste sur une grille CARRÉE (coordonnées entières `GridPos`) :
 * seule la projection de RENDU change ici — losange 2:1 façon HoMM Online. Le
 * pathfinding A*, la vision, les coûts de terrain, la sauvegarde : inchangés.
 *
 * Convention : la tuile (0,0) a son CENTRE à l'origine du monde. `isoTileCenter`
 * et `isoWorldToTile` sont inverses l'une de l'autre — d'où la cohérence du
 * picking (tap → tuile) et du hook de test `tileToScreen`.
 */

/** Largeur/hauteur d'un losange de tuile (2:1 = look iso classique). */
export const ISO_TILE_W = 64;
export const ISO_TILE_H = 32;

/**
 * Boîte locale (px) dans laquelle chaque couche DESSINE son contenu, centrée sur
 * (BOX/2, BOX/2) — identique à l'ancien `TILE_SIZE` carré. Positionner un nœud à
 * `isoAnchor` fait tomber ce centre de contenu sur le centre du losange, sans
 * toucher au code de dessin des sprites/vignettes.
 */
const CONTENT_BOX = 64;

export interface WorldPoint {
  x: number;
  y: number;
}

/** Centre du losange de la tuile (tx,ty) en coordonnées MONDE (fractions admises). */
export function isoTileCenter(tx: number, ty: number): WorldPoint {
  return { x: (tx - ty) * (ISO_TILE_W / 2), y: (tx + ty) * (ISO_TILE_H / 2) };
}

/**
 * Coin haut-gauche de la boîte de contenu à poser sur `node.position` pour qu'un
 * contenu dessiné autour de (CONTENT_BOX/2, CONTENT_BOX/2) soit centré sur la
 * tuile. Fractions admises (interpolation d'animation).
 */
export function isoAnchor(tx: number, ty: number): WorldPoint {
  const c = isoTileCenter(tx, ty);
  return { x: c.x - CONTENT_BOX / 2, y: c.y - CONTENT_BOX / 2 };
}

/**
 * Fraction transparente SOUS le contact-sol des assets de carte 512² : leur
 * contenu opaque s'arrête vers ~87 % de la hauteur (ombre/marge en dessous).
 */
export const CONTENT_BOTTOM_MARGIN = 0.13;

/**
 * Échelle d'un jeton de carte, calée sur le LOSANGE (lot R5, constat U3).
 *
 * L'ancienne formule ajustait la plus grande dimension à une boîte **carrée** de
 * `TILE_SIZE` (64 px) : un sprite carré occupait donc 64 px de haut, soit **deux
 * rangées** de tuiles (le losange n'en fait que 32) — le jeton du héros
 * recouvrait la ville sous ses pieds et un groupe de gardiens masquait trois
 * cases. On borne ici les DEUX dimensions dans le repère du losange, en
 * préservant le ratio d'aspect :
 *
 * - hauteur ≤ `rows × ISO_TILE_H` (allocation verticale, en rangées de losange) ;
 * - largeur ≤ `cols × ISO_TILE_W`.
 *
 * `rows` est le vrai réglage : 1,5 pour un objet/gardien/héros (il déborde un peu
 * vers le haut, comme dans HoMM, sans avaler la case derrière), davantage pour un
 * point de repère majeur comme la ville.
 */
export function isoTokenScale(
  texture: { width: number; height: number },
  rows: number,
  cols = 1,
): number {
  return Math.min((ISO_TILE_W * cols) / texture.width, (ISO_TILE_H * rows) / texture.height);
}

/**
 * Ordonnée LOCALE (dans la boîte de contenu) où poser le BORD BAS `anchor(0.5, 1)`
 * d'un asset qui EMBARQUE son propre socle isométrique (mine, coffre, fontaine,
 * château…) pour que ce socle recouvre exactement le losange de la case. Le
 * contact-sol peint tombe alors sur le VERTEX AVANT du losange (centre +
 * `ISO_TILE_H/2`) ; on y ajoute la {@link CONTENT_BOTTOM_MARGIN} qui sépare le
 * contenu opaque du bord bas de l'image. Poser le bord bas AU CENTRE (ancien
 * réglage) remontait tout l'asset d'un demi-losange → il flottait au-dessus de
 * sa case. `spriteHeight` = hauteur du sprite APRÈS mise à l'échelle.
 */
export function isoGroundSeatY(spriteHeight: number): number {
  return CONTENT_BOX / 2 + ISO_TILE_H / 2 + spriteHeight * CONTENT_BOTTOM_MARGIN;
}

/** Inverse de `isoTileCenter` : point MONDE → tuile entière la plus proche (picking). */
export function isoWorldToTile(wx: number, wy: number): { x: number; y: number } {
  const a = wx / (ISO_TILE_W / 2); // = tx - ty
  const b = wy / (ISO_TILE_H / 2); // = tx + ty
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

/** Profondeur d'affichage (y-sort) : plus grand = plus « devant »/bas à l'écran. */
export function isoDepth(tx: number, ty: number): number {
  return tx + ty;
}

/** Les 4 sommets du losange d'une tuile (centre décalé), pour dessiner le sol. */
export function isoDiamond(tx: number, ty: number): number[] {
  const c = isoTileCenter(tx, ty);
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  // haut, droite, bas, gauche
  return [c.x, c.y - hh, c.x + hw, c.y, c.x, c.y + hh, c.x - hw, c.y];
}
