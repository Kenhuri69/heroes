import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import { evaluateOutcome } from '../scenario/outcome';
import type { Draft } from './draft';
import { collectCasualties } from './state-helpers';
import type { CombatSideId, CombatState } from './types';

/**
 * Quitter un combat (C3) : reddition et fuite. Contrairement à une défaite
 * normale (`applyConsequences` retire le héros de la carte), ces deux actions
 * laissent le héros **survivre** :
 *  - `Retreat` (fuite) : le héros abandonne son armée (`army = []`), gratuit ;
 *  - `Surrender` (reddition) : le héros paie de l'or (valeur de l'armée survivante)
 *    et conserve son armée.
 * L'ennemi l'emporte (le gardien reste, la ville n'est pas prise) ; aucun état
 * persistant nouveau (le combat se résout à `null`), donc save/golden inchangés.
 */

type LeaveCmd = { type: 'Retreat' } | { type: 'Surrender' };

function enemyOf(side: CombatSideId): CombatSideId {
  return side === 'attacker' ? 'defender' : 'attacker';
}

function playerHero(state: GameState, combat: CombatState): HeroState | undefined {
  return combat.heroId ? state.heroes.find((h) => h.id === combat.heroId) : undefined;
}

/** Coût de reddition (C3) : valeur en or de l'armée survivante du camp joueur. */
export function surrenderCost(state: GameState, combat: CombatState): number {
  return combat.stacks
    .filter((s) => s.side === combat.playerSide && s.count > 0)
    .reduce((sum, s) => sum + s.count * (state.unitCatalog[s.unitId]?.recruitCost?.gold ?? 0), 0);
}

/** Validation commune : combat d'aventure en cours, au tour du joueur, héros vivant. */
function validateLeave(state: GameState): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const active = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!active || active.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  if (!playerHero(state, combat))
    return { code: 'invalidAction', message: 'aucun héros ne peut quitter ce combat (arène)' };
  return null;
}

export function validateRetreat(state: GameState): CommandError | null {
  return validateLeave(state);
}

export function validateSurrender(state: GameState): CommandError | null {
  const base = validateLeave(state);
  if (base) return base;
  const combat = state.combat as CombatState;
  const hero = playerHero(state, combat) as HeroState;
  const player = state.players.find((p) => p.id === hero.playerId);
  if (!player) return { code: 'invalidAction', message: 'joueur introuvable' };
  if (player.resources.gold < surrenderCost(state, combat))
    return { code: 'cannotAfford', message: 'or insuffisant pour se rendre' };
  return null;
}

/** Termine un combat quitté sans les conséquences du vainqueur (le héros survit). */
function endLeftCombat(
  draft: Draft,
  combat: CombatState,
  mode: 'retreat' | 'surrender',
  events: GameEvent[],
): void {
  const winner = enemyOf(combat.playerSide);
  combat.finished = true;
  combat.winner = winner;
  combat.activeStackId = null;
  const casualties = collectCasualties(combat);
  // Chance de fontaine consommée pour tout héros engagé encore vivant (comme la fin normale).
  for (const heroId of [combat.attackerHeroId, combat.defenderHeroId]) {
    const hero = heroId ? draft.heroes.find((h) => h.id === heroId) : undefined;
    if (hero) hero.visitLuck = 0;
  }
  events.push({ type: 'CombatLeft', mode, heroId: combat.heroId ?? '' });
  events.push({ type: 'CombatEnded', winner, playerSide: combat.playerSide, casualties });
  // Le héros survit (pas de `splice`) : aucune élimination, mais on réévalue les
  // conditions de scénario (no-op hors scénario / si rien ne change).
  evaluateOutcome(draft, events);
  draft.combat = null;
}

export function handleRetreat(draft: Draft, _cmd: LeaveCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return; // exclu par validate
  const hero = playerHero(draft, combat);
  if (hero) hero.army = []; // fuite : l'armée est abandonnée
  endLeftCombat(draft, combat, 'retreat', events);
}

export function handleSurrender(draft: Draft, _cmd: LeaveCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return; // exclu par validate
  const hero = playerHero(draft, combat);
  if (hero) {
    const player = draft.players.find((p) => p.id === hero.playerId);
    if (player) player.resources.gold -= surrenderCost(draft, combat);
    // Reddition : le héros conserve son armée survivante (hors machines de guerre).
    hero.army = combat.stacks
      .filter((s) => s.side === combat.playerSide && s.count > 0 && !hero.warMachines.includes(s.unitId))
      .map((s) => ({ unitId: s.unitId, count: s.count }));
  }
  endLeftCombat(draft, combat, 'surrender', events);
}
