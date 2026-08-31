import { describe, expect, it } from 'vitest';
import { DIFFICULTY_TUNING_FOR_TESTS, seatEconomy } from './game';

/**
 * Lot L5 : le cran de difficulté ne vit QUE côté client — il est projeté en
 * pourcentages économiques opaques sur les sièges IA. Le moteur, lui, ne voit
 * jamais d'enum (invariant README §1 étendu : pas plus de « difficulté » que de
 * faction dans le moteur).
 */
describe('difficulté — profil économique du siège IA', () => {
  it('ne pose aucun profil sur un siège humain, quel que soit le cran', () => {
    for (const level of ['facile', 'normal', 'difficile'] as const) {
      expect(seatEconomy(DIFFICULTY_TUNING_FOR_TESTS[level], false)).toEqual({});
    }
  });

  it('laisse le cran normal neutre (aucun champ ⇒ sauvegarde inchangée)', () => {
    expect(seatEconomy(DIFFICULTY_TUNING_FOR_TESTS.normal, true)).toEqual({});
  });

  it('handicape l’IA en facile et l’avantage en difficile, dans la durée', () => {
    expect(seatEconomy(DIFFICULTY_TUNING_FOR_TESTS.facile, true)).toEqual({
      economyBonus: { incomePercent: -25, growthPercent: -25 },
    });
    expect(seatEconomy(DIFFICULTY_TUNING_FOR_TESTS.difficile, true)).toEqual({
      economyBonus: { incomePercent: 50, growthPercent: 25 },
    });
  });
});
