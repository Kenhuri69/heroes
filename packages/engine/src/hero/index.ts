import { revealAround } from '../adventure/fog';
import { DIRECTIONS, samePos, type GridPos } from '../adventure/map';
import { isPassable } from '../adventure/path';
import { heroLuckOf, killsFromDamage, magicResistanceOf } from '../combat/damage';
import { combatRules, collectCasualties, recordLoss } from '../combat/state-helpers';
import { checkCombatEnd } from '../combat/turns';
import { hexDistance } from '../combat/hex';
import type { CombatState, CombatStack } from '../combat/types';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { GameState, HeroState } from '../core/state';
import type { TownState } from '../town/types';
import type { SpellKind } from './types';
import { heroVisionBonus } from './skills';
import {
  effectiveManaCost,
  effectivePower,
  spellDamageAmount,
  spellHealAmount,
  spellStatusDuration,
} from './spells';

/**
 * Points d'entrée héros (sorts en combat + choix de compétence) appelés par
 * `core/engine.ts` — signatures FIGÉES en cadrage (plan phase-3.2). Lot K :
 * implémentation ici (fichiers frères dans `hero/`), sans toucher aux
 * signatures ni à `core/`.
 */

type Draft = GameState;
type CastSpellCmd = Extract<Command, { type: 'CastSpell' }>;
type ChooseSkillCmd = Extract<Command, { type: 'ChooseSkill' }>;
type ChooseAttributeCmd = Extract<Command, { type: 'ChooseAttribute' }>;

/** Héros lié au camp joueur (`combat.playerSide`) — seul camp habilité à lancer un sort (décision plan #2). */
function heroForPlayerSide(state: GameState, combat: CombatState) {
  const heroId = combat.playerSide === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  return heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
}

export function validateCastSpell(state: GameState, cmd: CastSpellCmd): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const activeStack = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!activeStack || activeStack.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  const hero = heroForPlayerSide(state, combat);
  if (!hero) return { code: 'invalidAction', message: 'aucun héros lié au camp joueur' };
  if (combat.heroCastThisRound)
    return { code: 'heroAlreadyCast', message: 'le héros a déjà lancé un sort ce round' };
  const spell = state.spellCatalog[cmd.spellId];
  if (!spell) return { code: 'unknownSpell', message: `sort inconnu '${cmd.spellId}'` };
  if (!hero.spells.includes(cmd.spellId))
    return { code: 'spellNotKnown', message: `sort non appris '${cmd.spellId}'` };
  // A8 : un sort d'aventure (Ville-portail…) ne se lance JAMAIS en combat — il
  // passe par `CastAdventureSpell`. Sinon il posait un faux buff (mods 0) pour sa mana.
  if (spell.kind === 'adventure')
    return { code: 'invalidAction', message: `'${cmd.spellId}' est un sort d’aventure (hors combat)` };
  const manaCost = effectiveManaCost(hero, state.skillCatalog, spell);
  if (hero.mana < manaCost) return { code: 'notEnoughMana', message: 'mana insuffisante' };
  const target = combat.stacks.find((s) => s.id === cmd.targetStackId);
  if (!target || target.count <= 0)
    return { code: 'invalidTarget', message: `cible invalide '${cmd.targetStackId}'` };
  // Remédiation R1 : contrainte de camp selon la nature du sort — dégâts,
  // debuff et marque visent l'adverse ; soin et buff le camp du lanceur
  // (`combat.playerSide`). Interdit un dégât sur soi ou un buff sur l'ennemi.
  const targetsEnemy =
    spell.kind === 'damage' || spell.kind === 'debuff' || spell.kind === 'applyMarks';
  if (targetsEnemy !== (target.side !== combat.playerSide))
    return { code: 'invalidTarget', message: 'cible du mauvais camp pour ce sort' };
  return null;
}

export function validateChooseSkill(state: GameState, cmd: ChooseSkillCmd): CommandError | null {
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return { code: 'unknownHero', message: `héros inconnu '${cmd.heroId}'` };
  if (hero.pendingSkillChoices.length === 0)
    return { code: 'noPendingChoice', message: 'aucune proposition de compétence en attente' };
  if (!hero.pendingSkillChoices.includes(cmd.skillId))
    return { code: 'unknownSkill', message: `proposition inconnue '${cmd.skillId}'` };
  return null;
}

/** H-LEVELCHOICE (doc 02 §1.2) : le joueur choisit un attribut parmi la 1ʳᵉ paire en attente. */
export function validateChooseAttribute(state: GameState, cmd: ChooseAttributeCmd): CommandError | null {
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return { code: 'unknownHero', message: `héros inconnu '${cmd.heroId}'` };
  const pending = hero.pendingAttributeChoices[0];
  if (!pending) return { code: 'noPendingChoice', message: 'aucune proposition d’attribut en attente' };
  if (!pending.includes(cmd.attribute))
    return { code: 'invalidAttribute', message: `proposition inconnue '${cmd.attribute}'` };
  return null;
}

