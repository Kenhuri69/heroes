/**
 * Bandes de force des gardiens (doc 02 §2.2) : `display.strengthBands` définit 7
 * bandes (few→legion). Le libellé localisé reste la source au survol/appui long ;
 * la **gradation visuelle** (A1, sprint 2) réduit ces 7 bandes à **3 crans** pour
 * le rendu du jeton — l'effectif exact n'est jamais révélé.
 */

export type BandTier = 'lone' | 'group' | 'horde';

/** Clé de bande de force pour un effectif — première bande dont `max` couvre `count`. */
export function strengthBandKey(count: number, bands: { max: number | null; key: string }[]): string {
  return bands.find((b) => b.max === null || count <= b.max)?.key ?? '';
}

/** Réduit les 7 bandes aux 3 crans visuels : solitaire / groupe / horde. */
export function bandTier(bandKey: string): BandTier {
  if (bandKey === 'horde' || bandKey === 'throng' || bandKey === 'legion') return 'horde';
  if (bandKey === 'pack' || bandKey === 'lots') return 'group';
  return 'lone';
}
