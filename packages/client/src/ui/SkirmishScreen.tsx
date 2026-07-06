import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../app/store';
import { t, resolveLoc } from '../app/i18n';
import type { SkirmishDifficulty } from '../app/game';
import './options.css';

const DIFFICULTIES: SkirmishDifficulty[] = ['facile', 'normal', 'difficile'];

/** Nom localisé d'une faction depuis son id (clé `@loc:faction.<id>.name`). */
function factionName(id: string): string {
  return resolveLoc(`@loc:faction.${id}.name`);
}

/**
 * Écran de configuration d'une escarmouche vs IA (doc 09, Alpha 4.14) : choix de
 * la faction du joueur, de la faction de l'IA et du cran de difficulté. « Lancer »
 * émet `heroes:start-skirmish` (même découplage que « Nouvelle partie » : le
 * composant ne construit pas la commande — `main.ts` l'écoute). La liste des
 * factions vient du store (`s.factions`, peuplé au chargement) : aucun id en dur.
 */
export function SkirmishScreen({ onClose }: { onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const factions = useApp((s) => s.factions);
  const [humanFactionId, setHuman] = useState(factions[0] ?? '');
  const [aiFactionId, setAi] = useState(factions[1] ?? factions[0] ?? '');
  const [difficulty, setDifficulty] = useState<SkirmishDifficulty>('normal');
  const [opponent, setOpponent] = useState<'ai' | 'human'>('ai');

  const options = useMemo(
    () => factions.map((id) => ({ id, label: factionName(id) })),
    [factions],
  );

  const start = (): void => {
    window.dispatchEvent(
      new CustomEvent('heroes:start-skirmish', {
        detail: { humanFactionId, aiFactionId, difficulty, opponent },
      }),
    );
    onClose();
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal options-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('skirmish.title')}
        data-testid="skirmish-screen"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('skirmish.title')}</h2>
          <button
            class="modal-close"
            data-testid="skirmish-close"
            aria-label={t('skirmish.close')}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <section class="options-section">
          <h3>{t('skirmish.yourFaction')}</h3>
          <select
            class="skirmish-select"
            data-testid="skirmish-human-faction"
            value={humanFactionId}
            onChange={(e) => setHuman((e.currentTarget as HTMLSelectElement).value)}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </section>

        <section class="options-section">
          <h3>{t('skirmish.opponent')}</h3>
          <div class="segmented" role="group">
            <button
              class={opponent === 'ai' ? 'active' : ''}
              data-testid="skirmish-opponent-ai"
              onClick={() => setOpponent('ai')}
            >
              {t('skirmish.opponent.ai')}
            </button>
            <button
              class={opponent === 'human' ? 'active' : ''}
              data-testid="skirmish-opponent-human"
              onClick={() => setOpponent('human')}
            >
              {t('skirmish.opponent.human')}
            </button>
          </div>
        </section>

        <section class="options-section">
          <h3>{opponent === 'human' ? t('skirmish.player2Faction') : t('skirmish.aiFaction')}</h3>
          <select
            class="skirmish-select"
            data-testid="skirmish-ai-faction"
            value={aiFactionId}
            onChange={(e) => setAi((e.currentTarget as HTMLSelectElement).value)}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </section>

        {opponent === 'ai' && (
          <section class="options-section">
            <h3>{t('skirmish.difficulty')}</h3>
            <div class="segmented" role="group">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  class={difficulty === level ? 'active' : ''}
                  data-testid={`skirmish-difficulty-${level}`}
                  onClick={() => setDifficulty(level)}
                >
                  {t(`skirmish.difficulty.${level}`)}
                </button>
              ))}
            </div>
          </section>
        )}

        <section class="options-section">
          <button
            class="menu-button"
            data-testid="skirmish-start"
            disabled={!humanFactionId || !aiFactionId}
            onClick={start}
          >
            {t('skirmish.start')}
          </button>
        </section>
      </div>
    </div>
  );
}
