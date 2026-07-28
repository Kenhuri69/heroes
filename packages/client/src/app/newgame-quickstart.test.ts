import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAP_SIZE_DIMENSIONS, quickStartConfig, RANDOM, resolveNewGameConfig } from './game';
import { PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../render/playerColors';

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

/**
 * Parité nom ↔ couleur (lot R4, A5) : la pastille de couleur est nommée via
 * `newgame.colorName.<PLAYER_COLOR_NAMES[i]>`, couplé PAR INDEX à
 * `PLAYER_COLORS`. Sans ce garde-fou, une 9ᵉ couleur ajoutée à la palette
 * afficherait l'`aria-label` brut « newgame.colorName.8 » — exactement la
 * régression que le lot corrige.
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../../data');

describe('palette de joueur — parité nom localisé', () => {
  it('chaque couleur a un suffixe de nom non vide', () => {
    expect(PLAYER_COLOR_NAMES).toHaveLength(PLAYER_COLORS.length);
    for (const name of PLAYER_COLOR_NAMES) expect(name.trim().length).toBeGreaterThan(0);
  });

  it('chaque nom a sa clé `newgame.colorName.<nom>` en FR et EN', async () => {
    const read = async (lang: string): Promise<Record<string, string>> =>
      JSON.parse(await readFile(join(DATA_DIR, `core/locales/${lang}.json`), 'utf8')) as Record<string, string>;
    const [fr, en] = await Promise.all([read('fr'), read('en')]);
    for (const name of PLAYER_COLOR_NAMES) {
      expect(fr[`newgame.colorName.${name}`], `fr: ${name}`).toBeTruthy();
      expect(en[`newgame.colorName.${name}`], `en: ${name}`).toBeTruthy();
    }
  });
});
