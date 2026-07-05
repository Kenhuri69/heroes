import { useEffect } from 'preact/hooks';
import { appStore, useApp } from '../app/store';
import { t } from '../app/i18n';
import './Journal.css';

/**
 * Modale Journal (doc 08 §3) : historique consultable des notifications déjà
 * vues en toast (ressources, combats, ville, etc. — source unique `notify` de
 * `app/notifications.ts`). Plus récent en tête. Fermeture par bouton, backdrop
 * ou Échap (handler global de `shell.tsx`).
 */
export function Journal({ onClose }: { onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const journal = useApp((s) => s.journal);

  // Remise à 0 des non-lus dès l'ouverture (l'utilisateur consulte le journal).
  useEffect(() => {
    appStore.setState({ journalUnread: 0 });
  }, []);

  const entries = [...journal].reverse();

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal journal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('journal.title')}
        data-testid="journal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('journal.title')}</h2>
          <button class="modal-close" data-testid="journal-close" aria-label={t('journal.close')} onClick={onClose}>
            ×
          </button>
        </header>

        {entries.length === 0 ? (
          <p class="journal-empty">{t('journal.empty')}</p>
        ) : (
          <ol class="journal-entries">
            {entries.map((entry) => (
              <li class="journal-entry" data-testid="journal-entry" key={entry.id}>
                <span class="journal-entry-day">{t('journal.entryDay', { day: entry.day })}</span>
                <span class="journal-entry-message">{entry.message}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
