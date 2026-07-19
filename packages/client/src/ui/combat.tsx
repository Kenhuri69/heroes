import { useSyncExternalStore } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  heroActionLeftFor,
  heroesOnSide,
  heroAttackDamageFor,
  canHeroRally,
  canCallReinforcements,
  scaleCost,
  estimateHeroRally,
  initiativeSpeed,
  roundActionOrder,
  surrenderCost,
  spellcasterParams,
  isSilenced,
  isStackSpellImmune,
  heroKnownSpellIds,
  estimateUnitSpell,
  spellTargetsEnemy,
  type CombatStack,
  type CombatState,
  type CombatUnitDef,
  type HeroState,
  type SpellEstimate,
} from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { dispatch } from '../app/dispatch';
import { recordCombatAuto } from '../app/telemetry';
import { humanId } from '../app/game';
import { t, resolveUnitName, resolveSpellName, resolveLoc, resolveHeroName, commandErrorMessage } from '../app/i18n';
import { COMBAT_SPEEDS } from '../app/ui-constants';
import { combatPreview, type CombatPreview } from '../scenes/combat/preview';
import { pushToast } from './toasts';
import { SpellBook } from './SpellBook';
import { CombatLog } from './CombatLog';
import './combat.css';

/**
 * UI DOM de l'écran de combat (doc 08 §2.4) : bandeau haut (piles des deux
 * camps + round), barre d'actions bas, panneau de prévisualisation de
 * dégâts OBLIGATOIRE avant confirmation. Le canvas (`CombatScene`) ne rend
 * aucun de ces chiffres — uniquement cette couche DOM.
 */
/** Pause entre deux rounds auto (lot M4) — divisée par la vitesse ×1/×2/×4. */
const AUTO_ROUND_PAUSE_MS = 500;

