import { createEmptyState, playerPower, weekOf, type GameState } from '@heroes/engine';
import { appStore, useApp } from '../app/store';
import { navigate } from '../app/router';
import { humanId } from '../app/game';
import { t } from '../app/i18n';
import { outcomeBackgroundUrl } from '../render/assets';
import './OutcomeOverlay.css';

/**
 * Overlay victoire/défaite (doc 02 §6, plan phase-3.5 lot U ; graphique U6b) :
 * monté par `Shell` dès que `game.outcome !== null`. Non fermable autrement que
 * par « Retour au menu » — la partie est terminée. Affiche un graphique de
 * puissance par joueur (doc 08 §2.5), calculé sur l'état final avant le reset.
 */
export function OutcomeOverlay() {
  useApp((s) => s.locale); // réactivité i18n
  const outcome = useApp((s) => s.game.outcome);
  // Réf `s.game` STABLE ; les données du graphique sont dérivées DANS le corps
  // (un sélecteur renvoyant un tableau frais bouclerait à l'infini, cf. U4).
  const game = useApp((s) => s.game);
  if (!outcome) return null;

  const backToMenu = (): void => {
    appStore.setState({ game: createEmptyState() });
    // B13 : passer par `navigate('menu')` — le SEUL point qui remet `turnAck`,
    // `playerColors` et `activeChapter` à zéro. Le setState direct historique
    // laissait ces résidus fuiter dans la partie suivante (couleurs réutilisées,
    // 1er overlay de passage hot-seat sauté, progression de campagne corrompue).
    navigate('menu');
  };

  const bg = outcomeBackgroundUrl(outcome.status);

  // Hot-seat (Alpha 4.15) : à ≥ 2 humains, « Victoire/Défaite » (centré sur soi)
  // n'a pas de sens — on nomme le vainqueur (numéro de siège).
  const multiHuman = game.players.filter((p) => p.controller === 'human').length >= 2;
  const winnerSeat = game.players.findIndex((p) => p.id === outcome.winnerPlayerId) + 1;
  const title =
    multiHuman && winnerSeat > 0
      ? t('outcome.winner', { n: winnerSeat })
      : t(outcome.status === 'won' ? 'outcome.won' : 'outcome.lost');

  return (
    <div class="modal-backdrop">
      <div
        class="modal outcome-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="outcome-overlay"
        style={bg ? { backgroundImage: `url(${bg})` } : undefined}
      >
        <h2 data-testid="outcome-status">{title}</h2>
        <StatsSummary game={game} />
        <PowerChart game={game} />
        <button class="menu-button" data-testid="outcome-back-to-menu" onClick={backToMenu}>
          {t('outcome.backToMenu')}
        </button>
      </div>
    </div>
  );
}

/**
 * Récapitulatif de fin de partie (UX-ENDSTATS, doc 08 §2.5) : durée + avoirs
 * finaux du joueur humain, lus DIRECTEMENT de l'état final (aucun suivi moteur).
 * Les pertes cumulées (nécessitant un suivi côté moteur pour être exactes en
 * multi-joueurs/IA) restent différées.
 */
function StatsSummary({ game }: { game: GameState }) {
  const human = humanId(game);
  const day = game.calendar.day;
  const week = weekOf(day);
  const ownTowns = game.towns.filter((tw) => tw.ownerPlayerId === human);
  const heroes = game.heroes.filter((h) => h.playerId === human);
  const bestLevel = heroes.reduce((m, h) => Math.max(m, h.level), 0);
  const armyUnits =
    heroes.reduce((sum, h) => sum + h.army.reduce((n, s) => n + s.count, 0), 0) +
    ownTowns.reduce((sum, tw) => sum + tw.garrison.reduce((n, s) => n + s.count, 0), 0);
  return (
    <dl class="outcome-stats" data-testid="outcome-stats">
      <div>
        <dt>{t('outcome.duration')}</dt>
        <dd data-testid="outcome-duration">{t('outcome.durationValue', { day, week })}</dd>
      </div>
      <div>
        <dt>{t('outcome.townsOwned')}</dt>
        <dd>{ownTowns.length}</dd>
      </div>
      <div>
        <dt>{t('outcome.heroesOwned')}</dt>
        <dd>{t('outcome.heroesValue', { count: heroes.length, level: bestLevel })}</dd>
      </div>
      <div>
        <dt>{t('outcome.armyUnits')}</dt>
        <dd>{armyUnits}</dd>
      </div>
    </dl>
  );
}

/** Teintes catégorielles (thème sombre) validées dataviz — assignées par joueur (identité, pas rang). */
const SERIES = ['#3987e5', '#199e70', '#c98500', '#9085e9'];

const BAR_H = 26;
const GAP = 12;
const PAD_L = 104; // colonne des libellés
const PAD_R = 52; // colonne des valeurs
const TOP = 6;
const CHART_W = 340;

/**
 * Graphique de puissance de fin de partie (doc 08 §2.5) : barres horizontales,
 * une par joueur, triées par puissance décroissante. Double encodage (libellé +
 * valeur en étiquette directe) : jamais la couleur seule (accessibilité §4).
 * Couleur = identité du joueur (ordre d'origine), pas rang.
 */
function PowerChart({ game }: { game: GameState }) {
  const human = humanId(game);
  let aiCount = 0;
  const bars = game.players
    .map((p, i) => {
      const isHuman = p.id === human;
      const label = isHuman ? t('outcome.you') : t('outcome.ai', { n: ++aiCount });
      return { id: p.id, isHuman, label, color: SERIES[i % SERIES.length]!, power: playerPower(game, p.id) };
    })
    .sort((a, b) => b.power - a.power);
  if (bars.length === 0) return null;

  const maxPower = Math.max(1, ...bars.map((b) => b.power));
  const barMaxW = CHART_W - PAD_L - PAD_R;
  const height = TOP * 2 + bars.length * (BAR_H + GAP) - GAP;
  const summary = bars.map((b) => `${b.label} ${b.power}`).join(', ');

  return (
    <figure class="power-chart" data-testid="outcome-power-chart">
      <figcaption class="power-chart-title">{t('outcome.powerTitle')}</figcaption>
      <svg
        viewBox={`0 0 ${CHART_W} ${height}`}
        width="100%"
        role="img"
        aria-label={`${t('outcome.powerTitle')} — ${summary}`}
      >
        {bars.map((b, i) => {
          const y = TOP + i * (BAR_H + GAP);
          const w = Math.max(3, (b.power / maxPower) * barMaxW);
          return (
            <g key={b.id} data-testid="outcome-power-bar">
              <title>{`${b.label} : ${b.power}`}</title>
              <text class="power-label" x={PAD_L - 10} y={y + BAR_H / 2} dominant-baseline="central" text-anchor="end">
                {b.label}
              </text>
              <rect
                x={PAD_L}
                y={y}
                width={w}
                height={BAR_H}
                rx={4}
                fill={b.color}
                stroke={b.isHuman ? '#ffffff' : 'none'}
                stroke-width={b.isHuman ? 2 : 0}
              />
              <text class="power-value" x={PAD_L + w + 8} y={y + BAR_H / 2} dominant-baseline="central">
                {b.power}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
