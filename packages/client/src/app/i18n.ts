import { LOCALE_LANGS, type LoadReport } from '@heroes/content';
import { EngineError } from '@heroes/engine';
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
  // Machines de guerre communes (doc 02 §5) : leur nom vit dans les locales CORE
  // (pas de paquet) — `resolveUnitName` fait le repli core → paquet.
  for (const wm of report.content.coreWarMachines) refs[wm.id] = wm.name;
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
 * Message localisé d'une erreur de commande moteur (remédiation R2b) : mappe le
 * `code` structuré d'une `EngineError` vers `cmdError.<code>`, avec repli sur un
 * message générique. Utilisé partout où une commande rejetée doit être surfacée
 * (toast de combat, bandeau de ville) plutôt qu'avalée en silence.
 */
export function commandErrorMessage(err: unknown): string {
  if (err instanceof EngineError) {
    const key = `cmdError.${err.detail.code}`;
    const msg = t(key);
    if (msg !== key) return msg;
  }
  return t('cmdError.default');
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
  if (!ref) return unitId;
  // Repli core → paquet : les unités de faction vivent dans le paquet, les
  // machines de guerre communes dans les locales core (doc 02 §5).
  const key = ref.startsWith('@loc:') ? ref.slice('@loc:'.length) : ref;
  const core = t(key);
  return core !== key ? core : resolveLoc(ref);
}

/**
 * Nom localisé d'un sort/compétence/artefact via une clé générique
 * `<prefix>.<id>` des locales core — repli sur l'id brut (les catalogues
 * `SpellDef`/`HeroSkillDef`/`ArtifactDef` n'ont pas de champ `name`, doc
 * 08 §2.3/§2.4, lot M phase 3.2).
 */
function resolveGenericName(prefix: string, id: string): string {
  const key = `${prefix}.${id}`;
  const value = t(key);
  return value === key ? id : value;
}

export function resolveSpellName(spellId: string): string {
  return resolveGenericName('spell', spellId);
}

export function resolveSkillName(skillId: string): string {
  return resolveGenericName('skill', skillId);
}

export function resolveArtifactName(artifactId: string): string {
  return resolveGenericName('artifact', artifactId);
}

/**
 * Cherche une clé de nom dans les locales CORE puis, à défaut, dans les locales
 * de PAQUET (remédiation R4b) — les noms de bâtiments de faction (dwellings) et
 * de ressources de faction vivent dans le paquet, pas dans le core (doc 06).
 * Repli sur l'id brut si la clé est absente partout.
 */
function resolveCoreOrPack(prefix: string, id: string): string {
  const key = `${prefix}.${id}`;
  const core = t(key);
  if (core !== key) return core;
  const pack = resolveLoc(key);
  return pack === key ? id : pack;
}

/** Nom localisé d'un bâtiment : core (`townHall`, `fort`…) ou dwelling de paquet. */
export function resolveBuildingName(id: string): string {
  return resolveCoreOrPack('building', id);
}

/** Nom localisé d'une ressource de faction (`essence`…) — vit dans le paquet (CO7). */
export function resolveFactionResourceName(id: string): string {
  return resolveCoreOrPack('factionResource', id);
}

/**
 * Nom localisé d'un scénario (`scenario.name` = référence `@loc:` vers les
 * locales CORE — data/core/locales/, plan phase-3.5, pas les locales de
 * paquet comme `resolveLoc`). Repli sur la clé brute si absente.
 */
export function resolveScenarioName(nameRef: string): string {
  const key = nameRef.startsWith('@loc:') ? nameRef.slice('@loc:'.length) : nameRef;
  return t(key);
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