export function CombatUi() {
  useApp((s) => s.locale); // réactivité i18n
  const combat = useApp((s) => s.game.combat);
  const combatSpeed = useApp((s) => s.combatSpeed);
  const combatBark = useApp((s) => s.combatBark);
  // B12 (revue 2026-07) : le héros de l'UI est celui LIÉ AU COMBAT (même
  // résolution que le moteur, `heroForPlayerSide`) — pas le premier héros du
  // joueur : avec plusieurs héros (Taverne), mana/grimoire/gating affichaient
  // ceux du mauvais héros. Arène (aucun héros lié) ⇒ undefined, boutons cachés.
  // E4.4b : héros AGISSANT — le sélectionné (coop) sinon le lead du camp joueur.
  const actingHeroId = useApp((s) => s.combatActingHeroId);
  const hero = useApp((s) => {
    const c = s.game.combat;
    if (!c) return undefined;
    const leadId = c.playerSide === 'attacker' ? c.attackerHeroId : c.defenderHeroId;
    const id = s.combatActingHeroId ?? leadId;
    return id ? s.game.heroes.find((h) => h.id === id) : undefined;
  });
  // Héros du joueur HUMAIN pouvant agir sur son camp (lead + alliés coop) — le
  // sélecteur n'apparaît qu'à plusieurs (coop). Dérivé de `combat` (déjà abonné)
  // + snapshot du store : PAS un sélecteur `useApp` (renverrait un nouveau tableau
  // à chaque rendu ⇒ boucle de re-rendu). Helpers moteur purs (E4.4).
  const actingHeroes: HeroState[] = (() => {
    if (!combat) return [];
    const game = appStore.getState().game;
    const hid = humanId(game);
    return heroesOnSide(combat, combat.playerSide)
      .map((id) => game.heroes.find((h) => h.id === id))
      .filter((h): h is HeroState => !!h && h.playerId === hid);
  })();
  const catalog = useApp((s) => s.game.unitCatalog);
  const artifactCatalog = useApp((s) => s.game.artifactCatalog);
  const autoActive = useApp((s) => s.combatAutoActive);
  const config = useApp((s) => s.game.config);
  const playerGold = useApp(
    (s) => s.game.players.find((p) => p.id === humanId(s.game))?.resources.gold ?? 0,
  );
  const preview = useSyncExternalStore(combatPreview.subscribe, combatPreview.get);
  // E8 (moitié in-combat) : la riposte estimée de la cible anéantirait-elle la
  // pile attaquante ? Seuil = riposte MINIMALE ≥ PV totaux ⇒ perte certaine
  // (`retaliation` déjà null pour un tir / une cible qui ne riposte pas).
  const lethalRetaliation = ((): boolean => {
    if (!preview || preview.kind === 'moat' || !preview.retaliation || !combat) return false;
    const attacker = combat.stacks.find((s) => s.id === preview.attackerId);
    const hp = attacker ? catalog[attacker.unitId]?.stats.hp ?? 0 : 0;
    if (!attacker || hp <= 0) return false;
    const pool = (attacker.count - 1) * hp + attacker.firstHp;
    return preview.retaliation.damageMin >= pool;
  })();
  const spellTarget = useApp((s) => s.combatSpellTarget);
  const [spellBookOpen, setSpellBookOpen] = useState(false);
  const [heroAttackOpen, setHeroAttackOpen] = useState(false);
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [reinforceOpen, setReinforceOpen] = useState(false);
  const [unitSpellOpen, setUnitSpellOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState<'retreat' | 'surrender' | null>(null);
  // E1 : sur mobile, les actions secondaires (Prière/Sort d'unité/Fuir/Se rendre/
  // Journal/vitesses) sont repliées derrière « ⋯ » pour rendre le plateau au
  // joueur. Sur desktop elles restent inline (CSS) — cet état ne sert qu'au tiroir.
  const [showMoreActions, setShowMoreActions] = useState(false);
  // E3 : la file d'initiative défile horizontalement (overflow) ; on ramène la
  // puce active dans la vue à chaque changement de tour (elle n'est plus coupée
  // au bord droit sans qu'on sache où elle est).
  const orderRef = useRef<HTMLOListElement>(null);
  // Fiche de pile inspectée : source unique dans le store — ouverte par un tap
  // sur une vignette du bandeau OU un appui long sur le plateau (CombatScene).
  const inspectId = useApp((s) => s.combatInspectId);
  const [logOpen, setLogOpen] = useState(false);

  // Boucle d'auto-combat round par round (lot M4, doc 08 §2.4) : tant que la
  // bascule est levée et que la main est au joueur, joue UN round auto après
  // une courte pause (÷ vitesse). « Reprendre la main » coupe la boucle — le
  // round en cours de résolution se termine, puis les actions se réactivent.
  useEffect(() => {
    if (!autoActive || !combat || combat.finished) return;
    const activeStack = combat.stacks.find((s) => s.id === combat.activeStackId);
    if (activeStack?.side !== combat.playerSide) return;
    const id = setTimeout(() => {
      dispatch({ type: 'AutoCombat', rounds: 1 }).catch((err: unknown) => {
        appStore.setState({ combatAutoActive: false });
        pushToast(commandErrorMessage(err), 'error');
      });
    }, AUTO_ROUND_PAUSE_MS / combatSpeed);
    return () => clearTimeout(id);
  }, [autoActive, combat, combatSpeed]);

  // Raccourcis combat desktop (lot M8 C2), jamais requis : Espace = Attendre,
  // D = Défendre, quand c'est au joueur et hors auto. Ignorés si une saisie a le
  // focus. Échap reste géré par le handler global (fermeture de pile).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
        return;
      const s = appStore.getState();
      const c = s.game.combat;
      if (!c || c.finished || s.combatAutoActive) return;
      const act = c.stacks.find((st) => st.id === c.activeStackId);
      if (act?.side !== c.playerSide) return;
      const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
      if (key !== 'space' && key !== 'd') return;
      e.preventDefault();
      dispatch({ type: 'CombatAction', action: { type: key === 'space' ? 'wait' : 'defend' } }).catch(
        (err: unknown) => pushToast(commandErrorMessage(err), 'error'),
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // E3 : ramène la puce active dans la vue de la file d'initiative (défilement
  // horizontal borné à son conteneur — inline center, jamais de scroll vertical).
  useEffect(() => {
    const el = orderRef.current?.querySelector('.stack-chip-active');
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [combat?.activeStackId]);

  if (!combat) return null;

  // C-TACTICS (doc 02 §5.1) : phase de placement — le joueur repositionne ses
  // piles (tap sur le plateau, géré par CombatScene) puis lance la bataille.
  const isPlacement = combat.phase === 'placement';

  const active = combat.stacks.find((s) => s.id === combat.activeStackId);
  const isPlayerTurn = !combat.finished && !isPlacement && active?.side === combat.playerSide;
  // Budget d'actions du HÉROS AGISSANT ce round (doc 02 §1 ; E4.4 par-héros) —
  // helper moteur pur partagé validations/IA/UI.
  const heroCanAct = !!hero && heroActionLeftFor(appStore.getState().game, combat, hero.id);
  const canCastSpell =
    isPlayerTurn &&
    !autoActive &&
    heroCanAct &&
    !!hero &&
    // H-ARTEQUIP.2 : un héros sans sort appris peut caster via un artefact équipé.
    heroKnownSpellIds(hero, artifactCatalog).length > 0;
  // C1 : attaque du héros disponible si la feature est activée (config), un héros
  // est lié au camp joueur et a encore une action ce round.
  const canHeroStrike =
    isPlayerTurn && !autoActive && !!hero && !!config?.combat.heroAttack && heroCanAct;
  // F-SKILLS.2-UI : Prière de bataille disponible si le héros du camp joueur porte
  // la compétence (`battleResurrectHp`), 1×/combat — gating délégué au moteur pur.
  const canPray = isPlayerTurn && !autoActive && canHeroRally(appStore.getState().game);
  // B3-client : « Renforts » en combat PvE — gate d'affichage délégué au moteur pur
  // (`canCallReinforcements` : feature opt-in, PvE, tour joueur, plafond, hex libre).
  const canReinforce = isPlayerTurn && !autoActive && canCallReinforcements(appStore.getState().game);
  // CAP-CAST : la pile active du joueur est-elle une lanceuse (`spellcaster`)
  // jouable à la main (charges > 0, non silenciée, son sort au catalogue) ? Le
  // moteur supporte déjà `castSpell` ; on n'exposait que l'IA/auto jusqu'ici.
  const unitSpell = (() => {
    if (!isPlayerTurn || autoActive || !active) return null;
    const def = catalog[active.unitId];
    const params = def ? spellcasterParams(def) : null;
    if (!params || active.spellCharges <= 0 || isSilenced(active)) return null;
    const spell = appStore.getState().game.spellCatalog[params.spellId];
    return spell ? { spell } : null;
  })();
  // C3 : fuite/reddition disponibles au tour du joueur dans un combat d'aventure
  // (héros lié). Le coût de reddition est la valeur en or de l'armée survivante.
  const canLeave = isPlayerTurn && !autoActive && !!combat.heroId;
  const surrenderGold = canLeave ? surrenderCost(appStore.getState().game, combat) : 0;
  const canSurrender = canLeave && playerGold >= surrenderGold;

  // E2 : RAISON courte de désactivation par bouton (null = activé) — mêmes
  // sous-conditions que les gates ci-dessus, source unique. Le bouton l'affiche en
  // sous-libellé + `title`/`aria` (plus de « grisé sans explication », doc 08 §2.4).
  const commonReason = autoActive ? 'auto' : !isPlayerTurn ? 'enemyTurn' : null;
  const heroReason = !hero ? 'noHero' : (commonReason ?? (!heroCanAct ? 'heroActed' : null));
  const unitSpellReason = ((): string | null => {
    if (unitSpell) return null;
    if (commonReason) return commonReason;
    if (!active) return 'enemyTurn';
    const def = catalog[active.unitId];
    if (!def || !spellcasterParams(def)) return 'notCaster';
    if (isSilenced(active)) return 'silenced';
    if (active.spellCharges <= 0) return 'noCharges';
    return 'notCaster';
  })();
  const reason: Record<string, string | null> = {
    'hero-attack': canHeroStrike ? null : heroReason,
    spell: canCastSpell ? null : (heroReason ?? 'noSpell'),
    prayer: canPray ? null : (commonReason ?? 'prayer'),
    reinforcements: canReinforce ? null : (commonReason ?? 'reinforcements'),
    'unit-spell': unitSpellReason,
    retreat: canLeave ? null : (!combat.heroId ? 'noHero' : commonReason),
    surrender: canSurrender ? null : !canLeave ? (!combat.heroId ? 'noHero' : commonReason) : 'gold',
  };
  // Sous-libellé court (visible) + explication complète en `title` (survol/appui
  // long/lecteur d'écran) pour un bouton désactivé (E2). `null` ⇒ rien.
  const reasonNode = (key: string | null | undefined) =>
    key ? <span class="combat-btn-reason">{t(`combat.reason.${key}`)}</span> : null;
  const reasonTitle = (key: string | null | undefined): string | undefined =>
    key ? t(`combat.reason.${key}.hint`) : undefined;

  // Ordre de passage projeté (lot M1, doc 08 §2.4) : remplace les deux rangées
  // par camp triées par slot — l'actif est la 1ʳᵉ entrée par construction.
  const order = roundActionOrder(combat, catalog, appStore.getState().game);
  const sheetStack = inspectId ? (combat.stacks.find((s) => s.id === inspectId) ?? null) : null;

  const act = (action: 'wait' | 'defend'): void => {
    dispatch({ type: 'CombatAction', action: { type: action } }).catch((err: unknown) => {
      pushToast(commandErrorMessage(err), 'error'); // remédiation CL3 : plus d'erreur avalée en silence
    });
  };
  // Bascule auto ⇄ reprise de main (lot M4). L'« Auto-Battle » instantané
  // reste disponible sur l'écran pré-combat (Lot 1 fidélité HO).
  const auto = (): void => {
    if (autoActive) {
      appStore.setState({ combatAutoActive: false });
      return;
    }
    recordCombatAuto(); // télémétrie opt-in (Alpha 4.19) — délégation = « abandon » manuel
    appStore.setState({ combatAutoActive: true });
  };

  return (
    <div class="combat-ui">
      <header class="combat-armies">
        <div class="combat-round" data-testid="combat-round">
          {t('combat.round', { round: combat.round })}
        </div>
        {hero && (
          <div class="combat-hero" data-testid="combat-hero" aria-label={t('combat.heroPresent')}>
            <span class="combat-hero-badge" aria-hidden="true">
              ⚔
            </span>
            <span class="combat-hero-name">{t('hero.genericName')}</span>
            <span class="combat-hero-mana">{t('hero.mana', { mana: hero.mana, manaMax: hero.manaMax })}</span>
          </div>
        )}
        <ol ref={orderRef} class="combat-order" data-testid="combat-order" aria-label={t('combat.order.label')}>
          {order.current.map((s) => (
            <li key={s.id}>
              <StackChip stack={s} active={s.id === combat.activeStackId} onOpen={() => appStore.setState({ combatInspectId: s.id })} />
            </li>
          ))}
          {order.next.length > 0 && (
            <li class="combat-order-sep">
              <span>{t('combat.order.next')}</span>
            </li>
          )}
          {order.next.map((s) => (
            <li key={`next-${s.id}`} class="combat-order-next">
              <StackChip stack={s} active={false} onOpen={() => appStore.setState({ combatInspectId: s.id })} />
            </li>
          ))}
        </ol>
      </header>

      {/* Bark de combat (doc 13 §6.3, N4b) : réplique de l'antagoniste au début du combat. */}
      {combatBark && (
        <p class="combat-bark" data-testid="combat-bark">
          {resolveBark(combatBark)}
        </p>
      )}

      {/* F-SCHOOLS.8 (Pas de Brume) : bandeau de ciblage d'hex — le joueur tape
          la destination sur la grille, ou annule. Tap hors zone = annulation. */}
      {spellTarget && (
        <div class="combat-teleport-banner" data-testid="teleport-banner">
          <span>{t('spellbook.chooseDestination')}</span>
          <button
            data-testid="teleport-cancel"
            onClick={() => appStore.setState({ combatSpellTarget: null })}
          >
            {t('combat.leaveCancel')}
          </button>
        </div>
      )}

      {/* UXD-0 R5a : préviz + actions dans un conteneur colonne (plus de
          recouvrement de la consigne quand la barre passe à 2 rangées). */}
      <div class="combat-bottom">
        <div class="damage-preview" data-testid="damage-preview">
          {preview ? formatPreview(preview) : t('combat.damagePreviewPlaceholder')}
        </div>
        {lethalRetaliation && (
          <p class="damage-preview-warning" data-testid="damage-preview-warning" role="alert">
            {t('combat.lethalRetaliationWarning')}
          </p>
        )}

        {isPlacement ? (
          <footer class="combat-actions combat-placement" data-testid="combat-placement">
            <span class="combat-placement-hint">{t('combat.placementHint')}</span>
            <button
              data-testid="combat-start-battle"
              class="combat-start-battle"
              onClick={() => {
                dispatch({ type: 'FinishPlacement' }).catch((err: unknown) => pushToast(commandErrorMessage(err)));
              }}
            >
              {t('combat.startBattle')}
            </button>
          </footer>
        ) : (
        <footer class="combat-actions">
        {/* E4.4b : sélecteur du héros agissant — coop uniquement (plusieurs héros
            du joueur sur son camp). Mono-héros ⇒ masqué (comportement inchangé). */}
        {actingHeroes.length > 1 && (
          <div class="combat-hero-picker" data-testid="combat-hero-picker">
            <span class="combat-hero-picker-label">{t('combat.actingHero')}</span>
            {actingHeroes.map((h) => {
              const leadId = combat.playerSide === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
              const selected = (actingHeroId ?? leadId) === h.id;
              const canAct = heroActionLeftFor(appStore.getState().game, combat, h.id);
              return (
                <button
                  key={h.id}
                  class={`combat-hero-chip${selected ? ' active' : ''}`}
                  data-testid={`combat-hero-chip-${h.id}`}
                  disabled={!canAct}
                  onClick={() => appStore.setState({ combatActingHeroId: h.id })}
                >
                  {resolveHeroName(h.name) || t('hero.genericName')}
                </button>
              );
            })}
          </div>
        )}
        {/* Primaires : toujours visibles (E1). */}
        <div class="combat-actions-primary">
        <button data-testid="combat-wait" disabled={!isPlayerTurn || autoActive} onClick={() => act('wait')}>
          {t('combat.wait')}
        </button>
        <button data-testid="combat-defend" disabled={!isPlayerTurn || autoActive} onClick={() => act('defend')}>
          {t('combat.defend')}
        </button>
        <button
          data-testid="combat-hero-attack"
          disabled={!canHeroStrike}
          title={reasonTitle(reason['hero-attack'])}
          onClick={() => setHeroAttackOpen(true)}
        >
          {t('combat.heroAttack')}
          {reasonNode(reason['hero-attack'])}
        </button>
        <button
          data-testid="combat-spell"
          disabled={!canCastSpell}
          title={reasonTitle(reason['spell'])}
          onClick={() => setSpellBookOpen(true)}
        >
          {t('combat.spell')}
          {reasonNode(reason['spell'])}
        </button>
        <button
          data-testid="combat-auto"
          class={autoActive ? 'combat-auto-active' : ''}
          disabled={!isPlayerTurn && !autoActive}
          onClick={auto}
        >
          {autoActive ? t('combat.resume') : t('combat.auto')}
        </button>
        {/* « ⋯ » : révèle les secondaires (mobile uniquement — masqué en CSS sur desktop). */}
        <button
          data-testid="combat-more"
          class={`combat-more-toggle${showMoreActions ? ' active' : ''}`}
          aria-label={t('combat.more')}
          aria-expanded={showMoreActions}
          onClick={() => setShowMoreActions((v) => !v)}
        >
          ⋯
        </button>
        </div>
        {/* Secondaires : repliées derrière « ⋯ » sur mobile, inline sur desktop. */}
        <div class={`combat-actions-secondary${showMoreActions ? ' open' : ''}`}>
        <button
          data-testid="combat-prayer"
          disabled={!canPray}
          title={reasonTitle(reason['prayer'])}
          onClick={() => setPrayerOpen(true)}
        >
          {t('combat.prayer')}
          {reasonNode(reason['prayer'])}
        </button>
        {config?.combat.reinforcements && (
          <button
            data-testid="combat-reinforcements"
            disabled={!canReinforce}
            title={reasonTitle(reason['reinforcements'])}
            onClick={() => setReinforceOpen(true)}
          >
            {t('combat.reinforcements')}
            {reasonNode(reason['reinforcements'])}
          </button>
        )}
        <button
          data-testid="combat-unit-spell"
          disabled={!unitSpell}
          title={reasonTitle(reason['unit-spell'])}
          onClick={() => setUnitSpellOpen(true)}
        >
          {t('combat.unitSpell')}
          {reasonNode(reason['unit-spell'])}
        </button>
        <button
          data-testid="combat-retreat"
          disabled={!canLeave}
          title={reasonTitle(reason['retreat'])}
          onClick={() => setLeaveConfirm('retreat')}
        >
          {t('combat.retreat')}
          {reasonNode(reason['retreat'])}
        </button>
        <button
          data-testid="combat-surrender"
          disabled={!canSurrender}
          title={reasonTitle(reason['surrender'])}
          onClick={() => setLeaveConfirm('surrender')}
        >
          {surrenderGold === 0 ? t('combat.surrenderFree') : t('combat.surrender', { gold: surrenderGold })}
          {reasonNode(reason['surrender'])}
        </button>
        <button
          data-testid="combat-log-toggle"
          class={logOpen ? 'active' : ''}
          aria-pressed={logOpen}
          onClick={() => setLogOpen((v) => !v)}
        >
          {t('combat.log')}
        </button>
        <div class="combat-speeds" data-testid="combat-speed">
          {COMBAT_SPEEDS.map((speed) => (
            <button
              key={speed}
              class={combatSpeed === speed ? 'active' : ''}
              onClick={() => appStore.setState({ combatSpeed: speed })}
            >
              ×{speed}
            </button>
          ))}
        </div>
        </div>
      </footer>
        )}
      </div>

      {/* Journal de combat (UX-COMBATLOG) — monté en permanence pour accumuler
          les événements même masqué ; le bouton bascule seulement sa visibilité. */}
      <CombatLog visible={logOpen} />
      {spellBookOpen && hero && <SpellBook hero={hero} onClose={() => setSpellBookOpen(false)} />}
      {heroAttackOpen && hero && (
        <HeroAttackModal combat={combat} hero={hero} onClose={() => setHeroAttackOpen(false)} />
      )}
      {prayerOpen && <PrayerModal combat={combat} onClose={() => setPrayerOpen(false)} />}
      {reinforceOpen && hero && (
        <ReinforcementsModal hero={hero} onClose={() => setReinforceOpen(false)} />
      )}
      {unitSpellOpen && unitSpell && active && (
        <UnitSpellModal
          combat={combat}
          casterId={active.id}
          spellKind={unitSpell.spell.kind}
          spellId={unitSpell.spell.id}
          onClose={() => setUnitSpellOpen(false)}
        />
      )}
      {leaveConfirm && (
        <LeaveConfirm mode={leaveConfirm} gold={surrenderGold} onClose={() => setLeaveConfirm(null)} />
      )}
      {sheetStack && (
        <StackSheet stack={sheetStack} combat={combat} catalog={catalog} onClose={() => appStore.setState({ combatInspectId: null })} />
      )}
    </div>
  );
}

/**
 * Confirmation de fuite/reddition (C3) : action IRRÉVERSIBLE (le combat se termine
 * par une défaite), donc confirmation explicite (doc 08 §2.4). Fuite = armée
 * abandonnée ; reddition = armée gardée contre `gold` or.
 */
function LeaveConfirm({
  mode,
  gold,
  onClose,
}: {
  mode: 'retreat' | 'surrender';
  gold: number;
  onClose: () => void;
}) {
  useApp((s) => s.locale); // réactivité i18n
  const confirm = (): void => {
    dispatch({ type: mode === 'retreat' ? 'Retreat' : 'Surrender' })
      .then(() => onClose())
      .catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
  };
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal combat-leave"
        role="dialog"
        aria-modal="true"
        aria-label={t(mode === 'retreat' ? 'combat.retreat' : 'combat.surrender', { gold })}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t(mode === 'retreat' ? 'combat.retreat' : 'combat.surrender', { gold })}</h2>
        </header>
        <p>{t(mode === 'retreat' ? 'combat.retreatBody' : 'combat.surrenderBody', { gold })}</p>
        <div class="combat-leave-actions">
          <button data-testid="combat-leave-cancel" onClick={onClose}>
            {t('combat.leaveCancel')}
          </button>
          <button class="combat-leave-go" data-testid="combat-leave-confirm" onClick={confirm}>
            {t('combat.leaveConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modale d'attaque du héros (C1, doc 08 §2.4) : dégâts prévisualisés (déterministes,
 * indépendants de la cible) + liste des piles ennemies vivantes ; le choix d'une
 * cible confirme et dispatch `HeroAttack`. La feature est gatée par `combat-hero-attack`.
 */
function HeroAttackModal({ combat, hero, onClose }: { combat: CombatState; hero: HeroState; onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const game = appStore.getState().game;
  // E4.4b : dégâts du HÉROS AGISSANT (coop : allié possible), pas seulement le lead.
  const damage = heroAttackDamageFor(game, combat, combat.playerSide, hero);
  const targets = combat.stacks.filter((s) => s.side !== combat.playerSide && s.count > 0);

  const strike = (targetStackId: string): void => {
    dispatch({ type: 'HeroAttack', targetStackId, heroId: hero.id })
      .then(() => onClose())
      .catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal spellbook"
        role="dialog"
        aria-modal="true"
        aria-label={t('combat.heroAttack')}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('combat.heroAttack')}</h2>
          <button class="modal-close" aria-label={t('options.close')} onClick={onClose}>
            ×
          </button>
        </header>
        <p class="spell-preview" data-testid="hero-attack-preview">
          {t('combat.heroAttackPreview', { amount: damage })}
        </p>
        {targets.length === 0 ? (
          <p class="spellbook-empty">{t('spellbook.noTargets')}</p>
        ) : (
          <ul class="spell-target-list">
            {targets.map((stack) => (
              <li key={stack.id}>
                <button
                  class="spell-target"
                  data-testid={`hero-attack-target-${stack.id}`}
                  onClick={() => strike(stack.id)}
                >
                  {resolveUnitName(stack.unitId)} ×{stack.count}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Modale de Prière de bataille (F-SKILLS.2-UI, doc 03 §2/§5 · doc 08 §2.4) : le
 * héros du camp joueur ressuscite/soigne une pile ALLIÉE vivante, 1×/combat. Miroir
 * de `HeroAttackModal` mais ciblage allié ; prévisualisation OBLIGATOIRE des
 * créatures relevées par cible (`estimateHeroRally`, pur, sans RNG) ⇒ `HeroRally`.
 */
function PrayerModal({ combat, onClose }: { combat: CombatState; onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const game = appStore.getState().game;
  const targets = combat.stacks.filter((s) => s.side === combat.playerSide && s.count > 0);

  const pray = (targetStackId: string): void => {
    dispatch({ type: 'HeroRally', targetStackId })
      .then(() => onClose())
      .catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal spellbook"
        role="dialog"
        aria-modal="true"
        aria-label={t('combat.prayer')}
        data-testid="prayer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('combat.prayer')}</h2>
          <button class="modal-close" aria-label={t('options.close')} onClick={onClose}>
            ×
          </button>
        </header>
        {targets.length === 0 ? (
          <p class="spellbook-empty">{t('spellbook.noTargets')}</p>
        ) : (
          <ul class="spell-target-list">
            {targets.map((stack) => {
              const est = estimateHeroRally(game, stack.id);
              return (
                <li key={stack.id}>
                  <button
                    class="spell-target"
                    data-testid={`prayer-target-${stack.id}`}
                    onClick={() => pray(stack.id)}
                  >
                    <span>
                      {resolveUnitName(stack.unitId)} ×{stack.count}
                    </span>
                    <span class="spell-target-preview">
                      {t('combat.prayerPreview', { revived: est.revived, healed: est.healed })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Modale de renforts (B3-client, doc 18 B3) : en combat PvE, le héros ajoute une
 * pile fraîche d'une unité qu'il commande déjà, contre or. Sélection unité +
 * effectif (borné `maxUnitsPerCall`), coût prévisualisé (`recruitCost × count ×
 * costMultiplier`, miroir du moteur) ⇒ `CallReinforcements`.
 */
function ReinforcementsModal({ hero, onClose }: { hero: HeroState; onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const game = appStore.getState().game;
  const cfg = game.config?.combat.reinforcements;
  const player = game.players.find((p) => p.id === hero.playerId);
  const resources = (player?.resources ?? {}) as Record<string, number>;
  const maxUnits = cfg?.maxUnitsPerCall ?? 1;
  const mult = cfg?.costMultiplier ?? 1;
  const [sel, setSel] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  const recruitCostOf = (unitId: string): Record<string, number> | undefined =>
    (game.unitCatalog[unitId] as { recruitCost?: Record<string, number> } | undefined)?.recruitCost;
  // Unités que le héros commande ET qui ont un coût (renforçables).
  const units = hero.army.filter((s) => s.count > 0 && recruitCostOf(s.unitId));
  const selCost = sel ? scaleCost(recruitCostOf(sel)!, Math.max(1, Math.min(qty, maxUnits)) * mult) : null;
  const affordable = !!selCost && Object.entries(selCost).every(([id, amt]) => (resources[id] ?? 0) >= amt);

  const call = (): void => {
    if (!sel) return;
    dispatch({ type: 'CallReinforcements', unitId: sel, count: Math.max(1, Math.min(qty, maxUnits)) })
      .then(() => onClose())
      .catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal spellbook"
        role="dialog"
        aria-modal="true"
        aria-label={t('combat.reinforcements')}
        data-testid="reinforcements-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('combat.reinforcements')}</h2>
          <button class="modal-close" aria-label={t('options.close')} onClick={onClose}>
            ×
          </button>
        </header>
        {units.length === 0 ? (
          <p class="spellbook-empty">{t('combat.reinforcementsNone')}</p>
        ) : (
          <>
            <ul class="spell-target-list">
              {units.map((s) => (
                <li key={s.unitId}>
                  <button
                    class={`spell-target${sel === s.unitId ? ' active' : ''}`}
                    aria-pressed={sel === s.unitId}
                    data-testid={`reinforce-unit-${s.unitId}`}
                    onClick={() => setSel(s.unitId)}
                  >
                    <span>{resolveUnitName(s.unitId)}</span>
                    <span class="spell-target-preview">
                      {t('combat.reinforcementsUnitCost', { gold: (recruitCostOf(s.unitId)?.gold ?? 0) * mult })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {sel && (
              <div class="reinforcements-confirm">
                <label>
                  {t('combat.reinforcementsCount')}
                  <input
                    type="number"
                    min={1}
                    max={maxUnits}
                    value={qty}
                    data-testid="reinforce-qty"
                    onInput={(e) =>
                      setQty(Math.max(1, Math.min(maxUnits, Number((e.currentTarget as HTMLInputElement).value) || 1)))
                    }
                  />
                </label>
                <button
                  class="menu-button"
                  data-testid="reinforce-confirm"
                  disabled={!affordable}
                  onClick={call}
                >
                  {t('combat.reinforcementsConfirm', { gold: selCost?.gold ?? 0 })}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Modale de lancer de sort d'unité (CAP-CAST, doc 08 §2.4) : la pile active
 * `spellcaster` du joueur lance son sort embarqué. Cibles amies/ennemies selon
 * la nature du sort (`spellTargetsEnemy`), prévisualisation OBLIGATOIRE
 * (`estimateUnitSpell`, sans RNG) avant confirmation ⇒ `CombatAction castSpell`.
 */
function UnitSpellModal({
  combat,
  casterId,
  spellKind,
  spellId,
  onClose,
}: {
  combat: CombatState;
  casterId: string;
  spellKind: SpellEstimate['kind'];
  spellId: string;
  onClose: () => void;
}) {
  useApp((s) => s.locale); // réactivité i18n
  const [targetId, setTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<SpellEstimate | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const caster = combat.stacks.find((s) => s.id === casterId);
  const friendly = !spellTargetsEnemy(spellKind);
  const game = appStore.getState().game;
  // Cibles : camp allié (soin/buff) ou ennemi ; une pile furtive est inciblable, et
  // une pile immunisée aux sorts (unité CAP-SPELLIMMUNE OU immunité de ciblage
  // d'armée H-ARTEQUIP.2+) l'est pour un sort hostile — prédicat partagé moteur.
  const targets = combat.stacks.filter(
    (s) =>
      s.count > 0 &&
      !s.stealthed &&
      (friendly
        ? s.side === combat.playerSide
        : s.side !== combat.playerSide && !isStackSpellImmune(game, combat, s)),
  );

  const select = (id: string): void => {
    setTargetId(id);
    try {
      setPreview(estimateUnitSpell(appStore.getState().game, casterId, id));
      setPreviewFailed(false);
    } catch {
      setPreview(null);
      setPreviewFailed(true);
    }
  };
  const cast = (id: string): void => {
    dispatch({ type: 'CombatAction', action: { type: 'castSpell', targetStackId: id } })
      .then(() => onClose())
      .catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal spellbook"
        role="dialog"
        aria-modal="true"
        aria-label={t('combat.unitSpell')}
        data-testid="unit-spell-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{caster ? resolveUnitName(caster.unitId) : t('combat.unitSpell')}</h2>
          <button class="modal-close" aria-label={t('options.close')} onClick={onClose}>
            ×
          </button>
        </header>
        <p class="content-lore">{resolveSpellName(spellId)}</p>
        {targets.length === 0 ? (
          <p class="spellbook-empty">{t('spellbook.noTargets')}</p>
        ) : (
          <ul class="spell-target-list">
            {targets.map((stack) => (
              <li key={stack.id}>
                <button
                  class={`spell-target${targetId === stack.id ? ' selected' : ''}`}
                  data-testid={`unit-spell-target-${stack.id}`}
                  onClick={() => select(stack.id)}
                >
                  {resolveUnitName(stack.unitId)} ×{stack.count}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div class="spell-preview" data-testid="unit-spell-preview">
          {targetId ? formatSpellPreview(preview, previewFailed) : t('spellbook.chooseTarget')}
        </div>
        <button
          class="spellbook-cast"
          data-testid="unit-spell-cast"
          disabled={!targetId}
          onClick={() => targetId && cast(targetId)}
        >
          {t('spellbook.cast')}
        </button>
      </div>
    </div>
  );
}

/** Préviz d'un sort d'unité (mêmes libellés que le grimoire héros). */
function formatSpellPreview(est: SpellEstimate | null, failed: boolean): string {
  if (failed || !est) return t('spellbook.previewUnavailable');
  switch (est.kind) {
    case 'damage':
      return t('spellbook.previewDamage', { amount: est.amount, kills: est.kills });
    case 'heal':
      return t('spellbook.previewHeal', { amount: est.amount });
    case 'buff':
      return t('spellbook.previewBuff');
    case 'debuff':
      return t('spellbook.previewDebuff');
    case 'applyMarks':
      return t('spellbook.previewMarks');
    case 'dispel':
      return t('spellbook.previewDispel', { count: est.amount });
    default:
      return t('spellbook.previewUnavailable');
  }
}

/**
 * Vignette d'une pile dans la file d'ordre : effectif + nom localisé + marqueur
 * de camp (losange plein attaquant / anneau défenseur — forme ET couleur, A5).
 * Tap = fiche de pile (C14) ⇒ cible ≥ 44 px (A1).
 */
function StackChip({ stack, active, onOpen }: { stack: CombatStack; active: boolean; onOpen: () => void }) {
  const sideName = t(stack.side === 'attacker' ? 'combat.side.attacker' : 'combat.side.defender');
  return (
    <button
      type="button"
      class={`stack-chip stack-chip-${stack.side}${active ? ' stack-chip-active' : ''}`}
      aria-label={`${stack.count} × ${resolveUnitName(stack.unitId)} — ${sideName}`}
      onClick={onOpen}
    >
      <span class={`stack-chip-side chip-side-${stack.side}`} aria-hidden="true" />
      <span class="stack-chip-count">{stack.count}</span>
      <span class="stack-chip-unit">{resolveUnitName(stack.unitId)}</span>
    </button>
  );
}

/**
 * Fiche de pile (lot M1, C14 — « lisibilité d'état » doc 08 §1.4) : stats de
 * l'unité + état de combat de la pile, consultable au tap sur une vignette.
 * Aucune règle réimplémentée : catalogue moteur + `initiativeSpeed`.
 */
function StackSheet({
  stack,
  combat,
  catalog,
  onClose,
}: {
  stack: CombatStack;
  combat: CombatState;
  catalog: Record<string, CombatUnitDef>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const def = catalog[stack.unitId];
  if (!def) return null;
  const speed = Math.max(0, initiativeSpeed(stack, combat, catalog));
  const sideName = t(stack.side === 'attacker' ? 'combat.side.attacker' : 'combat.side.defender');
  const flags = [
    stack.defending ? t('combat.sheet.defending') : null,
    stack.waited ? t('combat.sheet.waited') : null,
    stack.immobilizedRounds > 0 ? t('combat.sheet.immobilized', { rounds: stack.immobilizedRounds }) : null,
    stack.marks > 0 ? t('combat.sheet.marks', { marks: stack.marks }) : null,
    stack.shield ? t('combat.sheet.shield', { shield: stack.shield }) : null,
  ].filter((f): f is string => f !== null);
  return (
    <div class="stack-sheet-backdrop" onClick={onClose}>
      <section
        class="stack-sheet"
        data-testid="stack-sheet"
        role="dialog"
        aria-label={resolveUnitName(stack.unitId)}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="stack-sheet-header">
          <h3>
            {stack.count} × {resolveUnitName(stack.unitId)}
          </h3>
          <button
            type="button"
            class="stack-sheet-close"
            data-testid="stack-sheet-close"
            aria-label={t('combat.sheet.close')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p class="stack-sheet-side">{sideName}</p>
        <dl class="stack-sheet-stats">
          <dt>{t('combat.sheet.hp')}</dt>
          <dd>
            {stack.firstHp}/{def.stats.hp}
          </dd>
          <dt>{t('attribute.attack')}</dt>
          <dd>{def.stats.attack}</dd>
          <dt>{t('attribute.defense')}</dt>
          <dd>{def.stats.defense}</dd>
          <dt>{t('combat.sheet.damage')}</dt>
          <dd>
            {def.stats.damage[0]}–{def.stats.damage[1]}
          </dd>
          <dt>{t('combat.sheet.speed')}</dt>
          <dd>{speed}</dd>
          {stack.ammo !== null && (
            <>
              <dt>{t('combat.sheet.ammo')}</dt>
              <dd>{stack.ammo}</dd>
            </>
          )}
        </dl>
        {stack.statuses.length > 0 && (
          <p class="stack-sheet-statuses">
            {t('combat.sheet.statuses')}{' '}
            {stack.statuses
              .map((st) => t('combat.sheet.statusRounds', { name: resolveSpellName(st.spellId), rounds: st.roundsLeft }))
              .join(' · ')}
          </p>
        )}
        {flags.length > 0 && <p class="stack-sheet-flags">{flags.join(' · ')}</p>}
      </section>
    </div>
  );
}

function formatPreview(p: CombatPreview): string {
  if (p.kind === 'moat') return t('combat.moatMovePreview', { damage: p.damage });
  const damage = t('combat.damage', { min: p.damageMin, max: p.damageMax });
  const kills = p.killsMin === p.killsMax ? `${p.killsMin}` : `${p.killsMin}–${p.killsMax}`;
  const retal = p.retaliation
    ? t('combat.retaliationEstimate', { min: p.retaliation.damageMin, max: p.retaliation.damageMax })
    : t('combat.noRetaliation');
  return t('combat.previewSummary', { damage, kills, retal });
}

/** Résout une clé de bark (`@loc:` vers les locales CORE, comme les dialogues). */
function resolveBark(ref: string): string {
  const key = ref.startsWith('@loc:') ? ref.slice('@loc:'.length) : ref;
  const value = t(key);
  return value === key ? resolveLoc(ref) : value;
}
