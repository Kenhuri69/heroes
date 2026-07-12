import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  RESOURCE_IDS,
  dailyMovementPoints,
  dailyIncome,
  xpForLevel,
  weekOf,
  type ArmyStack,
  type CombatUnitDef,
  type HeroState,
} from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { back, closeModalKind, openModal, useModals, useScreen } from '../app/router';
import { requestEndTurn, confirmPendingEndTurn, cancelPendingEndTurn } from '../app/end-turn';
import { dispatch } from '../app/dispatch';
import {
  adjacentFriendlyHeroes,
  heroArchetype,
  humanHeroes,
  humanId,
  humanTowns,
  resolveSelectedHero,
} from '../app/game';
import { RESOURCE_COLORS } from '../render/mapObjects';
import { playerColor } from '../render/playerColors';
import { heroAvatarUrl, resourceIconUrl, unitSpriteUrl } from '../render/assets';
import {
  t,
  resolveUnitName,
  resolveAbilityName,
  resolveAbilityDescription,
  resolveHeroName,
  resolveSpecialtyName,
  resolveSpecialtyDesc,
} from '../app/i18n';
import { AssetImg } from './AssetImg';
import { UiIcon } from './UiIcon';
import { MenuScreen } from './MenuScreen';
import { MapEditor } from './MapEditor';
import { OptionsPanel } from './OptionsPanel';
import { SkirmishScreen } from './SkirmishScreen';
import { NewGameScreen } from './NewGameScreen';
import { BriefingScreen } from './BriefingScreen';
import { LoadingOverlay } from './LoadingOverlay';
import { Journal } from './Journal';
import { ToastHost } from './toasts';
import { CombatUi } from './combat';
import { PreBattleScreen } from './PreBattleScreen';
import { TownScreen } from './TownScreen';
import { HeroSwap } from './HeroSwap';
import { HeroSkills } from './HeroSkills';
import { HeroInventory } from './HeroInventory';
import { AdventureSpellbook } from './AdventureSpellbook';
import { SkillChoice } from './SkillChoice';
import { AttributeChoice } from './AttributeChoice';
import { TreasureChoice } from './TreasureChoice';
import { HandoffOverlay } from './HandoffOverlay';
import { OutcomeOverlay } from './OutcomeOverlay';
import { FactionBadge } from './FactionBadge';
import { DialogueBox } from './DialogueBox';
import { CutsceneOverlay } from './CutsceneOverlay';
import { MiniMap } from './MiniMap';
import { QuestJournal } from './QuestJournal';
import { MapObjectCard } from './MapObjectCard';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { panCameraTo, DEFAULT_PAN_MS } from '../app/camera-control';
import { reduceMotion } from '../app/motion';
import './tokens.css'; // design tokens UXD-1 — à charger avant toute feuille
import './interactions.css'; // micro-interactions & transitions UXD-7
import './styles.css';

export function mountUi(root: HTMLElement): void {
  render(<Shell />, root);
}

/**
 * Raccourci « N » (lot X7) : sélectionne le prochain héros humain ayant encore
 * des points de mouvement et recentre la caméra dessus. Cyclique depuis le héros
 * sélectionné ; no-op s'il n'y a qu'un (ou zéro) héros mobile — utile surtout
 * en multi-héros (U4). Présentation pure (pas de commande moteur).
 */
