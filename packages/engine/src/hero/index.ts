import { revealAround } from '../adventure/fog';
import { DIRECTIONS, samePos, type GridPos } from '../adventure/map';
import { isPassable } from '../adventure/path';
import { heroLuckOf, killsFromDamage, magicResistanceOf } from '../combat/damage';
import { checkCombatEnd } from '../combat/turns';
import { applySpellToTargets, chainTargets, spellTargets, spellcasterParams } from '../combat/spell-effect';
import { factionCurseDurationBonus, factionSpellDamageMods, isSpellImmune, staticBlockedKeys } from '../combat/state-helpers';
import {
  COMBAT_COLS,
  COMBAT_ROWS,
  hexDistance,
  inCombatBounds,
  sameHex,
  type OffsetPos,
} from '../combat/hex';
import type { CombatState } from '../combat/types';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';
import type { TownState } from '../town/types';
import type { SpellKind } from './types';
import { heroKnownSpellIds } from './artifacts';
import { heroVisionRadius } from './skills';
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
  // H-ARTEQUIP.2 : un sort enseigné par un artefact équipé est castable comme un
  // sort appris (union `hero.spells` ∪ artefacts).
  if (!heroKnownSpellIds(hero, state.artifactCatalog).includes(cmd.spellId))
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
  // CAP-SPELLIMMUNE : ni une pile ennemie immunisée aux sorts.
  if (spellTargetsEnemy(spell.kind) && isSpellImmune(state.unitCatalog, target.unitId))
    return { code: 'invalidTarget', message: 'cible immunisée aux sorts' };
  // Remédiation R1 : contrainte de camp selon la nature du sort — dégâts,
  // debuff, marque et silence visent l'adverse ; soin et buff le camp du lanceur
  // (`combat.playerSide`). Interdit un dégât sur soi ou un buff sur l'ennemi.
  if (spellTargetsEnemy(spell.kind) !== (target.side !== combat.playerSide))
    return { code: 'invalidTarget', message: 'cible du mauvais camp pour ce sort' };
  // F-SCHOOLS.8 (Pas de Brume) : un sort de téléportation exige une destination
  // valide (case du plateau libre à portée de la pile ciblée).
  if (spell.kind === 'teleport') {
    if (!cmd.targetHex) return { code: 'invalidTarget', message: 'destination de téléportation requise' };
    const hex = cmd.targetHex;
    if (!teleportDestinations(state, cmd.spellId, cmd.targetStackId).some((p) => sameHex(p, hex)))
      return { code: 'invalidTarget', message: 'destination de téléportation invalide' };
  }
  return null;
}

/**
 * F-SCHOOLS.8 : cases où une pile alliée peut être téléportée par `spellId`
 * (`kind: 'teleport'`) — pure, déterministe (patron `reachableHexes`). Portée =
 * `base + perPower × Pouvoir` du héros joueur. La destination doit être DANS le
 * plateau, hors obstacle et libre de toute pile ; la téléportation ignore ce
 * qu'il y a ENTRE (seule la case d'arrivée compte). Partagée validation + UI.
 */
