import { useEffect } from 'preact/hooks';
import { appStore, useApp } from '../app/store';
import { eventBus, type AppEvent } from '../app/events';
import { t, resolveUnitName, resolveSpellName, resolveSkillName } from '../app/i18n';
import './toasts.css';

const TOAST_DURATION_MS = 4000;
let nextToastId = 1;

/** Ajoute un toast éphémère (exporté pour surfacer les erreurs hors UI, ex. bootstrap — CL8). */
export function pushToast(message: string): void {
  const id = nextToastId++;
  appStore.setState((s) => ({ toasts: [...s.toasts, { id, message }] }));
  setTimeout(() => {
    appStore.setState((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) }));
  }, TOAST_DURATION_MS);
}

/**
 * Traduit un événement moteur/app en message de toast, ou `null` s'il n'est
 * pas notifié (doc 08 §3 : ressource ramassée, jour/semaine, fin de combat,
 * niveau, chargement — le journal consultable reste MVP, écart assumé).
 * NB : `playerSide` vaut toujours `'attacker'` en 2.5 (combat/setup.ts) —
 * simplification assumée pour distinguer victoire/défaite du joueur.
 */
function toastMessage(event: AppEvent): string | null {
  switch (event.type) {
    case 'ResourcePicked':
      return t('toast.resourcePicked', { amount: event.amount, resource: t(`resource.${event.resource}`) });
    case 'WeekStarted':
      return t('toast.weekStarted', { week: event.week });
    case 'CombatEnded':
      return event.winner === 'attacker' ? t('toast.combatWon') : t('toast.combatLost');
    // Nécromancie (doc 04 §2, plan phase-3.4) : relève post-victoire (effet de faction).
    case 'UndeadRaised':
      return t('toast.undeadRaised', { count: event.count, unit: resolveUnitName(event.unitId) });
    // Ressource de faction gagnée post-victoire (doc 05 §3.3, plan phase-4.4).
    case 'FactionResourceGained':
      return t('toast.factionResourceGained', {
        amount: event.amount,
        resource: t(`factionResource.${event.resource}`),
      });
    case 'HeroLevelUp':
      return t('toast.heroLevelUp', { level: event.level });
    // Sorts & compétences du héros (doc 02 §1.2–§1.4, plan phase-3.2 lot M).
    case 'SpellCast':
      return t('toast.spellCast', { hero: t('hero.genericName'), spell: resolveSpellName(event.spellId) });
    case 'SkillLearned':
      return t('toast.skillLearned', {
        skill: resolveSkillName(event.skillId),
        rank: t(`skill.rank.${event.rank}`),
      });
    case 'GameLoaded':
      return t('toast.gameLoaded');
    // Échec de stockage d'une sauvegarde (doc 07 §4, plan phase-3.9) — évite la
    // perte de données silencieuse (navigation privée, quota dépassé…).
    case 'SaveFailed':
      return t('toast.saveFailed');
    // Villes (doc 02 §4) — revenu/croissance/construction/recrutement.
    case 'TownIncome':
      return t('toast.townIncome', { amount: event.amount, resource: t(`resource.${event.resource}`) });
    case 'TownGrowth':
      return t('toast.townGrowth', { added: event.added, unit: resolveUnitName(event.unitId) });
    case 'TownBuilt':
      return t('toast.townBuilt', { building: t(`building.${event.buildingId}`) });
    case 'UnitsRecruited':
      return t('toast.unitsRecruited', { count: event.count, unit: resolveUnitName(event.unitId) });
    // Fin de partie (doc 02 §6, plan phase-3.5) — l'overlay victoire/défaite
    // porte le message principal, ce toast n'est qu'un signal immédiat.
    case 'GameEnded':
      return event.status === 'won' ? t('toast.gameWon') : t('toast.gameLost');
    default:
      return null;
  }
}

/** File de toasts (doc 08 §3) — s'abonne une fois au bus, disparition ~4 s. */
export function ToastHost() {
  useApp((s) => s.locale); // réactivité i18n
  const toasts = useApp((s) => s.toasts);

  useEffect(() => {
    return eventBus.on((event) => {
      const message = toastMessage(event);
      if (message) pushToast(message);
    });
  }, []);

  return (
    <div class="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <div class="toast" data-testid="toast" key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
