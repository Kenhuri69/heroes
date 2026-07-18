/**
 * Classement Elo (doc 18 lot 4.2, écart E2) — math PURE et déterministe, sans
 * RNG ni date : consommée par le worker backend pour mettre à jour les scores
 * PvP à la résolution d'un match. Placée dans `engine/net` (comme `appendTurn`,
 * déjà partagée avec le serveur) plutôt que dans le worker afin d'être couverte
 * par la suite de tests moteur ; tree-shakée hors du bundle client (inutilisée
 * côté client).
 */

/** Note Elo de départ d'un nouveau joueur (convention classique). */
export const DEFAULT_ELO = 1200;

/** Facteur K standard : amplitude maximale d'un ajustement par match. */
export const DEFAULT_ELO_K = 32;

/**
 * Espérance de score de A face à B (probabilité de victoire attendue, 0..1)
 * selon la formule logistique Elo (échelle 400).
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Nouvelles notes après un match décisif entre `winnerRating` et `loserRating`.
 * Somme quasi conservée (écart de ±1 possible après arrondi entier). Une victoire
 * contre plus fort (upset) rapporte plus qu'une victoire attendue.
 */
export function computeEloUpdate(
  winnerRating: number,
  loserRating: number,
  k: number = DEFAULT_ELO_K,
): { winner: number; loser: number } {
  const expectedWin = expectedScore(winnerRating, loserRating);
  const delta = k * (1 - expectedWin);
  return {
    winner: Math.round(winnerRating + delta),
    loser: Math.round(loserRating - delta),
  };
}
