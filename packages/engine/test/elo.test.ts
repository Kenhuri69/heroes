import { describe, it, expect } from 'vitest';
import { computeEloUpdate, expectedScore, DEFAULT_ELO, DEFAULT_ELO_K } from '../src/net/elo';

describe('classement Elo (doc 18 lot 4.2)', () => {
  it('espérance de score : joueurs égaux ⇒ 0.5, plus fort ⇒ > 0.5', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10);
    expect(expectedScore(1400, 1200)).toBeGreaterThan(0.5);
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5);
    // Symétrie : Ea + Eb = 1.
    expect(expectedScore(1400, 1000) + expectedScore(1000, 1400)).toBeCloseTo(1, 10);
  });

  it('joueurs égaux : le vainqueur gagne K/2, le perdant perd K/2', () => {
    const { winner, loser } = computeEloUpdate(DEFAULT_ELO, DEFAULT_ELO);
    expect(winner).toBe(DEFAULT_ELO + DEFAULT_ELO_K / 2);
    expect(loser).toBe(DEFAULT_ELO - DEFAULT_ELO_K / 2);
  });

  it('conservation quasi nulle : le gain du vainqueur ≈ la perte du perdant (±1 arrondi)', () => {
    const w0 = 1300;
    const l0 = 1100;
    const { winner, loser } = computeEloUpdate(w0, l0);
    const gain = winner - w0;
    const perte = l0 - loser;
    expect(Math.abs(gain - perte)).toBeLessThanOrEqual(1);
  });

  it('upset : battre plus fort rapporte plus que battre plus faible', () => {
    const upset = computeEloUpdate(1000, 1400); // faible bat fort
    const attendu = computeEloUpdate(1400, 1000); // fort bat faible
    expect(upset.winner - 1000).toBeGreaterThan(attendu.winner - 1400);
    // Un upset approche le gain maximal K ; une victoire attendue en donne peu.
    expect(upset.winner - 1000).toBeLessThanOrEqual(DEFAULT_ELO_K);
    expect(attendu.winner - 1400).toBeGreaterThan(0);
  });

  it('facteur K personnalisable : borne l’amplitude du gain', () => {
    const k16 = computeEloUpdate(1000, 1400, 16);
    expect(k16.winner - 1000).toBeLessThanOrEqual(16);
  });
});
