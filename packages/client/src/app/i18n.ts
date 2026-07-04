import { LOCALE_LANGS, type LoadReport } from '@heroes/content';
import { appStore } from './store';

/** Langue UI (doc 08 §2.5) — même union que `AppState.locale`. */
type Lang = (typeof LOCALE_LANGS)[number];

const STORAGE_KEY = 'heroes.locale';

/** Traductions de l'UI générique (menu, options, toasts) — data/core/locales/. */
let coreLocales: Record<Lang, Record<string, string>> = { fr: {}, en: {} };
/** Traductions de contenu (noms d'unités, de factions…) — fusion de tous les paquets chargés. */
let packLocales: Record<Lang, Record<string, string>> = { fr: {}, en: {} };
/** unitId → référence `@loc:` de son nom (doc 06) — pour les vignettes de combat/tiroir héros. */
let unitNameRefs: Record<string, string> = {};

/**
 * Initialise l'i18n depuis le rapport de chargement de contenu (doc 06 §1) :
 * mémorise les locales core + paquets, calcule la langue initiale
 * (localStorage sinon langue navigateur si fr/en sinon 'fr') et synchronise
 * `appStore`. À appeler une fois au démarrage avant le premier rendu —
 * branchement dans `main.ts` fait en intégration (hors périmètre du lot G).
 */
export function initI18n(report: LoadReport): void {
  coreLocales = report.content.coreLocales;
  const merged: Record<Lang, Record<string, string>> = { fr: {}, en: {} };
  const refs: Record<string, string> = {};
  for (const pack of report.content.packs) {
    for (const lang of LOCALE_LANGS) Object.assign(merged[lang], pack.locales[lang]);
    for (const unit of pack.units) refs[unit.id] = unit.name;
  }
  packLocales = merged;
  unitNameRefs = refs;
  appStore.setState({ locale: initialLocale() });
}

function initialLocale(): Lang {
  const stored = safeLocalStorageGet(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : '';
  return nav === 'en' ? 'en' : 'fr';
}

/**
 * Traduit une clé de l'UI générique, avec interpolation `{param}`.
 * Repli : coreLocales.fr, puis la clé elle-même — jamais d'exception.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const locale = appStore.getState().locale;
  const raw = coreLocales[locale][key] ?? coreLocales.fr[key] ?? key;
  return interpolate(raw, params);
}

/**
 * Résout une référence `@loc:clé` du CONTENU (nom d'unité, de faction…) via
 * les locales des paquets chargés — langue courante, repli fr puis la clé.
 */
export function resolveLoc(ref: string): string {
  const key = ref.startsWith('@loc:') ? ref.slice('@loc:'.length) : ref;
  const locale = appStore.getState().locale;
  return packLocales[locale][key] ?? packLocales.fr[key] ?? key;
}

/** Nom localisé d'une unité depuis son id — pratique pour les vignettes/tiroir. */
export function resolveUnitName(unitId: string): string {
  const ref = unitNameRefs[unitId];
  return ref ? resolveLoc(ref) : unitId;
}

/** Change la langue courante — store + persistance (doc 08 §2.5). */
export function setLocale(locale: Lang): void {
  appStore.setState({ locale });
  safeLocalStorageSet(STORAGE_KEY, locale);
}

function interpolate(raw: string, params?: Record<string, string | number>): string {
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible (navigation privée…) — pas bloquant */
  }
}
