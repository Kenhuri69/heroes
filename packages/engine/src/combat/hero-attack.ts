import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import { heroArtifactBonus } from '../hero/artifacts';
import { effectivePower } from '../hero/spells';
import { factionCombatBonus, heroActionLeftFor, heroesOnSide, recordLoss } from './state-helpers';
import { killsFromDamage } from './damage';
import { handleStackDeath } from './death';
import type { Draft } from './draft';
import { checkCombatEnd } from './turns';
import type { CombatSideId, CombatState } from './types';

type HeroAttackCmd = { type: 'HeroAttack'; targetStackId: string; heroId?: string };

function heroForSide(state: GameState, combat: CombatState, side: CombatSideId) {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  return heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
}

/** Héros AGISSANT résolu : `cmd.heroId` (E4.4, coop) sinon le lead du camp joueur. */
function actingHero(state: GameState, combat: CombatState, heroId?: string): HeroState | undefined {
  if (heroId) return state.heroes.find((h) => h.id === heroId);
  return heroForSide(state, combat, combat.playerSide);
}

/**
 * Dégâts déterministes de l'attaque d'un HÉROS précis (C1/E4.4) — sans RNG, donc
 * la préviz est exacte : `base + perPower×Pouvoir + perAttack×Attaque` avec les
 * stats du héros agissant (bonus de faction du camp inclus). 0 si feature/héros absent.
 */
export function heroAttackDamageFor(
  state: GameState,
  combat: CombatState,
  side: CombatSideId,
  hero: HeroState | undefined,
): number {
  const cfg = state.config?.combat.heroAttack;
  if (!cfg || !hero) return 0;
  const power = effectivePower(hero, state.artifactCatalog);
  const attack =
    factionCombatBonus(state, combat, side).attack +
    hero.attributes.attack +
    heroArtifactBonus(hero, state.artifactCatalog).attack;
  return Math.max(0, Math.round(cfg.base + cfg.perPower * power + cfg.perAttack * attack));
}

/** Préviz de l'attaque du héros **lead** d'un camp (rétro-compat client/UI). */
export function heroAttackDamage(state: GameState, combat: CombatState, side: CombatSideId): number {
  return heroAttackDamageFor(state, combat, side, heroForSide(state, combat, side));
}

/** La pile active du camp joueur peut-elle déclencher l'attaque du héros ? */
export function canHeroAttack(state: GameState): boolean {
  return validateHeroAttackTarget(state) === null;
}

/** Validation commune (hors cible précise) : combat, tour joueur, héros agissant, feature, budget. */
function validateHeroAttackTarget(state: GameState, heroId?: string): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const active = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!active || active.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  if (!state.config?.combat.heroAttack)
    return { code: 'heroAttackUnavailable', message: 'attaque du héros indisponible' };
  // E4.4 : héros agissant = `heroId` (coop) sinon le lead ; il doit être sur le
  // camp joueur (lead ou allié coop d'une pile vivante).
  const hero = actingHero(state, combat, heroId);
  if (!hero || !heroesOnSide(combat, combat.playerSide).includes(hero.id))
    return { code: 'heroAttackUnavailable', message: 'aucun héros lié au camp joueur' };
  // Actions de héros par round (doc 02 §1, généralisé doc 18 C1) : frappe et
  // sort consomment le même budget PAR HÉROS — 1 de base, + perk `heroActionsPerRound`.
  if (!heroActionLeftFor(state, combat, hero.id))
    return { code: 'heroAttackUsed', message: 'le héros a déjà épuisé ses actions ce round' };
  return null;
}

export function validateHeroAttack(state: GameState, cmd: HeroAttackCmd): CommandError | null {
  const base = validateHeroAttackTarget(state, cmd.heroId);
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
 * joueur/IA : dégâts déterministes, une action de héros par round (frappe OU
 * sort, exclusifs ; réinit chaque round comme le sort). Les validations de la
 * COMMANDE `HeroAttack` restent joueur-only ; l'appelant IA garantit ses
 * préconditions (héros présent, frappe disponible, cible adverse vivante).
 */
export function strikeWithHero(
  draft: Draft,
  side: CombatSideId,
  heroId: string,
  targetStackId: string,
  events: GameEvent[],
): void {
  const combat = draft.combat;
  if (!combat) return;
  const target = combat.stacks.find((s) => s.id === targetStackId);
  const targetDef = target ? draft.unitCatalog[target.unitId] : undefined;
  const hero = draft.heroes.find((h) => h.id === heroId);
  if (!target || !targetDef || !hero) return;

  const amount = heroAttackDamageFor(draft, combat, side, hero);
  combat.heroAttackUsed.push(heroId); // suivi PAR HÉROS (E4.4)

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
  const hero = actingHero(draft, combat, cmd.heroId);
  if (!hero) return;
  strikeWithHero(draft, combat.playerSide, hero.id, cmd.targetStackId, events);
}
