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
