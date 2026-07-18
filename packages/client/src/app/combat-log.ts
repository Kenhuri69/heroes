import { appStore } from './store';
import { eventBus, type AppEvent } from './events';
import { t, resolveUnitName, resolveSpellName, resolveFactionResourceName } from './i18n';

/**
 * Journal de combat (UX-COMBATLOG, doc 08 §2.4) : un listener global accumule
 * les **événements moteur déjà émis** du combat courant en lignes lisibles dans
 * `store.combatLog`. Pure présentation (aucun état/ règle moteur). Installé une
 * fois au bootstrap ⇒ capture aussi les événements d'ouverture (pré-combat),
 * avant que l'UI de combat ne soit montée.
 */
const MAX_LINES = 80;

// Carte id de pile → id d'unité, semée à `CombatStarted` (toutes les piles sont
// alors présentes) et complétée au fil des events (invocations/relèves). Une pile
// morte garde son nom : elle est retirée de l'état mais pas de cette carte.
let names = new Map<string, string>();
let seq = 0;

const nameOf = (stackId: string): string => {
  const unitId = names.get(stackId);
  return unitId ? resolveUnitName(unitId) : stackId;
};

function combatLogText(e: AppEvent): string | null {
  switch (e.type) {
    case 'CombatRoundStarted':
      return t('combatLog.round', { round: e.round });
    case 'StackAttacked':
      if (e.dodged) return t('combatLog.dodge', { target: nameOf(e.targetId) });
      return t(e.retaliation ? 'combatLog.retaliate' : 'combatLog.attack', {
        attacker: nameOf(e.attackerId),
        target: nameOf(e.targetId),
        damage: e.damage,
        kills: e.kills,
      });
    case 'StackDied':
      return t('combatLog.died', { unit: nameOf(e.stackId) });
    case 'StackHealed':
      return t('combatLog.healed', { unit: nameOf(e.stackId), amount: e.amount });
    case 'StackPoisoned':
      return t('combatLog.poisoned', { unit: nameOf(e.stackId), damage: e.damage });
    case 'StackAmmoReplenished':
      return t('combatLog.ammoReplenished', { unit: nameOf(e.stackId), amount: e.amount });
    case 'SpellCast':
      return t('combatLog.spell', {
        spell: resolveSpellName(e.spellId),
        target: nameOf(e.targetId),
        amount: e.amount,
      });
    case 'UnitSpellCast':
      return t('combatLog.unitSpell', {
        caster: nameOf(e.casterId),
        spell: resolveSpellName(e.spellId),
        target: nameOf(e.targetId),
      });
    case 'HeroStruck':
      return t('combatLog.heroStruck', { target: nameOf(e.targetId), amount: e.amount });
    case 'HeroRallied':
      return t('combatLog.rallied', { target: nameOf(e.targetId), revived: e.revived, healed: e.healed });
    case 'StackReborn':
      return t('combatLog.reborn', { unit: nameOf(e.stackId), count: e.count });
    case 'MoraleTriggered':
      return t(e.positive ? 'combatLog.moralePos' : 'combatLog.moraleNeg', { unit: nameOf(e.stackId) });
    case 'StackFeared':
      return t('combatLog.feared', { unit: nameOf(e.targetId) });
    case 'StackImmobilized':
      return t('combatLog.immobilized', { unit: nameOf(e.stackId) });
    case 'StackResonated':
      return t('combatLog.resonated', {
        unit: nameOf(e.stackId),
        amount: e.amount,
        resource: resolveFactionResourceName(e.resource),
      });
    case 'WallBombarded':
      // S2.4 : l'événement moteur ne porte pas la valeur des dégâts (calculée
      // dans `bombardWalls`, non exposée) ⇒ message qualitatif, pas de « −N ».
      return t(e.destroyed ? 'combatLog.wallDestroyed' : 'combatLog.wallBombarded');
    case 'CombatEnded':
      return e.winner === e.playerSide ? t('combatLog.won') : t('combatLog.lost');
    default:
      return null;
  }
}

export function installCombatLog(): void {
  eventBus.on((e: AppEvent) => {
    const combat = appStore.getState().game.combat;
    if (e.type === 'CombatStarted') {
      names = new Map();
      if (combat) for (const s of combat.stacks) names.set(s.id, s.unitId);
      appStore.setState({ combatLog: [] });
      return;
    }
    // Complète la carte (piles apparues après coup : relèves, invocations).
    if (combat) for (const s of combat.stacks) if (!names.has(s.id)) names.set(s.id, s.unitId);
    const text = combatLogText(e);
    if (text === null) return;
    appStore.setState((st) => {
      const next = [...st.combatLog, { id: ++seq, text }];
      return { combatLog: next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next };
    });
  });
}
