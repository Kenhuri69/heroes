import { useState } from 'preact/hooks';
import { t } from '../app/i18n';
import { isLoggedIn, logout, requestMagicLink, verifyMagicLink } from '../app/net';
import './options.css';

/**
 * Panneau « En ligne » (doc 15, Live 7.3) — connexion magic-link minimale au
 * backend. Rendu uniquement quand `isOnline()` (flag `VITE_BACKEND_URL`) : sans
 * backend il n'est jamais monté. L'e-mail réel n'étant pas encore branché, le
 * lien de vérification renvoyé est affiché pour être suivi (dev/beta). Les écrans
 * PvP complets viendront sur ce socle.
 */
export function OnlinePanel({ onClose }: { onClose: () => void }) {
  useState(0); // hook d'ancrage (i18n réactif via re-render parent)
  const [email, setEmail] = useState('');
  const [verifyLink, setVerifyLink] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [error, setError] = useState<string | null>(null);

  const request = (): void => {
    setError(null);
    requestMagicLink(email)
      .then((r) => setVerifyLink(r.verifyLink))
      .catch((e: unknown) => setError((e as Error).message));
  };
  const verify = (): void => {
    setError(null);
    verifyMagicLink(token.trim())
      .then(() => setLoggedIn(true))
      .catch((e: unknown) => setError((e as Error).message));
  };
  const signOut = (): void => {
    logout();
    setLoggedIn(false);
    setVerifyLink(null);
    setToken('');
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal options-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('online.title')}
        data-testid="online-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('online.title')}</h2>
          <button class="modal-close" data-testid="online-close" aria-label={t('online.close')} onClick={onClose}>
            ×
          </button>
        </header>

        {loggedIn ? (
          <section class="options-section">
            <p>{t('online.connected')}</p>
            <button class="menu-button" data-testid="online-logout" onClick={signOut}>
              {t('online.logout')}
            </button>
          </section>
        ) : (
          <>
            <section class="options-section">
              <h3>{t('online.email')}</h3>
              <input
                class="skirmish-select"
                type="email"
                data-testid="online-email"
                value={email}
                onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
                placeholder="you@example.com"
              />
              <button class="menu-button" data-testid="online-request" disabled={!email} onClick={request}>
                {t('online.request')}
              </button>
              {verifyLink && (
                <p class="online-link" data-testid="online-verify-link">
                  {t('online.linkHint')} <code>{verifyLink}</code>
                </p>
              )}
            </section>
            <section class="options-section">
              <h3>{t('online.token')}</h3>
              <input
                class="skirmish-select"
                data-testid="online-token"
                value={token}
                onInput={(e) => setToken((e.currentTarget as HTMLInputElement).value)}
              />
              <button class="menu-button" data-testid="online-verify" disabled={!token} onClick={verify}>
                {t('online.verify')}
              </button>
            </section>
          </>
        )}
        {error && (
          <p class="online-error" data-testid="online-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
