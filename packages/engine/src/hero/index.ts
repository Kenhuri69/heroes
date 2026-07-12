import { revealAround } from '../adventure/fog';
import { DIRECTIONS, samePos, type GridPos } from '../adventure/map';
import { isPassable } from '../adventure/path';
import { heroLuckOf, killsFromDamage, magicResistanceOf } from '../combat/damage';
import { checkCombatEnd } from '../combat/turns';
import { applySpellToTargets, spellTargets } from '../combat/spell-effect';
import type { CombatState } from '../combat/types';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import type { TownState } from '../town/types';
import type { SpellKind } from './types';
import { heroVisionBonus } from './skills';
import { effectiveManaCost, effectivePower, spellDamageAmount, spellHealAmount, spellTargetsEnemy } from './spells';

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

/** Héros lié à un camp du combat — `undefined` si le camp n'a pas de héros. */
function heroForSide(state: GameState, combat: CombatState, side: CombatState['playerSide']) {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  return heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
}

/** Héros lié au camp joueur — la COMMANDE `CastSpell` reste joueur-only ; l'IA passe par `castHeroSpell`. */
function heroForPlayerSide(state: GameState, combat: CombatState) {
  return heroForSide(state, combat, combat.playerSide);
}

export function validateCastSpell(state: GameState, cmd: CastSpellCmd): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const activeStack = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!activeStack || activeStack.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  const hero = heroForPlayerSide(state, combat);
  if (!hero) return { code: 'invalidAction', message: 'aucun héros lié au camp joueur' };
  if (combat.heroCastThisRound.includes(combat.playerSide))
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
  // F-SCHOOLS.7 : un sort offensif ne peut viser une pile ennemie furtive.
  if (spellTargetsEnemy(spell.kind) && target.stealthed)
    return { code: 'invalidTarget', message: 'cible furtive' };
  // Remédiation R1 : contrainte de camp selon la nature du sort — dégâts,
  // debuff, marque et silence visent l'adverse ; soin et buff le camp du lanceur
  // (`combat.playerSide`). Interdit un dégât sur soi ou un buff sur l'ennemi.
  if (spellTargetsEnemy(spell.kind) !== (target.side !== combat.playerSide))
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
 * Lancer du sort du héros d'un CAMP (C-AIPARITY, doc 02 §5.5) — cœur partagé
 * joueur/IA : mana débitée, verrou 1/round par camp, effet via le même
 * `applySpellToTargets` que le lancer d'unité. Les validations de la COMMANDE
 * `CastSpell` restent joueur-only ; l'appelant IA garantit ses préconditions
 * (héros présent, mana suffisante, cible du bon camp).
 */
export function castHeroSpell(
  draft: Draft,
  side: CombatState['playerSide'],
  spellId: string,
  targetStackId: string,
  events: GameEvent[],
): void {
  const combat = draft.combat;
  if (!combat) return;
  const hero = heroForSide(draft, combat, side);
  const spell = draft.spellCatalog[spellId];
  const target = combat.stacks.find((s) => s.id === targetStackId);
  if (!hero || !spell || !target) return;

  hero.mana -= effectiveManaCost(hero, draft.skillCatalog, spell);
  combat.heroCastThisRound.push(side);
  const power = effectivePower(hero, draft.artifactCatalog);
  const luck = heroLuckOf(draft, combat, side);
  // C7 : effet appliqué à la cible (+ alliées adjacentes en `splash`) via le
  // cœur PARTAGÉ avec le lancer d'unité `spellcaster` (A2h, combat/spell-effect).
  const { amount, kills } = applySpellToTargets(draft, combat, spell, target, power, luck, events);

  events.push({
    type: 'SpellCast',
    heroId: hero.id,
    spellId: spell.id,
    targetId: targetStackId,
    amount,
    kills,
  });

  // Un sort de dégâts peut achever le dernier défenseur adverse : le combat
  // doit se terminer immédiatement, comme après une frappe (`applyAction`).
  checkCombatEnd(draft, events);
}

