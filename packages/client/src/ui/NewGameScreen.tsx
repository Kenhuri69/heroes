import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../app/store';
import { t, resolveLoc } from '../app/i18n';
import {
  RANDOM,
  type MapSize,
  type NewGameRawConfig,
  type NewGameSlot,
  type ResourceLevel,
  type SkirmishDifficulty,
} from '../app/game';
import { PLAYER_COLORS } from '../render/playerColors';
import './options.css';
import './newgame.css';

/** Teinte CSS `#rrggbb` d'une couleur 0xRRGGBB. */
function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

const MAP_SIZES: (MapSize | typeof RANDOM)[] = ['small', 'medium', 'large', RANDOM];
const RESOURCE_LEVELS: (ResourceLevel | typeof RANDOM)[] = ['bas', 'standard', 'riche', RANDOM];
const DIFFICULTIES: (SkirmishDifficulty | typeof RANDOM)[] = ['facile', 'normal', 'difficile', RANDOM];
const PLAYER_COUNTS = [2, 3, 4] as const;
const MAX_PLAYERS = 4;
// Équipes proposées : 0 = sans alliance ; 1..3 = équipes A/B/C (alliés = même n°).
const TEAM_OPTIONS = [0, 1, 2, 3] as const;

/** Libellé d'une équipe : 0 = « Aucune » (i18n) ; sinon lettre A/B/C. */
function teamLabel(team: number): string {
  return team === 0 ? t('newgame.team.none') : String.fromCharCode(64 + team);
}

/** Nom localisé d'une faction depuis son id (clé `@loc:faction.<id>.name`). */
function factionName(id: string): string {
  return resolveLoc(`@loc:faction.${id}.name`);
}

/** Graine pseudo-unique côté client (jamais dans le moteur) — horloge mêlée. */
function rollSeed(prev: number): number {
  return (Date.now() ^ Math.imul(prev || 1, 2654435761)) >>> 0;
}

/**
 * Écran de configuration « Nouvelle partie » (doc 09) : faction par joueur,
 * nombre de joueurs (humain hot-seat / IA), taille de carte, quantité de
 * ressources (bas/riche), difficulté IA et graine reproductible. Chaque
 * paramètre peut rester sur « Aléatoire » (tiré au lancement depuis la graine).
 *
 * Même découplage que « Escarmouche » : ce composant NE construit PAS la commande.
 * « Lancer » émet `heroes:start-newgame` avec la config brute ; `main.ts` résout
 * les tirages, génère la carte (avec avancée du chargement) et joue le `StartGame`.
 */
