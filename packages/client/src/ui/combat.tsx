import { useSyncExternalStore } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import {
  heroAttackDamage,
  initiativeSpeed,
  roundActionOrder,
  surrenderCost,
  type CombatStack,
  type CombatState,
  type CombatUnitDef,
} from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { dispatch } from '../app/dispatch';
import { recordCombatAuto } from '../app/telemetry';
import { humanId } from '../app/game';
import { t, resolveUnitName, resolveSpellName, resolveLoc, commandErrorMessage } from '../app/i18n';
import { COMBAT_SPEEDS } from '../app/ui-constants';
import { combatPreview, type DamagePreview } from '../scenes/combat/preview';
import { pushToast } from './toasts';
import { SpellBook } from './SpellBook';
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
  const hero = useApp((s) => s.game.heroes.find((h) => h.playerId === humanId(s.game)));
  const catalog = useApp((s) => s.game.unitCatalog);
  const autoActive = useApp((s) => s.combatAutoActive);
  const config = useApp((s) => s.game.config);
  const playerGold = useApp(
    (s) => s.game.players.find((p) => p.id === humanId(s.game))?.resources.gold ?? 0,
  );
  const preview = useSyncExternalStore(combatPreview.subscribe, combatPreview.get);
  const [spellBookOpen, setSpellBookOpen] = useState(false);
  const [heroAttackOpen, setHeroAttackOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState<'retreat' | 'surrender' | null>(null);
  const [sheetStackId, setSheetStackId] = useState<string | null>(null);

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
        pushToast(commandErrorMessage(err));
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
        (err: unknown) => pushToast(commandErrorMessage(err)),
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!combat) return null;

  const active = combat.stacks.find((s) => s.id === combat.activeStackId);
  const isPlayerTurn = !combat.finished && active?.side === combat.playerSide;
  const canCastSpell =
    isPlayerTurn && !autoActive && !combat.heroCastThisRound && !!hero && hero.spells.length > 0;
  // C1 : attaque du héros disponible si la feature est activée (config), un héros
  // est lié au camp joueur et ne l'a pas déjà utilisée ce combat.
  const canHeroStrike =
    isPlayerTurn &&
    !autoActive &&
    !!hero &&
    !!config?.combat.heroAttack &&
    !combat.heroAttackUsed.includes(combat.playerSide);
  // C3 : fuite/reddition disponibles au tour du joueur dans un combat d'aventure
  // (héros lié). Le coût de reddition est la valeur en or de l'armée survivante.
  const canLeave = isPlayerTurn && !autoActive && !!combat.heroId;
  const surrenderGold = canLeave ? surrenderCost(appStore.getState().game, combat) : 0;
  const canSurrender = canLeave && playerGold >= surrenderGold;

  // Ordre de passage projeté (lot M1, doc 08 §2.4) : remplace les deux rangées
  // par camp triées par slot — l'actif est la 1ʳᵉ entrée par construction.
  const order = roundActionOrder(combat, catalog);
  const sheetStack = sheetStackId ? (combat.stacks.find((s) => s.id === sheetStackId) ?? null) : null;

  const act = (action: 'wait' | 'defend'): void => {
    dispatch({ type: 'CombatAction', action: { type: action } }).catch((err: unknown) => {
      pushToast(commandErrorMessage(err)); // remédiation CL3 : plus d'erreur avalée en silence
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
          <div class="combat-hero" data-testid="combat-hero" title={t('combat.heroPresent')}>
            <span class="combat-hero-badge" aria-hidden="true">
              ⚔
            </span>
            <span class="combat-hero-name">{t('hero.genericName')}</span>
            <span class="combat-hero-mana">{t('hero.mana', { mana: hero.mana, manaMax: hero.manaMax })}</span>
          </div>
        )}
        <ol class="combat-order" data-testid="combat-order" aria-label={t('combat.order.label')}>
          {order.current.map((s) => (
            <li key={s.id}>
              <StackChip stack={s} active={s.id === combat.activeStackId} onOpen={() => setSheetStackId(s.id)} />
            </li>
          ))}
          {order.next.length > 0 && (
            <li class="combat-order-sep">
              <span>{t('combat.order.next')}</span>
            </li>
          )}
          {order.next.map((s) => (
            <li key={`next-${s.id}`} class="combat-order-next">
              <StackChip stack={s} active={false} onOpen={() => setSheetStackId(s.id)} />
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

      {/* UXD-0 R5a : préviz + actions dans un conteneur colonne (plus de
          recouvrement de la consigne quand la barre passe à 2 rangées). */}
      <div class="combat-bottom">
        <div class="damage-preview" data-testid="damage-preview">
          {preview ? formatPreview(preview) : t('combat.damagePreviewPlaceholder')}
        </div>

        <footer class="combat-actions">
        <button data-testid="combat-wait" disabled={!isPlayerTurn || autoActive} onClick={() => act('wait')}>
          {t('combat.wait')}
        </button>
        <button data-testid="combat-defend" disabled={!isPlayerTurn || autoActive} onClick={() => act('defend')}>
          {t('combat.defend')}
        </button>
        <button data-testid="combat-spell" disabled={!canCastSpell} onClick={() => setSpellBookOpen(true)}>
          {t('combat.spell')}
        </button>
        <button
          data-testid="combat-hero-attack"
          disabled={!canHeroStrike}
          onClick={() => setHeroAttackOpen(true)}
        >
          {t('combat.heroAttack')}
        </button>
        <button data-testid="combat-retreat" disabled={!canLeave} onClick={() => setLeaveConfirm('retreat')}>
          {t('combat.retreat')}
        </button>
        <button
          data-testid="combat-surrender"
          disabled={!canSurrender}
          onClick={() => setLeaveConfirm('surrender')}
        >
          {t('combat.surrender', { gold: surrenderGold })}
        </button>
        <button
          data-testid="combat-auto"
          class={autoActive ? 'combat-auto-active' : ''}
          disabled={!isPlayerTurn && !autoActive}
          onClick={auto}
        >
          {autoActive ? t('combat.resume') : t('combat.auto')}
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
      </footer>
      </div>

      {spellBookOpen && hero && <SpellBook hero={hero} onClose={() => setSpellBookOpen(false)} />}
      {heroAttackOpen && <HeroAttackModal combat={combat} onClose={() => setHeroAttackOpen(false)} />}
      {leaveConfirm && (
        <LeaveConfirm mode={leaveConfirm} gold={surrenderGold} onClose={() => setLeaveConfirm(null)} />
      )}
      {sheetStack && (
        <StackSheet stack={sheetStack} combat={combat} catalog={catalog} onClose={() => setSheetStackId(null)} />
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
      .catch((err: unknown) => pushToast(commandErrorMessage(err)));
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
function HeroAttackModal({ combat, onClose }: { combat: CombatState; onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const game = appStore.getState().game;
  const damage = heroAttackDamage(game, combat, combat.playerSide);
  const targets = combat.stacks.filter((s) => s.side !== combat.playerSide && s.count > 0);

  const strike = (targetStackId: string): void => {
    dispatch({ type: 'HeroAttack', targetStackId })
      .then(() => onClose())
      .catch((err: unknown) => pushToast(commandErrorMessage(err)));
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

function formatPreview(p: DamagePreview): string {
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
