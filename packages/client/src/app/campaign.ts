import type { Campaign, LoadReport } from '@heroes/content';
import type { GameState } from '@heroes/engine';
import { eventBus } from './events';
import { dispatch } from './dispatch';
import { loadScenarioMap } from './content';
import { loadScenarioNarrative } from './narrative';
import { playOpeningCutscene } from './cutscene';
import { navigate } from './router';
import { appStore } from './store';
import { humanHeroes, scenarioStartCommand, type HeroCarry } from './game';

/**
 * Système de campagne (doc 13 §4.1, N3a) : chaîne des chapitres avec continuité
 * du héros. La progression (chapitres faits + report de héros) est persistée en
 * **localStorage** — hors `GameState` (pas de bump de save) : c'est un état de
 * méta-jeu, comme les Options.
 */

const STORAGE_KEY = 'heroes.campaigns';
const FLAGS_KEY = 'heroes.flags';

interface CampaignSave {
  chaptersDone: number;
  heroCarry: HeroCarry | null;
}
type CampaignStore = Record<string, CampaignSave>;

function readStore(): CampaignStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CampaignStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: CampaignStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* stockage indisponible — la progression n'est pas sauvée, pas bloquant */
  }
}

/** Chapitres complétés d'une campagne (0 = seul le chapitre 1 est jouable). */
export function chaptersDone(campaignId: string): number {
  return readStore()[campaignId]?.chaptersDone ?? 0;
}

/**
 * Drapeaux de campagne (doc 13 §6.3, N3c.2) — posés par les choix de dialogue,
 * **globaux et relus entre campagnes** (méta-jeu, hors `GameState`). Persistés
 * dans un stockage propre pour rester lisibles indépendamment des sauvegardes.
 */
function readFlags(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(FLAGS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Miroir des drapeaux dans le store (mise à jour de l'UI). */
export function campaignFlags(): Record<string, boolean> {
  return readFlags();
}

/** Pose un drapeau (idempotent), le persiste et rafraîchit le miroir du store. */
export function setCampaignFlag(name: string): void {
  const flags = readFlags();
  if (flags[name]) return;
  flags[name] = true;
  try {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
  } catch {
    /* stockage indisponible — le drapeau n'est pas persisté, pas bloquant */
  }
  appStore.setState({ campaignFlags: flags });
}

/** Rafraîchit le miroir de progression dans le store (pour l'écran de sélection). */
function syncProgress(campaigns: Campaign[]): void {
  const store = readStore();
  const progress: Record<string, number> = {};
  for (const c of campaigns) progress[c.id] = store[c.id]?.chaptersDone ?? 0;
  appStore.setState({ campaignProgress: progress });
}

/** Snapshot du héros humain pour report au chapitre suivant (doc 13 §4.1). */
function snapshotHero(game: GameState): HeroCarry | null {
  const hero = humanHeroes(game)[0];
  if (!hero) return null;
  return {
    level: hero.level,
    xp: hero.xp,
    attributes: { ...hero.attributes },
    skills: { ...hero.skills },
    spells: [...hero.spells],
    artifacts: [...hero.artifacts],
  };
}

/**
 * Démarre un chapitre de campagne : résout le scénario du chapitre, sa carte et
 * sa narration, puis dispatch un `StartGame` doté du report de héros (chapitre
 * > 1). Mémorise le chapitre actif pour l'avancement à la victoire.
 */
export async function startCampaignChapter(
  report: LoadReport,
  campaign: Campaign,
  chapterIndex: number,
  seed: number,
): Promise<void> {
  const chapter = campaign.chapters[chapterIndex];
  if (!chapter) throw new Error(`chapitre inconnu ${campaign.id}#${chapterIndex}`);
  const scenario = report.content.scenarios.find((s) => s.id === chapter.scenario);
  if (!scenario) throw new Error(`scénario de chapitre inconnu '${chapter.scenario}'`);
  const map = await loadScenarioMap(report, scenario);
  const heroCarry = chapterIndex > 0 ? (readStore()[campaign.id]?.heroCarry ?? undefined) : undefined;
  loadScenarioNarrative(scenario);
  appStore.setState({ activeChapter: { campaignId: campaign.id, chapterIndex } });
  await dispatch(scenarioStartCommand(report, scenario, seed, map, heroCarry));
  navigate('adventure');
  // Cinématique d'ouverture (N3c.1) : en arrière-plan une fois la scène en place
  // (ne bloque pas le démarrage — elle attend l'interaction du joueur).
  void playOpeningCutscene(scenario);
}

/**
 * Branche l'avancement de campagne sur le bus d'événements (une fois au boot) :
 * à la victoire d'un chapitre actif, snapshot du héros + progression persistée.
 */
export function initCampaign(report: LoadReport): void {
  syncProgress(report.content.campaigns);
  appStore.setState({ campaignFlags: readFlags() }); // drapeaux persistés (N3c.2)
  eventBus.on((event) => {
    if (event.type !== 'GameEnded' || event.status !== 'won') return;
    const active = appStore.getState().activeChapter;
    if (!active) return;
    const store = readStore();
    const prev = store[active.campaignId]?.chaptersDone ?? 0;
    store[active.campaignId] = {
      // Le chapitre `chapterIndex` est fait → au moins `chapterIndex + 1` chapitres.
      chaptersDone: Math.max(prev, active.chapterIndex + 1),
      heroCarry: snapshotHero(appStore.getState().game),
    };
    writeStore(store);
    syncProgress(report.content.campaigns);
    // Chapitre terminé : on quitte le contexte actif (l'overlay propose la suite).
    appStore.setState({ activeChapter: null });
  });
}
