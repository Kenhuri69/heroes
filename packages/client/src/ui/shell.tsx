import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { RESOURCE_IDS, weekOf, type ArmyStack } from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { back, closeModalKind, openModal, useModals, useScreen } from '../app/router';
import { dispatch } from '../app/dispatch';
import { humanId } from '../app/game';
import { saveGame, restoreSavedGame } from '../app/save';
import { eventBus } from '../app/events';
import { RESOURCE_COLORS } from '../render/mapObjects';
import { resourceIconUrl } from '../render/assets';
import { t, resolveUnitName } from '../app/i18n';
import { AssetImg } from './AssetImg';
import { MenuScreen } from './MenuScreen';
import { OptionsPanel } from './OptionsPanel';
import { Journal } from './Journal';
import { ToastHost, pushToast } from './toasts';
import { CombatUi } from './combat';
import { TownScreen } from './TownScreen';
import { HeroSkills } from './HeroSkills';
import { HeroInventory } from './HeroInventory';
import { SkillChoice } from './SkillChoice';
import { OutcomeOverlay } from './OutcomeOverlay';
import './styles.css';

export function mountUi(root: HTMLElement): void {
  render(<Shell />, root);
}

function Shell() {
  useApp((s) => s.locale); // réactivité i18n
  const screen = useScreen();
  const started = useApp((s) => s.game.started);
  const inCombat = useApp((s) => s.game.combat !== null);
  const modals = useModals();
  // Remédiation CL4 : la montée de niveau vise le héros du JOUEUR HUMAIN avec
  // un choix en attente (avant : `heroes[0]`, qui pouvait être un héros IA).
  const pendingSkillHero = useApp((s) => {
    const id = humanId(s.game);
    return s.game.heroes.find((h) => h.playerId === id && h.pendingSkillChoices.length > 0) ?? null;
  });

  // Bouton retour Android / geste / Échap (doc 08 §3) : ferme la modale du
  // dessus. Les overlays forcés (choix de compétence, fin de partie) ne sont
  // pas dans la pile ⇒ `back()` renvoie false et les laisse intacts.
  const modalDepth = modals.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (modalDepth === 0) return;
    // Une entrée d'historique tant qu'une modale est ouverte : le retour
    // matériel Android dépile au lieu de quitter la page.
    history.pushState(null, '');
    const onPop = (): void => {
      back();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [modalDepth === 0]);

  const optionsModal = modals.some((m) => m.kind === 'options');
  const townModal = modals.find((m): m is { kind: 'town'; townId: string } => m.kind === 'town');
  const journalModal = modals.some((m) => m.kind === 'journal');

  return (
    <>
      {screen === 'menu' ? (
        <MenuScreen />
      ) : started ? (
        inCombat ? (
          <CombatUi />
        ) : (
          <>
            <ResourceBar />
            <HeroDrawer />
            <ArmyBand />
            <TurnBar onOpenOptions={() => openModal({ kind: 'options' })} />
          </>
        )
      ) : null}
      {optionsModal && <OptionsPanel onClose={() => closeModalKind('options')} />}
      {townModal && <TownScreen townId={townModal.townId} onClose={() => closeModalKind('town')} />}
      {journalModal && <Journal onClose={() => closeModalKind('journal')} />}
      {pendingSkillHero && <SkillChoice hero={pendingSkillHero} />}
      <OutcomeOverlay />
      <ToastHost />
    </>
  );
}

/** Bandeau haut compact, tap = détail plus tard (doc 08 §2.1 mobile). */
function ResourceBar() {
  const player = useApp((s) => s.game.players.find((p) => p.id === humanId(s.game)));
  if (!player) return null;
  // Ressources de faction (doc 05 §3.3) : affichées après les 7 communes, seulement
  // celles que le joueur possède (Essence pour Arcane Hunters ; rien sinon).
  const factionResources = Object.entries(player.factionResources);
  return (
    <header class="resource-bar">
      {RESOURCE_IDS.map((id) => (
        <span class="resource" key={id} data-resource={id}>
          <AssetImg
            src={resourceIconUrl(id, 24)}
            alt=""
            class="resource-icon"
            fallback={
              <i style={{ background: `#${(RESOURCE_COLORS[id] ?? 0xffffff).toString(16).padStart(6, '0')}` }} />
            }
          />
          <span data-testid={`resource-${id}`}>{player.resources[id]}</span>
        </span>
      ))}
      {factionResources.map(([id, amount]) => (
        <span class="resource resource--faction" key={id} data-resource={id}>
          <AssetImg src={resourceIconUrl(id, 24)} alt="" class="resource-icon" fallback={<i />} />
          <span data-testid={`faction-resource-${id}`}>{amount}</span>
        </span>
      ))}
    </header>
  );
}

function guardianBand(count: number, bands: { max: number | null; key: string }[]): string {
  const band = bands.find((b) => b.max === null || count <= b.max);
  return band ? t(`guardianBand.${band.key}`) : '';
}

