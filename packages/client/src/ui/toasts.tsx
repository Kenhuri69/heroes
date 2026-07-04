import { useEffect } from 'preact/hooks';
import { appStore, useApp } from '../app/store';
import { eventBus, type AppEvent } from '../app/events';
import { t } from '../app/i18n';
import './toasts.css';

const TOAST_DURATION_MS = 4000;
let nextToastId = 1;

function pushToast(message: string): void {
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
    case 'HeroLevelUp':
      return t('toast.heroLevelUp', { level: event.level });
    case 'GameLoaded':
      return t('toast.gameLoaded');
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
