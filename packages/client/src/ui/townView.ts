/**
 * Helpers purs de la **vue de ville** (lot R2, constats H1/H2 de
 * `.claude/plans/game-review-remediation-plan.md`).
 *
 * Isolés de `TownScreen.tsx` pour être testables sans DOM ni JSX : la préférence
 * « panorama replié » est un état de PRÉSENTATION (hors `GameState`, aucun bump
 * de sauvegarde), persistée en `localStorage` sur le même patron que
 * `ARMY_BAND_KEY` (`shell.tsx`) — lecture tolérante, écriture protégée.
 */

export const TOWN_VIEW_KEY = 'heroes.townViewCollapsed';

/**
 * Le panorama doit-il être replié à l'ouverture de la ville ?
 *
 * - Une préférence stockée gagne toujours (le joueur a choisi).
 * - Sans préférence : **replié en portrait** (constat H1 — le panorama poussait
 *   le premier contrôle du panneau actif sous le pli sur mobile), **déplié en
 *   paysage / desktop où la hauteur est disponible** (le panorama n'est pas
 *   supprimé : rejet acté §5 du plan de revue).
 *
 * Pur : les deux entrées sont injectées (`stored` = valeur `localStorage` brute
 * ou `null`, `portrait` = orientation courante).
 */
export function townViewCollapsedDefault(stored: string | null, portrait: boolean): boolean {
  if (stored !== null) return stored === '1';
  return portrait;
}

export function readTownViewCollapsed(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(TOWN_VIEW_KEY);
  } catch {
    /* stockage indisponible (navigation privée) — on retombe sur l'orientation */
  }
  let portrait = true;
  try {
    portrait = window.matchMedia('(orientation: portrait)').matches;
  } catch {
    /* matchMedia absent — portrait par défaut (le cas le plus contraint) */
  }
  return townViewCollapsedDefault(stored, portrait);
}

export function writeTownViewCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(TOWN_VIEW_KEY, collapsed ? '1' : '0');
  } catch {
    /* stockage indisponible — préférence en mémoire seule (même patron qu'ARMY_BAND_KEY) */
  }
}

/**
 * Repli **nommé** d'une vignette de bâtiment manquante (constat H2 : « marqueurs
 * anonymes »). Deux premières lettres significatives du nom localisé, en
 * capitales — un carré muet devient identifiable. Chaîne vide ⇒ `'?'` (jamais un
 * marqueur sans aucun contenu).
 */
export function buildingInitials(name: string): string {
  // Découpe sur TOUT ce qui n'est ni lettre ni chiffre (et non sur une liste de
  // séparateurs) : sinon un nom parenthésé comme « Graal (test) » rendait « G( »,
  // une initiale de ponctuation qui se lit comme un défaut d'affichage.
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
  if (words.length === 0) return '?';
  const letters = words.length >= 2 ? `${words[0]![0]!}${words[1]![0]!}` : words[0]!.slice(0, 2);
  return letters.toLocaleUpperCase();
}
