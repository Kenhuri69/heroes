import { armyStrength, dailyIncome, RESOURCE_IDS, type HeroState } from '@heroes/engine';
import { appStore, useApp } from '../app/store';
import { t, resolveHeroName, resolveLoc } from '../app/i18n';
import { closeModalKind, openModal } from '../app/router';
import { humanId, heroArchetype } from '../app/game';
import { panCameraTo, DEFAULT_PAN_MS } from '../app/camera-control';
import { reduceMotion } from '../app/motion';
import { heroAvatarUrl, resourceIconUrl, unitSpriteUrl } from '../render/assets';
import { FactionBadge } from './FactionBadge';
import { UiIcon } from './UiIcon';
import './KingdomOverview.css';

/**
 * Vue de royaume (E1, doc 18 §2.E, sprint 3) : répond en UN écran à « où en
 * suis-je ? » dès 2+ villes/héros — villes (chantier du jour, garnison résumée),
 * héros (niveau, PM, puissance d'armée), revenus/jour agrégés — avec navigation
 * directe (tap ville ⇒ `TownScreen` ; tap héros ⇒ centrage caméra + sélection).
 * **Client pur, lecture seule** : toutes les données viennent de l'état ou de
 * helpers PURS `@heroes/engine` (`dailyIncome`, `armyStrength`) — zéro formule
 * dupliquée, zéro diff moteur. La vue montre le royaume du **joueur humain
 * actif** (`humanId`), jamais un id en dur. Se ferme avant d'ouvrir une ville
 * (remplacement, pile de modales ≤ 2, doc 08).
 */
export function KingdomOverview({ onClose }: { onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const game = useApp((s) => s.game);
  const pid = humanId(game);
  const towns = game.towns.filter((tn) => tn.ownerPlayerId === pid);
  const heroes = game.heroes.filter((h) => h.playerId === pid);
  const income = dailyIncome(game, pid);
  const day = game.calendar.day;
  const week = Math.floor((day - 1) / 7) + 1;
  const incomeIds = RESOURCE_IDS.filter((r) => (income[r] ?? 0) !== 0);

  const openTown = (id: string): void => {
    closeModalKind('kingdom'); // remplacement, pas empilement
    openModal({ kind: 'town', townId: id });
  };
  const goToHero = (h: HeroState): void => {
    closeModalKind('kingdom');
    appStore.setState({ selectedHeroId: h.id });
    void panCameraTo(h.pos.x, h.pos.y, reduceMotion() ? 0 : DEFAULT_PAN_MS);
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal kingdom-panel chrome-framed"
        role="dialog"
        aria-modal="true"
        aria-label={t('kingdom.title')}
        data-testid="kingdom-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('kingdom.title')}</h2>
          <button class="modal-close" data-testid="kingdom-close" aria-label={t('kingdom.close')} onClick={onClose}>
            ×
          </button>
        </header>

        <div class="kingdom-summary" data-testid="kingdom-summary">
          <span class="kingdom-date">{t('kingdom.dayWeek', { day, week })}</span>
          <ul class="kingdom-income">
            {incomeIds.length === 0 ? (
              <li class="kingdom-income-none">{t('kingdom.noIncome')}</li>
            ) : (
              incomeIds.map((r) => {
                const url = resourceIconUrl(r);
                return (
                  <li key={r} class="kingdom-income-item" title={t(`resource.${r}`)}>
                    {url ? (
                      <img src={url} alt={t(`resource.${r}`)} width={20} height={20} />
                    ) : (
                      <span class="kingdom-income-label">{t(`resource.${r}`)}</span>
                    )}
                    <span class="kingdom-income-val">+{income[r]}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div class="kingdom-body">
          <section class="kingdom-section" data-testid="kingdom-towns">
            <h3>{t('kingdom.towns', { count: towns.length })}</h3>
            {towns.length === 0 ? (
              <p class="kingdom-empty">{t('kingdom.noTowns')}</p>
            ) : (
              <ul class="kingdom-list">
                {towns.map((tn) => (
                  <li key={tn.id}>
                    <button
                      class="kingdom-town"
                      data-testid={`kingdom-town-${tn.id}`}
                      onClick={() => openTown(tn.id)}
                    >
                      <FactionBadge factionId={tn.factionId} />
                      <span class="kingdom-town-name">{resolveLoc(`faction.${tn.factionId}.name`)}</span>
                      <span class={`kingdom-town-build ${tn.builtToday ? 'is-used' : 'is-free'}`}>
                        <UiIcon id="tab-build" fallback="⚒" />{' '}
                        {t(tn.builtToday ? 'town.buildQueueUsed' : 'town.buildQueueFree')}
                      </span>
                      <span class="kingdom-town-garrison">
                        {tn.garrison.length === 0 ? (
                          <span class="kingdom-garrison-empty">{t('kingdom.emptyGarrison')}</span>
                        ) : (
                          tn.garrison.slice(0, 7).map((s, i) => {
                            const url = unitSpriteUrl(s.unitId, game.unitCatalog[s.unitId]?.groupId);
                            return (
                              <span key={i} class="kingdom-unit" title={`×${s.count}`}>
                                {url ? <img src={url} alt="" width={22} height={22} /> : <span class="kingdom-unit-dot" />}
                                <span class="kingdom-unit-count">{s.count}</span>
                              </span>
                            );
                          })
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section class="kingdom-section" data-testid="kingdom-heroes">
            <h3>{t('kingdom.heroes', { count: heroes.length })}</h3>
            {heroes.length === 0 ? (
              <p class="kingdom-empty">{t('kingdom.noHeroes')}</p>
            ) : (
              <ul class="kingdom-list">
                {heroes.map((h) => {
                  const avatar = heroAvatarUrl(h.factionId, heroArchetype(h.attributes), h.name);
                  return (
                    <li key={h.id}>
                      <button
                        class="kingdom-hero"
                        data-testid={`kingdom-hero-${h.id}`}
                        onClick={() => goToHero(h)}
                      >
                        {avatar ? (
                          <img class="kingdom-hero-avatar" src={avatar} alt="" width={40} height={40} />
                        ) : (
                          <span class="kingdom-hero-avatar placeholder">
                            <FactionBadge factionId={h.factionId} />
                          </span>
                        )}
                        <span class="kingdom-hero-info">
                          <span class="kingdom-hero-name">
                            {h.name ? resolveHeroName(h.name) : t('hero.genericName')}
                          </span>
                          <span class="kingdom-hero-stats">
                            {t('kingdom.level', { level: h.level })} · {t('kingdom.movement', { pm: h.movementPoints })}{' '}
                            · {t('kingdom.strength', { power: armyStrength(h.army, game.unitCatalog) })}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
