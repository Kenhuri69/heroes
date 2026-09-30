import { beginGuardianCombat } from '../combat/setup';
import type { GameEvent } from '../core/events';
import { armyStrength } from '../core/power';
import { rollRange } from '../core/rng';
import type { GameState, HeroState } from '../core/state';
import { heroEffectTotal, heroArmyCap } from '../hero/skills';
import { canAffordCost, scaleCost, spendCost } from '../town/resources';
import { unitWithEconomy } from '../town/unit-economy';
import type { GuardianObjectDef } from './map';
import { queueGuardianRespawn } from './respawn';

/** Proposition d'un gardien neutre à l'interception (LE5 A4). */
export type NeutralOffer = NonNullable<GameState['pendingNeutralOffer']>;

/**
 * Gardien qui ne fuit ni ne se rallie jamais : champ `neverFlee`, butin qui dépend
 * de lui (`guardedBy` — banques, trésors gardés), ou cible d'une quête
 * `defeatGuardian` encore active.
 */
function neverFlees(state: GameState, guardian: GuardianObjectDef): boolean {
  if (guardian.neverFlee) return true;
  if (state.map?.objects.some((o) => 'guardedBy' in o && o.guardedBy === guardian.id)) return true;
  return (state.quests?.quests ?? []).some(
    (q) =>
      q.status === 'active' &&
      q.def.steps.some((s) => s.condition.type === 'defeatGuardian' && s.condition.objectId === guardian.id),
  );
}

/**
 * Coût du ralliement : coût de recrutement de la pile entière, réduit du % de
 * Diplomatie (arrondi au supérieur). `null` sans Diplomatie, sans place dans
 * l'armée (ni pile de même unité ni emplacement libre) ou pour une unité sans
 * coût de recrutement (non recrutable).
 */
function joinCost(state: GameState, hero: HeroState, guardian: GuardianObjectDef): Record<string, number> | null {
  const discount = Math.min(100, heroEffectTotal(hero, state.skillCatalog, 'neutralJoinDiscountPct', state.artifactCatalog));
  if (discount <= 0) return null;
  const hasRoom =
    hero.army.some((s) => s.unitId === guardian.unitId) || hero.army.filter((s) => s.count > 0).length < heroArmyCap(hero);
  if (!hasRoom) return null;
  const recruitCost = unitWithEconomy(state.unitCatalog, guardian.unitId)?.recruitCost;
  if (!recruitCost) return null;
  const full = scaleCost(recruitCost, guardian.count);
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(full)) cost[res] = Math.ceil((amount * (100 - discount)) / 100);
  return cost;
}

/**
 * Proposition du gardien `guardian` face à `hero` (LE5 A4), ou `null` quand il
 * combat : règle absente, gardien `neverFlee`, ou rapport de force trop faible.
 * Rapport `r` = force du héros / force du gardien (`armyStrength`) :
 * - fuite si `r ≥ fleeRatio` ; entre `fleeChanceFrom` et `fleeRatio`, tirée au
 *   RNG seedé avec une probabilité linéaire (consommé seulement dans cette zone) ;
 * - ralliement si `r ≥ joinRatio` et Diplomatie (cf. `joinCost`).
 */
export function neutralOfferFor(
  draft: GameState,
  hero: HeroState,
  guardian: GuardianObjectDef,
  allyHeroId?: string,
): NeutralOffer | null {
  const rules = draft.config?.neutralReactions;
  if (!rules || neverFlees(draft, guardian)) return null;
  const guardianPower = armyStrength([{ unitId: guardian.unitId, count: guardian.count }], draft.unitCatalog);
  if (guardianPower <= 0) return null;
  const ratio = armyStrength(hero.army, draft.unitCatalog) / guardianPower;
  let release = ratio >= rules.fleeRatio;
  if (!release && ratio >= rules.fleeChanceFrom) {
    const roll = rollRange(draft.rng, 0, 999);
    draft.rng = roll.state;
    release = roll.value < ((ratio - rules.fleeChanceFrom) / (rules.fleeRatio - rules.fleeChanceFrom)) * 1000;
  }
  const cost = ratio >= rules.joinRatio ? joinCost(draft, hero, guardian) : null;
  if (!release && !cost) return null;
  return {
    heroId: hero.id,
    playerId: hero.playerId,
    guardianObjectId: guardian.id,
    release,
    joinCost: cost,
    ...(allyHeroId !== undefined ? { allyHeroId } : {}),
  };
}

/** Choix proposés au joueur (le combat est toujours possible). */
export type NeutralOfferChoice = 'fight' | 'release' | 'join';

/** Le choix est-il ouvert par la proposition (et le ralliement payable) ? */
export function neutralChoiceAllowed(state: GameState, offer: NeutralOffer, choice: NeutralOfferChoice): boolean {
  if (choice === 'fight') return true;
  if (choice === 'release') return offer.release;
  const player = state.players.find((p) => p.id === offer.playerId);
  return !!offer.joinCost && !!player && canAffordCost(player, offer.joinCost);
}

/**
 * Résout la proposition en attente (humain via `ResolveNeutralOffer`, IA sur-le-
 * champ) : `fight` ouvre le combat de gardien (le pas d'engagement est déjà
 * payé) ; `release` retire le gardien sans XP ni butin ; `join` paie le coût et
 * ajoute la pile à l'armée. Fuite et ralliement mettent le respawn en file comme
 * une victoire. No-op sans proposition ou pour un choix non ouvert.
 */
export function resolveNeutralOffer(draft: GameState, choice: NeutralOfferChoice, events: GameEvent[]): void {
  const offer = draft.pendingNeutralOffer;
  if (!offer || !neutralChoiceAllowed(draft, offer, choice)) return;
  delete draft.pendingNeutralOffer;
  const map = draft.map;
  const idx = map ? map.objects.findIndex((o) => o.id === offer.guardianObjectId) : -1;
  const guardian = idx !== -1 ? map!.objects[idx] : undefined;
  const hero = draft.heroes.find((h) => h.id === offer.heroId);
  if (!map || !guardian || guardian.type !== 'guardian' || !hero) return;
  if (choice === 'fight') {
    beginGuardianCombat(draft, hero.id, guardian.id, events, offer.allyHeroId);
    return;
  }
  if (choice === 'join') {
    const player = draft.players.find((p) => p.id === offer.playerId)!;
    spendCost(player, offer.joinCost!);
    const stack = hero.army.find((s) => s.unitId === guardian.unitId);
    if (stack) stack.count += guardian.count;
    else hero.army.push({ unitId: guardian.unitId, count: guardian.count });
  }
  queueGuardianRespawn(draft, guardian, guardian.count);
  map.objects.splice(idx, 1);
  events.push({
    type: choice === 'join' ? 'NeutralJoined' : 'GuardianReleased',
    heroId: hero.id,
    playerId: hero.playerId,
    objectId: guardian.id,
    unitId: guardian.unitId,
    count: guardian.count,
  });
}
