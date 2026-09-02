/**
 * Palette des surfaces qui NE PEUVENT PAS lire `tokens.css` : contexte canvas 2D
 * (mini-carte) et attributs de présentation SVG inline (`fill="…"`, qui ne
 * résolvent pas `var(--…)`). Tout le reste du DOM stylé prend ses couleurs dans
 * `ui/tokens.css` — invariant UXD-1, vérifié en CI.
 *
 * Revue 2026-09 (suite) : ces littéraux étaient dispersés dans trois composants
 * TSX, hors de portée du garde-fou CI (qui ne balayait que les `*.css`). Ils
 * vivent désormais ICI, et le garde-fou couvre aussi les `*.tsx`.
 */

/** Couleurs de bannière de faction — complètent un motif, jamais seul signal (doc 08 §4). */
export const FACTION_COLORS = [
  '#c0392b',
  '#2980b9',
  '#27ae60',
  '#8e44ad',
  '#c9971f',
  '#16a085',
  '#d35400',
  '#546e7a',
] as const;

/** Repli de couleur de bannière (identique au dernier ton de la palette). */
export const FACTION_COLOR_FALLBACK = '#546e7a';

/** Liseré du badge de faction (parchemin clair) et trait des motifs. */
export const BADGE_STROKE = '#e8e2d0';
export const BADGE_GLYPH = '#f5f3ec';

/** Teintes catégorielles (thème sombre) du graphe de puissance — par joueur, pas par rang. */
export const SERIES_COLORS = ['#3987e5', '#199e70', '#c98500', '#9085e9'] as const;

/** Contour de la barre du joueur humain dans le graphe de puissance. */
export const SERIES_HUMAN_STROKE = '#ffffff';

/** Mini-carte : tuile jamais explorée. */
export const MINIMAP_UNEXPLORED = '#0b0e14';

/** Mini-carte : terrain connu (nuances plus claires que le rendu Pixi, pour la lisibilité en petit). */
export const MINIMAP_TERRAIN: Record<string, string> = {
  grass: '#3a5a34',
  dirt: '#8a6a44',
  sand: '#ccb680',
  forest: '#274a24',
  rough: '#8a7f58',
  snow: '#dfe6ee',
  swamp: '#4a5a2c',
  river: '#3f7aa6',
  water: '#24406a',
  mountain: '#6a5f56',
  rocks: '#7a766f',
  cave: '#544d46',
  'cave-wall': '#2e2c33',
};

/** Mini-carte : terrain inconnu du catalogue (ne doit jamais arriver — filet visuel). */
export const MINIMAP_DEFAULT = '#3a3d47';
