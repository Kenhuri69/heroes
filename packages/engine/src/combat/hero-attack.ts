import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { effectivePower } from '../hero/spells';
import { heroAttackOf, killsFromDamage } from './damage';
import { handleStackDeath } from './death';
import type { Draft } from './draft';
import { checkCombatEnd } from './turns';
import { recordLoss } from './state-helpers';
import type { CombatSideId, CombatState } from './types';

type HeroAttackCmd = { type: 'HeroAttack'; targetStackId: string };

function heroForSide(state: GameState, combat: CombatState, side: CombatSideId) {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  return heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
}

/**
 * Dégâts déterministes de l'attaque du héros (C1) — sans RNG, donc la
 * prévisualisation est exacte : `base + perPower×Pouvoir + perAttack×Attaque`.
 * Retourne 0 si la feature est désactivée (config `combat.heroAttack` absente).
 */
export function heroAttackDamage(state: GameState, combat: CombatState, side: CombatSideId): number {
  const cfg = state.config?.combat.heroAttack;
  if (!cfg) return 0;
  const hero = heroForSide(state, combat, side);
  if (!hero) return 0;
  const power = effectivePower(hero, state.artifactCatalog);
  const attack = heroAttackOf(state, combat, side);
  return Math.max(0, Math.round(cfg.base + cfg.perPower * power + cfg.perAttack * attack));
}

/** La pile active du camp joueur peut-elle déclencher l'attaque du héros ? */
export function canHeroAttack(state: GameState): boolean {
  return validateHeroAttackTarget(state) === null;
}

/** Validation commune (hors cible précise) : combat, tour joueur, héros, feature, non utilisée. */
function validateHeroAttackTarget(state: GameState): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const active = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!active || active.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  if (!state.config?.combat.heroAttack)
    return { code: 'heroAttackUnavailable', message: 'attaque du héros indisponible' };
  if (!heroForSide(state, combat, combat.playerSide))
    return { code: 'heroAttackUnavailable', message: 'aucun héros lié au camp joueur' };
  if (combat.heroAttackUsed.includes(combat.playerSide))
    return { code: 'heroAttackUsed', message: 'le héros a déjà frappé ce combat' };
  return null;
}

export function validateHeroAttack(state: GameState, cmd: HeroAttackCmd): CommandError | null {
  const base = validateHeroAttackTarget(state);
  if (base) return base;
  const combat = state.combat as CombatState;
  const target = combat.stacks.find((s) => s.id === cmd.targetStackId);
  if (!target || target.count <= 0)
    return { code: 'invalidTarget', message: `cible invalide '${cmd.targetStackId}'` };
  if (target.side === combat.playerSide)
    return { code: 'invalidTarget', message: 'l’attaque du héros vise l’ennemi' };
  // F-SCHOOLS.7 : la frappe du héros ne peut viser une pile ennemie furtive.
  if (target.stealthed) return { code: 'invalidTarget', message: 'cible furtive' };
  return null;
}

/**
 * Frappe du héros d'un CAMP (C-AIPARITY, doc 02 §5.5) — cœur partagé
 * joueur/IA : dégâts déterministes, 1×/combat par camp. Les validations de la
 * COMMANDE `HeroAttack` restent joueur-only ; l'appelant IA garantit ses
 * préconditions (héros présent, frappe disponible, cible adverse vivante).
 */
export function strikeWithHero(
  draft: Draft,
  side: CombatSideId,
  targetStackId: string,
  events: GameEvent[],
): void {
  const combat = draft.combat;
  if (!combat) return;
  const target = combat.stacks.find((s) => s.id === targetStackId);
  const targetDef = target ? draft.unitCatalog[target.unitId] : undefined;
  if (!target || !targetDef) return;

  const amount = heroAttackDamage(draft, combat, side);
  combat.heroAttackUsed.push(side);

  const pool = (target.count - 1) * targetDef.stats.hp + target.firstHp;
  const kills = killsFromDamage(pool, targetDef.stats.hp, target.count, amount);
  const remaining = Math.max(0, pool - amount);
  const newCount = target.count - kills;
  target.count = newCount;
  target.firstHp = newCount > 0 ? remaining - (newCount - 1) * targetDef.stats.hp : 0;
  recordLoss(combat, target, kills);
  events.push({
    type: 'HeroStruck',
    side,
    targetId: target.id,
    amount,
    kills,
  });
  // Mort centralisée (CAP-LIFE.2) : renaissance éventuelle, sinon retrait — corrige
  // au passage l'absence de splice de ce chemin (la pile morte restait sur le plateau).
  if (target.count <= 0) handleStackDeath(combat, target, targetDef, events);
  checkCombatEnd(draft, events);
}

export function handleHeroAttack(draft: Draft, cmd: HeroAttackCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return; // exclu par validate
  strikeWithHero(draft, combat.playerSide, cmd.targetStackId, events);
}
