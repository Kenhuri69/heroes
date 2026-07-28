import { afterEach, describe, expect, it, vi } from 'vitest';
import { combatInsets, FALLBACK_INSET_BOTTOM, FALLBACK_INSET_TOP } from './insets';

/**
 * Lot R1 (B2) : marges d'écran réservées aux surcouches DOM du combat. Le point
 * critique est le REPLI — quand le DOM n'est pas monté (arène headless, test
 * unitaire, rendu avant montage) ou publie une hauteur inutilisable, la marge doit
 * revenir aux constantes historiques et JAMAIS tomber à 0 : une marge nulle
 * recadrerait le plateau sur toute la hauteur de l'écran (régression inverse).
 */
describe('combatInsets', () => {
  afterEach(() => combatInsets.reset());

  it('sans mesure publiée, rend les marges de repli (jamais 0)', () => {
    expect(combatInsets.get()).toEqual({ top: FALLBACK_INSET_TOP, bottom: FALLBACK_INSET_BOTTOM });
    expect(FALLBACK_INSET_TOP).toBeGreaterThan(0);
    expect(FALLBACK_INSET_BOTTOM).toBeGreaterThan(0);
  });

  it('adopte les hauteurs mesurées (cas du cran 3 : 91 / 217)', () => {
    combatInsets.set({ top: 91, bottom: 217 });
    expect(combatInsets.get()).toEqual({ top: 91, bottom: 217 });
  });

  it('retombe sur le repli pour une hauteur nulle, négative ou non finie', () => {
    const bads: (number | null)[] = [0, -12, Number.NaN, Number.POSITIVE_INFINITY, null];
    for (const bad of bads) {
      combatInsets.set({ top: bad, bottom: bad });
      expect(combatInsets.get()).toEqual({ top: FALLBACK_INSET_TOP, bottom: FALLBACK_INSET_BOTTOM });
    }
    // Champ carrément absent (élément DOM non monté) : même repli.
    combatInsets.set({});
    expect(combatInsets.get()).toEqual({ top: FALLBACK_INSET_TOP, bottom: FALLBACK_INSET_BOTTOM });
  });

  it('repli indépendant par côté (une seule surcouche mesurée)', () => {
    combatInsets.set({ bottom: 157 });
    expect(combatInsets.get()).toEqual({ top: FALLBACK_INSET_TOP, bottom: 157 });
  });

  it('reset() (démontage du DOM) revient au repli', () => {
    combatInsets.set({ top: 91, bottom: 217 });
    combatInsets.reset();
    expect(combatInsets.get()).toEqual({ top: FALLBACK_INSET_TOP, bottom: FALLBACK_INSET_BOTTOM });
  });

  it('notifie les abonnés au changement, pas sur une republication identique', () => {
    const fn = vi.fn();
    const off = combatInsets.subscribe(fn);
    combatInsets.set({ top: 86, bottom: 157 });
    combatInsets.set({ top: 86, bottom: 157 });
    expect(fn).toHaveBeenCalledTimes(1);
    combatInsets.set({ top: 86, bottom: 168 });
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    combatInsets.set({ top: 91, bottom: 217 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
