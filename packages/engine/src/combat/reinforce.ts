import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { COMBAT_COLS, COMBAT_ROWS } from './hex';
import { shooterAmmo } from './state-helpers';
import { firstFreeCombatHex, spellcasterParams } from './spell-effect';
import { canAffordCost, scaleCost, spendCost } from '../town/resources';
import { unitWithEconomy } from '../town/unit-economy';
import type { CombatSideId, CombatState, CombatStack } from './types';

type ReinforceCmd = { type: 'CallReinforcements'; unitId: string; count: number };

/**
 * Renforts en combat (doc 18 B3, signature MMHO) — action de HÉROS hors tour de
 * pile (comme `HeroAttack`), **strictement opt-in et PvE** : le héros ajoute une
 * pile FRAÎCHE d'une unité qu'il commande déjà, contre or. Générique : aucun nom
 * de faction (l'unité vient de l'armée du héros ; le coût = son `recruitCost`).
 */

/** Le héros lié au camp du joueur (contexte aventure), ou `undefined` (arène). */
function playerHero(state: GameState, combat: CombatState) {
  return combat.heroId ? state.heroes.find((h) => h.id === combat.heroId) : undefined;
}

/** Hex arrière libre du camp joueur pour poser un renfort, ou `null` (plateau plein). */
function reinforcementHex(combat: CombatState, side: CombatSideId) {
  const backCol = side === 'attacker' ? 0 : COMBAT_COLS - 1;
  return firstFreeCombatHex(combat, { col: backCol, row: Math.floor(COMBAT_ROWS / 2) });
}

export function validateCallReinforcements(state: GameState, cmd: ReinforceCmd): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  if (combat.phase !== 'battle')
    return { code: 'invalidAction', message: 'renforts indisponibles hors bataille' };
  const cfg = state.config?.combat.reinforcements;
  if (!cfg) return { code: 'reinforcementsUnavailable', message: 'renforts indisponibles (feature désactivée)' };
  // PvE only (doc 18 B3) : jamais en hero-vs-hero, jamais en arène.
  if (combat.defenderHeroId !== null)
    return { code: 'reinforcementsUnavailable', message: 'renforts interdits en combat de héros' };
  const hero = playerHero(state, combat);
  if (!hero) return { code: 'reinforcementsUnavailable', message: 'aucun héros lié au camp joueur' };
  // C'est au joueur de jouer (pile active de son camp) — même gate que HeroAttack.
  const active = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!active || active.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  if ((combat.reinforcementsUsed ?? 0) >= cfg.maxCallsPerCombat)
    return { code: 'reinforcementsUnavailable', message: 'plafond de renforts atteint pour ce combat' };
  if (cmd.count < 1 || cmd.count > cfg.maxUnitsPerCall)
    return { code: 'invalidAction', message: `effectif de renfort hors bornes (1..${cfg.maxUnitsPerCall})` };
  if (!hero.army.some((s) => s.unitId === cmd.unitId))
    return { code: 'reinforcementsUnavailable', message: `'${cmd.unitId}' n’est pas une unité du héros` };
  const recruitCost = unitWithEconomy(state.unitCatalog, cmd.unitId)?.recruitCost;
  if (!recruitCost) return { code: 'reinforcementsUnavailable', message: `'${cmd.unitId}' non renforçable (coût inconnu)` };
  const player = state.players.find((p) => p.id === hero.playerId);
  if (!player) return { code: 'reinforcementsUnavailable', message: 'joueur du héros introuvable' };
  if (!canAffordCost(player, scaleCost(recruitCost, cmd.count * cfg.costMultiplier)))
    return { code: 'cannotAfford', message: 'or insuffisant pour appeler des renforts' };
  if (!reinforcementHex(combat, combat.playerSide))
    return { code: 'reinforcementsUnavailable', message: 'plateau plein : aucun hex libre pour le renfort' };
  return null;
}

export function handleCallReinforcements(draft: GameState, cmd: ReinforceCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  const cfg = draft.config?.combat.reinforcements;
  if (!combat || !cfg) return; // exclu par validate
  const hero = playerHero(draft, combat);
  const player = hero ? draft.players.find((p) => p.id === hero.playerId) : undefined;
  const def = draft.unitCatalog[cmd.unitId];
  const recruitCost = unitWithEconomy(draft.unitCatalog, cmd.unitId)?.recruitCost;
  const side = combat.playerSide;
  const pos = reinforcementHex(combat, side);
  if (!player || !def || !recruitCost || !pos) return;
  spendCost(player, scaleCost(recruitCost, cmd.count * cfg.costMultiplier));
  // Slot unique jamais réutilisé (patron summon) : > 99 (tour de siège) et au-dessus
  // de toute pile vivante OU du cimetière du camp.
  const slot =
    1 +
    Math.max(
      99,
      ...combat.stacks.filter((s) => s.side === side).map((s) => s.slot),
      ...(combat.graveyard ?? []).filter((g) => g.side === side).map((g) => g.slot),
    );
  const newStack: CombatStack = {
    id: `${side}-${slot}`,
    side,
    slot,
    unitId: cmd.unitId,
    count: cmd.count,
    firstHp: def.stats.hp,
    pos,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: shooterAmmo(def),
    spellCharges: spellcasterParams(def)?.charges ?? 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    // Le renfort se DÉPLOIE ce round et n'agit qu'au round SUIVANT (anti-abus
    // « renfort + charge immédiate ») : marqué comme ayant déjà agi ce round.
    acted: true,
    statuses: [],
  };
  combat.stacks.push(newStack);
  combat.reinforcementsUsed = (combat.reinforcementsUsed ?? 0) + 1;
  events.push({ type: 'ReinforcementsCalled', side, stackId: newStack.id, unitId: cmd.unitId, count: cmd.count });
}
