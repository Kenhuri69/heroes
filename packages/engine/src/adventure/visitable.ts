import type { GameEvent } from '../core/events';
import { weekOf, type GameState, type HeroState, type PlayerState, type ResourceId } from '../core/state';
import { maxAffordableCount, scaleCost, spendCost } from '../town/resources';
import { unitWithEconomy } from '../town/unit-economy';
import { grantXp, xpForLevel } from './experience';
import { revealAround } from './fog';
import type { DwellingObjectDef, VisitableObjectDef } from './map';

/** Cap d'armée du héros (doc 02 §5.1) — même limite que la garnison de ville. */
const MAX_ARMY_STACKS = 7;

/**
 * Visite d'un lieu de bonus (doc 02 §2.2) — appelée en passant par le
 * mouvement, le héros ne s'arrête pas. No-op si le héros a déjà consommé sa
 * visite (`oncePerHero` : à vie ; `oncePerHeroPerWeek` : cette semaine).
 * L'effet est déclaratif et générique (cf. `VisitableEffect`).
 */
export function visitBonus(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  obj: VisitableObjectDef,
  events: GameEvent[],
): void {
  const week = weekOf(draft.calendar.day);
  const last = obj.visits[hero.id];
  if (last === -1 || (obj.frequency === 'oncePerHeroPerWeek' && last === week)) return;

  const effect = obj.effect;
  let amount = 0;
  if (effect.kind === 'luck') {
    hero.visitLuck += effect.amount;
    amount = effect.amount;
  } else if (effect.kind === 'movement') {
    hero.movementPoints += effect.amount;
    amount = effect.amount;
  } else if (effect.kind === 'levelXp') {
    // « +1 niveau » (arbre du savoir) : l'XP manquante pour le niveau suivant.
    // No-op au niveau max (grantXp ignore un montant ≤ 0), mais la visite est
    // consommée dans tous les cas.
    const config = draft.config?.hero;
    amount = config ? Math.max(0, xpForLevel(config, hero.level + 1) - hero.xp) : 0;
    grantXp(draft, events, hero.id, amount);
  } else if (effect.kind === 'vision') {
    // Tour de guet (F2) : révèle durablement le brouillard autour du lieu.
    if (draft.map) revealAround(player.explored, draft.map, obj.pos, effect.amount);
    amount = effect.amount;
  } else if (effect.kind === 'permanentStat') {
    // Arène/statue (M-VISIT) : +attribut DÉFINITIF au héros visiteur.
    hero.attributes[effect.attribute] += effect.amount;
    amount = effect.amount;
  } else if (effect.kind === 'learnSpell') {
    // Sanctuaire de sort (M-VISIT) : enseigne un sort au héros. Idempotent —
    // s'il le connaît déjà, la visite est consommée sans rien apprendre (0).
    if (!hero.spells.includes(effect.spellId)) {
      hero.spells.push(effect.spellId);
      amount = 1;
    }
  } else if (effect.kind === 'grantSkill') {
    // Cabane de la sorcière (M-VISIT) : enseigne une compétence (rang 1) hors
    // montée de niveau. Idempotent — déjà connue ⇒ visite consommée sans gain (0).
    if (hero.skills[effect.skillId] === undefined) {
      hero.skills[effect.skillId] = 1;
      amount = 1;
    }
  } else {
    player.resources[effect.resource as ResourceId] += effect.amount;
    amount = effect.amount;
  }

  obj.visits[hero.id] = obj.frequency === 'oncePerHero' ? -1 : week;
  events.push({
    type: 'BonusVisited',
    heroId: hero.id,
    playerId: player.id,
    objectId: obj.id,
    // Copie structurelle : l'événement survit au `produce` d'immer, jamais une
    // référence au draft (proxy révoqué à la sortie).
    effect: { ...effect },
    amount,
  });
}

/**
 * Visite d'une habitation hors ville (doc 02 §2.2) — recrute le **maximum
 * abordable** du stock dans l'armée du héros (coût `recruitCost` des données
 * d'unité, ressources de faction comprises), fusion de pile, cap 7 piles.
 * No-op si stock vide, armée pleine sans pile fusionnable, ou 0 abordable.
 */
export function recruitDwelling(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  obj: DwellingObjectDef,
  events: GameEvent[],
): void {
  if (obj.stock <= 0) return;
  const existing = hero.army.find((s) => s.unitId === obj.unitId);
  if (!existing && hero.army.length >= MAX_ARMY_STACKS) return;
  const cost = unitWithEconomy(draft.unitCatalog, obj.unitId)?.recruitCost ?? {};
  const count = maxAffordableCount(player, cost, obj.stock);
  if (count <= 0) return;
  spendCost(player, scaleCost(cost, count));
  if (existing) existing.count += count;
  else hero.army.push({ unitId: obj.unitId, count });
  obj.stock -= count;
  events.push({
    type: 'DwellingRecruited',
    heroId: hero.id,
    playerId: player.id,
    objectId: obj.id,
    unitId: obj.unitId,
    count,
  });
}
