import { useEffect } from 'preact/hooks';
import { appStore, useApp } from '../app/store';
import { eventBus } from '../app/events';
import { notify, appendJournal } from '../app/notifications';
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

/** File de toasts (doc 08 §3) — s'abonne une fois au bus, disparition ~4 s. */
export function ToastHost() {
  useApp((s) => s.locale); // réactivité i18n
  const toasts = useApp((s) => s.toasts);

  useEffect(() => {
    return eventBus.on((event) => {
      const message = notify(event, appStore.getState().game);
      if (message) {
        pushToast(message);
        appendJournal(message);
      }
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
