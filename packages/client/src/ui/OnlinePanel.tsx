import { useEffect, useState } from 'preact/hooks';
import { t } from '../app/i18n';
import { isLoggedIn, listSaves, logout, requestMagicLink, verifyMagicLink } from '../app/net';
import { appStore } from '../app/store';
import { pullCloudSave, pushCloudSave } from '../app/save';
import { pushToast } from './toasts';
import './options.css';

type CloudSlot = { slot: string; save_version: number; updated_at: number };

/** Libellé i18n d'un slot cloud (auto/manual connus ; sinon l'id brut). */
function slotLabel(slot: string): string {
  return slot === 'auto' || slot === 'manual' ? t(`online.saves.slot.${slot}`) : slot;
}

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
  // Sauvegardes cloud (NET-CLOUDSAVES.2) : `null` = pas encore chargé.
  const [saves, setSaves] = useState<CloudSlot[] | null>(null);

  const refreshSaves = (): void => {
    listSaves()
      .then((r) => setSaves(r.saves))
      .catch(() => setSaves([]));
  };
  // Charge la liste dès que connecté (et au montage si déjà connecté).
  useEffect(() => {
    if (loggedIn) refreshSaves();
    else setSaves(null);
  }, [loggedIn]);

  const doUpload = (): void => {
    void pushCloudSave(appStore.getState().game)
      .then(() => {
        pushToast(t('toast.cloudSaved'), 'success');
        refreshSaves();
      })
      .catch(() => pushToast(t('toast.cloudSaveError'), 'error'));
  };
  const doLoadSlot = (slot: string): void => {
    void pullCloudSave(slot as 'auto' | 'manual')
      .then((r) => {
        if (r === 'ok') {
          pushToast(t('toast.cloudLoaded'), 'success');
          onClose();
        } else if (r === 'incompatible') pushToast(t('toast.cloudIncompatible'), 'error');
        else pushToast(t('toast.cloudNotStarted'), 'error');
      })
      .catch(() => pushToast(t('toast.cloudLoadError'), 'error'));
  };

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
          <>
            <section class="options-section">
              <p>{t('online.connected')}</p>
              <button class="menu-button" data-testid="online-logout" onClick={signOut}>
                {t('online.logout')}
              </button>
            </section>
            <section class="options-section">
              <h3>{t('online.saves.title')}</h3>
              <button class="menu-button" data-testid="online-upload" onClick={doUpload}>
                {t('online.saves.upload')}
              </button>
              {saves !== null && saves.length === 0 && (
                <p data-testid="online-saves-empty">{t('online.saves.empty')}</p>
              )}
              {saves !== null && saves.length > 0 && (
                <ul class="online-saves">
                  {saves.map((s) => (
                    <li key={s.slot} class="online-save-row" data-testid={`online-save-${s.slot}`}>
                      <span class="online-save-info">
                        {slotLabel(s.slot)} · {new Date(s.updated_at).toLocaleString()} · v{s.save_version}
                      </span>
                      <button
                        class="menu-button"
                        data-testid={`online-save-load-${s.slot}`}
                        onClick={() => doLoadSlot(s.slot)}
                      >
                        {t('online.saves.load')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
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
