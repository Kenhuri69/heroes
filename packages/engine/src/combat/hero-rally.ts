import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { heroBattlePrayerHp } from '../hero/skills';
import type { Draft } from './draft';
import { resolveResurrect, resurrectStack } from './spell-effect';
import { collectCasualties } from './state-helpers';
import type { CombatSideId, CombatState } from './types';

type HeroRallyCmd = { type: 'HeroRally'; targetStackId: string };

function heroForSide(state: GameState, combat: CombatState, side: CombatSideId) {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  return heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
}

/**
 * Prière de bataille (F-SKILLS.2, doc 03 §2/§5) : PV que le héros d'un camp peut
 * soigner/ressusciter 1×/combat, dérivés de sa compétence (`battleResurrectHp`).
 * 0 ⇒ action indisponible (aucun héros / compétence absente).
 */
export function heroRallyHp(state: GameState, combat: CombatState, side: CombatSideId): number {
  const hero = heroForSide(state, combat, side);
  return hero ? heroBattlePrayerHp(hero, state.skillCatalog) : 0;
}

/** La pile active du camp joueur peut-elle déclencher la Prière de bataille ? */
export function canHeroRally(state: GameState): boolean {
  return validateHeroRallyReady(state) === null;
}

/**
 * Prévisualisation PURE (sans mutation, sans RNG) de la Prière sur une cible :
 * PV rendus + créatures ressuscitées si le joueur priait cette pile maintenant.
 * Consommée par l'UI (préviz obligatoire doc 08 §2.4) — zéro réimplémentation.
 */
export function estimateHeroRally(
  state: GameState,
  targetStackId: string,
): { healed: number; revived: number } {
  const combat = state.combat;
  if (!combat) return { healed: 0, revived: 0 };
  const target = combat.stacks.find((s) => s.id === targetStackId);
  const def = target ? state.unitCatalog[target.unitId] : undefined;
  if (!target || !def || target.count <= 0) return { healed: 0, revived: 0 };
  const hp = heroRallyHp(state, combat, combat.playerSide);
  if (hp <= 0) return { healed: 0, revived: 0 };
  const lostSoFar =
    collectCasualties(combat).find((c) => c.side === target.side && c.unitId === target.unitId)?.lost ?? 0;
  const { healed, revived } = resolveResurrect(def, target, lostSoFar, hp);
  return { healed, revived };
}

/** Validation commune (hors cible précise) : combat, tour joueur, compétence, non utilisée. */
function validateHeroRallyReady(state: GameState): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const active = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!active || active.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  if (heroRallyHp(state, combat, combat.playerSide) <= 0)
    return { code: 'heroRallyUnavailable', message: 'prière de bataille indisponible' };
  if ((combat.heroRallyUsed ?? []).includes(combat.playerSide))
    return { code: 'heroRallyUsed', message: 'la prière a déjà été invoquée ce combat' };
  return null;
}

export function validateHeroRally(state: GameState, cmd: HeroRallyCmd): CommandError | null {
  const ready = validateHeroRallyReady(state);
  if (ready) return ready;
  const combat = state.combat as CombatState;
  const target = combat.stacks.find((s) => s.id === cmd.targetStackId);
  if (!target || target.count <= 0)
    return { code: 'invalidTarget', message: `cible invalide '${cmd.targetStackId}'` };
  // La prière soigne un ALLIÉ vivant (pas l'ennemi).
  if (target.side !== combat.playerSide)
    return { code: 'invalidTarget', message: 'la prière vise une pile alliée' };
  return null;
}

/**
 * Prière de bataille d'un CAMP — cœur partagé joueur/IA : soigne/ressuscite une
 * pile alliée de `heroRallyHp` PV, 1×/combat par camp. Les validations de la
 * COMMANDE restent joueur-only ; l'appelant IA garantit ses préconditions
 * (héros doté, prière disponible, cible alliée vivante).
 */
export function rallyWithHero(
  draft: Draft,
  side: CombatSideId,
  targetStackId: string,
  events: GameEvent[],
): void {
  const combat = draft.combat;
  if (!combat) return;
  const target = combat.stacks.find((s) => s.id === targetStackId);
  if (!target) return;
  const hp = heroRallyHp(draft, combat, side);
  if (hp <= 0) return;
  const { healed, revived } = resurrectStack(draft, combat, target, hp);
  combat.heroRallyUsed = [...(combat.heroRallyUsed ?? []), side];
  events.push({ type: 'HeroRallied', side, targetId: target.id, healed, revived });
}

export function handleHeroRally(draft: Draft, cmd: HeroRallyCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return; // exclu par validate
  rallyWithHero(draft, combat.playerSide, cmd.targetStackId, events);
}