function selectNextHeroWithMoves(s: ReturnType<typeof appStore.getState>): void {
  const withMoves = humanHeroes(s.game).filter((h) => h.movementPoints > 0);
  if (withMoves.length === 0) return;
  const currentId = resolveSelectedHero(s.game, s.selectedHeroId)?.id;
  const idx = withMoves.findIndex((h) => h.id === currentId);
  const next = withMoves[(idx + 1) % withMoves.length]!;
  if (next.id === currentId) return; // déjà le seul héros mobile, déjà sélectionné
  appStore.setState({ selectedHeroId: next.id });
  void panCameraTo(next.pos.x, next.pos.y, reduceMotion() ? 0 : DEFAULT_PAN_MS);
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
  // Choix d'attribut à la montée (H-LEVELCHOICE, doc 02 §1.2) — même ciblage :
  // le héros du joueur humain avec une proposition d'attribut en attente.
  const pendingAttributeHero = useApp((s) => {
    const id = humanId(s.game);
    return s.game.heroes.find((h) => h.playerId === id && h.pendingAttributeChoices.length > 0) ?? null;
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
      if (e.key === 'Escape') {
        back();
        return;
      }
      // Raccourcis desktop (lot M8 C2), jamais requis : ignorés si une saisie a
      // le focus, si une modale/overlay est ouverte, ou hors de la carte. Le
      // combat a ses propres raccourcis (Espace/D) dans CombatUi.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
        return;
      const s = appStore.getState();
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (s.screen !== 'adventure' || s.game.combat || s.modals.length > 0 || s.pendingEndTurn) return;
      // « ? » ouvre l'aide des raccourcis (X7) — `e.key` vaut '?' (Maj+/), avant
      // le switch minuscule qui ne le verrait pas.
      if (e.key === '?') {
        openModal({ kind: 'shortcuts' });
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'e':
          requestEndTurn();
          break;
        case 'h':
          window.dispatchEvent(new CustomEvent('heroes:toggle-drawer'));
          break;
        case 'n':
          selectNextHeroWithMoves(s);
          break;
        case 't': {
          const town = humanTowns(s.game)[0];
          if (town) openModal({ kind: 'town', townId: town.id });
          break;
        }
      }
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
  const newgameModal = modals.some((m) => m.kind === 'newgame');
  const briefingModal = modals.find(
    (m): m is { kind: 'briefing'; scenarioId: string } => m.kind === 'briefing',
  );
  const shortcutsModal = modals.some((m) => m.kind === 'shortcuts');
  const heroswapModal = modals.find(
    (m): m is { kind: 'heroswap'; fromHeroId: string; toHeroId: string } => m.kind === 'heroswap',
  );

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
      {newgameModal && <NewGameScreen onClose={() => closeModalKind('newgame')} />}
      {briefingModal && (
        <BriefingScreen scenarioId={briefingModal.scenarioId} onClose={() => closeModalKind('briefing')} />
      )}
      {townModal && <TownScreen townId={townModal.townId} onClose={() => closeModalKind('town')} />}
      {heroswapModal && (
        <HeroSwap
          fromHeroId={heroswapModal.fromHeroId}
          toHeroId={heroswapModal.toHeroId}
          onClose={() => closeModalKind('heroswap')}
        />
      )}
      {journalModal && <Journal onClose={() => closeModalKind('journal')} />}
      {shortcutsModal && <ShortcutsOverlay onClose={() => closeModalKind('shortcuts')} />}
      {pendingSkillHero && <SkillChoice hero={pendingSkillHero} />}
      {/* Un seul choix forcé à la fois (pile ≤ 2, doc 08 §3) : l'attribut passe
          après la compétence si les deux sont en attente. */}
      {!pendingSkillHero && pendingAttributeHero && <AttributeChoice hero={pendingAttributeHero} />}
      {pendingTreasure && <TreasureChoice pending={pendingTreasure} />}
      <EndTurnConfirm />
      {screen === 'adventure' && <HandoffOverlay />}
      {started && !inCombat && <CutsceneOverlay />}
      {started && !inCombat && <DialogueBox />}
      <OutcomeOverlay />
      <LoadingOverlay />
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
  const game = useApp((s) => s.game);
  const player = game.players.find((p) => p.id === humanId(game));
  if (!player) return null;
  // Ressources de faction (doc 05 §3.3) : affichées après les 7 communes, seulement
  // celles que le joueur possède (Essence pour Arcane Hunters ; rien sinon).
  const factionResources = Object.entries(player.factionResources);
  // UX-RAIL (doc 08 §2.1, note M6) : revenu quotidien projeté affiché inline à
  // côté de chaque stock (desktop ; masqué en portrait compact via CSS). Helper
  // moteur pur partagé avec `ResourceDetail` — aucun calcul dupliqué (R7).
  const income = dailyIncome(game, player.id);
  return (
    <header class="resource-bar">
      {RESOURCE_IDS.map((id) => (
        <button
          type="button"
          class="resource"
          key={id}
          data-resource={id}
          data-testid={`resource-open-${id}`}
          aria-label={`${t(`resource.${id}`)} : ${player.resources[id]}${
            income[id] ? ` (${t('resourceDetail.perDay', { amount: income[id] ?? 0 })})` : ''
          }`}
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
          {income[id] ? (
            <span class="resource-income" data-testid={`resource-income-${id}`}>
              +{formatResourceShort(income[id] ?? 0)}
            </span>
          ) : null}
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

/**
 * Confirmation de fin de tour (lot M8 C12) : overlay léger quand un héros n'a
 * pas bougé (`pendingEndTurn` posé par `requestEndTurn`). Tap-tap : Confirmer /
 * Annuler ; Échap annule. Désactivable via l'option « Confirmer la fin de tour ».
 */
function EndTurnConfirm() {
  useApp((s) => s.locale);
  const pending = useApp((s) => s.pendingEndTurn);
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancelPendingEndTurn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);
  if (!pending) return null;
  return (
    <div class="map-card-backdrop" onClick={cancelPendingEndTurn}>
      <section
        class="map-card end-turn-confirm"
        data-testid="end-turn-confirm"
        role="dialog"
        aria-label={t('turnBar.confirmEndTurnTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <p class="map-card-line">{t('turnBar.confirmEndTurnBody')}</p>
        <div class="end-turn-confirm-actions">
          <button data-testid="end-turn-cancel" onClick={cancelPendingEndTurn}>
            {t('turnBar.confirmEndTurnCancel')}
          </button>
          <button class="end-turn-confirm-go" data-testid="end-turn-confirm-go" onClick={confirmPendingEndTurn}>
            {t('turnBar.confirmEndTurnGo')}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * 7 slots d'armée (doc 08 §2.1) — partagé tiroir héros + bandeau bas. Slot rempli
 * = vignette **encadrée** (asset de l'unité + effectif) qui ouvre au tap une fiche
 * détaillée (`UnitCard` : stats + capacités). Repli gracieux : si l'asset manque,
 * la vignette affiche le nom de l'unité.
 *
 * UX-REORDER (doc 08 §2.1/§2.3) : quand `heroId` est fourni et l'armée compte ≥ 2
 * piles, un bouton **« Réorganiser »** bascule un mode **tap-tap** (touch-first,
 * pas de drag obligatoire) : 1er tap = sélectionner une pile, 2ᵉ tap sur une autre
 * = la déplacer là (commande moteur `ReorderArmy`), re-tap = désélectionner.
 * L'ordre des slots pèse sur le placement de combat.
 */
function ArmySlots({ army, heroId }: { army: ArmyStack[]; heroId?: string }) {
  useApp((s) => s.locale); // réactivité i18n (noms d'unités/capacités)
  const catalog = useApp((s) => s.game.unitCatalog);
  const [inspected, setInspected] = useState<string | null>(null);
  const [mode, setMode] = useState<'none' | 'reorder' | 'split'>('none');
  const [picked, setPicked] = useState<number | null>(null);
  const [splitSlot, setSplitSlot] = useState<number | null>(null);
  const def = inspected ? catalog[inspected] : undefined;
  const canReorder = heroId !== undefined && army.length >= 2;
  // UX-SPLIT : séparer exige un slot libre (≤ 7) et une pile scindable (≥ 2).
  const canSplit = heroId !== undefined && army.length < 7 && army.some((s) => s.count >= 2);

  const setToggle = (target: 'reorder' | 'split'): void => {
    setMode((m) => (m === target ? 'none' : target));
    setPicked(null);
  };

  const tapSlot = (i: number, unitId: string, count: number): void => {
    if (mode === 'split') {
      if (count >= 2) setSplitSlot(i);
      return;
    }
    if (mode !== 'reorder') {
      setInspected(unitId);
      return;
    }
    if (picked === null) {
      setPicked(i);
      return;
    }
    if (picked === i) {
      setPicked(null);
      return;
    }
    dispatch({ type: 'ReorderArmy', heroId: heroId!, from: picked, to: i }).catch(() => {
      /* réorg invalide (hors tour) — sans conséquence, ignorée */
    });
    setPicked(null);
  };

  return (
    <>
      {(canReorder || canSplit) && (
        <div class="army-actions">
          {canReorder && (
            <button
              type="button"
              class="army-reorder-toggle"
              data-testid="army-reorder-toggle"
              aria-pressed={mode === 'reorder'}
              onClick={() => setToggle('reorder')}
            >
              {mode === 'reorder' ? t('army.reorder.done') : t('army.reorder.toggle')}
            </button>
          )}
          {canSplit && (
            <button
              type="button"
              class="army-reorder-toggle"
              data-testid="army-split-toggle"
              aria-pressed={mode === 'split'}
              onClick={() => setToggle('split')}
            >
              {mode === 'split' ? t('army.reorder.done') : t('army.split.toggle')}
            </button>
          )}
        </div>
      )}
      <ol class="army-slots" data-testid="army-slots">
        {Array.from({ length: 7 }, (_, i) => army[i]).map((stack, i) =>
          stack ? (
            <li
              key={i}
              class={`army-slot filled${mode === 'reorder' && picked === i ? ' picked' : ''}`}
            >
              <button
                type="button"
                class="army-slot-btn"
                data-testid={`army-slot-${i}`}
                disabled={mode === 'split' && stack.count < 2}
                aria-label={
                  mode === 'reorder'
                    ? t('army.reorder.move', { name: resolveUnitName(stack.unitId) })
                    : mode === 'split'
                      ? t('army.split.pick', { name: resolveUnitName(stack.unitId) })
                      : t('army.card.inspect', { name: resolveUnitName(stack.unitId) })
                }
                onClick={() => tapSlot(i, stack.unitId, stack.count)}
              >
                <span class="army-slot-portrait">
                  <AssetImg
                    src={unitSpriteUrl(stack.unitId, catalog[stack.unitId]?.groupId)}
                    alt=""
                    class="army-slot-img"
                    fallback={<span class="army-slot-name">{resolveUnitName(stack.unitId)}</span>}
                  />
                </span>
                <span class="army-slot-count">×{stack.count}</span>
              </button>
            </li>
          ) : (
            <li key={i} class="army-slot empty" aria-hidden="true" />
          ),
        )}
      </ol>
      {inspected && def && (
        <UnitCard unitId={inspected} def={def} onClose={() => setInspected(null)} />
      )}
      {splitSlot !== null && army[splitSlot] && heroId !== undefined && (
        <SplitDialog
          stack={army[splitSlot]!}
          onConfirm={(count) => {
            const from = splitSlot;
            dispatch({ type: 'SplitStack', heroId, from, count }).catch(() => {
              /* split invalide (hors tour) — sans conséquence, ignorée */
            });
            setSplitSlot(null);
            setMode('none');
          }}
          onClose={() => setSplitSlot(null)}
        />
      )}
    </>
  );
}

/**
 * UX-SPLIT (doc 08 §2.1/§2.3) : curseur de répartition **touch-first** pour
 * séparer une pile en deux. Aperçu « effectif restant | effectif détaché »,
 * slider + boutons ± (cibles ≥ 44px), confirmation ⇒ commande `SplitStack`.
 */
function SplitDialog({
  stack,
  onConfirm,
  onClose,
}: {
  stack: ArmyStack;
  onConfirm: (count: number) => void;
  onClose: () => void;
}) {
  useApp((s) => s.locale); // réactivité i18n
  const total = stack.count;
  const [count, setCount] = useState(Math.floor(total / 2) || 1);
  const name = resolveUnitName(stack.unitId);
  const clamp = (n: number): number => Math.max(1, Math.min(total - 1, n));
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="split-backdrop" onClick={onClose}>
      <section
        class="split-dialog"
        data-testid="split-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('army.split.title', { name })}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="split-dialog-header">{t('army.split.title', { name })}</header>
        <div class="split-preview" aria-hidden="true">
          <span class="split-preview-part">×{total - count}</span>
          <span class="split-preview-sep">|</span>
          <span class="split-preview-part">×{count}</span>
        </div>
        <div class="split-controls">
          <button
            type="button"
            class="split-step"
            aria-label={t('army.split.less')}
            onClick={() => setCount((c) => clamp(c - 1))}
          >
            −
          </button>
          <input
            type="range"
            class="split-range"
            data-testid="split-range"
            min={1}
            max={total - 1}
            value={count}
            aria-label={t('army.split.title', { name })}
            onInput={(e) => setCount(clamp(Number((e.target as HTMLInputElement).value)))}
          />
          <button
            type="button"
            class="split-step"
            aria-label={t('army.split.more')}
            onClick={() => setCount((c) => clamp(c + 1))}
          >
            +
          </button>
        </div>
        <div class="split-actions">
          <button type="button" class="split-cancel" onClick={onClose}>
            {t('army.split.cancel')}
          </button>
          <button
            type="button"
            class="split-confirm"
            data-testid="split-confirm"
            onClick={() => onConfirm(count)}
          >
            {t('army.split.confirm')}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Fiche d'unité de l'armée (aventure, doc 08 §2.1) : portrait encadré, stats et
 * capacités **localisées** de l'unité. Lecture seule ; lit le catalogue moteur
 * (aucune règle réimplémentée). Distincte de la `StackSheet` de combat, qui
 * montre l'état de combat live d'une pile engagée.
 */
function UnitCard({
  unitId,
  def,
  onClose,
}: {
  unitId: string;
  def: CombatUnitDef;
  onClose: () => void;
}) {
  useApp((s) => s.locale); // réactivité i18n
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="unit-card-backdrop" onClick={onClose}>
      <section
        class="unit-card"
        data-testid="unit-card"
        role="dialog"
        aria-modal="true"
        aria-label={resolveUnitName(unitId)}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="unit-card-header">
          <span class="unit-card-portrait">
            <AssetImg
              src={unitSpriteUrl(unitId, def.groupId)}
              alt=""
              class="unit-card-img"
              fallback={
                <span class="unit-card-portrait-fallback" aria-hidden="true">
                  ⚔
                </span>
              }
            />
          </span>
          <h3>{resolveUnitName(unitId)}</h3>
          <button
            type="button"
            class="unit-card-close"
            data-testid="unit-card-close"
            aria-label={t('combat.sheet.close')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <dl class="unit-card-stats">
          <dt>{t('army.card.hp')}</dt>
          <dd>{def.stats.hp}</dd>
          <dt>{t('attribute.attack')}</dt>
          <dd>{def.stats.attack}</dd>
          <dt>{t('attribute.defense')}</dt>
          <dd>{def.stats.defense}</dd>
          <dt>{t('combat.sheet.damage')}</dt>
          <dd>
            {def.stats.damage[0]}–{def.stats.damage[1]}
          </dd>
          <dt>{t('combat.sheet.speed')}</dt>
          <dd>{def.stats.speed}</dd>
        </dl>
        <h4 class="unit-card-abilities-title">{t('army.card.abilities')}</h4>
        {def.abilities.length > 0 ? (
          <ul class="unit-card-abilities" data-testid="unit-card-abilities">
            {def.abilities.map((a) => {
              const desc = resolveAbilityDescription(a.id);
              return (
                <li key={a.id}>
                  <span class="unit-card-ability-name">{resolveAbilityName(a.id)}</span>
                  {desc && <span class="unit-card-ability-desc">{desc}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="unit-card-no-abilities">{t('army.card.noAbilities')}</p>
        )}
      </section>
    </div>
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
 * Bouton de rencontre héros ↔ héros (UX-HEROSWAP, doc 02 §1.5) : un bouton par
 * héros allié adjacent, ouvrant l'écran de transfert double-colonne. Rien
 * n'apparaît si aucun héros allié n'est adjacent (cas MVP mono-héros).
 */
function HeroSwapButton({ hero }: { hero: HeroState }) {
  useApp((s) => s.locale);
  const game = useApp((s) => s.game);
  const neighbours = adjacentFriendlyHeroes(game, hero);
  if (neighbours.length === 0) return null;
  return (
    <div class="hero-swap-actions" data-testid="hero-swap-actions">
      {neighbours.map((other) => (
        <button
          key={other.id}
          type="button"
          class="hero-swap-open"
          data-testid={`hero-swap-open-${other.id}`}
          onClick={() => openModal({ kind: 'heroswap', fromHeroId: hero.id, toHeroId: other.id })}
        >
          {t('heroswap.openWith', {
            name: other.name ? resolveHeroName(other.name) : t('hero.genericName'),
          })}
        </button>
      ))}
    </div>
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
  const artifactCatalog = useApp((s) => s.game.artifactCatalog);
  const [open, setOpen] = useState(false);
  // Raccourci `H` (lot M8 C2) : bascule le tiroir depuis le handler clavier global.
  useEffect(() => {
    const toggle = (): void => setOpen((o) => !o);
    window.addEventListener('heroes:toggle-drawer', toggle);
    return () => window.removeEventListener('heroes:toggle-drawer', toggle);
  }, []);
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
      {/* Lot M8 C25 : identité (portrait + niveau + jauges) EN TÊTE, juste après
          le bandeau de sélection ; la mini-carte passe en fin de tiroir. */}
      <aside class={`hero-drawer${open ? ' open' : ''}`} data-testid="hero-drawer">
        <HeroStrip />
        <AssetImg
          src={heroAvatarUrl(hero.factionId, heroArchetype(hero.attributes), hero.name)}
          alt=""
          class="hero-avatar"
          fallback={<div class="hero-portrait-placeholder" aria-hidden="true" />}
        />
        {hero.factionId && (
          <div class="hero-faction" data-testid="hero-faction-badge">
            <FactionBadge factionId={hero.factionId} />
          </div>
        )}
        {hero.name && (
          <div class="hero-name" data-testid="hero-name">
            {resolveHeroName(hero.name)}
          </div>
        )}
        {hero.specialtyId && (
          <div class="hero-specialty" data-testid="hero-specialty">
            <span class="hero-specialty-label">{t('hero.specialty')}</span>
            <span class="hero-specialty-name">{resolveSpecialtyName(hero.specialtyId)}</span>
            {resolveSpecialtyDesc(hero.specialtyId) && (
              <span class="hero-specialty-desc">{resolveSpecialtyDesc(hero.specialtyId)}</span>
            )}
          </div>
        )}
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
        <ArmySlots army={hero.army} heroId={hero.id} />
        <HeroSwapButton hero={hero} />
        <HeroSkills hero={hero} />
        <HeroInventory hero={hero} catalog={artifactCatalog} />
        <AdventureSpellbook hero={hero} />
        <QuestJournal />
        {/* Mini-carte en fin de tiroir (mobile ; le widget fixe est desktop only,
            masqué ≥ 900px par CSS) — l'identité passe avant (C25). */}
        <h3 class="hero-army-title hero-minimap-title">{t('hero.minimapTitle')}</h3>
        <MiniMap variant="drawer" />
      </aside>
    </>
  );
}

/**
 * Préférence « bandeau d'armée replié » (lot X3, HUD aventure mobile) — état de
 * présentation local, hors `GameState` (pas de bump de save). **Replié par
 * défaut** : au premier lancement mobile la carte n'est plus masquée à ~40 % par
 * le bandeau déployé (constat E3 de l'audit). Le choix du joueur persiste.
 */
const ARMY_BAND_KEY = 'heroes.armyBandCollapsed';

function readArmyBandCollapsed(): boolean {
  try {
    const v = localStorage.getItem(ARMY_BAND_KEY);
    return v === null ? true : v === '1'; // absent = replié par défaut
  } catch {
    return true;
  }
}

function writeArmyBandCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(ARMY_BAND_KEY, collapsed ? '1' : '0');
  } catch {
    /* stockage indisponible (navigation privée) — préférence en mémoire seule */
  }
}

/** Bandeau bas repliable (portrait, doc 08 §2.1) — accès rapide à l'armée du héros sélectionné. */
function ArmyBand() {
  useApp((s) => s.locale);
  const hero = useApp((s) => resolveSelectedHero(s.game, s.selectedHeroId));
  const [collapsed, setCollapsed] = useState(readArmyBandCollapsed);
  if (!hero) return null;
  const toggle = (): void => {
    setCollapsed((c) => {
      const next = !c;
      writeArmyBandCollapsed(next);
      return next;
    });
  };
  return (
    <div class={`army-band${collapsed ? ' collapsed' : ''}`} data-testid="army-band">
      <button class="army-band-toggle" data-testid="army-band-toggle" onClick={toggle}>
        {t('army.title')} {collapsed ? '▲' : '▼'}
      </button>
      {!collapsed && <ArmySlots army={hero.army} heroId={hero.id} />}
    </div>
  );
}

/** Nom hexadécimal `#rrggbb` d'une couleur de joueur (pastille de l'indicateur). */
function colorCss(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

/**
 * Indicateur de tour (UX multi-joueurs) : dit QUI agit, en permanence quand il y
 * a plusieurs joueurs. Pendant les tours IA (`store.aiTurn`), affiche une barre
 * de progression `done/total` des adversaires — le joueur voit que la partie
 * n'est pas figée et suit l'avancée, tout en gardant la carte navigable (rien
 * n'est bloqué). Sur le tour d'un humain (hot-seat), montre le joueur actif.
 */
function TurnIndicator() {
  useApp((s) => s.locale);
  const players = useApp((s) => s.game.players);
  const currentPlayer = useApp((s) => s.game.currentPlayer);
  const aiTurn = useApp((s) => s.aiTurn);
  const active = players[currentPlayer];
  if (aiTurn) {
    const color = colorCss(playerColor(players, players[aiTurn.seat - 1]?.id ?? null));
    const pct = aiTurn.total > 0 ? Math.round((aiTurn.done / aiTurn.total) * 100) : 0;
    return (
      <span class="turn-indicator turn-indicator--ai" data-testid="turn-indicator" role="status">
        <span class="turn-dot" style={{ background: color }} aria-hidden="true" />
        <span data-testid="ai-turn-label">{t('turn.aiPlaying', { n: aiTurn.seat })}</span>
        <span class="gauge" aria-hidden="true">
          <span class="gauge-fill" style={{ width: `${pct}%` }} />
        </span>
        <span class="turn-progress" data-testid="ai-progress">
          {t('turn.progress', { done: aiTurn.done, total: aiTurn.total })}
        </span>
      </span>
    );
  }
  // Hors tour IA : n'affiche le joueur actif que s'il y a plusieurs joueurs
  // (en solo, « Joueur 1 » serait du bruit).
  if (players.length < 2 || !active) return null;
  const color = colorCss(playerColor(players, active.id));
  return (
    <span class="turn-indicator" data-testid="turn-indicator">
      <span class="turn-dot" style={{ background: color }} aria-hidden="true" />
      <span data-testid="active-player-label">
        {active.controller === 'human'
          ? t('turn.player', { n: currentPlayer + 1 })
          : t('turn.aiPlaying', { n: currentPlayer + 1 })}
      </span>
    </span>
  );
}

/** Jour/semaine, points de mouvement, sauvegarde et gros bouton fin de tour (doc 08 §2.1). */
function TurnBar({ onOpenOptions }: { onOpenOptions: () => void }) {
  useApp((s) => s.locale);
  const day = useApp((s) => s.game.calendar.day);
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
        <TurnIndicator />
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
            title={`${t('town.open')} (T)`}
            onClick={() => openModal({ kind: 'town', townId: town.id })}
          >
            <FactionBadge factionId={town.factionId} />
            {t('town.open')}
          </button>
        ))}
        <button
          class="end-turn"
          data-testid="end-turn"
          title={`${t('turnBar.endTurn')} (E)`}
          onClick={requestEndTurn}
        >
          {t('turnBar.endTurn')}
        </button>
      </div>
    </div>
  );
}
