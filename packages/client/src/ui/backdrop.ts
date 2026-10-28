/**
 * Fermeture d'une modale au clic sur son fond. Le clic doit viser le fond
 * lui-même : se fier au `stopPropagation` du panneau ne suffit pas, car depuis
 * Preact 11 une couche démontée pendant le clic (bouton « fermer » d'une aide
 * ouverte depuis Options) perd ses écouteurs et laisse le clic remonter jusqu'au
 * fond de la modale parente, qui se fermait aussi.
 */
export function closeOnBackdrop(onClose: () => void): (e: MouseEvent) => void {
  return (e) => {
    if (e.target === e.currentTarget) onClose();
  };
}