export function teleportDestinations(state: GameState, spellId: string, targetStackId: string): OffsetPos[] {
  const combat = state.combat;
  if (!combat) return [];
  const spell = state.spellCatalog[spellId];
  const target = combat.stacks.find((s) => s.id === targetStackId);
  if (!spell || spell.kind !== 'teleport' || !target || target.count <= 0) return [];
  const hero = heroForPlayerSide(state, combat);
  const power = hero ? effectivePower(hero, state.artifactCatalog) : 0;
  const range = spell.base + spell.perPower * power;
  // C-SIEGE2 : on ne peut pas téléporter sur un obstacle, un mur ni une pile.
  const blocked = staticBlockedKeys(combat);
  for (const s of combat.stacks) if (s.count > 0) blocked.add(`${s.pos.col},${s.pos.row}`);
  const out: OffsetPos[] = [];
  for (let col = 0; col < COMBAT_COLS; col++) {
    for (let row = 0; row < COMBAT_ROWS; row++) {
      const p = { col, row };
      if (!inCombatBounds(p) || blocked.has(`${col},${row}`)) continue;
      if (hexDistance(target.pos, p) > range) continue;
      out.push(p);
    }
  }
  return out;
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
  // H-ARTEQUIP.2 : un sort d'aventure enseigné par un artefact équipé est castable.
  if (!heroKnownSpellIds(hero, state.artifactCatalog).includes(cmd.spellId))
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
        heroVisionRadius(hero, draft.config?.visionRadius ?? 0, draft.skillCatalog, draft.artifactCatalog),
      );
    }
  } else if (spell.adventure.type === 'vision') {
    // H-SPELLS.3 : ouvre le brouillard dans un large rayon autour du héros (sans
    // le déplacer). Le rayon est porté par la donnée du sort.
    revealAround(player.explored, map, hero.pos, spell.adventure.radius);
  } else if (spell.adventure.type === 'movementBonus') {
    // H-SPELLS (Marche forcée) : ajoute des PM immédiats (sans déplacer le héros).
    hero.movementPoints += spell.adventure.amount;
  } else if (spell.adventure.type === 'revealMap') {
    // H-SPELLS (Cartographie) : révèle TOUT le brouillard — un rayon égal à la
    // dimension de la carte couvre toute la grille depuis n'importe quelle case.
    revealAround(player.explored, map, hero.pos, Math.max(map.width, map.height));
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
  targetHex?: OffsetPos,
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

  let amount = 0;
  let kills = 0;
  if (spell.kind === 'teleport') {
    // F-SCHOOLS.8 (Pas de Brume) : déplace instantanément la pile alliée ciblée
    // vers `targetHex` (validé). Réutilise `StackMoved` (le client anime déjà) ;
    // un repositionnement rompt l'enracinement de Symbiose (comme un déplacement).
    if (targetHex) {
      const from = { ...target.pos };
      target.pos = { ...targetHex };
      target.symbiosisStacks = 0;
      events.push({ type: 'StackMoved', stackId: target.id, from, to: { ...targetHex } });
    }
  } else {
    const luck = heroLuckOf(draft, combat, side);
    // F-BONUS (Fléau persistant, doc 04 §2) : un sort de MALÉDICTION (`debuff`)
    // d'un héros doté dure +N rounds — bonus par-faction calculé ici, passé comme
    // simple nombre au cœur partagé (qui ignore toute notion de faction).
    const durationBonus = spell.kind === 'debuff' ? factionCurseDurationBonus(draft, hero) : 0;
    // Magie Irrésistible (doc 17 §2) : mods de dégâts de la faction du héros —
    // calculés ici, passés comme données au cœur partagé (qui ignore la faction).
    // Bornés au sort de dégâts (no-op {0,0} pour les autres kinds via le helper).
    const damageMods = spell.kind === 'damage' ? factionSpellDamageMods(draft, hero) : { bonusPct: 0, resistancePierce: 0 };
    // C7 : effet appliqué à la cible (+ alliées adjacentes en `splash`) via le
    // cœur PARTAGÉ avec le lancer d'unité `spellcaster` (A2h, combat/spell-effect).
    ({ amount, kills } = applySpellToTargets(draft, combat, spell, target, power, luck, events, durationBonus, damageMods));
  }

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
  castHeroSpell(draft, combat.playerSide, cmd.spellId, cmd.targetStackId, events, cmd.targetHex);
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
  // Magie Irrésistible (doc 17 §2) : la préviz héros reflète les mods de dégâts
  // de la faction (le sort d'unité `spellcaster` passe par le défaut {0,0}).
  return estimateSpellWithPower(state, spellId, targetStackId, power, factionSpellDamageMods(state, hero));
}

