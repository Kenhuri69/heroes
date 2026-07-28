import { beforeAll, describe, expect, it } from 'vitest';
import type { LoadReport } from '@heroes/content';
import { heroDisplayName, initI18n, setLocale } from './i18n';

/**
 * Lot R6 (B4) : libellé affichable d'un héros. Le bandeau de combat et le toast de
 * sort affichaient TOUJOURS « Le héros » alors que le joueur mène des héros nommés
 * (M-TAVERN.2, héros canon). `heroDisplayName` est la source unique de ce libellé :
 * nom localisé (locales CORE ou de PAQUET), repli sur le générique si — et
 * seulement si — le héros n'a pas de nom (`HeroState.name === ''`).
 *
 * Locales injectées à la main (`initI18n` ne lit que ces trois champs) : le test
 * porte sur la RÉSOLUTION, pas sur le contenu réel des paquets.
 */
const report = {
  content: {
    coreLocales: {
      fr: { 'hero.genericName': 'Le héros', 'hero.name.default': 'Aldric' },
      en: { 'hero.genericName': 'The hero', 'hero.name.default': 'Aldric' },
    },
    packs: [
      {
        locales: { fr: { 'hero.canon.name': 'Isabel' }, en: { 'hero.canon.name': 'Isabel' } },
        units: [],
      },
    ],
    coreWarMachines: [],
  },
} as unknown as LoadReport;

beforeAll(() => {
  initI18n(report);
  setLocale('fr');
});

describe('heroDisplayName (B4)', () => {
  it('héros nommé (locales de paquet) ⇒ nom résolu, jamais le générique', () => {
    expect(heroDisplayName('@loc:hero.canon.name')).toBe('Isabel');
  });

  it('héros nommé par une clé CORE ⇒ nom résolu', () => {
    expect(heroDisplayName('hero.name.default')).toBe('Aldric');
  });

  it('héros SANS nom ⇒ repli sur le libellé générique', () => {
    expect(heroDisplayName('')).toBe('Le héros');
  });

  it('clé inconnue ⇒ la clé brute (le repli générique ne masque pas un contenu manquant)', () => {
    expect(heroDisplayName('@loc:hero.inconnu.name')).toBe('hero.inconnu.name');
  });
});
