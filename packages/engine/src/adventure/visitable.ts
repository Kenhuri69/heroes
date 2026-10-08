import type { GameEvent } from '../core/events';
import { weekOf, type GameState, type HeroState, type PlayerState, type ResourceId } from '../core/state';
import { maxAffordableCount, scaleCost, spendCost } from '../town/resources';
import { unitWithEconomy } from '../town/unit-economy';
import { heroArmyCap, heroLearnableCircle } from '../hero/skills';
import { grantXp, xpForLevel } from './experience';
import { revealAround } from './fog';
import type { DwellingObjectDef, VisitableObjectDef } from './map';
import { grantArtifact } from '../hero/equip';

/** Cap d'armée du héros (doc 02 §5.1) — base 7, étendu par `heroArmyCap` (doc 18 C1). */
export const MAX_ARMY_STACKS = 7;

/** Le héros peut-il encore profiter de ce lieu aujourd'hui (fréquence de visite) ? */
export function visitAvailable(obj: VisitableObjectDef, heroId: string, day: number): boolean {
  const last = obj.visits[heroId];
  if (last === undefined) return true;
  if (obj.frequency === 'oncePerHero') return false;
  if (obj.frequency === 'oncePerHeroPerDay') return last !== day;
  return last !== weekOf(day);
}

/** Nombre de compétences secondaires qu'un héros peut connaître (doc 02 §1.3). */
const MAX_HERO_SKILLS = 6;

/**
 * Visite d'un lieu de bonus (doc 02 §2.2) — appelée en passant par le
 * mouvement, le héros ne s'arrête pas. No-op si le héros a déjà consommé sa
 * visite (`oncePerHero` : à vie ; `oncePerHeroPerWeek` : cette semaine ;
 * `oncePerHeroPerDay` : aujourd'hui — la marque stocke alors le jour).
 * L'effet est déclaratif et générique (cf. `VisitableEffect`).
 *
 * Lot R3 : un sanctuaire dont le sort dépasse le cercle apprenable, ou une cabane
 * pour un héros à 6 compétences, est refusé (`BonusRefused`) sans consommer la
 * visite. Une cabane apprenable pose une proposition (`pendingSkillOffer`) et
 * retourne `true` : l'appelant interrompt le chemin.
 */
export function visitBonus(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  obj: VisitableObjectDef,
  events: GameEvent[],
): boolean {
  if (!visitAvailable(obj, hero.id, draft.calendar.day)) return false;

  const effect = obj.effect;
  const refuse = (reason: 'wisdomRequired' | 'skillsFull'): boolean => {
    events.push({ type: 'BonusRefused', heroId: hero.id, playerId: player.id, objectId: obj.id, reason });
    return false;
  };
  let amount = 0;
  if (effect.kind === 'luck') {
    hero.visitLuck += effect.amount;
    amount = effect.amount;
  } else if (effect.kind === 'morale') {
    // Temple / point d'eau (M-VISIT) : +moral jusqu'au prochain combat (miroir de `luck`).
    hero.visitMorale += effect.amount;
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
  } else if (effect.kind === 'experience') {
    // Pierre du Savoir (M-VISIT) : montant FIXE d'XP (peut monter de niveau).
    amount = effect.amount;
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
    // Lot R3 (canon III) : un cercle au-delà de ce que permet la Sagesse est
    // refusé et la visite reste disponible — le héros reviendra.
    if (!hero.spells.includes(effect.spellId)) {
      const circle = draft.spellCatalog[effect.spellId]?.circle ?? 0;
      if (circle > heroLearnableCircle(hero, draft.skillCatalog)) return refuse('wisdomRequired');
      hero.spells.push(effect.spellId);
      amount = 1;
    }
  } else if (effect.kind === 'grantSkill') {
    // Cabane de la sorcière (M-VISIT) : enseigne une compétence (rang 1) hors
    // montée de niveau. Déjà connue ⇒ visite consommée sans gain (0). Lot R3 :
    // sinon le héros s'arrête et choisit (`pendingSkillOffer`) ; à 6 compétences,
    // la visite est refusée et reste disponible.
    if (hero.skills[effect.skillId] === undefined) {
      if (Object.keys(hero.skills).length >= MAX_HERO_SKILLS) return refuse('skillsFull');
      draft.pendingSkillOffer = { heroId: hero.id, playerId: player.id, objectId: obj.id, skillId: effect.skillId };
      events.push({ type: 'SkillOffered', heroId: hero.id, playerId: player.id, objectId: obj.id, skillId: effect.skillId });
      return true;
    }
  } else if (effect.kind === 'grantWarMachine') {
    // Fabrique de machines de guerre (M-VISIT) : donne une machine de guerre au
    // héros. Idempotent — déjà possédée ⇒ visite consommée sans rien donner (0).
    if (!hero.warMachines.includes(effect.machineId)) {
      hero.warMachines.push(effect.machineId);
      amount = 1;
    }
  } else if (effect.kind === 'restoreMana') {
    // Puits de magie (M-VISIT) : restaure la mana à son maximum. `amount` = mana
    // réellement rendue (0 si déjà pleine ⇒ visite consommée sans gain).
    amount = Math.max(0, hero.manaMax - hero.mana);
    hero.mana = hero.manaMax;
  } else if (effect.kind === 'grantArtifact') {
    // Chariot / dépouille (M-VISIT) : donne un artefact. Même routage que le
    // ramassage au sol (movement.ts) — 1er slot équipé libre, sinon le SAC (le
    // sac n'a pas de plafond ⇒ toujours placé, amount = 1).
    grantArtifact(hero, draft.artifactCatalog, effect.artifactId);
    amount = 1;
  } else {
    player.resources[effect.resource as ResourceId] += effect.amount;
    amount = effect.amount;
  }

  consumeVisit(draft, hero, player, obj, amount, events);
  return false;
}

/** Marque la visite du héros (selon la fréquence du lieu) et émet `BonusVisited`. */
function consumeVisit(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  obj: VisitableObjectDef,
  amount: number,
  events: GameEvent[],
): void {
  const effect = obj.effect;
  obj.visits[hero.id] =
    obj.frequency === 'oncePerHero'
      ? -1
      : obj.frequency === 'oncePerHeroPerDay'
        ? draft.calendar.day
        : weekOf(draft.calendar.day);
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
 * Résout la proposition de cabane en attente (lot R3 ; humain via
 * `ResolveSkillOffer`, IA sur-le-champ) : accepter apprend la compétence au rang
 * 1 et consomme la visite ; refuser ne consomme rien (le héros pourra revenir).
 * No-op sans proposition.
 */
export function resolveSkillOffer(draft: GameState, accept: boolean, events: GameEvent[]): void {
  const offer = draft.pendingSkillOffer;
  if (!offer) return;
  delete draft.pendingSkillOffer;
  if (!accept) return;
  const hero = draft.heroes.find((h) => h.id === offer.heroId);
  const player = draft.players.find((p) => p.id === offer.playerId);
  const obj = draft.map?.objects.find((o) => o.id === offer.objectId);
  if (!hero || !player || !obj || obj.type !== 'visitable') return;
  hero.skills[offer.skillId] = 1;
  consumeVisit(draft, hero, player, obj, 1, events);
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
  if (!existing && hero.army.length >= heroArmyCap(hero)) return;
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