type CastAdventureSpellCmd = Extract<Command, { type: 'CastAdventureSpell' }>;

/** Villes possédées par le joueur (`townPortal` ne cible qu'une ville à soi). */
function ownedTowns(state: GameState, playerId: string): TownState[] {
  return state.towns.filter((t) => t.ownerPlayerId === playerId);
}

/**
 * B4 — tuile d'arrivée d'un `townPortal` sans superposer deux héros : la tuile de
 * la ville si elle est franchissable et libre, sinon la 1ʳᵉ voisine (8 dir)
 * franchissable et libre ; `null` si aucune (le portail avorte, cas extrême).
 */
function landingTileFor(draft: GameState, target: GridPos, heroId: string): GridPos | null {
  const map = draft.map;
  const config = draft.config;
  if (!map || !config) return null;
  const free = (p: GridPos): boolean =>
    isPassable(config, map, p) && !draft.heroes.some((h) => h.id !== heroId && samePos(h.pos, p));
  if (free(target)) return target;
  for (const d of DIRECTIONS) {
    const p = { x: target.x + d.x, y: target.y + d.y };
    if (free(p)) return p;
  }
  return null;
}

/** Ville possédée la plus proche du héros (distance de Tchebychev ; ordre stable). */
function nearestOwnedTown(state: GameState, hero: HeroState): TownState | undefined {
  let best: TownState | undefined;
  let bestDist = Infinity;
  for (const town of ownedTowns(state, hero.playerId)) {
    const d = Math.max(Math.abs(town.pos.x - hero.pos.x), Math.abs(town.pos.y - hero.pos.y));
    if (d < bestDist) {
      bestDist = d;
      best = town;
    }
  }
  return best;
}

/**
 * Sort d'aventure (doc 02 §1.4, Alpha 4.16) — lancé sur la CARTE, hors combat.
 * Exige : hors combat, joueur actif, héros à lui, sort connu ET de kind
 * `adventure`, mana suffisante. `townPortal` : le joueur doit posséder une ville
 * (celle ciblée si `townId`, sinon la plus proche).
 */
export function validateCastAdventureSpell(
  state: GameState,
  cmd: CastAdventureSpellCmd,
): CommandError | null {
  if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
  const current = state.players[state.currentPlayer];
  if (!current || current.id !== cmd.playerId)
    return { code: 'notYourTurn', message: `ce n’est pas le tour de ${cmd.playerId}` };
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return { code: 'unknownHero', message: `héros inconnu '${cmd.heroId}'` };
  if (hero.playerId !== cmd.playerId)
    return { code: 'notYourHero', message: `'${cmd.heroId}' n’appartient pas à ${cmd.playerId}` };
  const spell = state.spellCatalog[cmd.spellId];
  if (!spell) return { code: 'unknownSpell', message: `sort inconnu '${cmd.spellId}'` };
  if (!hero.spells.includes(cmd.spellId))
    return { code: 'spellNotKnown', message: `sort non appris '${cmd.spellId}'` };
  if (spell.kind !== 'adventure' || !spell.adventure)
    return { code: 'invalidAction', message: `'${cmd.spellId}' n’est pas un sort d’aventure` };
  if (hero.mana < spell.manaCost) return { code: 'notEnoughMana', message: 'mana insuffisante' };
  if (spell.adventure.type === 'townPortal') {
    if (cmd.townId !== undefined) {
      const town = state.towns.find((t) => t.id === cmd.townId);
      if (!town || town.ownerPlayerId !== cmd.playerId)
        return { code: 'invalidAction', message: `ville cible '${cmd.townId}' non possédée` };
    } else if (ownedTowns(state, cmd.playerId).length === 0) {
      return { code: 'invalidAction', message: 'aucune ville possédée où se téléporter' };
    }
  }
  return null;
}

