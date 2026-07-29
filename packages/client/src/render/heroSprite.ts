import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './tilemap';
import { ISO_TILE_H, ISO_TILE_W } from './projection';

/**
 * Hauteur du repli dessiné, en RANGÉES de losange — **même budget** que les
 * jetons peints (règle du lot R5, `isoTokenScale`). Le repli ne doit pas être
 * l'exception qui déborde.
 */
const HERO_ROWS = 1.5;

/**
 * Jeton de héros DESSINÉ (dernier repli, lot R5b) — affiché quand la faction n'a
 * ni art dédié `map/hero-<faction>` ni jeton générique `map/hero`.
 *
 * L'ancien repli était un **écusson plat** (aplat + disque blanc) posé au milieu
 * d'assets peints et ombrés en 3/4 : il lisait comme un marqueur d'UI tombé sur
 * la carte, sans indice de « héros » ni d'appartenance au-delà de la couleur.
 * On garde la **forme d'écu** — elle lit bien à cette taille, là où une
 * silhouette humanoïde de 48 px se réduit à une tache — mais on corrige ses deux
 * vrais défauts, dans la maison de style des autres replis (aplats + liseré
 * d'encre) :
 *
 * - une **ombre au sol** posée sur le losange et une **hampe plantée** : le jeton
 *   appartient au terrain au lieu d'y flotter (c'est ce qui le faisait lire comme
 *   un marqueur d'UI parmi des assets peints et ombrés) ;
 * - une **épée en pal** à la place du disque nu : elle dit « héros/armée », alors
 *   que le disque ne disait rien. La couleur du joueur reste le canal
 *   d'appartenance, doublée par la forme d'écu (2ᵉ canal, doc 08 §4).
 *
 * Déterministe (aucun aléa) et borné à {@link HERO_ROWS} rangées de losange, bord
 * bas au contact-sol de la case — comme les jetons peints.
 */
export function buildHeroSprite(color: number): Container {
  const node = new Container();
  const cx = TILE_SIZE / 2;
  // Contact-sol de la case : vertex avant du losange (cf. `isoGroundSeatY`).
  const groundY = TILE_SIZE / 2 + ISO_TILE_H / 2;
  const height = HERO_ROWS * ISO_TILE_H; // 48 px
  const topY = groundY - height;

  // Ombre portée : ellipse écrasée au ratio du losange, sous le jeton.
  node.addChild(
    new Graphics()
      .ellipse(cx, groundY - 3, ISO_TILE_W / 4, ISO_TILE_H / 5)
      .fill({ color: 0x1a1c22, alpha: 0.35 }),
  );

  // Hampe plantée au sol : donne la verticale et « pose » l'écu sur la case.
  node.addChild(
    new Graphics()
      .rect(cx - 1.5, topY + 6, 3, height - 8)
      .fill(0x6b4a2a)
      .stroke({ width: 1.5, color: 0x1a1c22 }),
  );

  // Écu à la couleur du joueur, liseré d'encre (maison de style des replis).
  const w = 15;
  const shTop = topY + 2;
  const shBot = shTop + 26;
  node.addChild(
    new Graphics()
      .poly([cx - w, shTop, cx + w, shTop, cx + w, shBot - 9, cx, shBot, cx - w, shBot - 9])
      .fill(color)
      .stroke({ width: 2, color: 0x1a1c22 }),
  );

  // Épée en pal, pointe en haut : dit « héros/armée » là où un disque nu ne
  // disait rien. La **garde épaisse + le pommeau** sont ce qui bascule la lecture
  // de « flèche » à « épée » à cette taille (une lame nue sur une barre fine se
  // lit comme un chevron).
  const bladeTop = shTop + 4;
  const guardY = shBot - 9;
  node.addChild(
    new Graphics()
      .poly([cx, bladeTop, cx + 2.5, bladeTop + 5, cx + 2.5, guardY, cx - 2.5, guardY, cx - 2.5, bladeTop + 5])
      .fill(0xe8e2d0)
      .rect(cx - 6.5, guardY, 13, 3.5)
      .fill(0xe8e2d0)
      .rect(cx - 1.5, guardY + 3.5, 3, 3)
      .fill(0xe8e2d0)
      .circle(cx, guardY + 7.5, 2.2)
      .fill(0xe8e2d0),
  );

  return node;
}
