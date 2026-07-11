import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../app/store';
import { t } from '../app/i18n';

/**
 * Journal de combat (UX-COMBATLOG, doc 08 §2.4) : affiche `store.combatLog`
 * (alimenté par le listener global `app/combat-log.ts`). Pure présentation ;
 * `visible` ne change que l'affichage (l'accumulation est globale, hors React).
 */
export function CombatLog({ visible }: { visible: boolean }) {
  useApp((s) => s.locale); // réactivité i18n
  const lines = useApp((s) => s.combatLog);
  const listRef = useRef<HTMLOListElement>(null);

  // Défilement vers le bas à chaque nouvelle ligne (la plus récente visible).
  useEffect(() => {
    if (visible && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lines, visible]);

  return (
    <div
      class={`combat-log ${visible ? 'open' : 'closed'}`}
      data-testid="combat-log"
      aria-hidden={!visible}
      aria-live="polite"
    >
      <ol ref={listRef} class="combat-log-lines" data-testid="combat-log-lines">
        {lines.length === 0 ? (
          <li class="combat-log-empty">{t('combatLog.empty')}</li>
        ) : (
          lines.map((l) => <li key={l.id}>{l.text}</li>)
        )}
      </ol>
    </div>
  );
}
