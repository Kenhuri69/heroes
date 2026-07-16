/**
 * Layout des emplacements de la vue de ville peinte (UX-TOWNVIEW, doc 08
 * §2.2/§5). Chaque bâtiment reçoit une position en POURCENTAGE du panneau
 * (responsive) dérivée de son IDENTITÉ (id, ordre stable) — jamais de son statut :
 * un bâtiment ne bouge donc pas quand on le construit (fidélité HoMM, le Fort
 * reste au même endroit).
 *
 * Deux sources, la faction primant (UX-TOWNVIEW lot 2) :
 * - **Ancres par faction** (`anchors`, chargées depuis `assets/layouts/town-
 *   <factionId>.json` via le registre d'assets — data-driven, hors `packages/`,
 *   faction-agnostique dans le code) : emplacements calés sur le décor peint de
 *   la faction. Le i-ᵉ bâtiment (ordre id stable) prend la i-ᵉ ancre.
 * - **Défaut « au sol »** (repli, ou pour les bâtiments au-delà des ancres
 *   fournies) : les emplacements sont posés dans la **bande d'avant-plan** (tiers
 *   inférieur) plutôt que dispersés plein cadre — les bâtiments reposent sur le
 *   sol du tableau au lieu de flotter sur le ciel / le donjon central.
 */
export interface TownSlot {
  /** Centre horizontal, % de la largeur du panneau (0..100). */
  x: number;
  /** Centre vertical, % de la hauteur du panneau (0..100). */
  y: number;
}

/** Hash FNV-1a d'un id + sel → réel dans [-1, 1), pour une gigue déterministe. */
function jitter(seed: string, salt: number): number {
  let h = (0x811c9dc5 ^ salt) | 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  h ^= h >>> 15;
  return ((h >>> 0) / 0x100000000) * 2 - 1;
}

// Bande d'avant-plan du défaut : les décors peints ont leur sol praticable dans
// le tiers inférieur (le donjon héroïque occupe le haut) — on y ancre les rangées.
const BAND_TOP = 52;
const BAND_BOTTOM = 88;

/** Position par défaut du i-ᵉ bâtiment (sur n) dans la bande d'avant-plan. */
function bandSlot(id: string, index: number, count: number): TownSlot {
  const perRow = Math.max(3, Math.min(6, Math.round(Math.sqrt(count * 1.6))));
  const rows = Math.ceil(count / perRow);
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const inRow = Math.min(perRow, count - row * perRow);
  // Décalage d'une demi-cellule sur les rangées impaires (aspect masonry).
  const stagger = row % 2 === 1 ? 40 / perRow : 0;
  let x = 10 + (col + 0.5) * (80 / inRow) + stagger;
  let y = rows === 1 ? (BAND_TOP + BAND_BOTTOM) / 2 : BAND_TOP + row * ((BAND_BOTTOM - BAND_TOP) / (rows - 1));
  x = Math.max(8, Math.min(92, x + jitter(id, 1) * 2.5));
  y = Math.max(BAND_TOP - 4, Math.min(BAND_BOTTOM + 2, y + jitter(id, 2) * 2));
  return { x, y };
}

/**
 * Répartit les bâtiments sur le décor. Ordre id stable ⇒ positions stables. Si
 * `anchors` est fourni (layout bespoke de la faction), chaque bâtiment prend
 * l'ancre de même rang ; les bâtiments au-delà du nombre d'ancres retombent sur
 * la bande d'avant-plan (le catalogue peut croître sans casser le layout).
 */
export function townLayout(buildingIds: readonly string[], anchors?: readonly TownSlot[]): Map<string, TownSlot> {
  const ids = [...buildingIds].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, TownSlot>();
  ids.forEach((id, i) => {
    const anchor = anchors?.[i];
    map.set(id, anchor ?? bandSlot(id, i, ids.length));
  });
  return map;
}