export function NewGameScreen({ onClose }: { onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const factions = useApp((s) => s.factions);
  const [playerCount, setPlayerCount] = useState<number>(2);
  // Contrôleur par siège (le siège 0 est toujours l'humain local « Vous »).
  const [controllers, setControllers] = useState<('human' | 'ai')[]>(
    Array.from({ length: MAX_PLAYERS }, (_, i) => (i === 0 ? 'human' : 'ai')),
  );
  // Faction par siège : id de faction ou `RANDOM`.
  const [slotFactions, setSlotFactions] = useState<string[]>(
    Array.from({ length: MAX_PLAYERS }, (_, i) => factions[i % Math.max(1, factions.length)] ?? RANDOM),
  );
  // Couleur par siège (défaut = couleur d'index de la palette partagée).
  const [slotColors, setSlotColors] = useState<number[]>(
    Array.from({ length: MAX_PLAYERS }, (_, i) => PLAYER_COLORS[i % PLAYER_COLORS.length]!),
  );
  // Équipe par siège (0 = sans alliance, défaut ⇒ chacun-pour-soi).
  const [slotTeams, setSlotTeams] = useState<number[]>(Array.from({ length: MAX_PLAYERS }, () => 0));
  const [mapSize, setMapSize] = useState<MapSize | typeof RANDOM>('medium');
  const [resourceLevel, setResourceLevel] = useState<ResourceLevel | typeof RANDOM>('standard');
  const [difficulty, setDifficulty] = useState<SkirmishDifficulty | typeof RANDOM>('normal');
  const [seed, setSeed] = useState<number>(() => rollSeed(0));

  const factionOptions = useMemo(
    () => [
      { id: RANDOM, label: t('newgame.random') },
      ...factions.map((id) => ({ id, label: factionName(id) })),
    ],
    [factions],
  );

  const setController = (i: number, value: 'human' | 'ai'): void =>
    setControllers((prev) => prev.map((c, j) => (j === i ? value : c)));
  const setSlotFaction = (i: number, value: string): void =>
    setSlotFactions((prev) => prev.map((f, j) => (j === i ? value : f)));
  const setSlotColor = (i: number, value: number): void =>
    setSlotColors((prev) => prev.map((c, j) => (j === i ? value : c)));
  const setSlotTeam = (i: number, value: number): void =>
    setSlotTeams((prev) => prev.map((tm, j) => (j === i ? value : tm)));

  // Au moins un humain requis (hot-seat) : le siège 0 l'est toujours, donc OK.
  const canStart = factions.length > 0;

  const start = (): void => {
    const slots: NewGameSlot[] = Array.from({ length: playerCount }, (_, i) => ({
      controller: i === 0 ? 'human' : controllers[i]!,
      factionId: slotFactions[i] ?? RANDOM,
      color: slotColors[i]!,
      team: slotTeams[i]!,
    }));
    const config: NewGameRawConfig = { slots, mapSize, resourceLevel, difficulty, seed };
    window.dispatchEvent(new CustomEvent('heroes:start-newgame', { detail: config }));
    onClose();
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal options-panel newgame-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('newgame.title')}
        data-testid="newgame-screen"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('newgame.title')}</h2>
          <button
            class="modal-close"
            data-testid="newgame-close"
            aria-label={t('newgame.close')}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <section class="options-section">
          <h3>{t('newgame.players')}</h3>
          <div class="segmented" role="group">
            {PLAYER_COUNTS.map((n) => (
              <button
                key={n}
                class={playerCount === n ? 'active' : ''}
                data-testid={`newgame-players-${n}`}
                onClick={() => setPlayerCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <section class="options-section">
          <h3>{t('newgame.seats')}</h3>
          <ol class="newgame-seats" data-testid="newgame-seats">
            {Array.from({ length: playerCount }, (_, i) => (
              <li class="newgame-seat" key={i} data-testid={`newgame-seat-${i}`}>
                <span class="newgame-seat-label">
                  {i === 0 ? t('newgame.you') : t('newgame.seat', { n: i + 1 })}
                </span>
                {i === 0 ? (
                  <span class="newgame-seat-controller newgame-seat-human">{t('newgame.human')}</span>
                ) : (
                  <div class="segmented newgame-seat-controller" role="group">
                    <button
                      class={controllers[i] === 'human' ? 'active' : ''}
                      data-testid={`newgame-seat-${i}-human`}
                      onClick={() => setController(i, 'human')}
                    >
                      {t('newgame.human')}
                    </button>
                    <button
                      class={controllers[i] === 'ai' ? 'active' : ''}
                      data-testid={`newgame-seat-${i}-ai`}
                      onClick={() => setController(i, 'ai')}
                    >
                      {t('newgame.ai')}
                    </button>
                  </div>
                )}
                <select
                  class="skirmish-select newgame-seat-faction"
                  data-testid={`newgame-seat-${i}-faction`}
                  value={slotFactions[i]}
                  onChange={(e) => setSlotFaction(i, (e.currentTarget as HTMLSelectElement).value)}
                >
                  {factionOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div class="newgame-seat-colors" role="group" aria-label={t('newgame.color')}>
                  {PLAYER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      class={`newgame-swatch${slotColors[i] === c ? ' active' : ''}`}
                      data-testid={`newgame-seat-${i}-color-${hex(c).slice(1)}`}
                      style={{ background: hex(c) }}
                      aria-label={hex(c)}
                      aria-pressed={slotColors[i] === c}
                      onClick={() => setSlotColor(i, c)}
                    />
                  ))}
                </div>
                <div class="segmented newgame-seat-team" role="group" aria-label={t('newgame.team')}>
                  {TEAM_OPTIONS.map((tm) => (
                    <button
                      key={tm}
                      class={slotTeams[i] === tm ? 'active' : ''}
                      data-testid={`newgame-seat-${i}-team-${tm}`}
                      onClick={() => setSlotTeam(i, tm)}
                    >
                      {teamLabel(tm)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section class="options-section">
          <h3>{t('newgame.mapSize')}</h3>
          <div class="segmented" role="group">
            {MAP_SIZES.map((size) => (
              <button
                key={size}
                class={mapSize === size ? 'active' : ''}
                data-testid={`newgame-size-${size}`}
                onClick={() => setMapSize(size)}
              >
                {t(`newgame.mapSize.${size}`)}
              </button>
            ))}
          </div>
        </section>

        <section class="options-section">
          <h3>{t('newgame.resources')}</h3>
          <div class="segmented" role="group">
            {RESOURCE_LEVELS.map((level) => (
              <button
                key={level}
                class={resourceLevel === level ? 'active' : ''}
                data-testid={`newgame-resources-${level}`}
                onClick={() => setResourceLevel(level)}
              >
                {t(`newgame.resources.${level}`)}
              </button>
            ))}
          </div>
        </section>

        <section class="options-section">
          <h3>{t('newgame.difficulty')}</h3>
          <div class="segmented" role="group">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                class={difficulty === level ? 'active' : ''}
                data-testid={`newgame-difficulty-${level}`}
                onClick={() => setDifficulty(level)}
              >
                {t(`newgame.difficulty.${level}`)}
              </button>
            ))}
          </div>
        </section>

        <section class="options-section">
          <h3>{t('newgame.seed')}</h3>
          <div class="newgame-seed-row">
            <input
              class="skirmish-select newgame-seed-input"
              type="number"
              inputMode="numeric"
              data-testid="newgame-seed"
              value={seed}
              onInput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                if (Number.isFinite(v)) setSeed(Math.max(0, Math.floor(v)));
              }}
            />
            <button
              class="newgame-reroll"
              data-testid="newgame-reroll"
              aria-label={t('newgame.reroll')}
              onClick={() => setSeed((prev) => rollSeed(prev))}
            >
              🎲
            </button>
          </div>
          <p class="options-hint">{t('newgame.seedHint')}</p>
        </section>

        <section class="options-section">
          <button
            class="menu-button"
            data-testid="newgame-start"
            disabled={!canStart}
            onClick={start}
          >
            {t('newgame.start')}
          </button>
        </section>
      </div>
    </div>
  );
}
