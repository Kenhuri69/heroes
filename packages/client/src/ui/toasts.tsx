import { useEffect } from 'preact/hooks';
import { appStore, useApp, type ToastKind } from '../app/store';
import { eventBus, type AppEvent } from '../app/events';
import { notify, appendJournal, aggregateDailyIncome } from '../app/notifications';
import { playSfx } from '../app/audio';
import './toasts.css';

const TOAST_DURATION_MS = 4000;
let nextToastId = 1;

/**
 * Ajoute un toast éphémère (exporté pour surfacer les erreurs hors UI, ex.
 * bootstrap — CL8). `kind` (défaut `info`) porte l'accent visuel + le SFX
 * (`success → ui-confirm`, `error → ui-error`, `info` muet ; UXD-6b). Le son
 * double le feedback visuel, jamais le seul canal (A5).
 */
export function pushToast(message: string, kind: ToastKind = 'info'): void {
  const id = nextToastId++;
  appStore.setState((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
  if (kind === 'success') playSfx('ui-confirm');
  else if (kind === 'error') playSfx('ui-error');
  setTimeout(() => {
    appStore.setState((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) }));
  }, TOAST_DURATION_MS);
}

/**
 * Classe un toast événementiel (doc 08 §3, UXD-6b) : **succès** = action
 * positive confirmée du joueur (construction, recrutement, capture, gains de
 * combat/partie…) ; **erreur** = échec de stockage d'une sauvegarde ; le reste
 * (revenus, ramassages, croissances, infos passives) = `info` (muet).
 */
function toastKind(event: AppEvent): ToastKind {
  switch (event.type) {
    case 'SaveFailed':
      return 'error';
    case 'GameLoaded':
    case 'TownBuilt':
    case 'UnitsRecruited':
    case 'UnitsUpgraded':
    case 'WarMachineBought':
    case 'TownCaptured':
    case 'HeroLevelUp':
    case 'HeroAttributeChosen':
    case 'SkillLearned':
    case 'HuntContractCompleted':
      return 'success';
    case 'CombatEnded':
      return event.winner === event.playerSide ? 'success' : 'info';
    case 'GameEnded':
      return event.status === 'won' ? 'success' : 'info';
    default:
      return 'info';
  }
}

/** File de toasts (doc 08 §3) — s'abonne une fois au bus, disparition ~4 s. */
export function ToastHost() {
  useApp((s) => s.locale); // réactivité i18n
  const toasts = useApp((s) => s.toasts);

  useEffect(() => {
    // E9 : traitement PAR LOT — un lot de dispatch = un « moment » de jeu.
    return eventBus.onBatch((events, meta) => {
      const game = appStore.getState().game;
      // (1) Revenus du jour agrégés en UN toast/entrée (au lieu d'un par source).
      const income = aggregateDailyIncome(events, game);
      if (income) {
        pushToast(income, 'success');
        appendJournal(income);
      }
      // (2) Reste des événements, un message chacun.
      for (const event of events) {
        // Revenus déjà agrégés ci-dessus.
        if (event.type === 'MineIncome' || event.type === 'TownIncome') continue;
        // Combats de l'IA (vs neutres/entre eux) : pas de toast — le joueur ne les
        // voit pas ; seuls SES combats (écran posé) notifient (E9).
        if (event.type === 'CombatEnded' && !meta.humanCombat) continue;
        const message = notify(event, game);
        if (message) {
          pushToast(message, toastKind(event));
          appendJournal(message);
        }
      }
    });
  }, []);

  return (
    <div class="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <div class={`toast toast-${toast.kind}`} data-kind={toast.kind} data-testid="toast" key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
