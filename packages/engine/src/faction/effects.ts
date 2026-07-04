import type { Draft } from '../combat/draft';
import { hasAbility } from '../combat/state-helpers';
import type { CombatSideId, CombatState } from '../combat/types';
import type { GameEvent } from '../core/events';
import type { HeroState } from '../core/state';
import type { FactionBonus } from './types';

/** Capacité d'armée du héros (doc 02 §5.1) — ≤ 7 piles distinctes. */
const MAX_ARMY_STACKS = 7;

type Casualty = { side: CombatSideId; unitId: string; lost: number };

/**
 * Interprète les effets de faction déclaratifs du héros vainqueur (doc 06
 * §4) : lit `draft.factionCatalog[hero.factionId]?.bonuses`, jamais un nom de
 * faction. Appelé depuis `applyConsequences` (combat/turns.ts) après la
 * reconstruction de `hero.army`, uniquement quand le héros a gagné en tant
 * qu'attaquant.
 */
export function applyFactionVictoryEffects(
  draft: Draft,
  combat: CombatState,
  hero: HeroState,
  casualties: Casualty[],
  events: GameEvent[],
): void {
  const bonuses = draft.factionCatalog[hero.factionId]?.bonuses ?? [];
  for (const bonus of bonuses) {
    if (bonus.type === 'raiseUndeadOnVictory') {
      applyRaiseUndeadOnVictory(draft, bonus, casualties, hero, events);
    }
  }
}

function applyRaiseUndeadOnVictory(
  draft: Draft,
  bonus: Extract<FactionBonus, { type: 'raiseUndeadOnVictory' }>,
  casualties: Casualty[],
  hero: HeroState,
  events: GameEvent[],
): void {
  const raisedDef = draft.unitCatalog[bonus.unitId];
  if (!raisedDef || raisedDef.stats.hp <= 0) return; // données absentes/invalides — no-op défensif

  // PV vivants (non-`undead`) tués côté défenseur (doc 04 : « PV des créatures
  // vivantes ennemies tuées »).
  const hpKilled = casualties
    .filter((c) => c.side === 'defender')
    .reduce((sum, c) => {
      const def = draft.unitCatalog[c.unitId];
      if (!def || hasAbility(def, 'undead')) return sum;
      return sum + def.stats.hp * c.lost;
    }, 0);
  if (hpKilled <= 0) return;

  const existingStack = hero.army.find((s) => s.unitId === bonus.unitId);
  const cap = bonus.capBase + bonus.capPerExisting * (existingStack?.count ?? 0);
  const raised = Math.min(
    Math.floor((hpKilled * bonus.percentHpRaised) / 100 / raisedDef.stats.hp),
    cap,
  );
  if (raised <= 0) return;

  if (existingStack) {
    existingStack.count += raised;
  } else {
    if (hero.army.length >= MAX_ARMY_STACKS) return; // armée pleine : pas d'ajout (documenté, lot O)
    hero.army.push({ unitId: bonus.unitId, count: raised });
  }
  events.push({ type: 'UndeadRaised', heroId: hero.id, unitId: bonus.unitId, count: raised });
}
