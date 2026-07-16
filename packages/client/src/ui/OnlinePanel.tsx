import { useEffect, useState } from 'preact/hooks';
import { t } from '../app/i18n';
import {
  forfeitMatch,
  isLoggedIn,
  joinMatch,
  listMatches,
  listSaves,
  logout,
  requestMagicLink,
  verifyMagicLink,
  type MatchSummary,
} from '../app/net';
import { appStore } from '../app/store';
import { pullCloudSave, pushCloudSave } from '../app/save';
import { RANDOM, type NewGameRawConfig } from '../app/game';
import { PLAYER_COLORS } from '../render/playerColors';
import { pushToast } from './toasts';
import './options.css';

/** Preset async 2 sièges humains (NET-PVPUI slice A) — tirages seedés. */
function onlineMatchPreset(seed: number): NewGameRawConfig {
  return {
    slots: [
      { controller: 'human', factionId: RANDOM, color: PLAYER_COLORS[0] ?? 0, team: 0 },
      { controller: 'human', factionId: RANDOM, color: PLAYER_COLORS[1] ?? 0, team: 0 },
    ],
    mapSize: 'small',
    resourceLevel: 'standard',
    guardians: RANDOM,
    mines: RANDOM,
    eventBuildings: RANDOM,
    pickups: RANDOM,
    difficulty: 'normal',
    seed,
    online: true,
  };
}

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

  // Lobby PvP asynchrone (NET-PVPUI slice A) : `null` = pas encore chargé.
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const refreshMatches = (): void => {
    listMatches()
      .then((r) => setMatches(r.matches))
      .catch(() => setMatches([]));
  };
  // Charge au montage (si connecté) et quand une partie est créée/rejointe/abandonnée.
  useEffect(() => {
    if (!loggedIn) {
      setMatches(null);
      return;
    }
    refreshMatches();
    const onChanged = (): void => refreshMatches();
    window.addEventListener('heroes:matches-changed', onChanged);
    return () => window.removeEventListener('heroes:matches-changed', onChanged);
  }, [loggedIn]);

  const doCreateMatch = (): void => {
    // La création passe par le pipeline « nouvelle partie » (résolution + carte),
    // routé vers `createMatch` par le drapeau `online` (main.ts). Ferme le panneau
    // pendant la génération ; l'événement `heroes:matches-changed` rafraîchira.
    window.dispatchEvent(new CustomEvent('heroes:start-newgame', { detail: onlineMatchPreset(Date.now()) }));
  };
  const doJoin = (id: string): void => {
    void joinMatch(id)
      .then(() => {
        pushToast(t('toast.matchJoined'), 'success');
        refreshMatches();
      })
      .catch(() => pushToast(t('toast.matchError'), 'error'));
  };
  const doForfeit = (id: string): void => {
    void forfeitMatch(id)
      .then(() => {
        pushToast(t('toast.matchForfeited'), 'success');
        refreshMatches();
      })
      .catch(() => pushToast(t('toast.matchError'), 'error'));
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
            <section class="options-section" data-testid="online-matches">
              <h3>{t('online.matches.title')}</h3>
              <div class="online-match-actions">
                <button class="menu-button" data-testid="online-match-create" onClick={doCreateMatch}>
                  {t('online.matches.create')}
                </button>
                <button class="menu-button" data-testid="online-match-refresh" onClick={refreshMatches}>
                  {t('online.matches.refresh')}
                </button>
              </div>
              {matches !== null && matches.length === 0 && (
                <p data-testid="online-matches-empty">{t('online.matches.empty')}</p>
              )}
              {matches !== null && matches.length > 0 && (
                <ul class="online-saves">
                  {matches.map((m) => (
                    <li key={m.id} class="online-save-row" data-testid={`online-match-${m.id}`}>
                      <span class="online-save-info">
                        {t(`online.matches.status.${m.status}`)} · {new Date(m.created_at).toLocaleString()}
                      </span>
                      {m.status === 'open' && (
                        <button
                          class="menu-button"
                          data-testid={`online-match-join-${m.id}`}
                          onClick={() => doJoin(m.id)}
                        >
                          {t('online.matches.join')}
                        </button>
                      )}
                      {m.status === 'active' && (
                        <button
                          class="menu-button"
                          data-testid={`online-match-forfeit-${m.id}`}
                          onClick={() => doForfeit(m.id)}
                        >
                          {t('online.matches.forfeit')}
                        </button>
                      )}
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
