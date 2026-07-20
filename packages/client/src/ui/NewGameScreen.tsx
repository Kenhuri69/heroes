import { useMemo, useState } from 'preact/hooks';
import { useApp } from '../app/store';
import { t, resolveLoc } from '../app/i18n';
import {
  RANDOM,
  type ContentLevel,
  type MapSize,
  type NewGameRawConfig,
  type NewGameSlot,
  type ResourceLevel,
  type SkirmishDifficulty,
} from '../app/game';
import { resolveHeroName } from '../app/i18n';
import { PLAYER_COLORS } from '../render/playerColors';
import { SectionToggle, useCollapsed } from './CollapsibleSection';
import './options.css';
import './newgame.css';

/** Teinte CSS `#rrggbb` d'une couleur 0xRRGGBB. */
function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

const MAP_SIZES: (MapSize | typeof RANDOM)[] = ['small', 'medium', 'large', 'huge', 'colossal', RANDOM];
const RESOURCE_LEVELS: (ResourceLevel | typeof RANDOM)[] = ['bas', 'standard', 'riche', RANDOM];
const CONTENT_LEVELS: (ContentLevel | typeof RANDOM)[] = ['none', 'rare', 'standard', 'abundant', RANDOM];
/** Curseurs de quantité par catégorie d'objets de carte (doc 09) : clé i18n ↔ champ de config. */
const CONTENT_CATEGORIES = [
  { key: 'guardians', field: 'guardians' },
  { key: 'mines', field: 'mines' },
  { key: 'eventBuildings', field: 'eventBuildings' },
  { key: 'pickups', field: 'pickups' },
] as const;
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
  // Héros de départ par siège (H-NAMED.2) : `RANDOM` = tirage seedé ; sièges humains.
  const [slotHeroes, setSlotHeroes] = useState<string[]>(Array.from({ length: MAX_PLAYERS }, () => RANDOM));
  const rosterHeroes = useApp((s) => s.rosterHeroes);
  const [mapSize, setMapSize] = useState<MapSize | typeof RANDOM>('medium');
  const [resourceLevel, setResourceLevel] = useState<ResourceLevel | typeof RANDOM>('standard');
  // Quantité par catégorie d'objets de carte (défaut « standard » ⇒ carte inchangée).
  const [contentLevels, setContentLevels] = useState<Record<string, ContentLevel | typeof RANDOM>>({
    guardians: 'standard',
    mines: 'standard',
    eventBuildings: 'standard',
    pickups: 'standard',
  });
  const setContentLevel = (field: string, value: ContentLevel | typeof RANDOM): void =>
    setContentLevels((prev) => ({ ...prev, [field]: value }));
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
  const setSlotFaction = (i: number, value: string): void => {
    setSlotFactions((prev) => prev.map((f, j) => (j === i ? value : f)));
    // Changer de faction réinitialise le héros du siège (roster proposé différent).
    setSlotHeroes((prev) => prev.map((h, j) => (j === i ? RANDOM : h)));
  };
  const setSlotHero = (i: number, value: string): void =>
    setSlotHeroes((prev) => prev.map((h, j) => (j === i ? value : h)));
  const setSlotColor = (i: number, value: number): void =>
    setSlotColors((prev) => prev.map((c, j) => (j === i ? value : c)));
  const setSlotTeam = (i: number, value: number): void =>
    setSlotTeams((prev) => prev.map((tm, j) => (j === i ? value : tm)));

  // « Options avancées » repliées par défaut (divulgation progressive, doc 08 §2.5) :
  // l'essentiel (joueurs, sièges, taille) reste visible ; densités/difficulté/graine
  // sont derrière un pli. Présentation pure (localStorage), hors GameState.
  const [advancedCollapsed, toggleAdvanced] = useCollapsed('newgame.advanced', true);

  // Au moins un humain requis (hot-seat) : le siège 0 l'est toujours, donc OK.
  const canStart = factions.length > 0;

  const launch = (config: NewGameRawConfig): void => {
    window.dispatchEvent(new CustomEvent('heroes:start-newgame', { detail: config }));
    onClose();
  };

  const start = (): void => {
    const slots: NewGameSlot[] = Array.from({ length: playerCount }, (_, i) => ({
      controller: i === 0 ? 'human' : controllers[i]!,
      factionId: slotFactions[i] ?? RANDOM,
      color: slotColors[i]!,
      team: slotTeams[i]!,
      heroId: slotHeroes[i] ?? RANDOM,
    }));
    launch({
      slots,
      mapSize,
      resourceLevel,
      guardians: contentLevels.guardians!,
      mines: contentLevels.mines!,
      eventBuildings: contentLevels.eventBuildings!,
      pickups: contentLevels.pickups!,
      difficulty,
      seed,
    });
  };

  // Départ rapide (doc 08 §2.5) : duel standard sans configuration — 2 joueurs
  // (vous vs 1 IA), carte moyenne, tout standard, graine fraîche. Respecte la
  // faction déjà choisie au siège 0. Ignore les autres réglages du formulaire.
  const quickStart = (): void => {
    launch({
      slots: [
        { controller: 'human', factionId: slotFactions[0] ?? RANDOM, color: PLAYER_COLORS[0]!, team: 0, heroId: RANDOM },
        { controller: 'ai', factionId: RANDOM, color: PLAYER_COLORS[1]!, team: 0, heroId: RANDOM },
      ],
      mapSize: 'medium',
      resourceLevel: 'standard',
      guardians: 'standard',
      mines: 'standard',
      eventBuildings: 'standard',
      pickups: 'standard',
      difficulty: 'normal',
      seed: rollSeed(seed),
    });
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

        <section class="options-section newgame-quick-section">
          <button class="menu-button newgame-quick" data-testid="newgame-quick-start" onClick={quickStart}>
            {t('newgame.quickStart')}
          </button>
          <p class="options-hint">{t('newgame.quickStartHint')}</p>
        </section>

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
                  aria-label={t('newgame.factionLabel')}
                  value={slotFactions[i]}
                  onChange={(e) => setSlotFaction(i, (e.currentTarget as HTMLSelectElement).value)}
                >
                  {factionOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {(i === 0 || controllers[i] === 'human') && (
                  <select
                    class="skirmish-select newgame-seat-hero"
                    data-testid={`newgame-seat-${i}-hero`}
                    aria-label={t('newgame.heroLabel')}
                    value={slotHeroes[i]}
                    onChange={(e) => setSlotHero(i, (e.currentTarget as HTMLSelectElement).value)}
                  >
                    <option value={RANDOM}>{t('newgame.random')}</option>
                    {rosterHeroes
                      .filter((h) => h.factionId === slotFactions[i])
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {resolveHeroName(h.name)}
                        </option>
                      ))}
                  </select>
                )}
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

        <SectionToggle
          title={t('newgame.advanced')}
          collapsed={advancedCollapsed}
          onToggle={toggleAdvanced}
          testId="newgame-advanced-toggle"
        />
        {!advancedCollapsed && (
        <div class="newgame-advanced" data-testid="newgame-advanced">
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

        {CONTENT_CATEGORIES.map((cat) => (
          <section class="options-section" key={cat.field}>
            <h3>{t(`newgame.content.${cat.key}`)}</h3>
            <div class="segmented" role="group">
              {CONTENT_LEVELS.map((level) => (
                <button
                  key={level}
                  class={contentLevels[cat.field] === level ? 'active' : ''}
                  data-testid={`newgame-${cat.field}-${level}`}
                  onClick={() => setContentLevel(cat.field, level)}
                >
                  {t(`newgame.contentLevel.${level}`)}
                </button>
              ))}
            </div>
          </section>
        ))}

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
        </div>
        )}

        <footer class="newgame-footer">
          <button
            class="menu-button"
            data-testid="newgame-start"
            disabled={!canStart}
            onClick={start}
          >
            {t('newgame.start')}
          </button>
        </footer>
      </div>
    </div>
  );
}