export function handleCastAdventureSpell(
  draft: Draft,
  cmd: CastAdventureSpellCmd,
  events: GameEvent[],
): void {
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  const spell = draft.spellCatalog[cmd.spellId];
  const player = draft.players.find((p) => p.id === cmd.playerId);
  const map = draft.map;
  if (!hero || !spell || !spell.adventure || !player || !map) return; // exclu par validate

  hero.mana -= spell.manaCost;

  if (spell.adventure.type === 'townPortal') {
    const town = cmd.townId
      ? draft.towns.find((t) => t.id === cmd.townId)
      : nearestOwnedTown(draft, hero);
    // B4 : n'atterrit que sur une tuile libre (jamais deux héros superposés).
    const dest = town ? landingTileFor(draft, town.pos, hero.id) : null;
    if (dest) {
      hero.pos = { ...dest };
      revealAround(
        player.explored,
        map,
        hero.pos,
        (draft.config?.visionRadius ?? 0) + heroVisionBonus(hero, draft.skillCatalog),
      );
    }
  }

  events.push({ type: 'AdventureSpellCast', heroId: hero.id, spellId: spell.id, pos: { ...hero.pos } });
}

/**
 * Piles affectées par un sort (C7) : la cible seule, ou — pour un sort `splash`
 * (Boule de feu…) — la cible + les piles du MÊME camp qui lui sont adjacentes sur
 * la grille hex. Capturée AVANT toute mutation (une pile tuée est retirée ensuite).
 */
function spellTargets(combat: CombatState, area: 'splash' | undefined, center: CombatStack): CombatStack[] {
  if (area !== 'splash') return [center];
  return combat.stacks.filter(
    (s) => s.count > 0 && s.side === center.side && (s.id === center.id || hexDistance(s.pos, center.pos) === 1),
  );
}

/** Applique les dégâts d'un sort à UNE pile (kills, firstHp, bilan, mort) — retourne {amount, kills}. */
function damageOneStack(
  draft: Draft,
  combat: CombatState,
  target: CombatStack,
  amount: number,
  events: GameEvent[],
): { amount: number; kills: number } {
  const targetDef = draft.unitCatalog[target.unitId];
  if (!targetDef) return { amount: 0, kills: 0 };
  const pool = (target.count - 1) * targetDef.stats.hp + target.firstHp;
  const kills = killsFromDamage(pool, targetDef.stats.hp, target.count, amount);
  const remaining = Math.max(0, pool - amount);
  const newCount = target.count - kills;
  target.count = newCount;
  target.firstHp = newCount > 0 ? remaining - (newCount - 1) * targetDef.stats.hp : 0;
  recordLoss(combat, target.side, target.unitId, kills);
  if (target.count <= 0) {
    events.push({ type: 'StackDied', stackId: target.id });
    const idx = combat.stacks.findIndex((s) => s.id === target.id);
    if (idx !== -1) combat.stacks.splice(idx, 1);
  }
  return { amount, kills };
}

export function handleCastSpell(draft: Draft, cmd: CastSpellCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return; // exclu par validate
  const hero = heroForPlayerSide(draft, combat);
  const spell = draft.spellCatalog[cmd.spellId];
  const target = combat.stacks.find((s) => s.id === cmd.targetStackId);
  if (!hero || !spell || !target) return; // exclu par validate

  hero.mana -= effectiveManaCost(hero, draft.skillCatalog, spell);
  combat.heroCastThisRound = true;
  const power = effectivePower(hero, draft.artifactCatalog);
  // C7 : liste des piles affectées (cible seule, ou cible + adjacentes en `splash`).
  const targets = spellTargets(combat, spell.area, target);

  let amount = 0;
  let kills = 0;

  if (spell.kind === 'damage') {
    const luck = heroLuckOf(draft, combat, combat.playerSide);
    const rules = combatRules(draft);
    const luckRoll = rollRange(draft.rng, 0, 99);
    draft.rng = luckRoll.state;
    const lucky = luckRoll.value < Math.round(rules.luckChancePerPoint * luck * 100);
    for (const t of targets) {
      const def = draft.unitCatalog[t.unitId];
      if (!def) continue;
      // Résistance à la magie (doc 05 §4) + amplification par la Marque (D10),
      // évaluées PAR pile affectée. Chance (luck) tirée une fois pour le sort.
      const dmg = spellDamageAmount(
        spell,
        power,
        lucky,
        magicResistanceOf(def, t.transformed),
        rules.markBonusPerStack * t.marks,
      );
      const r = damageOneStack(draft, combat, t, dmg, events);
      amount += r.amount;
      kills += r.kills;
    }
  } else if (spell.kind === 'heal') {
    for (const t of targets) {
      const def = draft.unitCatalog[t.unitId];
      if (!def) continue;
      const heal = spellHealAmount(spell, power);
      // Plafond de soin approximé par l'effectif courant + pertes déjà
      // enregistrées (décision plan #3) — évalué par pile.
      const lostSoFar =
        collectCasualties(combat).find((c) => c.side === t.side && c.unitId === t.unitId)?.lost ?? 0;
      const maxCount = t.count + lostSoFar;
      const currentPool = (t.count - 1) * def.stats.hp + t.firstHp;
      const newPool = Math.min(maxCount * def.stats.hp, currentPool + heal);
      const newCount = Math.min(maxCount, Math.max(1, Math.ceil(newPool / def.stats.hp)));
      t.count = newCount;
      t.firstHp = newPool - (newCount - 1) * def.stats.hp;
      amount += heal;
    }
  } else if (spell.kind === 'applyMarks') {
    const marksMax = combatRules(draft).marksMax;
    for (const t of targets) {
      const before = t.marks;
      t.marks = Math.min(marksMax, t.marks + (spell.marks ?? 0));
      const posed = t.marks - before;
      amount += posed;
      if (posed > 0) events.push({ type: 'MarkApplied', targetId: t.id, marks: t.marks });
    }
  } else {
    // buff / debuff (doc 02 §1.4) : statut temporaire sur chaque pile affectée.
    for (const t of targets) {
      t.statuses.push({
        spellId: spell.id,
        attackMod: spell.attackMod ?? 0,
        defenseMod: spell.defenseMod ?? 0,
        speedMod: spell.speedMod ?? 0,
        damageDealtMod: 0, // les sorts actuels ne modulent pas les dégâts infligés (A2c)
        roundsLeft: spellStatusDuration(power),
      });
    }
  }

  events.push({
    type: 'SpellCast',
    heroId: hero.id,
    spellId: spell.id,
    targetId: cmd.targetStackId,
    amount,
    kills,
  });

  // Un sort de dégâts peut achever le dernier défenseur adverse : le combat
  // doit se terminer immédiatement, comme après une frappe (`applyAction`).
  checkCombatEnd(draft, events);
}

