import { describe, expect, it } from 'vitest';
import { MAP_SIZE_DIMENSIONS, quickStartConfig, RANDOM, resolveNewGameConfig } from './game';

/**
 * Préréglage « Démarrage rapide » (lot R4) : logique pure — 2 joueurs, factions
 * aléatoires, carte moyenne, tout le reste au standard. La reproductibilité est
 * vérifiée au niveau de `resolveNewGameConfig` : à graine égale, les tirages
 * (RNG seedé moteur) rendent exactement la même configuration résolue.
 */
const COLORS = [0x111111, 0x222222, 0x333333] as const;
const FACTIONS = ['alpha', 'beta', 'gamma'];

describe('quickStartConfig', () => {
  it('rend 2 sièges (humain + IA), factions aléatoires et réglages standard', () => {
    const cfg = quickStartConfig(1234, COLORS);
    expect(cfg.slots).toHaveLength(2);
    expect(cfg.slots.map((s) => s.controller)).toEqual(['human', 'ai']);
    expect(cfg.slots.map((s) => s.factionId)).toEqual([RANDOM, RANDOM]);
    expect(cfg.slots.map((s) => s.heroId)).toEqual([RANDOM, RANDOM]);
    expect(cfg.slots.map((s) => s.team)).toEqual([0, 0]); // chacun pour soi
    expect(cfg.slots.map((s) => s.color)).toEqual([COLORS[0], COLORS[1]]);
    expect(cfg.mapSize).toBe('medium');
    expect(cfg.resourceLevel).toBe('standard');
    expect([cfg.guardians, cfg.mines, cfg.eventBuildings, cfg.pickups]).toEqual([
      'standard',
      'standard',
      'standard',
      'standard',
    ]);
    expect(cfg.difficulty).toBe('normal');
    expect(cfg.seed).toBe(1234);
  });

  it('reste reproductible : à graine égale, la config résolue est identique', () => {
    const a = resolveNewGameConfig(quickStartConfig(777, COLORS), FACTIONS, {}, 777);
    const b = resolveNewGameConfig(quickStartConfig(777, COLORS), FACTIONS, {}, 777);
    expect(a).toEqual(b);
    expect(a.setup.seats).toHaveLength(2);
    expect(a.setup.seats.map((s) => s.controller)).toEqual(['human', 'ai']);
    expect(a.setup.difficulty).toBe('normal');
    // Carte moyenne : le préréglage ne laisse pas la taille au hasard.
    expect(a.map.width).toBe(MAP_SIZE_DIMENSIONS.medium);
    expect(a.map.height).toBe(MAP_SIZE_DIMENSIONS.medium);
    expect(a.map.startPositionCount).toBe(2);
    // Densités standard ⇒ facteur 1 (carte inchangée à graine égale).
    expect([
      a.map.guardianDensity,
      a.map.mineDensity,
      a.map.eventBuildingDensity,
      a.map.pickupDensity,
    ]).toEqual([1, 1, 1, 1]);
    // Les factions restent tirées dans le catalogue fourni (aucun id en dur).
    for (const seat of a.setup.seats) expect(FACTIONS).toContain(seat.factionId);
  });
});
