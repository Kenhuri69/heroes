import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  RESOURCE_IDS,
  dailyMovementPoints,
  dailyIncome,
  xpForLevel,
  weekOf,
  type ArmyStack,
} from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { back, closeModalKind, openModal, useModals, useScreen } from '../app/router';
import { dispatch } from '../app/dispatch';
import { heroArchetype, humanHeroes, humanId, humanTowns, resolveSelectedHero } from '../app/game';
import { RESOURCE_COLORS } from '../render/mapObjects';
import { heroAvatarUrl, resourceIconUrl } from '../render/assets';
import { t, resolveUnitName } from '../app/i18n';
import { AssetImg } from './AssetImg';
import { UiIcon } from './UiIcon';
import { MenuScreen } from './MenuScreen';
import { MapEditor } from './MapEditor';
import { OptionsPanel } from './OptionsPanel';
import { SkirmishScreen } from './SkirmishScreen';
import { Journal } from './Journal';
import { ToastHost } from './toasts';
import { CombatUi } from './combat';
import { PreBattleScreen } from './PreBattleScreen';
import { TownScreen } from './TownScreen';
import { HeroSkills } from './HeroSkills';
import { HeroInventory } from './HeroInventory';
import { AdventureSpellbook } from './AdventureSpellbook';
import { SkillChoice } from './SkillChoice';
import { TreasureChoice } from './TreasureChoice';
import { HandoffOverlay } from './HandoffOverlay';
import { OutcomeOverlay } from './OutcomeOverlay';
import { FactionBadge } from './FactionBadge';
import { DialogueBox } from './DialogueBox';
import { CutsceneOverlay } from './CutsceneOverlay';
import { MiniMap } from './MiniMap';
import { QuestJournal } from './QuestJournal';
import { MapObjectCard } from './MapObjectCard';
import './tokens.css'; // design tokens UXD-1 — à charger avant toute feuille
import './interactions.css'; // micro-interactions & transitions UXD-7
import './styles.css';

export function mountUi(root: HTMLElement): void {
  render(<Shell />, root);
}

