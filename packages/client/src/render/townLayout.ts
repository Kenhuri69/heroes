/**
 * Layout déterministe des emplacements de la vue de ville peinte (UX-TOWNVIEW,
 * doc 08 §2.2/§5). Chaque bâtiment reçoit une position en POURCENTAGE du panneau
 * (responsive) dérivée UNIQUEMENT de son identité (id, ordre stable) — jamais de
 * son statut : un bâtiment ne bouge donc pas quand on le construit (fidélité
 * HoMM, le Fort reste au même endroit). Défaut déterministe côté client
 * (décision UX-TOWNVIEW « A ») : aucun schéma ni donnée de layout tant que l'art
 * bespoke composable (AS-TOWNBG) n'existe pas — les positions data-driven par
 * faction arriveront en Lot 2, avec l'art.
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

/**
 * Répartit les bâtiments en gradins de village sur le décor : rangées décalées
 * (masonry), rangée 0 au fond (haut, petit), dernière au premier plan (bas). Une
 * gigue déterministe (±) casse l'alignement mécanique sans jamais sortir du cadre
 * (positions bornées à [8,92] × [15,85]).
 */
export function townLayout(buildingIds: readonly string[]): Map<string, TownSlot> {
  const ids = [...buildingIds].sort((a, b) => a.localeCompare(b));
  const n = ids.length;
  const map = new Map<string, TownSlot>();
  if (n === 0) return map;
  const perRow = Math.max(3, Math.min(6, Math.round(Math.sqrt(n * 1.6))));
  const rows = Math.ceil(n / perRow);
  for (let i = 0; i < n; i++) {
    const id = ids[i]!;
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    // Décalage d'une demi-cellule sur les rangées impaires (aspect masonry).
    const stagger = row % 2 === 1 ? 40 / perRow : 0;
    let x = 10 + (col + 0.5) * (80 / inRow) + stagger;
    let y = rows === 1 ? 50 : 22 + row * (58 / (rows - 1));
    x = Math.max(8, Math.min(92, x + jitter(id, 1) * 2.5));
    y = Math.max(15, Math.min(85, y + jitter(id, 2) * 2));
    map.set(id, { x, y });
  }
  return map;
}
