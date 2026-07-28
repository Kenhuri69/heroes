/**
 * Plafond des boutons de ville de la barre d'actions (lot R3, constat H7).
 *
 * La barre rendait UN bouton par ville possédée : en milieu/fin de partie
 * (5-10 villes) la rangée débordait et écrasait « Fin de tour ». Au-delà de
 * `MAX_TOWN_BUTTONS`, un bouton unique « Villes (N) » ouvre l'écran Royaume,
 * qui couvre déjà ce besoin. En deçà, les boutons individuels (et leurs
 * `data-testid` `town-open-<id>`) sont conservés tels quels.
 *
 * Fonction pure et générique (aucune connaissance du modèle de ville) : elle se
 * teste en unitaire, sans navigateur.
 */
export const MAX_TOWN_BUTTONS = 2;

export function townBarLayout<T>(towns: readonly T[]): {
  buttons: readonly T[];
  aggregate: number | null;
} {
  return towns.length > MAX_TOWN_BUTTONS
    ? { buttons: [], aggregate: towns.length }
    : { buttons: towns, aggregate: null };
}
