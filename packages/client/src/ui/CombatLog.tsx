import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../app/store';
import { t } from '../app/i18n';
import { pushToast } from './toasts';

/**
 * Journal de combat (UX-COMBATLOG, doc 08 §2.4) : affiche `store.combatLog`
 * (alimenté par le listener global `app/combat-log.ts`). Pure présentation ;
 * `visible` ne change que l'affichage (l'accumulation est globale, hors React).
 *
 * E14 (plan `game-ergonomics-immersion-review`) : filtre texte + copie/export
 * des lignes visibles (`navigator.clipboard`) — sans tagger les événements
 * (basse plomberie : `CombatLogLine` reste `{id,text}`).
 */
export function CombatLog({ visible }: { visible: boolean }) {
  useApp((s) => s.locale); // réactivité i18n
  const lines = useApp((s) => s.combatLog);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLOListElement>(null);

  const needle = query.trim().toLowerCase();
  const shown = needle ? lines.filter((l) => l.text.toLowerCase().includes(needle)) : lines;

  // Défilement vers le bas à chaque nouvelle ligne (la plus récente visible).
  useEffect(() => {
    if (visible && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [shown, visible]);

  const copy = (): void => {
    const text = shown.map((l) => l.text).join('\n');
    void navigator.clipboard?.writeText(text).then(
      () => pushToast(t('combatLog.copied'), 'success'),
      () => pushToast(t('combatLog.copyFailed'), 'error'),
    );
  };

  return (
    <div
      class={`combat-log ${visible ? 'open' : 'closed'}`}
      data-testid="combat-log"
      aria-hidden={!visible}
      aria-live="polite"
    >
      <div class="combat-log-tools">
        <input
          type="search"
          role="searchbox"
          class="combat-log-filter"
          data-testid="combat-log-filter"
          placeholder={t('combatLog.filterPlaceholder')}
          aria-label={t('combatLog.filterPlaceholder')}
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <button
          type="button"
          class="combat-log-copy"
          data-testid="combat-log-copy"
          onClick={copy}
          disabled={shown.length === 0}
        >
          {t('combatLog.copy')}
        </button>
      </div>
      <ol ref={listRef} class="combat-log-lines" data-testid="combat-log-lines">
        {lines.length === 0 ? (
          <li class="combat-log-empty">{t('combatLog.empty')}</li>
        ) : shown.length === 0 ? (
          <li class="combat-log-empty">{t('combatLog.noMatch')}</li>
        ) : (
          shown.map((l) => <li key={l.id}>{l.text}</li>)
        )}
      </ol>
    </div>
  );
}
