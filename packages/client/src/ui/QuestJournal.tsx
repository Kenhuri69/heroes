import { useApp } from '../app/store';
import { t } from '../app/i18n';
import { useCollapsed, SectionToggle } from './CollapsibleSection';
import './QuestJournal.css';

/**
 * Journal de quêtes de campagne (doc 13 §6.3, lot N2b) : liste les quêtes
 * actives/terminées avec leur étape courante. Affiché dans le tiroir héros /
 * panneau latéral. Rien hors campagne (journal vide). `rem` → 3 crans de police.
 */
export function QuestJournal() {
  const entries = useApp((s) => s.questJournal);
  const [collapsed, toggle] = useCollapsed('quests');
  if (entries.length === 0) return null;

  return (
    <section class="quest-journal" data-testid="quest-journal">
      <SectionToggle
        title={t('journal.title')}
        collapsed={collapsed}
        onToggle={toggle}
        testId="quest-journal-toggle"
      />
      {!collapsed && (
      <ul class="quest-journal-list">
        {entries.map((q) => {
          const title = resolveKey(q.titleKey);
          return (
            <li
              key={q.id}
              class={`quest-journal-entry quest-journal-${q.status}`}
              data-testid={`quest-entry-${q.id}`}
            >
              <span class="quest-journal-title">
                {title}
                {(q.kind === 'personal' || q.kind === 'daily') && (
                  <span class="quest-journal-kind" data-testid={`quest-kind-${q.id}`}>
                    {t(`journal.kind.${q.kind}`)}
                  </span>
                )}
              </span>
              {q.descriptionKey && (
                <span class="quest-journal-desc">{resolveKey(q.descriptionKey)}</span>
              )}
              <span class="quest-journal-progress" data-testid={`quest-progress-${q.id}`}>
                {q.status === 'completed'
                  ? t('journal.done')
                  : t('journal.step', { current: Math.min(q.stepIndex + 1, q.stepCount), total: q.stepCount })}
              </span>
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}

function resolveKey(ref: string): string {
  const key = ref.startsWith('@loc:') ? ref.slice('@loc:'.length) : ref;
  return t(key);
}
