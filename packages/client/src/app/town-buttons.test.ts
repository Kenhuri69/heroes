import { describe, expect, it } from 'vitest';
import { MAX_TOWN_BUTTONS, collapseTownButtons } from './game';

/**
 * Lot R3 (constat H7) : la barre d'actions rendait UN bouton par ville possédée
 * (`towns.map`), sans plafond — en milieu/fin de partie (5-10 villes) la rangée
 * débordait ou écrasait « Fin de tour ». Le plafond borne la navigation à
 * 6 boutons quelle que soit la partie, ce qui est la condition de la rangée unique.
 */
describe('plafond des boutons de ville (R3, H7)', () => {
  it('laisse les boutons individuels jusqu’au plafond', () => {
    expect(collapseTownButtons(0)).toBe(false);
    expect(collapseTownButtons(1)).toBe(false);
    expect(collapseTownButtons(MAX_TOWN_BUTTONS)).toBe(false);
  });

  it('replie derrière « Villes (N) » au-delà du plafond', () => {
    expect(collapseTownButtons(MAX_TOWN_BUTTONS + 1)).toBe(true);
    expect(collapseTownButtons(5)).toBe(true);
    expect(collapseTownButtons(10)).toBe(true);
  });
});