export function handleCastSpell(draft: Draft, cmd: CastSpellCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return; // exclu par validate
  castHeroSpell(draft, combat.playerSide, cmd.spellId, cmd.targetStackId, events);
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

type ReorderArmyCmd = Extract<Command, { type: 'ReorderArmy' }>;

/**
 * UX-REORDER (doc 08 §2.1/§2.3) : réordonne l'armée du héros du joueur ACTIF.
 * L'ordre des slots pèse sur le placement de combat (`combat/setup.ts`), c'est
 * donc une commande moteur déterministe et non de la simple présentation.
 * Aucun événement dédié (surface figée `events.ts`) : le rendu observe `army`.
 */
export function validateReorderArmy(state: GameState, cmd: ReorderArmyCmd): CommandError | null {
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return { code: 'unknownHero', message: `héros inconnu '${cmd.heroId}'` };
  const current = state.players[state.currentPlayer];
  if (!current || hero.playerId !== current.id)
    return { code: 'notYourHero', message: `'${cmd.heroId}' n’appartient pas au joueur actif` };
  const n = hero.army.length;
  const valid = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < n;
  if (!valid(cmd.from) || !valid(cmd.to))
    return { code: 'invalidReorder', message: `indices hors de l'armée (${cmd.from}→${cmd.to})` };
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- pas d'événement dédié (surface figée events.ts)
export function handleReorderArmy(draft: Draft, cmd: ReorderArmyCmd, events: GameEvent[]): void {
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return; // exclu par validate
  const [moved] = hero.army.splice(cmd.from, 1);
  if (moved) hero.army.splice(cmd.to, 0, moved);
}

type SplitStackCmd = Extract<Command, { type: 'SplitStack' }>;

const MAX_ARMY_STACKS = 7;

/**
 * UX-SPLIT (doc 08 §2.1/§2.3) : sépare une pile de l'armée du héros du joueur
 * ACTIF en deux, la nouvelle pile étant ajoutée en fin d'`army` (compact ≤ 7).
 * Commande moteur déterministe (l'ordre/nombre de piles pèse sur le combat).
 * Aucun événement dédié (surface figée `events.ts`) : le rendu observe `army`.
 */
export function validateSplitStack(state: GameState, cmd: SplitStackCmd): CommandError | null {
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return { code: 'unknownHero', message: `héros inconnu '${cmd.heroId}'` };
  const current = state.players[state.currentPlayer];
  if (!current || hero.playerId !== current.id)
    return { code: 'notYourHero', message: `'${cmd.heroId}' n’appartient pas au joueur actif` };
  if (hero.army.length >= MAX_ARMY_STACKS)
    return { code: 'invalidSplit', message: 'armée pleine (7 piles max)' };
  if (!Number.isInteger(cmd.from) || cmd.from < 0 || cmd.from >= hero.army.length)
    return { code: 'invalidSplit', message: `pile source invalide (${cmd.from})` };
  const source = hero.army[cmd.from];
  if (!source) return { code: 'invalidSplit', message: `pile source invalide (${cmd.from})` };
  if (!Number.isInteger(cmd.count) || cmd.count < 1 || cmd.count >= source.count)
    return { code: 'invalidSplit', message: `quantité de séparation invalide (${cmd.count})` };
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- pas d'événement dédié (surface figée events.ts)
export function handleSplitStack(draft: Draft, cmd: SplitStackCmd, events: GameEvent[]): void {
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return; // exclu par validate
  const source = hero.army[cmd.from];
  if (!source) return; // exclu par validate
  source.count -= cmd.count;
  hero.army.push({ unitId: source.unitId, count: cmd.count });
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
      // F-SCHOOLS.3 : un sort mange-Marques ajoute `marksDamagePct`%/charge.
      const consumeBonus = spell.marksDamagePct ? (spell.marksDamagePct / 100) * t.marks : 0;
      const markBonus = (state.config?.combat.markBonusPerStack ?? 0) * t.marks + consumeBonus;
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