export function handleChooseSkill(draft: Draft, cmd: ChooseSkillCmd, events: GameEvent[]): void {
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return; // exclu par validate
  const current = hero.skills[cmd.skillId];
  const rank = current !== undefined ? Math.min(3, current + 1) : 1;
  hero.skills[cmd.skillId] = rank;
  hero.pendingSkillChoices = [];
  events.push({ type: 'SkillLearned', heroId: hero.id, skillId: cmd.skillId, rank });
}

export function handleChooseAttribute(draft: Draft, cmd: ChooseAttributeCmd, events: GameEvent[]): void {
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return; // exclu par validate
  hero.attributes[cmd.attribute] += 1;
  hero.pendingAttributeChoices.shift(); // défile (H-LEVELCHOICE : file, pas écrasement)
  events.push({ type: 'HeroAttributeChosen', heroId: hero.id, level: hero.level, attribute: cmd.attribute });
}

/**
 * Estimation min/max d'un sort SANS RNG (doc 08 §2.4) — prévisualisation
 * obligatoire, utilisée par l'UI et l'IA future.
 */
export interface SpellEstimate {
  amount: number;
  kills: number;
  /** `adventure` inclus par exhaustivité du type — un sort d'aventure ne se lance jamais en combat. */
  kind: SpellKind;
}

export function estimateSpell(
  state: GameState,
  spellId: string,
  targetStackId: string,
): SpellEstimate {
  const combat = state.combat;
  if (!combat) throw new Error('estimateSpell: aucun combat en cours');
  const spell = state.spellCatalog[spellId];
  if (!spell) throw new Error(`estimateSpell: sort inconnu '${spellId}'`);
  const target = combat.stacks.find((s) => s.id === targetStackId);
  if (!target) throw new Error(`estimateSpell: cible introuvable '${targetStackId}'`);
  const hero = heroForPlayerSide(state, combat);
  const power = hero ? effectivePower(hero, state.artifactCatalog) : 0;

  // C7 : la préviz agrège la zone d'effet (cible + adjacentes en `splash`).
  const affected = spellTargets(combat, spell.area, target);

  if (spell.kind === 'damage') {
    let amount = 0;
    let kills = 0;
    for (const t of affected) {
      const def = state.unitCatalog[t.unitId];
      if (!def) continue;
      // D10 : la Marque amplifie les dégâts de sort — la préviz reflète le même bonus.
      const markBonus = (state.config?.combat.markBonusPerStack ?? 0) * t.marks;
      const dmg = spellDamageAmount(spell, power, false, magicResistanceOf(def, t.transformed), markBonus);
      const pool = (t.count - 1) * def.stats.hp + t.firstHp;
      amount += dmg;
      kills += killsFromDamage(pool, def.stats.hp, t.count, dmg);
    }
    return { amount, kills, kind: 'damage' };
  }
  if (spell.kind === 'heal') {
    return { amount: spellHealAmount(spell, power) * affected.length, kills: 0, kind: 'heal' };
  }
  return { amount: 0, kills: 0, kind: spell.kind };
}