/**
 * CAP-CAST : préviz du sort EMBARQUÉ d'une pile `spellcaster` (A2h) jouée à la
 * main — mêmes maths que le sort de héros mais le **Pouvoir** vient de la
 * capacité (les unités n'ont pas d'attribut Pouvoir), comme à la résolution
 * (`applyCastSpell`). Le client l'utilise pour la préviz obligatoire (doc 08 §2.4).
 */
export function estimateUnitSpell(
  state: GameState,
  casterStackId: string,
  targetStackId: string,
): SpellEstimate {
  const combat = state.combat;
  if (!combat) throw new Error('estimateUnitSpell: aucun combat en cours');
  const caster = combat.stacks.find((s) => s.id === casterStackId);
  const def = caster ? state.unitCatalog[caster.unitId] : undefined;
  const params = def ? spellcasterParams(def) : null;
  if (!params) throw new Error(`estimateUnitSpell: pile non lanceuse '${casterStackId}'`);
  return estimateSpellWithPower(state, params.spellId, targetStackId, params.power);
}

/** Cœur partagé de l'estimation : `power` explicite (héros ou capacité d'unité). */
function estimateSpellWithPower(
  state: GameState,
  spellId: string,
  targetStackId: string,
  power: number,
  /** Magie Irrésistible (doc 17 §2) — mods de dégâts du héros ; {0,0} pour une unité. */
  damageMods: { bonusPct: number; resistancePierce: number } = { bonusPct: 0, resistancePierce: 0 },
): SpellEstimate {
  const combat = state.combat;
  if (!combat) throw new Error('estimateSpell: aucun combat en cours');
  const spell = state.spellCatalog[spellId];
  if (!spell) throw new Error(`estimateSpell: sort inconnu '${spellId}'`);
  const target = combat.stacks.find((s) => s.id === targetStackId);
  if (!target) throw new Error(`estimateSpell: cible introuvable '${targetStackId}'`);

  // C7 : la préviz agrège la zone d'effet (cible + adjacentes en `splash`).
  const affected = spellTargets(combat, spell.area, target);

  if (spell.kind === 'damage') {
    let amount = 0;
    let kills = 0;
    // H-SPELLS.4 (chaîne) : la préviz agrège la cible + les rebonds décroissants.
    const hits = spell.chain
      ? chainTargets(combat, target, spell.chain.jumps).map((t, i) => ({
          t,
          mult: Math.pow(1 - spell.chain!.falloffPct / 100, i),
        }))
      : affected.map((t) => ({ t, mult: 1 }));
    for (const { t, mult } of hits) {
      const def = state.unitCatalog[t.unitId];
      if (!def) continue;
      // D10 : la Marque amplifie les dégâts de sort — la préviz reflète le même bonus.
      // F-SCHOOLS.3 : un sort mange-Marques ajoute `marksDamagePct`%/charge.
      const consumeBonus = spell.marksDamagePct ? (spell.marksDamagePct / 100) * t.marks : 0;
      const markBonus = (state.config?.combat.markBonusPerStack ?? 0) * t.marks + consumeBonus;
      // Magie Irrésistible (doc 17 §2) : mêmes maths qu'à la résolution.
      const resistance = Math.max(0, magicResistanceOf(def, t.transformed) - damageMods.resistancePierce);
      const dmg = Math.round(
        spellDamageAmount(spell, power, false, resistance, markBonus) * mult * (1 + damageMods.bonusPct),
      );
      const pool = (t.count - 1) * def.stats.hp + t.firstHp;
      amount += dmg;
      kills += killsFromDamage(pool, def.stats.hp, t.count, dmg);
    }
    return { amount, kills, kind: 'damage' };
  }
  if (spell.kind === 'heal') {
    return { amount: spellHealAmount(spell, power) * affected.length, kills: 0, kind: 'heal' };
  }
  // H-SPELLS.4 (Dissipation) : la préviz annonce le nombre de statuts à retirer.
  if (spell.kind === 'dispel') {
    return { amount: affected.reduce((n, t) => n + t.statuses.length, 0), kills: 0, kind: 'dispel' };
  }
  return { amount: 0, kills: 0, kind: spell.kind };
}
