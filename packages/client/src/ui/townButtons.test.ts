import { describe, it, expect } from 'vitest';
import { townBarLayout, MAX_TOWN_BUTTONS } from './townButtons';

/** Ce que la barre d'actions rendrait pour un jeu de villes donné (lot R3, H7). */
function renderedTestIds(count: number): { townButtons: string[]; aggregateLabel: string | null } {
  const towns = Array.from({ length: count }, (_, i) => ({ id: `t${i + 1}` }));
  const layout = townBarLayout(towns);
  return {
    townButtons: layout.buttons.map((town) => `town-open-${town.id}`),
    aggregateLabel: layout.aggregate === null ? null : `Villes (${layout.aggregate})`,
  };
}

describe('townBarLayout (plafond des boutons de ville, H7)', () => {
  it('rend un bouton par ville jusqu’au plafond', () => {
    expect(renderedTestIds(1)).toEqual({ townButtons: ['town-open-t1'], aggregateLabel: null });
    expect(renderedTestIds(2)).toEqual({
      townButtons: ['town-open-t1', 'town-open-t2'],
      aggregateLabel: null,
    });
    expect(MAX_TOWN_BUTTONS).toBe(2);
  });

  it('bascule sur un bouton agrégé unique au-delà du plafond', () => {
    const five = renderedTestIds(5);
    expect(five.townButtons).toEqual([]); // aucun `town-open-*`
    expect(five.aggregateLabel).toBe('Villes (5)'); // un seul bouton, portant « 5 »
  });

  it('ne rend rien quand le joueur ne possède aucune ville', () => {
    expect(renderedTestIds(0)).toEqual({ townButtons: [], aggregateLabel: null });
  });
});