/** 7 slots d'armée en lecture seule (doc 08 §2.1) — partagé tiroir héros + bandeau bas. */
function ArmySlots({ army }: { army: ArmyStack[] }) {
  return (
    <ol class="army-slots" data-testid="army-slots">
      {Array.from({ length: 7 }, (_, i) => army[i]).map((stack, i) => (
        <li key={i} class={stack ? 'army-slot filled' : 'army-slot empty'}>
          {stack && (
            <>
              <span class="army-slot-name">{resolveUnitName(stack.unitId)}</span>
              <span class="army-slot-count">×{stack.count}</span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Tiroir latéral (doc 08 §2.1) : portrait placeholder, niveau/XP, attributs,
 * armée 7 slots lecture seule. Mobile : ancré à gauche, replié par défaut
 * (hamburger ≥ 44 px) ; desktop : ancré à droite via media query CSS.
 */
function HeroDrawer() {
  useApp((s) => s.locale);
  const hero = useApp((s) => s.game.heroes.find((h) => h.playerId === humanId(s.game)));
  const [open, setOpen] = useState(false);
  if (!hero) return null;
  return (
    <>
      <button
        class="drawer-toggle"
        data-testid="hero-drawer-toggle"
        aria-label={t('hero.drawerToggle')}
        onClick={() => setOpen((o) => !o)}
      >
        ☰
      </button>
      <aside class={`hero-drawer${open ? ' open' : ''}`} data-testid="hero-drawer">
        <div class="hero-portrait-placeholder" aria-hidden="true" />
        <div class="hero-level" data-testid="hero-level">
          {t('hero.level', { level: hero.level })}
        </div>
        <div class="hero-xp" data-testid="hero-xp">
          {t('hero.xp', { xp: hero.xp })}
        </div>
        <div class="hero-mana" data-testid="hero-mana">
          {t('hero.mana', { mana: hero.mana, manaMax: hero.manaMax })}
        </div>
        <dl class="hero-attributes">
          <div>
            <dt>{t('attribute.attack')}</dt>
            <dd>{hero.attributes.attack}</dd>
          </div>
          <div>
            <dt>{t('attribute.defense')}</dt>
            <dd>{hero.attributes.defense}</dd>
          </div>
          <div>
            <dt>{t('attribute.power')}</dt>
            <dd>{hero.attributes.power}</dd>
          </div>
          <div>
            <dt>{t('attribute.knowledge')}</dt>
            <dd>{hero.attributes.knowledge}</dd>
          </div>
        </dl>
        <h3 class="hero-army-title">{t('army.title')}</h3>
        <ArmySlots army={hero.army} />
        <HeroSkills hero={hero} />
        <HeroInventory hero={hero} />
      </aside>
    </>
  );
}

/** Bandeau bas repliable (portrait, doc 08 §2.1) — accès rapide à l'armée. */
function ArmyBand() {
  useApp((s) => s.locale);
  const hero = useApp((s) => s.game.heroes.find((h) => h.playerId === humanId(s.game)));
  const [collapsed, setCollapsed] = useState(false);
  if (!hero) return null;
  return (
    <div class={`army-band${collapsed ? ' collapsed' : ''}`} data-testid="army-band">
      <button class="army-band-toggle" onClick={() => setCollapsed((c) => !c)}>
        {t('army.title')} {collapsed ? '▲' : '▼'}
      </button>
      {!collapsed && <ArmySlots army={hero.army} />}
    </div>
  );
}

/** Jour/semaine, points de mouvement, sauvegarde et gros bouton fin de tour (doc 08 §2.1). */
function TurnBar({ onOpenOptions }: { onOpenOptions: () => void }) {
  useApp((s) => s.locale);
  const day = useApp((s) => s.game.calendar.day);
  const humanPlayerId = useApp((s) => humanId(s.game));
  const hero = useApp((s) => s.game.heroes.find((h) => h.playerId === humanPlayerId));
  const hint = useApp((s) => s.guardianHint);
  const bands = useApp((s) => s.strengthBands);
  const firstOwnedTown = useApp((s) => s.game.towns.find((town) => town.ownerPlayerId === humanId(s.game)));
  const unread = useApp((s) => s.journalUnread);
  return (
    <>
      <div class="status-bar">
        <span data-testid="calendar">{t('turnBar.calendar', { day, week: weekOf(day) })}</span>
        {hero && (
          <span data-testid="movement-points">
            {t('turnBar.movementPoints', { points: hero.movementPoints })}
          </span>
        )}
        {hint && (
          <span class="guardian-hint" data-testid="guardian-hint">
            ⚔ {guardianBand(hint.count, bands)}
          </span>
        )}
      </div>
      <div class="actions">
        <button
          class="options-toggle"
          data-testid="options-open"
          aria-label={t('options.title')}
          onClick={onOpenOptions}
        >
          ⚙
        </button>
        <button
          class="journal-toggle"
          data-testid="journal-open"
          aria-label={t('journal.open')}
          onClick={() => openModal({ kind: 'journal' })}
        >
          🔔
          {unread > 0 && (
            <span class="journal-badge" data-testid="journal-unread">
              {unread}
            </span>
          )}
        </button>
        <button
          data-testid="save"
          onClick={() =>
            void saveGame(appStore.getState().game, 'manual')
              .then(() => pushToast(t('toast.saved')))
              .catch(() => eventBus.emit([{ type: 'SaveFailed' }]))
          }
        >
          {t('turnBar.save')}
        </button>
        <button data-testid="load" onClick={() => void restoreSavedGame('manual')}>
          {t('turnBar.load')}
        </button>
        {firstOwnedTown && (
          <button
            data-testid="town-open"
            onClick={() => openModal({ kind: 'town', townId: firstOwnedTown.id })}
          >
            {t('town.open')}
          </button>
        )}
        <button
          class="end-turn"
          data-testid="end-turn"
          onClick={() => void dispatch({ type: 'EndTurn', playerId: humanPlayerId })}
        >
          {t('turnBar.endTurn')}
        </button>
      </div>
    </>
  );
}
