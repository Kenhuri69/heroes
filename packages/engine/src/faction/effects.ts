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
    } else if (bonus.type === 'gainFactionResourceOnVictory') {
      applyGainFactionResourceOnVictory(draft, bonus, hero, events);
    }
  }
}

/** Crédite le joueur du héros vainqueur d'une ressource de faction (doc 05 §3.3). */
function applyGainFactionResourceOnVictory(
  draft: Draft,
  bonus: Extract<FactionBonus, { type: 'gainFactionResourceOnVictory' }>,
  hero: HeroState,
  events: GameEvent[],
): void {
  if (bonus.amount <= 0) return;
  const player = draft.players.find((p) => p.id === hero.playerId);
  if (!player) return;
  player.factionResources[bonus.resource] =
    (player.factionResources[bonus.resource] ?? 0) + bonus.amount;
  events.push({
    type: 'FactionResourceGained',
    playerId: player.id,
    resource: bonus.resource,
    amount: bonus.amount,
  });
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
  // Nécromancie graduée (F-SKILLS, doc 04 §2) : le rang de `scaleSkillId` choisit
  // le pourcentage ; repli sur `percentHpRaised` si non gradué / compétence non apprise.
  const rank = bonus.scaleSkillId ? (hero.skills[bonus.scaleSkillId] ?? 0) : 0;
  const percent =
    rank > 0 && bonus.percentByRank && bonus.percentByRank[rank - 1] !== undefined
      ? bonus.percentByRank[rank - 1]!
      : bonus.percentHpRaised;
  const raised = Math.min(Math.floor((hpKilled * percent) / 100 / raisedDef.stats.hp), cap);
  if (raised <= 0) return;

  if (existingStack) {
    existingStack.count += raised;
  } else {
    if (hero.army.length >= MAX_ARMY_STACKS) return; // armée pleine : pas d'ajout (documenté, lot O)
    hero.army.push({ unitId: bonus.unitId, count: raised });
  }
  events.push({ type: 'UndeadRaised', heroId: hero.id, unitId: bonus.unitId, count: raised });
}
