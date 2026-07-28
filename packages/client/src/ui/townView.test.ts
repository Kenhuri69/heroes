import { describe, expect, it } from 'vitest';
import { buildingInitials, townViewCollapsedDefault } from './townView';

/**
 * Lot R2 (constats H1/H2) — helpers purs de la vue de ville. Le câblage DOM
 * (bascule, étiquette, position du premier contrôle sous/au-dessus du pli) est
 * couvert par le smoke `@mobile` ; ici on ne teste que les décisions pures.
 */
describe('townViewCollapsedDefault', () => {
  it('replie par défaut en portrait quand aucune préférence n’est stockée', () => {
    expect(townViewCollapsedDefault(null, true)).toBe(true);
  });

  it('déplie par défaut en paysage/desktop (la hauteur y est disponible)', () => {
    expect(townViewCollapsedDefault(null, false)).toBe(false);
  });

  it('la préférence stockée prime sur l’orientation, dans les deux sens', () => {
    expect(townViewCollapsedDefault('0', true)).toBe(false); // déplié choisi en portrait
    expect(townViewCollapsedDefault('1', false)).toBe(true); // replié choisi en paysage
  });
});

describe('buildingInitials', () => {
  it('prend l’initiale des deux premiers mots', () => {
    expect(buildingInitials('Hôtel de ville')).toBe('HD');
    expect(buildingInitials('Town Hall')).toBe('TH');
  });

  it('prend les deux premières lettres d’un mot unique', () => {
    expect(buildingInitials('Forge')).toBe('FO');
  });

  it('coupe aussi sur apostrophes et tirets', () => {
    expect(buildingInitials("Guilde d'or")).toBe('GD');
    expect(buildingInitials('Sous-sol')).toBe('SS');
  });

  it('ignore la ponctuation au lieu d’en faire une initiale', () => {
    // Régression observée en capture : « Graal (test) » rendait « G( » sur le
    // marqueur — une parenthèse lue comme un glyphe cassé, alors que le repli
    // est justement là pour NOMMER le bâtiment (constat H2).
    expect(buildingInitials('Graal (test)')).toBe('GT');
    expect(buildingInitials('« Choixpeau »')).toBe('CH');
  });

  it('ne rend jamais un marqueur vide', () => {
    expect(buildingInitials('')).toBe('?');
    expect(buildingInitials('   ')).toBe('?');
  });
});