function Shell() {
  useApp((s) => s.locale); // réactivité i18n
  const screen = useScreen();
  const started = useApp((s) => s.game.started);
  const inCombat = useApp((s) => s.game.combat !== null);
  const preBattle = useApp((s) => s.preBattlePending);
  const modals = useModals();
  // Remédiation CL4 : la montée de niveau vise le héros du JOUEUR HUMAIN avec
  // un choix en attente (avant : `heroes[0]`, qui pouvait être un héros IA).
  const pendingSkillHero = useApp((s) => {
    const id = humanId(s.game);
    return s.game.heroes.find((h) => h.playerId === id && h.pendingSkillChoices.length > 0) ?? null;
  });
  // Trésor foulé (doc 02 §2.2) : modale forcée or/XP pour le joueur humain
  // uniquement — l'IA résout son choix dans son propre tour.
  const pendingTreasure = useApp((s) => {
    const pending = s.game.pendingTreasure;
    return pending && pending.playerId === humanId(s.game) ? pending : null;
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
  const skirmishModal = modals.some((m) => m.kind === 'skirmish');

  return (
    <>
      {screen === 'menu' ? (
        <MenuScreen />
      ) : screen === 'editor' ? (
        <MapEditor />
      ) : started ? (
        inCombat ? (
          preBattle ? (
            <PreBattleScreen />
          ) : (
            <CombatUi />
          )
        ) : (
          <>
            {/* UXD-3A : vignette de bord de monde (radial-gradient DOM, composée
                une fois — coût par-frame nul comme la toile de combat U5-E). */}
            <div class="map-vignette" aria-hidden="true" />
            <ResourceBar />
            <HeroDrawer />
            {/* UXD-0 R3 : armée + statut/actions dans UN conteneur en colonne —
                plus de blocs fixed indépendants qui se recouvrent au cran 3. */}
            <div class="bottom-hud">
              <ArmyBand />
              <TurnBar onOpenOptions={() => openModal({ kind: 'options' })} />
            </div>
            {/* Mini-carte : unique instance, montée dans le tiroir/colonne héros
                (bascule mobile, colonne persistante desktop). Plus de widget flottant. */}
            {/* Fiche d'objet de carte (doc 08 §2.1, lot M2) — appui long sur la carte. */}
            <MapObjectCard />
            {/* Fiche ressource (doc 08 §2.1, lot M6) — tap sur une ressource du bandeau. */}
            <ResourceDetail />
          </>
        )
      ) : null}
      {optionsModal && <OptionsPanel onClose={() => closeModalKind('options')} />}
      {skirmishModal && <SkirmishScreen onClose={() => closeModalKind('skirmish')} />}
      {townModal && <TownScreen townId={townModal.townId} onClose={() => closeModalKind('town')} />}
      {journalModal && <Journal onClose={() => closeModalKind('journal')} />}
      {pendingSkillHero && <SkillChoice hero={pendingSkillHero} />}
      {pendingTreasure && <TreasureChoice pending={pendingTreasure} />}
      {screen === 'adventure' && <HandoffOverlay />}
      {started && !inCombat && <CutsceneOverlay />}
      {started && !inCombat && <DialogueBox />}
      <OutcomeOverlay />
      <ToastHost />
    </>
  );
}

/**
 * Format compact des grands nombres (lot M5, C10) : ≥ 10 000 → « 12k »,
 * ≥ 10 000 000 → « 12M » — la barre tient sur une ligne en portrait. La valeur
 * EXACTE reste accessible (attribut `title` + `data-testid` inchangé pour le
 * smoke) ; la fiche détaillée au tap arrive au lot M6 (C8).
 */
function formatResourceShort(value: number): string {
  if (value >= 10_000_000) return `${Math.floor(value / 1_000_000)}M`;
  if (value >= 10_000) return `${Math.floor(value / 1000)}k`;
  return String(value);
}

/** Bandeau haut compact, tap = détail au lot M6 (doc 08 §2.1 mobile). */
function ResourceBar() {
  const player = useApp((s) => s.game.players.find((p) => p.id === humanId(s.game)));
  if (!player) return null;
  // Ressources de faction (doc 05 §3.3) : affichées après les 7 communes, seulement
  // celles que le joueur possède (Essence pour Arcane Hunters ; rien sinon).
  const factionResources = Object.entries(player.factionResources);
  return (
    <header class="resource-bar">
      {RESOURCE_IDS.map((id) => (
        <button
          type="button"
          class="resource"
          key={id}
          data-resource={id}
          data-testid={`resource-open-${id}`}
          aria-label={`${t(`resource.${id}`)} : ${player.resources[id]}`}
          onClick={() => appStore.setState({ resourceDetail: id })}
        >
          <AssetImg
            src={resourceIconUrl(id, 24)}
            alt=""
            class="resource-icon"
            fallback={
              <i style={{ background: `#${(RESOURCE_COLORS[id] ?? 0xffffff).toString(16).padStart(6, '0')}` }} />
            }
          />
          <span data-testid={`resource-${id}`} title={String(player.resources[id])}>
            {formatResourceShort(player.resources[id])}
          </span>
        </button>
      ))}
      {factionResources.map(([id, amount]) => (
        <span class="resource resource--faction" key={id} data-resource={id}>
          <AssetImg src={resourceIconUrl(id, 24)} alt="" class="resource-icon" fallback={<i />} />
          <span data-testid={`faction-resource-${id}`} title={String(amount)}>
            {formatResourceShort(amount)}
          </span>
        </span>
      ))}
    </header>
  );
}

/**
 * Fiche ressource (doc 08 §2.1 « tap = détail », lot M6 C8) : stock + revenu/jour
 * de toutes les ressources communes (villes + mines + compétence Économie via le
 * helper moteur pur `dailyIncome`). Overlay léger hors pile de modales (même
 * patron que `MapObjectCard`) — backdrop / × / Échap.
 */
function ResourceDetail() {
  useApp((s) => s.locale);
  const opened = useApp((s) => s.resourceDetail);
  const game = useApp((s) => s.game);
  const player = game.players.find((p) => p.id === humanId(game));
  const close = (): void => appStore.setState({ resourceDetail: null });
  useEffect(() => {
    if (!opened) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened]);
  if (!opened || !player) return null;
  const income = dailyIncome(game, player.id);
  return (
    <div class="map-card-backdrop" onClick={close}>
      <section
        class="map-card resource-detail"
        data-testid="resource-detail"
        role="dialog"
        aria-label={t('resourceDetail.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="map-card-header">
          <h3>{t('resourceDetail.title')}</h3>
          <button
            type="button"
            class="map-card-close"
            data-testid="resource-detail-close"
            aria-label={t('mapCard.close')}
            onClick={close}
          >
            ×
          </button>
        </header>
        <dl class="resource-detail-list">
          {RESOURCE_IDS.map((id) => (
            <div key={id} class={id === opened ? 'resource-detail-row current' : 'resource-detail-row'}>
              <dt>
                <AssetImg src={resourceIconUrl(id, 24)} alt="" class="resource-icon" fallback={<i />} />
                {t(`resource.${id}`)}
              </dt>
              <dd>
                {player.resources[id]}
                <span class="resource-detail-income">
                  {t('resourceDetail.perDay', { amount: income[id] ?? 0 })}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
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
 * Bandeau de portraits (doc 08 §2.1, lot UX U4) : sélectionne le héros humain
 * actif parmi tous ceux du joueur. Avec un seul héros, un unique bouton déjà
 * sélectionné — comportement identique à avant U4.
 */
function HeroStrip() {
  useApp((s) => s.locale);
  // Sélectionne `s.game` (réf stable) puis dérive la liste dans le corps : un
  // sélecteur renvoyant `game.heroes.filter(...)` créerait un NOUVEAU tableau à
  // chaque appel → `useSyncExternalStore` boucle à l'infini (renderer tué).
  const game = useApp((s) => s.game);
  const heroes = humanHeroes(game);
  const selectedId = useApp((s) => resolveSelectedHero(s.game, s.selectedHeroId)?.id);
  return (
    <ol class="hero-strip" data-testid="hero-strip">
      {heroes.map((h) => (
        <li key={h.id}>
          <button
            class={`hero-portrait${h.id === selectedId ? ' selected' : ''}`}
            data-testid={`hero-select-${h.id}`}
            aria-pressed={h.id === selectedId}
            aria-label={t('hero.select', { level: h.level })}
            onClick={() => appStore.setState({ selectedHeroId: h.id })}
          >
            <span class="hero-portrait-mini" aria-hidden="true" />
            <span class="hero-portrait-level">{h.level}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Tiroir latéral (doc 08 §2.1) : portrait placeholder, niveau/XP, attributs,
 * armée 7 slots lecture seule, pour le héros SÉLECTIONNÉ (bandeau `HeroStrip`
 * en tête, lot UX U4). Mobile : ancré à gauche, replié par défaut
 * (hamburger ≥ 44 px) ; desktop : ancré à droite via media query CSS.
 */
function HeroDrawer() {
  useApp((s) => s.locale);
  const hero = useApp((s) => resolveSelectedHero(s.game, s.selectedHeroId));
  const config = useApp((s) => s.game.config);
  const [open, setOpen] = useState(false);
  if (!hero) return null;
  // Jauge d'XP (lot M6 C24) : progression vers le seuil du prochain niveau
  // (`xpForLevel`) ; « niveau max » au cap (barre pleine).
  const atMax = !config || hero.level >= config.hero.maxLevel;
  const nextXp = config && !atMax ? xpForLevel(config.hero, hero.level + 1) : hero.xp;
  const prevXp = config && !atMax ? xpForLevel(config.hero, hero.level) : 0;
  const xpRatio = atMax || nextXp <= prevXp ? 1 : Math.min(1, (hero.xp - prevXp) / (nextXp - prevXp));
  return (
    <>
      <button
        class="drawer-toggle"
        data-testid="hero-drawer-toggle"
        aria-label={t('hero.drawerToggle')}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon id="act-hero" fallback="☰" />
      </button>
      <aside class={`hero-drawer${open ? ' open' : ''}`} data-testid="hero-drawer">
        <HeroStrip />
        {/* Mini-carte mobile (le widget fixe est desktop only) : masquée ≥ 900px par CSS. */}
        <h3 class="hero-army-title hero-minimap-title">{t('hero.minimapTitle')}</h3>
        <MiniMap variant="drawer" />
        <AssetImg
          src={heroAvatarUrl(hero.factionId, heroArchetype(hero.attributes))}
          alt=""
          class="hero-avatar"
          fallback={<div class="hero-portrait-placeholder" aria-hidden="true" />}
        />
        <div class="hero-level" data-testid="hero-level">
          {t('hero.level', { level: hero.level })}
        </div>
        <div class="hero-xp" data-testid="hero-xp">
          {atMax ? t('hero.xpMax', { xp: hero.xp }) : t('hero.xpProgress', { xp: hero.xp, next: nextXp })}
          <span class="gauge" aria-hidden="true">
            <span class="gauge-fill" style={{ width: `${Math.round(xpRatio * 100)}%` }} />
          </span>
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
        <AdventureSpellbook hero={hero} />
        <QuestJournal />
      </aside>
    </>
  );
}

/** Bandeau bas repliable (portrait, doc 08 §2.1) — accès rapide à l'armée du héros sélectionné. */
function ArmyBand() {
  useApp((s) => s.locale);
  const hero = useApp((s) => resolveSelectedHero(s.game, s.selectedHeroId));
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
  const hero = useApp((s) => resolveSelectedHero(s.game, s.selectedHeroId));
  const hint = useApp((s) => s.guardianHint);
  const bands = useApp((s) => s.strengthBands);
  const pathPreviewActive = useApp((s) => s.pathPreviewActive);
  const config = useApp((s) => s.game.config);
  const unitCatalog = useApp((s) => s.game.unitCatalog);
  // Réf `s.game` stable puis dérivation dans le corps (cf. HeroStrip) : un
  // sélecteur `humanTowns(s.game)` renverrait un nouveau tableau → boucle infinie.
  const towns = humanTowns(useApp((s) => s.game));
  const unread = useApp((s) => s.journalUnread);
  return (
    <div class="turn-row">
      <div class="status-bar">
        <span data-testid="calendar">{t('turnBar.calendar', { day, week: weekOf(day) })}</span>
        {hero && config && (() => {
          // Jauge de PM (lot M6 C9) : restants / max du jour (doc 02 §1.5) —
          // la barre double le chiffre (2ᵉ canal), jamais la couleur seule.
          const max = dailyMovementPoints(config, hero.army, unitCatalog);
          const ratio = max > 0 ? Math.min(1, hero.movementPoints / max) : 0;
          return (
            <span class="movement-gauge">
              <span data-testid="movement-points">
                {t('turnBar.movementPoints', { points: hero.movementPoints, max })}
              </span>
              <span class="gauge" aria-hidden="true">
                <span class="gauge-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
              </span>
            </span>
          );
        })()}
        {hint && (
          <span class="guardian-hint" data-testid="guardian-hint">
            <UiIcon id="act-combat" fallback="⚔" /> {guardianBand(hint.count, bands)}
          </span>
        )}
        {/* Annulation de la préviz (doc 08 §3, lot M2 C7) — pas d'undo après
            exécution : une découverte a pu être révélée. */}
        {pathPreviewActive && (
          <button
            type="button"
            class="cancel-path"
            data-testid="cancel-path"
            onClick={() => window.dispatchEvent(new CustomEvent('heroes:cancel-path'))}
          >
            {t('adventure.cancelPath')}
          </button>
        )}
      </div>
      <div class="actions">
        <button
          class="options-toggle"
          data-testid="options-open"
          aria-label={t('options.title')}
          onClick={onOpenOptions}
        >
          <UiIcon id="act-options" fallback="⚙" />
        </button>
        <button
          class="journal-toggle"
          data-testid="journal-open"
          aria-label={t('journal.open')}
          onClick={() => openModal({ kind: 'journal' })}
        >
          <UiIcon id="act-journal" fallback="🔔" />
          {unread > 0 && (
            <span class="journal-badge" data-testid="journal-unread">
              {unread}
            </span>
          )}
        </button>
        {/* Sauvegarder/Charger déplacés vers Options (lot M5, C11) : l'autosave
            de fin de tour couvre le cas courant ; la barre de tour ne garde que
            le geste le plus fréquent (Fin de tour) et les entrées de contexte. */}
        {towns.map((town) => (
          <button
            key={town.id}
            class="town-open"
            data-testid={`town-open-${town.id}`}
            onClick={() => openModal({ kind: 'town', townId: town.id })}
          >
            <FactionBadge factionId={town.factionId} />
            {t('town.open')}
          </button>
        ))}
        <button
          class="end-turn"
          data-testid="end-turn"
          onClick={() => void dispatch({ type: 'EndTurn', playerId: humanPlayerId })}
        >
          {t('turnBar.endTurn')}
        </button>
      </div>
    </div>
  );
}
