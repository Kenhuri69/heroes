import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../app/store';
import { t, resolveLoc, resolveHeroName } from '../app/i18n';
import { RANDOM, type SkirmishDifficulty } from '../app/game';
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
  const rosterHeroes = useApp((s) => s.rosterHeroes);
  const [humanFactionId, setHumanRaw] = useState(factions[0] ?? '');
  const [aiFactionId, setAi] = useState(factions[1] ?? factions[0] ?? '');
  const [difficulty, setDifficulty] = useState<SkirmishDifficulty>('normal');
  const [opponent, setOpponent] = useState<'ai' | 'human'>('ai');
  const [randomMap, setRandomMap] = useState(false);
  // Héros de départ du joueur (H-NAMED.2) — `RANDOM` = tirage seedé.
  const [humanHeroId, setHumanHeroId] = useState<string>(RANDOM);
  // Changer de faction réinitialise le héros (le roster proposé change).
  const setHuman = (id: string): void => {
    setHumanRaw(id);
    setHumanHeroId(RANDOM);
  };

  const options = useMemo(
    () => factions.map((id) => ({ id, label: factionName(id) })),
    [factions],
  );
  // Héros nommés de la faction humaine + option « Aléatoire ».
  const heroOptions = useMemo(
    () => [
      { id: RANDOM, label: t('newgame.random') },
      ...rosterHeroes
        .filter((h) => h.factionId === humanFactionId)
        .map((h) => ({ id: h.id, label: resolveHeroName(h.name) })),
    ],
    [rosterHeroes, humanFactionId],
  );

  const start = (): void => {
    window.dispatchEvent(
      new CustomEvent('heroes:start-skirmish', {
        detail: { humanFactionId, aiFactionId, difficulty, opponent, randomMap, humanHeroId },
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
          <h3>{t('skirmish.hero')}</h3>
          <select
            class="skirmish-select"
            data-testid="skirmish-human-hero"
            value={humanHeroId}
            onChange={(e) => setHumanHeroId((e.currentTarget as HTMLSelectElement).value)}
          >
            {heroOptions.map((o) => (
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
          <h3>{t('skirmish.map')}</h3>
          <div class="segmented" role="group">
            <button
              class={!randomMap ? 'active' : ''}
              data-testid="skirmish-map-standard"
              onClick={() => setRandomMap(false)}
            >
              {t('skirmish.map.standard')}
            </button>
            <button
              class={randomMap ? 'active' : ''}
              data-testid="skirmish-map-random"
              onClick={() => setRandomMap(true)}
            >
              {t('skirmish.map.random')}
            </button>
          </div>
        </section>

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
